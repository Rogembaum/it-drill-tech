# W63 — Coding-харнесс в контуре: opencode через внутренний шлюз с ограниченными правами

**Направление:** 15 platform.

## Сценарий
Разработчики ставят opencode, Qwen Code, Claude Code и Codex с личными ключами облачных провайдеров: код уходит наружу, шаринг сессий включён, агент без спроса делает git push и rm -rf. Подготовь корпоративный opencode.json, который раздаётся всем: единственный провайдер — внутренний LiteLLM, ключ из окружения, без шаринга и автообновления, опасные команды запрещены, остальные — с подтверждением.

## Что должно быть в opencode.json
- `"$schema": "https://opencode.ai/config.json"`.
- `provider.corp`: `"npm": "@ai-sdk/openai-compatible"`, `options.baseURL` — внутренний шлюз (`https://llm-gateway.corp.local/v1`), `options.apiKey: "{env:LITELLM_API_KEY}"`, в `models` — модели шлюза.
- `model` и `small_model` — из `corp/…`. `small_model` opencode использует для заголовков и сводок: без него он сам пойдёт к провайдеру по умолчанию.
- Внешние провайдеры выключены: `"enabled_providers": ["corp"]` или `disabled_providers` с `openai`, `anthropic`, `openrouter`, `google`.
- `"share": "disabled"`, `"autoupdate": false` — сессии не публикуются по ссылке, версия обновляется централизованно.
- `permission`: `edit: "ask"`, `webfetch: "deny"`, в `bash` — `"*": "ask"`, безопасные `git status`, `git diff*` — `allow`, `rm -rf*`, `git push*`, `curl*|*sh*` — `deny`.
- В файле нет ключей (`sk-…`).

## Требования к результату
$schema opencode; единственный провайдер corp через @ai-sdk/openai-compatible с baseURL внутреннего шлюза и apiKey {env:...}; model и small_model из corp; внешние провайдеры выключены; share=disabled, autoupdate=false; permission: edit ask, bash * ask, rm -rf / git push / curl|sh deny, webfetch deny; нет литеральных ключей.

## Как работать
```bash
./ai-lab start W63
# отредактируйте файлы workspaces/W63/
./ai-lab check W63
# при необходимости: ./ai-lab solve W63; ./ai-lab reset W63
```

**Другие харнессы — тот же принцип:**
- **Qwen Code:** `OPENAI_BASE_URL=https://llm-gateway.corp.local/v1`, `OPENAI_API_KEY`, `OPENAI_MODEL` или `~/.qwen/settings.json`; телеметрию выключи.
- **Claude Code:** `ANTHROPIC_BASE_URL` на LiteLLM (у него есть Anthropic-совместимый `/v1/messages`), `ANTHROPIC_AUTH_TOKEN` — виртуальный ключ; `managed-settings.json` с `permissions.deny` раскатывается централизованно и пользователем не переопределяется.
- **Codex CLI:** `~/.codex/config.toml` с `[model_providers.corp]` и `base_url`, `env_key`; `sandbox_mode = "workspace-write"`, `approval_policy = "on-request"`.

Ключи названий меняются между версиями — сверяйся с документацией той версии, которую раскатываешь. Практикум «Coding-харнессы через внутренний шлюз и sandbox» — живая версия.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
