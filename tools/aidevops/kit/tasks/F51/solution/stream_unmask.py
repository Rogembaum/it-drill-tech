"""Потоковое демаскирование: в буфере только хвост, который ещё может стать плейсхолдером."""
import re

MAX_LEN = 32
FULL = re.compile(r"<[A-Z]+_\d+>")
PARTIAL = re.compile(r"<(?:[A-Z]+(?:_\d*)?)?\Z")


class StreamUnmasker:
    def __init__(self, mapping):
        self.mapping = mapping
        self.buf = ""

    def _replace(self, text):
        return FULL.sub(lambda m: self.mapping.get(m.group(0), m.group(0)), text)

    def feed(self, chunk):
        self.buf += chunk
        cut = self.buf.rfind("<")
        if cut == -1:
            out, self.buf = self.buf, ""
            return self._replace(out)
        tail = self.buf[cut:]
        if PARTIAL.match(tail) and len(tail) < MAX_LEN:
            out, self.buf = self.buf[:cut], tail
        else:
            out, self.buf = self.buf, ""
        return self._replace(out)

    def flush(self):
        out, self.buf = self.buf, ""
        return self._replace(out)
