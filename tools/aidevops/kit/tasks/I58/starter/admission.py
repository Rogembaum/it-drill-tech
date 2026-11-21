"""Допуск модели. Сейчас проверяет только лицензию и останавливается на первой проблеме."""


def admit(card, policy):
    if card.get("license") not in policy["licenses"]:
        return {"decision": "reject", "reasons": ["license"]}
    return {"decision": "approve", "reasons": []}
