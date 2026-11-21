---
description: Проверить staged-изменения, закоммитить по SemVer и создать PR в main
---

Все нужные изменения уже добавлены в индекс (`git diff --cached`). Выполни следующие шаги строго по порядку:

1. **Проверка индекса:** Убедись, что `git diff --cached` не пуст. Не добавляй в индекс unstaged или untracked файлы самостоятельно.
2. **Валидация:** Запусти обязательные проверки из `.github/copilot-instructions.md` для затронутых файлов (например, `node tools/validate.mjs` или `terraform validate`). Если проверка упала — остановись и сообщи об ошибке.
3. **Ветка:** Если текущая ветка — `main`, создай новую тематическую ветку (`feat/...`, `fix/...`, `docs/...`), сохранив staged-изменения.
4. **Коммит:** Проанализируй `git diff --cached` и создай коммит по стандарту Conventional Commits (для корректного SemVer-релиза: `feat`, `fix`, `docs` и т. д.) с понятным описанием.
5. **Пуш и PR:** Отправь ветку в origin (`git push -u origin HEAD`) и создай Pull Request в ветку `main` через `gh pr create` с заголовком в стиле Conventional Commits и кратким списком изменений.

<!-- Get-Content .github/prompts/ship-staged.prompt.md -Raw | gh copilot -- --allow-all-tools -->