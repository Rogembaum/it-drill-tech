"""Детектор КТ. Сейчас ищет одно слово и срабатывает на любое «КТ»."""


def classify(text, codenames):
    low = text.lower()
    if "секрет" in low or "кт" in low:
        return {"action": "local_only", "reasons": ["marker:kt"]}
    return {"action": "allow", "reasons": []}
