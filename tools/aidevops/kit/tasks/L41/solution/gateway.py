"""LLM gateway: token bucket по запросам и суточный бюджет токенов на tenant."""
import math

DAY = 86400


class Gateway:
    def __init__(self, limits):
        self.limits = limits
        self.buckets = {}  # tenant -> (доступно запросов, время последнего пересчёта)
        self.used = {}     # tenant -> [номер суток UTC, израсходовано и зарезервировано]

    def _budget(self, tenant, now):
        day = int(now // DAY)
        rec = self.used.get(tenant)
        if rec is None or rec[0] != day:
            rec = self.used[tenant] = [day, 0]
        return rec

    def admit(self, tenant, max_tokens, now):
        lim = self.limits.get(tenant)
        if lim is None:
            return {"status": 403, "reason": "tenant"}
        if not isinstance(max_tokens, int) or isinstance(max_tokens, bool) or max_tokens <= 0:
            return {"status": 400, "reason": "max_tokens"}

        rpm = lim["rpm"]
        tokens, last = self.buckets.get(tenant, (rpm, now))
        tokens = min(rpm, tokens + (now - last) * rpm / 60)
        if tokens < 1:
            self.buckets[tenant] = (tokens, now)
            return {"status": 429, "reason": "rate", "retry_after": math.ceil((1 - tokens) * 60 / rpm)}

        rec = self._budget(tenant, now)
        if rec[1] + max_tokens > lim["daily_tokens"]:
            self.buckets[tenant] = (tokens, now)
            return {"status": 429, "reason": "budget", "retry_after": math.ceil((rec[0] + 1) * DAY - now)}

        self.buckets[tenant] = (tokens - 1, now)
        rec[1] += max_tokens
        return {"status": 200, "reserved": max_tokens}

    def settle(self, tenant, reserved, used, now):
        rec = self._budget(tenant, now)
        rec[1] = max(0, rec[1] - reserved + used)
