"""Пробник стрима. Сейчас TTFT — время первой любой строки, обрывы не различаются."""


def probe(events, stall_after=30):
    if not events:
        return {"ttft": None, "e2e": None, "tokens": 0, "max_gap": 0, "outcome": "empty"}
    return {"ttft": events[0][0], "e2e": events[-1][0], "tokens": len(events), "max_gap": 0, "outcome": "ok"}


def aggregate(results):
    ttft = [r["ttft"] for r in results if r["ttft"] is not None]
    avg = sum(ttft) / len(ttft) if ttft else None
    return {"n": len(results), "drop_rate": 0.0, "error_rate": 0.0, "stall_rate": 0.0, "ttft_p50": avg, "ttft_p95": avg}
