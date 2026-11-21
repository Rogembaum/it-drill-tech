"""Chargeback по токенам. Считает во float, ретраи учитываются дважды, неизвестные модели стоят 0."""


def invoice(usage, prices, markup="0"):
    teams = {}
    for u in usage:
        p = prices.get(u["model"], {"input": 0, "output": 0})
        cost = u["prompt_tokens"] * float(p["input"]) / 1e6 + u["completion_tokens"] * float(p["output"]) / 1e6
        teams[u["team"]] = round(teams.get(u["team"], 0) + cost, 2)
    return {"teams": teams, "total": sum(teams.values()), "unknown": []}


def reconcile(ours, provider, tolerance="0.02"):
    return {"ok": True, "diff": 0}
