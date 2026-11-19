"""Проверка весов перед стартом inference: revision, формат, путь и sha256."""
import hashlib
import re
from pathlib import Path, PurePosixPath

SAFE = {".safetensors", ".json", ".txt"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify(manifest, root):
    if not re.fullmatch(r"[0-9a-f]{40}", str(manifest.get("revision", ""))):
        raise ValueError("revision must be a full commit sha, not a branch or tag")
    files = manifest.get("files") or {}
    if not files:
        raise ValueError("manifest has no files")

    root = Path(root).resolve()
    out = []
    for name, digest in sorted(files.items()):
        p = PurePosixPath(name)
        if p.is_absolute() or ".." in p.parts or "\\" in name:
            raise PermissionError("path outside model dir: " + name)
        if p.suffix.lower() not in SAFE:
            raise PermissionError("format not allowed (pickle or unknown): " + name)
        path = root.joinpath(*p.parts)
        if not path.is_file():
            raise FileNotFoundError(name)
        if sha256(path) != str(digest).lower():
            raise ValueError("sha256 mismatch: " + name)
        out.append(path)
    return out
