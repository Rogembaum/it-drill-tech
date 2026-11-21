"""Оценка ASR на русской речи: нормализация, WER по словам, корпусный WER, RTF, выбор модели."""
import re


def normalize(text):
    text = text.lower().replace("ё", "е")
    return " ".join(re.sub(r"[^\w]|_", " ", text).split())


def _edits(ref_words, hyp_words):
    prev = list(range(len(hyp_words) + 1))
    for i, r in enumerate(ref_words, 1):
        cur = [i]
        for j, h in enumerate(hyp_words, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h)))
        prev = cur
    return prev[-1]


def _counts(ref, hyp):
    r, h = normalize(ref).split(), normalize(hyp).split()
    if not r:
        raise ValueError("empty reference")
    return _edits(r, h), len(r)


def wer(ref, hyp):
    edits, words = _counts(ref, hyp)
    return edits / words


def corpus_wer(pairs):
    edits = words = 0
    for ref, hyp in pairs:
        e, w = _counts(ref, hyp)
        edits, words = edits + e, words + w
    return edits / words


def rtf(processing_seconds, audio_seconds):
    return processing_seconds / audio_seconds


def choose(models, max_rtf):
    scores = {name: {"wer": corpus_wer(m["pairs"]), "rtf": rtf(m["processing_seconds"], m["audio_seconds"])}
              for name, m in models.items()}
    fit = [n for n, s in scores.items() if s["rtf"] <= max_rtf]
    return {"model": min(fit, key=lambda n: scores[n]["wer"]) if fit else None, "scores": scores}
