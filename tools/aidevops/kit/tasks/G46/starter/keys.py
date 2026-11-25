"""Реестр ключей шлюза. Сейчас: ключ = имя команды, хранится как есть, доступ ко всему навсегда."""


class KeyRegistry:
    def __init__(self):
        self.keys = {}

    def issue(self, team, models, ttl, now):
        key = "sk-" + team
        self.keys[key] = {"team": team, "models": models}
        return key, team

    def authorize(self, key, model, now):
        rec = self.keys.get(key)
        if rec is None:
            return {"ok": False, "reason": "unknown"}
        return {"ok": True, "team": rec["team"], "key_id": rec["team"]}

    def rotate(self, key_id, now, grace=3600):
        raise NotImplementedError

    def revoke(self, key_id):
        pass
