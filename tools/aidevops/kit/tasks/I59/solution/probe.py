"""Пробник стрима OpenAI-совместимого API: TTFT, обрывы, зависания, ошибки посреди стрима."""
import json
import math


def probe(events, stall_after=30):
    token_times, done, error = [], False, False
    for t, line in events:
        line = line.strip()
        if not line or line.startswith(":") or not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload == "[DONE]":
            done = True
            continue
        try:
            chunk = json.loads(payload)
        except ValueError:
            error = True
            continue
        if "error" in chunk:
            error = True
            continue
        for choice in chunk.get("choices") or []:
            delta = choice.get("delta") or {}
            if delta.get("content") or delta.get("reasoning_content"):
                token_times.append(t)
                break
        if any(c.get("finish_reason") for c in chunk.get("choices") or []):
            done = True

    gaps = [b - a for a, b in zip(token_times, token_times[1:])]
    max_gap = max(gaps) if gaps else 0
    if error:
        outcome = "error"
    elif not token_times:
        outcome = "empty"
    elif not done:
        outcome = "dropped"
    elif max_gap > stall_after:
        outcome = "stalled"
    else:
        outcome = "ok"
    return {"ttft": token_times[0] if token_times else None, "e2e": events[-1][0] if events else None,
            "tokens": len(token_times), "max_gap": max_gap, "outcome": outcome}


def _rank(values, q):
    if not values:
        return None
    s = sorted(values)
    return s[max(0, math.ceil(q * len(s)) - 1)]


def aggregate(results):
    n = len(results)
    rate = lambda kind: sum(r["outcome"] == kind for r in results) / n if n else 0.0
    ttft = [r["ttft"] for r in results if r["ttft"] is not None]
    return {"n": n, "drop_rate": rate("dropped"), "error_rate": rate("error"), "stall_rate": rate("stalled"),
            "ttft_p50": _rank(ttft, 0.5), "ttft_p95": _rank(ttft, 0.95)}
