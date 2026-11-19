#!/usr/bin/env python3
"""Собирает лабу CKA из тренажёра и стенда.

  python tools/build-lab-cka.py --trainer "<путь>/Тренажёр CKA.html" --kit "<путь>/cka-lab"

Пишет:
  labs/cka/data.js      — задачи, вопросы, карточки на скорость и ссылки на документацию
  labs/cka/cka-lab.zip  — стенд для скачивания; архив детерминированный, пересборка
                          без изменений в исходниках не меняет файл
"""
import argparse
import io
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "labs", "cka")
TASK_FIELDS = ("id", "key", "dom", "w", "min", "title", "host", "node", "manual", "online",
               "heavy", "breaks", "noexam", "conflicts", "ru", "en", "sol", "traps", "docs", "crit")
EXEC = (".sh",)
EXEC_NAMES = ("cka",)
ZIP_DATE = (1980, 1, 1, 0, 0, 0)


def grab(src, name):
    i = src.index("const %s=" % name) + len("const %s=" % name)
    obj, _ = json.JSONDecoder().raw_decode(src, i)
    return obj


def rows(items):
    return "[\n" + ",\n".join(json.dumps(x, ensure_ascii=False) for x in items) + "\n]"


def write_js(tasks, quiz, speed, docs, path):
    tasks = [{k: t[k] for k in TASK_FIELDS} for t in tasks]
    body = ",\n".join([
        "tasks: " + rows(tasks),
        "quiz: " + rows(quiz),
        "speed: " + rows(speed),
        "docs: {\n" + ",\n".join("%s: %s" % (json.dumps(k), json.dumps(docs[k], ensure_ascii=False))
                                 for k in sorted(docs)) + "\n}",
    ])
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Сгенерировано tools/build-lab-cka.py — руками не править. */\n")
        f.write("window.LAB_DATA = window.LAB_DATA || {};\n")
        f.write("window.LAB_DATA.cka = {\n" + body + "\n};\n")


def write_zip(kit, path):
    files = []
    for base, dirs, names in os.walk(kit):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        files += [os.path.join(base, n) for n in sorted(names) if not n.startswith(".")]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for full in files:
            rel = os.path.relpath(full, kit).replace(os.sep, "/")
            info = zipfile.ZipInfo("cka-lab/" + rel, ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            name = os.path.basename(full)
            mode = 0o755 if name.endswith(EXEC) or name in EXEC_NAMES else 0o644
            info.external_attr = (0o100000 | mode) << 16
            info.create_system = 3
            with open(full, "rb") as f:
                z.writestr(info, f.read())
    return len(files)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--trainer", required=True, help="Тренажёр CKA.html")
    p.add_argument("--kit", required=True, help="каталог стенда cka-lab (с файлом cka)")
    a = p.parse_args()

    with io.open(a.trainer, encoding="utf-8") as f:
        src = f.read()
    if not os.path.isfile(os.path.join(a.kit, "cka")):
        p.error("в %s нет файла cka" % a.kit)
    tasks, quiz, speed, docs = (grab(src, n) for n in ("TASKS", "QUIZ", "SPEED", "DOCS"))

    os.makedirs(OUT, exist_ok=True)
    write_js(tasks, quiz, speed, docs, os.path.join(OUT, "data.js"))
    n = write_zip(a.kit, os.path.join(OUT, "cka-lab.zip"))
    print("cka: %d задач, %d вопросов, %d карточек, архив: %d файлов"
          % (len(tasks), len(quiz), len(speed), n))


if __name__ == "__main__":
    main()
