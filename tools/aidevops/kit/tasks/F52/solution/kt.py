"""Детектор КТ и секретов: block — никуда, local_only — только локальные модели, allow — можно в облако."""
import re
import unicodedata

ZERO_WIDTH = re.compile("[\u200b-\u200d\u2060\ufeff]")

SECRETS = [
    ("secret:private_key", re.compile(r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----")),
    ("secret:aws_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("secret:gitlab_token", re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}")),
    ("secret:api_key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}")),
    ("secret:dsn_password", re.compile(r"\b[a-z][a-z0-9+.-]*://[^\s:/@]+:[^\s@/]+@[^\s/]+", re.I)),
]
MARKERS = re.compile(
    r"коммерческ\w*\s+тайн\w*|конфиденциальн\w*|для\s+служебного\s+пользования|trade\s+secret|\bconfidential\b"
    r"|гриф\s*[:\-]?\s*(?:кт|дсп)\b|\[(?:кт|дсп)\]",
    re.I)
INTERNAL_HOST = re.compile(r"\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:corp\.local|internal)\b", re.I)


def classify(text, codenames):
    text = ZERO_WIDTH.sub("", unicodedata.normalize("NFKC", text))
    reasons = {name for name, rx in SECRETS if rx.search(text)}
    if MARKERS.search(text):
        reasons.add("marker:kt")
    for name in codenames:
        if re.search(r"(?<!\w)%s(?!\w)" % re.escape(name), text, re.I):
            reasons.add("codename:" + name.lower())
    if INTERNAL_HOST.search(text):
        reasons.add("host:internal")
    if any(r.startswith("secret:") for r in reasons):
        action = "block"
    elif reasons:
        action = "local_only"
    else:
        action = "allow"
    return {"action": action, "reasons": sorted(reasons)}
