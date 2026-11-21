# G46 — Виртуальные ключи: выпуск, scope по моделям, ротация и отзыв

**Направление:** 12 gateway.

## Сценарий
Команды получают ключи к шлюзу в чате, ключи бессрочные, дают доступ ко всем моделям и хранятся в базе открытым текстом. Реализуй реестр виртуальных ключей: ключ показывается один раз, хранится только хеш, привязан к команде и списку моделей, имеет срок жизни, ротируется с grace-периодом и отзывается мгновенно.

## Контракт
```python
reg = KeyRegistry()
key, key_id = reg.issue(team="team-a", models=["qwen-coder-local"], ttl=30 * 86400, now=time.time())
reg.authorize(key, "qwen-coder-local", now)  # {"ok": True, "team": "team-a", "key_id": key_id}
reg.authorize(key, "deepseek-cloud", now)    # {"ok": False, "reason": "model"}
# reason: unknown | expired | revoked | model
new_key = reg.rotate(key_id, now, grace=3600)  # старый ключ работает ещё час
reg.revoke(key_id)                             # ключ (и его ротации) отключены сразу
```

- Ключ генерируй через `secrets.token_urlsafe`, храни только `sha256` от него. `key_id` — отдельный несекретный идентификатор для аудита и отзыва.
- `models` — явный список: `"*"` и пустой список запрещены (`ValueError`).
- `ttl` от 1 секунды до 90 дней, иначе `ValueError`; `team` обязателен.
- После `rotate` новый ключ наследует команду, модели и срок; старый истекает через `grace`.
- `now` передаётся явно — тесты не ждут.

## Требования к результату
issue() возвращает случайный ключ ≥ 32 символов, в реестре нет открытого текста; authorize() возвращает team или reason unknown/expired/revoked/model; rotate() оставляет старый ключ рабочим только на grace; revoke() действует сразу; wildcard-модели и TTL > 90 дней отклоняются ValueError.

## Как работать
```bash
./ai-lab start G46
# отредактируйте файлы workspaces/G46/
./ai-lab check G46
# при необходимости: ./ai-lab solve G46; ./ai-lab reset G46
```

**В LiteLLM:** то же самое делают `POST /key/generate` с `team_id`, `models`, `duration`, `max_budget`, `POST /key/regenerate` и `POST /key/delete`; ключи хранятся в Postgres в виде хеша. Практикум «LiteLLM: команды, ключи, бюджеты» — живая версия этой задачи.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
