"""Выбор модели. Сейчас pass@k = c/n для любого k, ограничения профиля не учитываются."""


def pass_at_k(n, c, k):
    return c / n


def select(results, profile):
    task = profile["task"]
    best = max(results, key=lambda r: r["tasks"][task]["c"] / r["tasks"][task]["n"])
    return {"model": best["model"], "ranking": [], "rejected": {}}
