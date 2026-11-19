#!/usr/bin/env python3
"""Собирает dist/ — ровно то, что выкладывается в бакет S3.

  python tools/build-dist.py

Каталог dist/ пересоздаётся с нуля, поэтому удалённые из репозитория файлы
в нём не задерживаются. Содержимое dist/ загружается в корень бакета.
"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
FILES = ("index.html", "app.js", "favicon.svg")
DIRS = ("data", "labs")


def main():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    for f in FILES:
        shutil.copy2(os.path.join(ROOT, f), os.path.join(DIST, f))
    for d in DIRS:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(DIST, d))
    n = sum(len(files) for _, _, files in os.walk(DIST))
    print("dist: %d файлов -> %s" % (n, DIST))


if __name__ == "__main__":
    main()
