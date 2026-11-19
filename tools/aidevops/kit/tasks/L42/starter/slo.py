"""SLO LLM-сервиса. Сейчас TTFT — это время всего ответа, а вместо p95 — среднее."""


def stream_metrics(events):
    done = events[-1]["t"]
    n = sum(1 for e in events if e.get("type") == "token")
    return {"ttft": done, "tpot": done / max(n, 1), "tokens": n, "e2e": done}


def p95(values):
    return sum(values) / len(values) if values else None


def evaluate(requests, slo):
    m = [stream_metrics(r["events"]) for r in requests if r["events"]]
    ttft = p95([x["ttft"] for x in m])
    tpot = p95([x["tpot"] for x in m])
    ok = ttft <= slo["ttft_p95"] and tpot <= slo["tpot_p95"]
    return {"ttft_p95": ttft, "tpot_p95": tpot, "error_rate": 0.0, "violations": [], "ok": ok}
