# it-drill-tech — agent map

Static site + downloadable lab kits. Prefer short diffs; match existing style in the target section.

## What ships to the site

`tools/build-dist.py` copies only: `index.html`, `app.js`, `favicon.svg`, `data/`, `labs/`.

- `tools/` is **build-time only** — never point learner snippets/links at `tools/…`.
- Learner stands live in `labs/<lab>/*.zip` and are produced by `tools/build-lab-<lab>.py`.

## Content surfaces (pick the right one)

| Surface | Where | Notes |
|---|---|---|
| Site quiz / digests | `data/questions.js` (+ `data/en/questions.js`) | Stable `key`; see README «Как добавить вопрос» |
| Site incident cases | `data/cases.js` (+ `data/en/cases.js`) | Stable `key`; keep EN keys in sync |
| Lab catalog card | `labs/catalog.js` | `id`, `tags`, `title`/`lede`/`stats`, `store`; `soon: true` = announce-only |
| Lab UI + data | `labs/<id>/lab.js`, `labs/<id>/data.js` | Register via `LabKit` (`labs/kit.js`). **`data.js` is often generated — do not hand-edit if a builder owns it** |
| Lab build inputs | `tools/<lab>/`, `tools/build-lab-<lab>.py` | Edit sources → rebuild → update `catalog.js` stats |

Active labs today: `cka`, `aidevops`. Future labs (csi, cni, argocd, …) follow the same `labs/<id>/` + catalog pattern.

## Rebuild / validate

```bash
# CKA
python tools/build-lab-cka.py --trainer "<path>/Тренажёр CKA.html" --kit "<path>/cka-lab"

# AI DevOps
python tools/build-lab-aidevops.py --academy "<path>/AI-DevOps-Academy-v2"

node tools/validate.mjs
```

External source paths: ask once or reuse from the chat — do not broad-scan the disk.
After rebuild: refresh `labs/catalog.js` stats and any hard-coded counts in that lab’s `lab.js`.

## Shell / git

- PowerShell: `;`, not `&&`. Prefer small `python`/`node` scripts over fragile quoting.
- Conventional Commits; `git add <paths>` only; no secrets / real `*.tfvars`; no push/amend unless asked.
- Details: `.github/copilot-instructions.md`. CI for site/labs/tools: `node tools/validate.mjs`.

## Adding questions or labs

Follow `.cursor/skills/add-lab-content/SKILL.md`.
