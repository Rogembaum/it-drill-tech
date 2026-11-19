"""Проверка весов перед стартом inference. Сейчас смотрит только, что файлы на месте."""
from pathlib import Path


def verify(manifest, root):
    return [Path(root) / name for name in sorted(manifest["files"]) if (Path(root) / name).exists()]
