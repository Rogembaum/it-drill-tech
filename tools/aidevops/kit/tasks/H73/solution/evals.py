import itertools
import re
import time
from contextlib import contextmanager
from math import comb

SECRET_KEY = re.compile(r"token|secret|password|authorization|api_key", re.I)


def pass_at_k(n, c, k):
    if n - c < k:
        return 1.0
    return 1.0 - comb(n - c, k) / comb(n, k)


def pass_hat_k(n, c, k):
    return comb(c, k) / comb(n, k)


def _key(f):
    return "%s/%s/%s" % (f["project_id"], f["kind"], f["object_id"])


def grade(trial, task):
    reasons = []
    if trial.get("status") not in task.get("allowed_status", ["done"]):
        reasons.append("status:%s" % trial.get("status"))
    got = {_key(f) for f in trial.get("findings", [])}
    expected = set(task.get("expected", []))
    reasons += ["missing:%s" % k for k in expected - got]
    reasons += ["unexpected:%s" % k for k in got - expected - set(task.get("allowed_extra", []))]
    calls = trial.get("tool_calls", [])
    forbidden = set(task.get("forbidden_tools", []))
    reasons += ["forbidden:%s" % c["tool"] for c in calls if c["tool"] in forbidden]
    deep_ok = set(task.get("deep_reads_allowed", []))
    reasons += ["deep_read:%s" % c["args"]["iid"] for c in calls
                if c["tool"] == "gitlab_get_mr" and c["args"].get("iid") not in deep_ok]
    if "max_steps" in task and trial.get("steps", 0) > task["max_steps"]:
        reasons.append("too_many_steps")
    return {"passed": not reasons, "reasons": sorted(reasons)}


def suite(trials, tasks, k):
    per_task = {}
    for task_id, task in tasks.items():
        results = [grade(t, task)["passed"] for t in trials.get(task_id, [])]
        n, c = len(results), sum(results)
        per_task[task_id] = {"n": n, "c": c, "pass@k": pass_at_k(n, c, k), "pass^k": pass_hat_k(n, c, k)}
    count = len(per_task) or 1
    return {
        "pass@k": sum(v["pass@k"] for v in per_task.values()) / count,
        "pass^k": sum(v["pass^k"] for v in per_task.values()) / count,
        "per_task": per_task,
    }


def _redact(attrs):
    return {k: "[REDACTED]" if SECRET_KEY.search(k) else v for k, v in attrs.items()}


class Tracer:
    def __init__(self, clock=time.monotonic):
        self.clock, self.spans, self._stack = clock, [], []
        self._ids = itertools.count(1)
        self.trace_id = "t%d" % next(self._ids)

    @contextmanager
    def span(self, name, **attrs):
        span = {"trace_id": self.trace_id, "span_id": "s%d" % next(self._ids),
                "parent_id": self._stack[-1]["span_id"] if self._stack else None,
                "name": name, "attributes": _redact(attrs), "status": "ok", "start": self.clock()}
        self._stack.append(span)
        try:
            yield span
        except BaseException as exc:
            span["status"] = "error"
            span["attributes"]["error.type"] = type(exc).__name__
            raise
        finally:
            self._stack.pop()
            span["duration"] = self.clock() - span.pop("start")
            self.spans.append(span)

    def export(self):
        return list(self.spans)
