import copy

SEV = {"info": 0, "warn": 1, "crit": 2}
STATIC = {"mr": "mrs", "pipeline": "pipelines", "security": "security"}
FALLBACK = "supervisor"


def should_split(p):
    if p.get("shared_context"):
        return {"split": False, "reason": "tight_coupling"}
    if p.get("parallel_subtasks", 0) < 2:
        return {"split": False, "reason": "nothing_to_parallelize"}
    if p.get("value") != "high":
        return {"split": False, "reason": "low_value_for_cost"}
    if p.get("context_tokens", 0) <= p.get("window", 0) // 2:
        return {"split": False, "reason": "fits_single_agent"}
    return {"split": True, "reason": "parallel_and_context_bound"}


def route(item, mode, rules=None, classifier=None, workers=None):
    if mode == "static":
        return STATIC.get(item.get("kind"), FALLBACK)
    if mode == "conditional":
        for predicate, worker in rules or []:
            if predicate(item):
                return worker
        return FALLBACK
    if mode == "dynamic":
        choice = classifier(item) if classifier else None
        return choice if choice in (workers or ()) else FALLBACK
    raise ValueError("mode: static, conditional, dynamic")


def _key(f):
    return (f["project_id"], f["kind"], str(f["object_id"]))


def merge(batches):
    merged, order = {}, []
    for worker, findings in batches:
        for f in findings:
            key = _key(f)
            evidence = f["evidence"] if isinstance(f["evidence"], list) else [f["evidence"]]
            if key not in merged:
                merged[key] = dict(f, evidence=[], sources=[], severities=[])
                order.append(key)
            m = merged[key]
            m["severities"].append(f["severity"])
            if SEV[f["severity"]] > SEV[m["severity"]]:
                m["severity"] = f["severity"]
            m["evidence"] += [e for e in evidence if e not in m["evidence"]]
            if worker not in m["sources"]:
                m["sources"].append(worker)
    out = []
    for key in order:
        m = merged[key]
        levels = [SEV[s] for s in m.pop("severities")]
        m["conflict"] = max(levels) - min(levels) >= 2
        out.append(m)
    return out


def supervise(items, workers, route_fn):
    batches = []
    for item in items:
        name = route_fn(item)
        worker = workers.get(name) or workers[FALLBACK]
        batches.append((name if name in workers else FALLBACK, worker(copy.deepcopy(item))))
    return merge(batches)
