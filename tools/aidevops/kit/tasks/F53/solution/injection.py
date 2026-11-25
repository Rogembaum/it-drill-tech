"""Guardrails: входной гвард от prompt injection и выходной гвард от эксфильтрации через URL."""
import base64
import binascii
import re
import unicodedata
from urllib.parse import urlsplit

ZERO_WIDTH = re.compile("[\u200b-\u200d\u2060\ufeff]")
B64 = re.compile(r"[A-Za-z0-9+/]{16,}={0,2}")
RULES = [
    ("override", re.compile(r"\b(?:ignore|disregard)\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above)\s+instructions"
                            r"|(?:игнорируй|забудь)\s+(?:все\s+)?(?:предыдущие|прошлые)\s+инструкции"
                            r"|\byou\s+are\s+now\b|\bты\s+теперь\b")),
    ("leak", re.compile(r"\b(?:reveal|print|show)\s+(?:your\s+|the\s+)?system\s+prompt"
                        r"|(?:покажи|выведи)\s+(?:свой\s+)?системный\s+промпт")),
]
ROLE_TOKENS = re.compile(r"<\|im_start\|>|<\|system\|>|\[inst\]|^\s*###\s*system\s*:", re.M)
IMAGE = re.compile(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)")
URL = re.compile(r"https?://[^\s)\]>\"']+")


def _normalize(text):
    text = ZERO_WIDTH.sub("", unicodedata.normalize("NFKC", text)).lower()
    return re.sub(r"[ \t]+", " ", text)


def _decoded(text):
    for chunk in B64.findall(text):
        try:
            raw = base64.b64decode(chunk + "=" * (-len(chunk) % 4), validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError):
            continue
        if raw.isprintable():
            yield raw


def _hits(text):
    norm = _normalize(text)
    hits = {name for name, rx in RULES if rx.search(norm)}
    if ROLE_TOKENS.search(norm):
        hits.add("role_token")
    return hits


def scan_input(text, source="user"):
    hits = _hits(text)
    for raw in _decoded(text):
        inner = _hits(raw)
        if inner:
            hits |= inner | {"encoded"}
    if not hits:
        verdict = "allow"
    elif "role_token" in hits or source in ("retrieved", "tool"):
        verdict = "block"
    else:
        verdict = "flag"
    return {"verdict": verdict, "hits": sorted(hits)}


def _allowed(host, allowed_domains):
    return any(host == d or host.endswith("." + d) for d in allowed_domains)


def scan_output(text, allowed_domains):
    hits, images = set(), set()
    for url in IMAGE.findall(text):
        host = (urlsplit(url).hostname or "").lower()
        images.add(url)
        if host and not _allowed(host, allowed_domains):
            hits.add("image:" + host)
    for url in URL.findall(text):
        host = (urlsplit(url).hostname or "").lower()
        if url not in images and host and not _allowed(host, allowed_domains):
            hits.add("link:" + host)
    if any(h.startswith("image:") for h in hits):
        verdict = "block"
    elif hits:
        verdict = "flag"
    else:
        verdict = "allow"
    return {"verdict": verdict, "hits": sorted(hits)}
