"""Обратимое маскирование PII с проверкой контрольных сумм. Один Vault — один запрос."""
import re

EMAIL = re.compile(r"(?<![\w.+-])[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
SNILS = re.compile(r"(?<!\d)\d{3}-\d{3}-\d{3}[ -]\d{2}(?!\d)")
CARD = re.compile(r"(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])")
PHONE = re.compile(r"(?<![\d+])(?:\+7|8)[ (-]*\d{3}[ )-]*\d{3}[ -]?\d{2}[ -]?\d{2}(?!\d)")
INN = re.compile(r"(?<!\d)(?:\d{12}|\d{10})(?!\d)")
PLACEHOLDER = re.compile(r"<([A-Z]+)_(\d+)>")


def _digits(s):
    return [int(c) for c in s if c.isdigit()]


def luhn(s):
    d = _digits(s)
    total = 0
    for i, x in enumerate(reversed(d)):
        if i % 2:
            x = x * 2 - 9 if x > 4 else x * 2
        total += x
    return total % 10 == 0


def _ctrl(d, weights):
    return sum(a * b for a, b in zip(d, weights)) % 11 % 10


def inn_valid(s):
    d = _digits(s)
    if len(d) == 10:
        return _ctrl(d, [2, 4, 10, 3, 5, 9, 4, 6, 8]) == d[9]
    if len(d) == 12:
        return _ctrl(d, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == d[10] \
            and _ctrl(d, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == d[11]
    return False


def snils_valid(s):
    d = _digits(s)
    total = sum(x * (9 - i) for i, x in enumerate(d[:9]))
    if total >= 100:
        total = total % 101 if total > 101 else 0
        total = 0 if total == 100 else total
    return total == d[9] * 10 + d[10]


RULES = [  # порядок важен: более специфичные форматы раньше
    ("EMAIL", EMAIL, None),
    ("SNILS", SNILS, snils_valid),
    ("PHONE", PHONE, None),
    ("CARD", CARD, luhn),
    ("INN", INN, inn_valid),
]


class Vault:
    def __init__(self):
        self._forward = {}  # (type, value) -> placeholder
        self._back = {}     # placeholder -> value
        self._count = {}

    def _token(self, kind, value):
        key = (kind, value)
        if key not in self._forward:
            n = self._count[kind] = self._count.get(kind, 0) + 1
            token = "<%s_%d>" % (kind, n)
            self._forward[key] = token
            self._back[token] = value
        return self._forward[key]

    def mask(self, text):
        for kind, rx, valid in RULES:
            def repl(m, kind=kind, valid=valid):
                value = m.group(0)
                if valid and not valid(value):
                    return value
                return self._token(kind, value)
            text = rx.sub(repl, text)
        return text

    def unmask(self, text):
        return PLACEHOLDER.sub(lambda m: self._back.get(m.group(0), m.group(0)), text)
