"""Демаскирование стрима. Сейчас заменяет плейсхолдеры в каждом чанке отдельно — разрезанные не находятся."""
MAX_LEN = 32


class StreamUnmasker:
    def __init__(self, mapping):
        self.mapping = mapping

    def feed(self, chunk):
        for token, value in self.mapping.items():
            chunk = chunk.replace(token, value)
        return chunk

    def flush(self):
        return ""
