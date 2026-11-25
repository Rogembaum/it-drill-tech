from datetime import datetime, timedelta

READ_TOOLS = {"gitlab_list_open_mrs", "gitlab_get_mr", "gitlab_list_failed_jobs"}
WRITE_TOOLS = {"gitlab_merge_mr", "gitlab_close_mr", "gitlab_post_comment", "gitlab_delete_project"}
BLOCKING = {"ci_must_pass", "conflict", "need_rebase"}
SEVERITY = {"info", "warn", "crit"}
ACTIONS = {"tool", "finish"}
STALE_DAYS = 14
MAX_MISTOOLS = 2


def _ts(value):
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")


def should_open(mr, now):
    if mr.get("detailed_merge_status") in BLOCKING:
        return True
    return _ts(now) - _ts(mr["updated_at"]) >= timedelta(days=STALE_DAYS)


def validate(payload):
    if not isinstance(payload, dict):
        return ["ответ должен быть JSON-объектом"]
    if payload.get("refusal"):
        return []
    errors = []
    if payload.get("finish_reason") == "length":
        errors.append("ответ обрезан по max_tokens")
    action = payload.get("action")
    if action not in ACTIONS:
        errors.append("action: одно из finish, tool")
    if action == "tool":
        if not isinstance(payload.get("tool"), str):
            errors.append("tool: нужна строка")
        if not isinstance(payload.get("args"), dict):
            errors.append("args: нужен объект")
    findings = payload.get("findings", [])
    if not isinstance(findings, list):
        return errors + ["findings: нужен список"]
    for i, f in enumerate(findings):
        if not isinstance(f, dict):
            errors.append("findings[%d]: нужен объект" % i)
            continue
        if f.get("severity") not in SEVERITY:
            errors.append("findings[%d].severity: одно из crit, info, warn" % i)
        for field in ("project_id", "kind", "object_id", "evidence"):
            if f.get(field) in (None, ""):
                errors.append("findings[%d].%s: обязательное поле" % (i, field))
    return errors


def _key(f):
    return (f["project_id"], f["kind"], str(f["object_id"]))


def _ungrounded(findings, seen):
    return ["findings[%d]: %s/%s не встречался в ответах инструментов" % (i, f["project_id"], f["object_id"])
            for i, f in enumerate(findings) if (f["project_id"], str(f["object_id"])) not in seen]


def _remember(seen, listed, name, args, data):
    pid = args.get("project_id")
    if name == "gitlab_list_open_mrs":
        for mr in data.get("items", []):
            seen.add((pid, str(mr["iid"])))
            listed[(pid, mr["iid"])] = mr
    elif name == "gitlab_get_mr" and data.get("head_pipeline"):
        seen.add((pid, str(data["head_pipeline"]["id"])))


def run(model, tools, now, max_steps=10, max_repairs=1):
    state = {"status": "acting", "stop_reason": None, "findings": [], "calls": [], "trace": []}
    seen, listed, keys = set(), {}, set()
    view = {"observation": None, "error": None, "findings": []}
    repairs = mistools = steps = 0

    def stop(status, reason):
        state["status"], state["stop_reason"] = status, reason
        state["trace"].append({"event": "stop", "status": status, "reason": reason})
        return state

    while True:
        if steps >= max_steps:
            return stop("aborted", "budget_steps")
        raw = model(view)
        if isinstance(raw, dict) and raw.get("refusal"):
            return stop("aborted", "refusal")
        errors = validate(raw)
        if not errors:
            errors = _ungrounded(raw.get("findings", []), seen)
        if errors:
            if repairs >= max_repairs:
                return stop("aborted", "invalid_output")
            repairs += 1
            state["trace"].append({"event": "repair", "errors": errors})
            view = {"observation": None, "error": "; ".join(errors), "rejected": raw, "findings": state["findings"]}
            continue
        repairs = 0
        steps += 1
        for f in raw.get("findings", []):
            if _key(f) not in keys:
                keys.add(_key(f))
                state["findings"].append(f)

        if raw["action"] == "finish":
            return stop("done", "finished")

        name, args = raw["tool"], raw["args"]
        if name in WRITE_TOOLS:
            state["trace"].append({"event": "guardrail", "tool": name})
            return stop("waiting_hitl", "write_requires_approval")
        if name not in READ_TOOLS:
            mistools += 1
            if mistools >= MAX_MISTOOLS:
                return stop("aborted", "mistool")
            view = {"observation": None, "error": "unknown_tool: %s" % name, "findings": state["findings"]}
            continue
        if name == "gitlab_get_mr":
            mr = listed.get((args.get("project_id"), args.get("iid")))
            if mr is None or not should_open(mr, now):
                state["trace"].append({"event": "reading_policy", "args": args})
                view = {"observation": None, "error": "reading_policy: MR не отобран по сводке", "findings": state["findings"]}
                continue

        state["calls"].append({"tool": name, "args": args})
        try:
            data = tools(name, args)
        except ValueError as exc:
            view = {"observation": None, "error": "bad_args: %s" % exc, "findings": state["findings"]}
            continue
        _remember(seen, listed, name, args, data)
        view = {"observation": {"tool": name, "args": args, "untrusted": True, "data": data},
                "error": None, "findings": state["findings"]}
