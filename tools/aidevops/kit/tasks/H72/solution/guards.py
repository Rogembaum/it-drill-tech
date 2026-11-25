import json
import random
import time

RETRY_STATUS = {429, 500, 502, 503, 504}
DESTRUCTIVE = {"gitlab_delete_project", "gitlab_delete_branch"}
WRITE = {"gitlab_merge_mr", "gitlab_close_mr", "gitlab_post_comment"}
CRIT_CONFIDENCE = 0.7


class Stop(Exception):
    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


def backoff(attempt, base=0.5, cap=30.0, rnd=random.random, retry_after=None):
    if retry_after is not None:
        return float(retry_after)
    return rnd() * min(cap, base * 2 ** attempt)


def classify_error(status=None, exc=None):
    if isinstance(exc, (TimeoutError, ConnectionError)) or status in RETRY_STATUS:
        return "retry"
    if status in (400, 422):
        return "repair"
    if status == 404:
        return "skip"
    return "abort"


class CircuitBreaker:
    def __init__(self, threshold=3, recovery=30.0, clock=time.monotonic):
        self.threshold, self.recovery, self.clock = threshold, recovery, clock
        self.state, self.failures, self.opened_at, self.probing = "closed", 0, None, False

    def allow(self):
        if self.state == "open" and self.clock() - self.opened_at >= self.recovery:
            self.state = "half_open"
        if self.state == "open":
            return False
        if self.state == "half_open":
            if self.probing:
                return False
            self.probing = True
        return True

    def record(self, ok):
        self.probing = False
        if ok:
            self.state, self.failures = "closed", 0
            return
        self.failures += 1
        if self.state == "half_open" or self.failures >= self.threshold:
            self.state, self.opened_at = "open", self.clock()


class Budget:
    def __init__(self, max_steps=12, max_tool_calls=12, max_cost_usd=0.5, max_seconds=120.0, clock=time.monotonic):
        self.limits = {"steps": max_steps, "tool_calls": max_tool_calls, "cost_usd": max_cost_usd}
        self.max_seconds, self.clock, self.started = max_seconds, clock, clock()
        self.used = {"steps": 0, "tool_calls": 0, "cost_usd": 0.0}

    def charge(self, steps=0, tool_calls=0, cost_usd=0.0):
        self.used["steps"] += steps
        self.used["tool_calls"] += tool_calls
        self.used["cost_usd"] += cost_usd
        if self.clock() - self.started > self.max_seconds:
            raise Stop("budget_time")
        if self.used["cost_usd"] > self.limits["cost_usd"]:
            raise Stop("budget_cost")
        if self.used["tool_calls"] > self.limits["tool_calls"]:
            raise Stop("budget_tools")
        if self.used["steps"] > self.limits["steps"]:
            raise Stop("budget_steps")


def guard(action, args, ctx):
    if action in DESTRUCTIVE:
        return "deny"
    if action in WRITE:
        return "ask" if ctx.get("hitl") else "deny"
    if action == "finish" and args.get("max_severity") == "crit" and ctx.get("confidence", 1.0) < CRIT_CONFIDENCE:
        return "ask" if ctx.get("hitl") else "deny"
    return "allow"


def detect_loop(calls, repeat=3):
    if len(calls) < repeat:
        return False
    tail = [json.dumps([c["tool"], c.get("args")], sort_keys=True) for c in calls[-repeat:]]
    return len(set(tail)) == 1


def alert_route(finding, sent, now, cooldown=3600):
    key = "%s/%s/%s" % (finding["project_id"], finding["kind"], finding["object_id"])
    last = sent.get(key)
    if last is not None and now - last < cooldown:
        return "suppress"
    if finding["severity"] != "crit":
        return "digest"
    sent[key] = now
    return "page"
