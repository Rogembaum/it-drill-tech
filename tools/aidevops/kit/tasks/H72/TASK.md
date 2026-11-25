# H72 — Надёжность агента: retry с jitter, circuit breaker, бюджеты, guardrails, алерты

**Направление:** 16 agentarch. **После:** H71.

## Сценарий
GitLab отдаёт 503, агент ретраит синхронно с соседями и добивает API; прогон крутится 40 минут и тратит $30; один и тот же get_mr вызывается по кругу; каждый warn будит дежурного. Собери слой надёжности: backoff с full jitter и Retry-After, классы ошибок, circuit breaker с half-open пробой, бюджеты шагов, вызовов, денег и времени, гейт действий, детектор зацикливания и маршрутизацию алертов с cooldown.

## Контракт
```python
backoff(attempt, base=0.5, cap=30.0, rnd=random.random, retry_after=None)  # секунды
classify_error(status=503)            # "retry" | "repair" | "skip" | "abort"
cb = CircuitBreaker(threshold=3, recovery=30, clock=time.monotonic)
cb.allow(); cb.record(ok=False); cb.state   # "closed" | "open" | "half_open"
b = Budget(max_steps=12, max_tool_calls=12, max_cost_usd=0.5, max_seconds=120, clock=...)
b.charge(steps=1, tool_calls=1, cost_usd=0.003)   # Stop("budget_time" | "budget_cost" | ...)
guard("gitlab_merge_mr", {}, {"hitl": True})       # "allow" | "ask" | "deny"
detect_loop(calls, repeat=3)                       # True — последние 3 вызова одинаковы
alert_route(finding, sent, now, cooldown=3600)     # "page" | "digest" | "suppress"
```

| Ошибка | Класс |
|---|---|
| 429, 500, 502, 503, 504, `TimeoutError`, `ConnectionError` | `retry` |
| 400, 422 — неверные аргументы от модели | `repair` |
| 404 — объект исчез | `skip` (находка `unchecked`, а не падение) |
| 401, 403 и прочее | `abort` |

- Full jitter: `rnd() * min(cap, base * 2 ** attempt)`. Без jitter клиенты ретраят одной волной.
- Breaker: `threshold` неудач подряд — `open`; через `recovery` — `half_open` и ровно один пропущенный вызов; его исход закрывает или снова открывает.
- Бюджет: превышение лимита — `Stop(reason)`, проверка в порядке время, деньги, инструменты, шаги.
- `guard`: удаление (`gitlab_delete_project`, `gitlab_delete_branch`) — всегда `deny`; запись — `ask` при доступном человеке, иначе `deny`; `finish` с `max_severity == "crit"` и `confidence < 0.7` — так же.
- `alert_route` запоминает время отправки `crit` в `sent`; ключ — `project_id/kind/object_id`.

## Требования к результату
backoff = rnd()*min(cap, base*2^attempt), Retry-After важнее; 429/5xx/timeout — retry, 400/422 — repair, 404 — skip, 401/403 — abort; breaker: threshold ошибок — open, после recovery одна проба half_open, провал — open, успех — closed; Budget: budget_steps/tools/cost/time; guard: delete — deny, write — ask при HITL иначе deny, crit c confidence < 0.7 — ask/deny; detect_loop: 3 одинаковых вызова подряд; alert_route: crit — page, повтор в cooldown — suppress, warn/info — digest.

## Как работать
```bash
./ai-lab start H72
# отредактируйте файлы workspaces/H72/
./ai-lab check H72
# при необходимости: ./ai-lab solve H72; ./ai-lab reset H72
```

**В production:** ретраи — только для идемпотентных вызовов (H71); fallback на другую модель или провайдера включается через LLM-шлюз (G45), а не в каждом агенте. Стоимость считается по `usage` из ответа провайдера. Причины остановки (`budget_*`, `mistool`, `low_confidence`, `no_progress`) — метрика с лейблом в Prometheus (W66), а не строка в логе.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и таблицу stop conditions агента с порогами и обоснованием.
