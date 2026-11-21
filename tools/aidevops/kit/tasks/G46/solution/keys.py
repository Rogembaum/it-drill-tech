"""Реестр виртуальных ключей шлюза: хранится только sha256, scope по моделям, TTL, ротация и отзыв."""
import hashlib
import secrets

MAX_TTL = 90 * 86400


def _digest(key):
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


class KeyRegistry:
    def __init__(self):
        self.by_hash = {}  # sha256(key) -> key_id
        self.meta = {}     # key_id -> {"team", "models", "expires", "revoked"}

    def _store(self, team, models, expires):
        key = "sk-" + secrets.token_urlsafe(32)
        key_id = "key_" + secrets.token_hex(8)
        self.by_hash[_digest(key)] = key_id
        self.meta[key_id] = {"team": team, "models": frozenset(models), "expires": expires, "revoked": False}
        return key, key_id

    def issue(self, team, models, ttl, now):
        if not team or not isinstance(team, str):
            raise ValueError("team required")
        if not models or "*" in models or not all(isinstance(m, str) and m for m in models):
            raise ValueError("explicit model list required")
        if not isinstance(ttl, (int, float)) or not 0 < ttl <= MAX_TTL:
            raise ValueError("ttl must be within 90 days")
        return self._store(team, models, now + ttl)

    def authorize(self, key, model, now):
        key_id = self.by_hash.get(_digest(key)) if isinstance(key, str) else None
        if key_id is None:
            return {"ok": False, "reason": "unknown"}
        rec = self.meta[key_id]
        if rec["revoked"]:
            return {"ok": False, "reason": "revoked"}
        if now >= rec["expires"]:
            return {"ok": False, "reason": "expired"}
        if model not in rec["models"]:
            return {"ok": False, "reason": "model"}
        return {"ok": True, "team": rec["team"], "key_id": key_id}

    def rotate(self, key_id, now, grace=3600):
        rec = self.meta[key_id]
        if rec["revoked"]:
            raise PermissionError("key revoked")
        key, new_id = self._store(rec["team"], rec["models"], rec["expires"])
        self.meta[new_id]["parent"] = key_id
        rec["expires"] = min(rec["expires"], now + grace)
        return key

    def revoke(self, key_id):
        chain = {key_id}
        while True:
            more = {kid for kid, rec in self.meta.items() if rec.get("parent") in chain} - chain
            if not more:
                break
            chain |= more
        for kid in chain:
            self.meta[kid]["revoked"] = True
