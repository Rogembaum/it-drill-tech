# W62 — OpenWebUI: compose для прод-контура за внутренним шлюзом

**Направление:** 15 platform.

## Сценарий
OpenWebUI подняли одной командой из README: образ :main, SQLite в контейнере, открытая регистрация, порт на 0.0.0.0, ключ OpenAI в compose и разрешённые пользовательские подключения — любой может вписать свой ключ OpenRouter и ходить мимо шлюза. Перепиши compose под прод: Postgres, секреты из окружения, только внутренний LiteLLM, регистрация через одобрение, закрытые direct connections.

## Что должно быть
| Переменная open-webui | Значение | Зачем |
|---|---|---|
| `WEBUI_SECRET_KEY` | `${WEBUI_SECRET_KEY:?}` | подпись JWT; без неё сессии сбрасываются при рестарте |
| `WEBUI_AUTH` | не `false` | без авторизации UI открыт всем |
| `ENABLE_SIGNUP` | `false` | пользователи приходят через SSO/OIDC или приглашение |
| `DEFAULT_USER_ROLE` | `pending` | новый пользователь ждёт одобрения администратора |
| `OPENAI_API_BASE_URL` | `http://litellm:4000/v1` | все модели — только через внутренний шлюз (G45) |
| `OPENAI_API_KEY` | `${OPENWEBUI_LITELLM_KEY}` | виртуальный ключ шлюза для OpenWebUI (G46) |
| `ENABLE_DIRECT_CONNECTIONS` | `false` | запрет своих эндпоинтов и ключей у пользователей |
| `ENABLE_OLLAMA_API` | `false` | Ollama не используется, лишний путь к моделям |
| `ENABLE_COMMUNITY_SHARING` | `false` | чаты не уходят на внешний сайт |
| `DATABASE_URL` | `postgresql://openwebui:${POSTGRES_PASSWORD}@postgres:5432/openwebui` | бэкап, HA, без SQLite в контейнере |

- Образы с фиксированным тегом (`ghcr.io/open-webui/open-webui:v0.6.x`, `postgres:16.x`), не `:main` и не `:latest`.
- Порт OpenWebUI — `127.0.0.1:3000:8080`: наружу через reverse proxy с TLS.
- Volume на `/app/backend/data`, `healthcheck` на `http://localhost:8080/health`.
- Postgres: без `ports`, свой `healthcheck`, `open-webui` ждёт его через `depends_on: condition: service_healthy`.
- В файле нет литеральных паролей и ключей: всё, где в имени SECRET, PASSWORD или KEY, — через `${...}`.

## Требования к результату
Образы с фиксированными тегами; WEBUI_SECRET_KEY, ключ шлюза и пароль БД — ${...}; ENABLE_SIGNUP=false, DEFAULT_USER_ROLE=pending, WEBUI_AUTH не выключен; OPENAI_API_BASE_URL на http://litellm:4000/v1; ENABLE_DIRECT_CONNECTIONS=false, ENABLE_OLLAMA_API=false, ENABLE_COMMUNITY_SHARING=false; DATABASE_URL на postgres; volume и healthcheck; порт только на 127.0.0.1; Postgres без публикации портов, depends_on service_healthy.

## Как работать
```bash
./ai-lab start W62
# отредактируйте файлы workspaces/W62/
./ai-lab check W62
# при необходимости: ./ai-lab solve W62; ./ai-lab reset W62
```

**Живая проверка:** `docker compose -f workspaces/W62/compose.yaml config` (подставит переменные из `.env`), затем `up -d`, первый вход создаёт администратора. Часть настроек OpenWebUI после первого запуска хранится в БД (PersistentConfig) и переменные окружения их уже не меняют — проверь их в Admin Panel. Практикумы «OpenWebUI: установка и подключение к шлюзу» и «OpenWebUI в проде» — живая версия.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
