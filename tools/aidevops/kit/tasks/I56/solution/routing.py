"""Маршрутизатор локально/облако: критичное и КТ никогда не уходит в облако, неизвестное считается критичным."""


def _ok(target, policy, task, reason):
    return {"status": 200, "target": target, "model": policy[target][task], "reason": reason}


def route(req, policy, health):
    classification = req.get("classification") or "kt"
    if classification == "secret":
        return {"status": 403, "reason": "secret"}
    task = req.get("task")
    if task not in policy["local"] or task not in policy["cloud"]:
        return {"status": 400, "reason": "task"}

    if req.get("repo") in policy["critical_repos"] or classification == "kt":
        reason = "critical_repo" if req.get("repo") in policy["critical_repos"] else "kt"
        if health.get("local"):
            return _ok("local", policy, task, reason)
        return {"status": 503, "reason": "local_unavailable"}

    if req.get("tenant") not in policy["cloud_tenants"]:
        if health.get("local"):
            return _ok("local", policy, task, "no_cloud_access")
        return {"status": 503, "reason": "local_unavailable"}

    if health.get("cloud"):
        return _ok("cloud", policy, task, "cloud_default")
    if health.get("local"):
        return _ok("local", policy, task, "cloud_fallback")
    return {"status": 503, "reason": "no_backend"}
