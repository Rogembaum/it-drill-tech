from contextlib import contextmanager


def pass_at_k(n, c, k):
    # TODO: несмещённая оценка pass@k
    return c / n if n else 0.0


def pass_hat_k(n, c, k):
    # TODO: pass^k — все k попыток успешны
    return c / n if n else 0.0


def grade(trial, task):
    # TODO: outcome, лишние находки, запрещённые инструменты, глубокое чтение, шаги
    return {"passed": trial.get("status") == "done", "reasons": []}


def suite(trials, tasks, k):
    return {"pass@k": 0.0, "pass^k": 0.0, "per_task": {}}


class Tracer:
    def __init__(self, clock=None):
        self.spans = []

    @contextmanager
    def span(self, name, **attrs):
        span = {"name": name, "attributes": attrs}
        yield span
        self.spans.append(span)

    def export(self):
        return self.spans
