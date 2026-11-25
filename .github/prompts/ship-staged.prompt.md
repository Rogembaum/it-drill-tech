---
description: Validate staged changes, commit with SemVer-friendly Conventional Commits, and open a PR to main
---

All required changes are already staged (`git diff --cached`). Follow these steps in order:

1. **Check the index:** Confirm `git diff --cached` is not empty. Do not stage unstaged or untracked files on your own.
2. **Validate:** Run the required checks from `.github/copilot-instructions.md` for the touched files (e.g. `node tools/validate.mjs` or `terraform validate`). If a check fails, stop and report the error.
3. **Branch:** If the current branch is `main`, create a topical branch (`feat/...`, `fix/...`, `docs/...`), keeping the staged changes.
4. **Commit:** Review `git diff --cached` and create a Conventional Commits commit (for correct SemVer releases: `feat`, `fix`, `docs`, etc.) with a clear message.
5. **Push and PR:** Push the branch to origin (`git push -u origin HEAD`) and open a Pull Request into `main` with `gh pr create`, using a Conventional Commits title and a short change list.

<!--
  After `git add` (index non-empty), run once:

    Get-Content .github/prompts/ship-staged.prompt.md -Raw | gh copilot -- --allow-all

  --allow-all is required so push/PR are not denied (tools alone is not enough).
  Interactive alternative (asks Yes/No in TUI):
    gh copilot -- -i "$(Get-Content .github/prompts/ship-staged.prompt.md -Raw)"
-->
