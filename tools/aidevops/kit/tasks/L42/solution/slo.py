"""SLO LLM-сервиса по событиям стрима: TTFT, TPOT, p95 и error rate."""
import math


def stream_metrics(events):
    toks = [e["t"] for e in events if e.get("type") == "token"]
    done = next((e["t"] for e in events if e.get("type") == "done"), None)
    if not toks:
        return {"ttft": None, "tpot": None, "tokens": 0, "e2e": done}
    tpot = (toks[-1] - toks[0]) / (len(toks) - 1) if len(toks) > 1 else None
    return {"ttft": toks[0], "tpot": tpot, "tokens": len(toks), "e2e": done if done is not None else toks[-1]}


def p95(values):
    if not values:
        return None
    s = sorted(values)
    return s[math.ceil(0.95 * len(s)) - 1]


def evaluate(requests, slo):
    ok_req = [r for r in requests if r.get("status") == 200]
    error_rate = (len(requests) - len(ok_req)) / len(requests) if requests else 0.0
    m = [stream_metrics(r.get("events") or []) for r in ok_req]
    ttft = p95([x["ttft"] for x in m if x["ttft"] is not None])
    tpot = p95([x["tpot"] for x in m if x["tpot"] is not None])

    violations = []
    if ttft is None or ttft > slo["ttft_p95"]:
        violations.append("ttft_p95")
    if tpot is None or tpot > slo["tpot_p95"]:
        violations.append("tpot_p95")
    if error_rate > slo["error_rate"]:
        violations.append("error_rate")
    return {"ttft_p95": ttft, "tpot_p95": tpot, "error_rate": error_rate,
            "violations": violations, "ok": not violations}
