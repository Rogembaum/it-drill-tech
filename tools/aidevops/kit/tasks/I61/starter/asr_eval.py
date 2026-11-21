"""Оценка ASR. Сейчас: фраза верна целиком или нет, WER корпуса — среднее по фразам."""


def normalize(text):
    return text.strip()


def wer(ref, hyp):
    return 0.0 if normalize(ref) == normalize(hyp) else 1.0


def corpus_wer(pairs):
    return sum(wer(r, h) for r, h in pairs) / len(pairs)


def rtf(processing_seconds, audio_seconds):
    return audio_seconds / processing_seconds


def choose(models, max_rtf):
    scores = {name: {"wer": corpus_wer(m["pairs"]), "rtf": 0} for name, m in models.items()}
    return {"model": min(scores, key=lambda n: scores[n]["wer"]), "scores": scores}
