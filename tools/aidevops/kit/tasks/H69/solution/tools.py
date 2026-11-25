import re

MAX_ITEMS = 200
PER_PAGE = 100
DESCRIPTION_LIMIT = 1000
DATE = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"

TOOLS = [
    {
        "name": "gitlab_list_open_mrs",
        "access": "read",
        "description": "Открытые MR проекта, старые сверху: iid, title, updated_at, draft, detailed_merge_status. Без описаний и diff.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "integer", "minimum": 1},
                "updated_before": {"type": "string", "pattern": DATE},
            },
            "required": ["project_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "gitlab_get_mr",
        "access": "read",
        "description": "Один MR: описание и head_pipeline. Только для MR, отобранных по сводке из списка.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "integer", "minimum": 1},
                "iid": {"type": "integer", "minimum": 1},
                "response_format": {"type": "string", "enum": ["concise", "detailed"]},
            },
            "required": ["project_id", "iid"],
            "additionalProperties": False,
        },
    },
    {
        "name": "gitlab_list_failed_jobs",
        "access": "read",
        "description": "Упавшие jobs одного пайплайна: name, stage, failure_reason. Логи job не возвращаются.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "integer", "minimum": 1},
                "pipeline_id": {"type": "integer", "minimum": 1},
            },
            "required": ["project_id", "pipeline_id"],
            "additionalProperties": False,
        },
    },
]
BY_NAME = {t["name"]: t for t in TOOLS}


def _type_ok(kind, value):
    if kind == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if kind == "string":
        return isinstance(value, str)
    return False


def validate_args(schema, args):
    if not isinstance(args, dict):
        return ["args должен быть объектом"]
    props = schema["properties"]
    errors = ["нет поля %s" % name for name in schema.get("required", []) if name not in args]
    for name, value in args.items():
        rule = props.get(name)
        if rule is None:
            errors.append("лишнее поле %s" % name)
            continue
        if not _type_ok(rule["type"], value):
            errors.append("%s: нужен %s" % (name, rule["type"]))
            continue
        if "minimum" in rule and value < rule["minimum"]:
            errors.append("%s: меньше %s" % (name, rule["minimum"]))
        if "enum" in rule and value not in rule["enum"]:
            errors.append("%s: одно из %s" % (name, ", ".join(rule["enum"])))
        if "pattern" in rule and not re.match(rule["pattern"], value):
            errors.append("%s: формат %s" % (name, rule["pattern"]))
    return errors


def _mr_summary(mr):
    return {
        "iid": mr["iid"],
        "title": mr["title"],
        "updated_at": mr["updated_at"],
        "draft": bool(mr.get("draft")),
        "detailed_merge_status": mr.get("detailed_merge_status"),
    }


def call(name, args, api):
    tool = BY_NAME.get(name)
    if tool is None:
        raise PermissionError("unknown tool: %s" % name)
    errors = validate_args(tool["input_schema"], args)
    if errors:
        raise ValueError("; ".join(errors))
    pid = args["project_id"]

    if name == "gitlab_list_open_mrs":
        items, page = [], 1
        while page and len(items) < MAX_ITEMS:
            body, headers = api.get("/projects/%d/merge_requests" % pid, {
                "state": "opened", "order_by": "updated_at", "sort": "asc",
                "per_page": PER_PAGE, "page": page,
            })
            items.extend(body)
            page = int(headers.get("x-next-page") or 0)
        truncated = bool(page) or len(items) > MAX_ITEMS
        items = items[:MAX_ITEMS]
        if "updated_before" in args:
            items = [mr for mr in items if mr["updated_at"] < args["updated_before"]]
        return {"items": [_mr_summary(mr) for mr in items], "truncated": truncated}

    if name == "gitlab_get_mr":
        mr, _ = api.get("/projects/%d/merge_requests/%d" % (pid, args["iid"]), {})
        pipeline = mr.get("head_pipeline") or None
        out = _mr_summary(mr)
        out["head_pipeline"] = {"id": pipeline["id"], "status": pipeline["status"]} if pipeline else None
        description = mr.get("description") or ""
        if args.get("response_format", "concise") == "concise":
            description = description[:DESCRIPTION_LIMIT]
        else:
            out["web_url"] = mr.get("web_url")
            out["author"] = (mr.get("author") or {}).get("username")
        out["description"] = description
        return out

    body, _ = api.get("/projects/%d/pipelines/%d/jobs" % (pid, args["pipeline_id"]),
                      {"scope[]": "failed", "per_page": PER_PAGE})
    return {"items": [{"name": j["name"], "stage": j["stage"], "failure_reason": j.get("failure_reason")} for j in body]}
