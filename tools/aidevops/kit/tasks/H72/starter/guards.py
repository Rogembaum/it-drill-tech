import time


class Stop(Exception):
    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


def backoff(attempt, base=0.5, cap=30.0, rnd=None, retry_after=None):
    # TODO: full jitter и Retry-After
    return base * 2 ** attempt


def classify_error(status=None, exc=None):
    return "retry"


class CircuitBreaker:
    def __init__(self, threshold=3, recovery=30.0, clock=time.monotonic):
        self.state = "closed"

    def allow(self):
        return True

    def record(self, ok):
        pass


class Budget:
    def __init__(self, max_steps=12, max_tool_calls=12, max_cost_usd=0.5, max_seconds=120.0, clock=time.monotonic):
        self.max_steps, self.steps = max_steps, 0

    def charge(self, steps=0, tool_calls=0, cost_usd=0.0):
        self.steps += steps
        if self.steps > self.max_steps:
            raise Stop("budget_steps")


def guard(action, args, ctx):
    return "allow"


def detect_loop(calls, repeat=3):
    return False


def alert_route(finding, sent, now, cooldown=3600):
    return "page"
