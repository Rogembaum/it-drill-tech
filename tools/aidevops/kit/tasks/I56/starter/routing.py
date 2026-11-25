"""Маршрутизатор локально/облако. Сейчас: при падении локального всё уходит в облако, классификация не проверяется."""


def route(req, policy, health):
    task = req.get("task", "chat")
    if req.get("repo") in policy["critical_repos"] and health["local"]:
        return {"status": 200, "target": "local", "model": policy["local"][task], "reason": "critical_repo"}
    return {"status": 200, "target": "cloud", "model": policy["cloud"][task], "reason": "cloud_default"}
