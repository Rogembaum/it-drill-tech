"""Guardrails. Сейчас: одна точная фраза, источник не учитывается, выход не проверяется."""


def scan_input(text, source="user"):
    if "ignore previous instructions" in text:
        return {"verdict": "flag", "hits": ["override"]}
    return {"verdict": "allow", "hits": []}


def scan_output(text, allowed_domains):
    return {"verdict": "allow", "hits": []}
