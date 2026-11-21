"""Chargeback по токенам: Decimal, дедупликация ретраев, кеш, комиссия агрегатора, сверка со счётом."""
from decimal import ROUND_HALF_UP, Decimal

MILLION = Decimal(1_000_000)
CENT = Decimal("0.01")


def _d(x):
    return Decimal(str(x))


def invoice(usage, prices, markup="0"):
    markup = _d(markup)
    raw, unknown, seen = {}, [], set()
    for u in usage:
        rid = u["request_id"]
        if rid in seen:
            continue
        seen.add(rid)
        prompt, completion = u["prompt_tokens"], u["completion_tokens"]
        cached = u.get("cached_tokens", 0) or 0
        if min(prompt, completion, cached) < 0 or cached > prompt:
            raise ValueError("bad token counts in %s" % rid)
        p = prices.get(u["model"])
        if p is None:
            unknown.append(rid)
            continue
        cached_price = _d(p.get("cached_input", p["input"]))
        cost = ((prompt - cached) * _d(p["input"]) + cached * cached_price
                + completion * _d(p["output"])) / MILLION
        if p.get("aggregator"):
            cost *= 1 + markup
        raw[u["team"]] = raw.get(u["team"], Decimal(0)) + cost
    teams = {t: v.quantize(CENT, rounding=ROUND_HALF_UP) for t, v in raw.items()}
    return {"teams": teams, "total": sum(teams.values(), Decimal(0)), "unknown": unknown}


def reconcile(ours, provider, tolerance="0.02"):
    ours, provider = _d(ours), _d(provider)
    diff = ours - provider
    ok = diff == 0 if provider == 0 else abs(diff) / provider <= _d(tolerance)
    return {"ok": ok, "diff": diff}
