#!/usr/bin/env python3
"""Собирает лабу AI DevOps из AI DevOps Academy v2.

  python tools/build-lab-aidevops.py --academy "<путь>/AI-DevOps-Academy-v2"

--academy — каталог, где лежат ai-devops-drill/ и ai-devops-labs/.

Поверх исходников применяется tools/aidevops/:
  content.json — правки и дополнения вопросов, чек-листов и сертификаций
  kit/         — файлы, добавленные в стенд (задачи L41–L44 и их проверки)
  KIT_PATCHES  — точечные исправления исходных файлов стенда (ниже); если
                 исходник изменился и фрагмент не найден, сборка падает

Пишет:
  labs/aidevops/data.js             — данные лабы
  labs/aidevops/ai-devops-labs.zip  — стенд; архив детерминированный
"""
import argparse
import io
import json
import os
import re
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "aidevops")
OUT = os.path.join(ROOT, "labs", "aidevops")
TOP = "ai-devops-labs"
ZIP_DATE = (1980, 1, 1, 0, 0, 0)
SKIP_DIRS = {".venv", "venv", "workspaces", ".state", "__pycache__", ".pytest_cache"}
EXEC_NAMES = {"ai-lab"}

DOMAIN_MODULE = {
    "01 agent": "agent", "02 tools": "mcp", "03 k8s": "k8s", "04 cicd": "cicd", "05 secure": "sec",
    "06 capstone": "capstone", "07 rag": "rag", "08 evals": "evals", "09 ainative": "native",
    "10 automation": "automation", "11 models": "models",
}
CAPSTONE = {"id": "capstone", "num": "—", "icon": "◇", "title": "Итоговый проект",
            "short": "Portfolio · Case study", "desc": "Связать все направления в проверяемый проект.",
            "goal": "Публичный репозиторий с архитектурой, реальными проверками и честным статусом demo/production."}

KIT_PATCHES = [
    ("lab/checks.py",
     "        elif tid in __import__('extra_checks').NEW_IDS:\n",
     "        elif tid in __import__('modelops_checks').NEW_IDS:\n"
     "            from modelops_checks import modelops_checker\n"
     "            return modelops_checker(tid,r,W,ROOT)\n"
     "        elif tid in __import__('extra_checks').NEW_IDS:\n"),
    ("lab/labctl.py",
     "'10 automation':'Telegram / n8n / API'}",
     "'10 automation':'Telegram / n8n / API',\n         '11 models':'ModelOps и LLM serving'}"),
    ("lab/labctl.py",
     "вывести задачи (01 agent|02 tools|03 k8s|04 cicd|05 secure)",
     "вывести задачи (01 agent … 11 models, см. README)"),
    ("lab/labctl.py",
     "./ai-lab exam                5 случайных практических задач",
     "./ai-lab exam                по одной случайной задаче из каждого направления"),
    ("lab/labctl.py",
     "print('Практический экзамен — 9 сценариев по направлениям:',' '.join(picks))",
     "print(f'Практический экзамен — {len(picks)} сценариев по направлениям:',' '.join(picks))"),
    ("tests/evals/test_routes.py", "CASES.read_text()", "CASES.read_text(encoding='utf-8')"),
    ("tools/run_evals.py",
     "out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\\n')",
     "out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\\n',encoding='utf8')"),
    ("tasks/C37/solution/.gitlab-ci.yml",
     "    - pip install pytest\n    - pytest -q tests/\n",
     "    - pip install -r requirements.txt\n    - python -m pytest -q tests/\n"),
    ("tasks/C37/solution/.gitlab-ci.yml",
     "    - pip install pytest\n    - pytest -q tests/evals/\n",
     "    - pip install -r requirements.txt\n    - python -m pytest -q tests/evals/\n"),
    ("README.md",
     "**40 сценариев по 10 тематическим направлениям**",
     "**44 сценария по 11 тематическим направлениям**"),
    ("README.md",
     "| P17, P38 | Capstone/portfolio | Верифицируемый case study |",
     "| P17, P38 | Capstone/portfolio | Верифицируемый case study |\n"
     "| L41–L44 | LLM gateway, TTFT/p95, KEDA по очереди, проверка весов | ModelOps и serving без GPU |"),
    ("README.md",
     "# 9 задач — по одной из 9 практических направлений",
     "# 10 задач — по одной из 10 практических направлений"),
]
STD_SECTIONS = {"Сценарий", "Требования к результату"}


def read(path):
    with io.open(path, encoding="utf-8") as f:
        return f.read()


def walk(base):
    out = {}
    for d, dirs, names in os.walk(base):
        dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
        for n in sorted(names):
            rel = os.path.relpath(os.path.join(d, n), base).replace(os.sep, "/")
            if rel.startswith("artifacts/") and n != ".gitkeep":
                continue
            with open(os.path.join(d, n), "rb") as f:
                out[rel] = f.read()
    return out


def build_kit(labs_dir):
    files = walk(labs_dir)
    extra = walk(os.path.join(SRC, "kit"))
    for rel, data in extra.items():
        if rel in files:
            raise SystemExit("kit/%s перекрывает исходный файл — сделайте патч в KIT_PATCHES" % rel)
        files[rel] = data
    for rel, old, new in KIT_PATCHES:
        text = files[rel].decode("utf-8")
        if text.count(old) != 1:
            raise SystemExit("патч не применился: %s — фрагмент найден %d раз" % (rel, text.count(old)))
        files[rel] = text.replace(old, new).encode("utf-8")

    tasks = json.loads(files["tasks.json"].decode("utf-8"))
    added = set()
    for rel in sorted(extra):
        m = re.fullmatch(r"tasks/([A-Z]\d{2})/meta\.json", rel)
        if m:
            tasks.append(json.loads(extra[rel].decode("utf-8")))
            added.add(m.group(1))
    files["tasks.json"] = (json.dumps(tasks, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    return files, tasks, added


def task_notes(md):
    """Разделы TASK.md сверх «Сценария» и «Требований»; блок запуска и строка про портфолио опускаются."""
    keep, cur = [], None
    for block in re.split(r"(?m)^## ", md)[1:]:
        title, _, body = block.partition("\n")
        title = title.strip()
        body = re.sub(r"(?ms)^\*\*Портфолио:\*\*.*?(?:\n\n|\Z)", "", body)
        if title == "Как работать":
            body = re.sub(r"(?s)^\s*```bash.*?```\s*", "", body)
            title = ""
        if title in STD_SECTIONS:
            continue
        body = body.strip()
        if body:
            keep.append({"h": title, "md": body})
    return keep


def site_tasks(files, tasks, added):
    out = []
    for t in tasks:
        tid = t["id"]
        def code(kind):
            pre = "tasks/%s/%s/" % (tid, kind)
            return [[rel[len(pre):], files[rel].decode("utf-8")] for rel in sorted(files) if rel.startswith(pre)]
        out.append({
            "id": tid, "dom": DOMAIN_MODULE[t["domain"]], "title": t["title"], "prereq": t.get("prereq", ""),
            "files": t["files"], "goal": t["goal"], "ev": t["evidence"],
            "notes": task_notes(files["tasks/%s/TASK.md" % tid].decode("utf-8")),
            "starter": code("starter"), "solution": code("solution"),
            "new": tid in added,
        })
    return out


def apply_content(drill, c):
    qs = {q["id"]: q for q in drill["questions"]}
    for qid, fix in c["question_fix"].items():
        qs[qid].update(fix)
    for q in c["questions_add"]:
        if q["id"] in qs:
            raise SystemExit("вопрос %s уже есть" % q["id"])
        q["new"] = True
        drill["questions"].append(q)
    labs = {l["id"]: l for l in drill["labs"]}
    for lid, fix in c["lab_replace"].items():
        labs[lid].update(fix)
    for l in c["labs_add"]:
        l["new"] = True
        drill["labs"].append(l)
    for cert in drill["certs"]:
        cert.update(c["cert_fix"].get(cert["name"], {}))

    mods = {m["id"] for m in drill["modules"]} | {"capstone"}
    for q in drill["questions"]:
        assert q["module"] in mods and 0 <= q["answer"] < len(q["options"]), q["id"]
    for l in drill["labs"]:
        assert l["module"] in mods, l["id"]


def write_zip(files, path):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in sorted(files):
            info = zipfile.ZipInfo(TOP + "/" + rel, ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            name = rel.rsplit("/", 1)[-1]
            mode = 0o755 if name.endswith(".sh") or name in EXEC_NAMES else 0o644
            info.external_attr = (0o100000 | mode) << 16
            info.create_system = 3
            z.writestr(info, files[rel])


def rows(items):
    return "[\n" + ",\n".join(json.dumps(x, ensure_ascii=False) for x in items) + "\n]"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--academy", required=True, help="каталог с ai-devops-drill/ и ai-devops-labs/")
    a = p.parse_args()
    drill_json = os.path.join(a.academy, "ai-devops-drill", "data.json")
    labs_dir = os.path.join(a.academy, "ai-devops-labs")
    if not os.path.isfile(drill_json) or not os.path.isfile(os.path.join(labs_dir, "ai-lab")):
        p.error("в %s нет ai-devops-drill/data.json или ai-devops-labs/ai-lab" % a.academy)

    drill = json.loads(read(drill_json))
    apply_content(drill, json.loads(read(os.path.join(SRC, "content.json"))))
    files, tasks, added = build_kit(labs_dir)

    os.makedirs(OUT, exist_ok=True)
    kit_zip = os.path.join(OUT, TOP + ".zip")
    write_zip(files, kit_zip)

    body = ",\n".join([
        "modules: " + rows(drill["modules"] + [CAPSTONE]),
        "tasks: " + rows(site_tasks(files, tasks, added)),
        "questions: " + rows(drill["questions"]),
        "labs: " + rows(drill["labs"]),
        "certs: " + rows(sorted(drill["certs"], key=lambda c: c["order"])),
        "tracks: " + json.dumps(files["docs/PORTFOLIO_TRACKS.md"].decode("utf-8"), ensure_ascii=False),
        "kit: " + json.dumps({"files": len(files), "kb": round(os.path.getsize(kit_zip) / 1024)}),
    ])
    with io.open(os.path.join(OUT, "data.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Сгенерировано tools/build-lab-aidevops.py — руками не править. */\n")
        f.write("window.LAB_DATA = window.LAB_DATA || {};\n")
        f.write("window.LAB_DATA.aidevops = {\n" + body + "\n};\n")
    print("aidevops: %d задач, %d вопросов, %d чек-листов, архив: %d файлов"
          % (len(tasks), len(drill["questions"]), len(drill["labs"]), len(files)))


if __name__ == "__main__":
    main()
