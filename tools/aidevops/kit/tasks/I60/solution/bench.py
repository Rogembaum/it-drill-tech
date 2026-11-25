"""Выбор модели под задачу: несмещённый pass@k, жёсткие ограничения профиля, ранжирование."""
from math import comb


def pass_at_k(n, c, k):
    if k < 1 or k > n or c < 0 or c > n:
        raise ValueError("bad n/c/k")
    if n - c < k:
        return 1.0
    return 1.0 - comb(n - c, k) / comb(n, k)


def select(results, profile):
    task, k = profile["task"], profile.get("k", 1)
    rejected, scored = {}, []
    for r in results:
        stats = r.get("tasks", {}).get(task)
        if profile.get("critical") and not r.get("local"):
            rejected[r["model"]] = "cloud_for_critical"
        elif not stats:
            rejected[r["model"]] = "no_results"
        elif stats["n"] < profile.get("min_n", 1):
            rejected[r["model"]] = "insufficient_samples"
        elif r["ttft_p95"] > profile["max_ttft_p95"]:
            rejected[r["model"]] = "ttft"
        else:
            scored.append((pass_at_k(stats["n"], stats["c"], k), r))
    scored.sort(key=lambda x: (-x[0], x[1]["cost_per_1m"], x[1]["ttft_p95"]))
    ranking = [[r["model"], score] for score, r in scored]
    return {"model": ranking[0][0] if ranking else None, "ranking": ranking, "rejected": rejected}
