---
name: add-lab-content
description: >-
  Adds questions, incident cases, workshops, kit tasks, or lab modules to
  it-drill-tech (site data/ or any labs/<id> such as cka, aidevops, or a new
  lab). Use when the user asks to add or expand questions, labs, checklists,
  quiz items, cases, catalog entries, kit tasks, or to rebuild lab data.js/zip.
---

# Add questions / labs / cases

## Before coding

1. Read `AGENTS.md` (deploy boundary + which surface to edit).
2. Identify the target: site `data/`, existing `labs/<id>`, or a new lab id.
3. Open one neighboring entry or task as the style/shape template.
4. For builders that need external sources (academy, trainer HTML), ask the path once — do not disk-scan.

## Choose surface

| Need | Edit |
|---|---|
| Site quiz digests | `data/questions.js` + `data/en/questions.js` (stable `key`) |
| Site incident cases | `data/cases.js` + `data/en/cases.js` |
| Lab catalog card / stats | `labs/catalog.js` |
| Lab questions / workshops / modules (aidevops) | `tools/aidevops/content.json` → rebuild |
| Lab kit auto-checked task (aidevops) | `tools/aidevops/kit/tasks/<ID>/` + `kit/lab/*_checks.py` + builder patches → rebuild |
| CKA content / stand | sources for `tools/build-lab-cka.py` → rebuild |
| Brand-new lab | `labs/<id>/{lab.js,data.js}` + catalog entry; add `tools/build-lab-<id>.py` if there is an upstream kit |

Never hand-edit generated `labs/<id>/data.js` when a builder owns it. Never ship learner flows that only exist under `tools/`.

## Checklist

- [ ] Right surface for the request (site vs lab vs kit)
- [ ] Shape/tone match neighbors; RU/EN keys aligned for `data/`
- [ ] Learner commands reference the stand (`./ai-lab`, `./cka`, …), not `tools/`
- [ ] Kit tasks: starter FAIL, solution PASS; checker returns `r`; live → `skip`
- [ ] Rebuild if applicable; `catalog.js` stats updated; `lab.js` copy updated if it hard-codes counts
- [ ] `node tools/validate.mjs` passes

## Rebuild commands

```bash
python tools/build-lab-cka.py --trainer "<path>" --kit "<path>"
python tools/build-lab-aidevops.py --academy "<path>/AI-DevOps-Academy-v2"
node tools/validate.mjs
```

## Do not

- Leave the only runnable prototype under `tools/` for learners
- Use `&&` in PowerShell one-liners
- Commit/push unless asked; no secrets in fixtures or snippets
