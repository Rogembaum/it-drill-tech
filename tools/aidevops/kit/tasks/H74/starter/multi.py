def should_split(p):
    # TODO: мультиагентность только когда она окупается
    return {"split": True, "reason": "always"}


def route(item, mode, rules=None, classifier=None, workers=None):
    return "mrs"


def merge(batches):
    # TODO: dedup, max severity, union evidence, sources, conflict
    out = []
    for worker, findings in batches:
        out.extend(findings)
    return out


def supervise(items, workers, route_fn):
    batches = []
    for item in items:
        batches.append((route_fn(item), workers[route_fn(item)](item)))
    return merge(batches)
