# H73 — Evals и трассировка агента: grader, pass@k и pass^k, spans

**Направление:** 16 agentarch. **После:** H72.

## Сценарий
Агент «вроде работает»: в демо отчёт правильный, в cron каждый третий прогон пропускает упавший pipeline, а разобрать почему нельзя — нет трейса. Собери минимальный eval-контур: grader по исходу и транскрипту, оценки pass@k и pass^k по нескольким попыткам, сводка по набору задач и трассировщик со span-иерархией, статусом ошибок и маскированием секретов.

## Контракт
```python
task = {"expected": ["1/stale_mr/11", "1/failed_pipeline/900"], "allowed_extra": [],
        "forbidden_tools": ["gitlab_merge_mr"], "deep_reads_allowed": [11], "max_steps": 6,
        "allowed_status": ["done"]}
trial = {"status": "done", "steps": 4, "findings": [...], "tool_calls": [{"tool": ..., "args": ...}]}
grade(trial, task)        # {"passed": False, "reasons": ["deep_read:10", "missing:1/failed_pipeline/900"]}
pass_at_k(n=4, c=3, k=3)  # 1.0  — хотя бы одна из k попыток успешна
pass_hat_k(n=4, c=3, k=3) # 0.25 — все k попыток успешны
suite({"a": [trial, ...]}, {"a": task}, k=3)   # {"pass@k", "pass^k", "per_task": {...}}

tr = Tracer()
with tr.span("agent.run", **{"gen_ai.request.model": "qwen3"}):
    with tr.span("tool.call", tool="gitlab_get_mr"):
        ...
tr.export()   # [{"trace_id", "span_id", "parent_id", "name", "attributes", "status", "duration"}]
```

| Причина в `grade` | Когда |
|---|---|
| `status:<s>` | статус не из `allowed_status` (по умолчанию `["done"]`) |
| `missing:<key>` / `unexpected:<key>` | исход: ожидаемая находка не найдена / лишняя |
| `forbidden:<tool>` | транскрипт: вызван запрещённый инструмент |
| `deep_read:<iid>` | транскрипт: `gitlab_get_mr` для MR вне `deep_reads_allowed` |
| `too_many_steps` | `steps > max_steps` |

- Ключ находки — `project_id/kind/object_id`; причины отсортированы.
- `pass_at_k`: если `n - c < k`, то 1.0. `pass^k` показывает надёжность в cron, `pass@k` — потенциал при ручном перезапуске.
- Span при исключении получает `status: "error"` и `error.type`, исключение пробрасывается дальше. Атрибуты, чьё имя содержит `token`, `secret`, `password`, `authorization`, `api_key`, — `[REDACTED]`.

## Требования к результату
pass_at_k — несмещённая оценка 1 - C(n-c,k)/C(n,k), pass_hat_k = C(c,k)/C(n,k); grade: status, missing, unexpected, forbidden tool, deep_read вне разрешённых, too_many_steps, причины отсортированы; suite: среднее по задачам, при 3 из 4 pass@3 = 1.0 и pass^3 = 0.25; Tracer: один trace_id, parent_id, duration, error у span и родителя, исключение пробрасывается, атрибуты с token/secret/password замаскированы.

## Как работать
```bash
./ai-lab start H73
# отредактируйте файлы workspaces/H73/
./ai-lab check H73
# при необходимости: ./ai-lab solve H73; ./ai-lab reset H73
```

**В production:** golden-набор — 20–50 реальных проектов с размеченным отчётом, каждый прогон в CI (C37) повторяется 3–5 раз; релиз блокирует падение `pass^k`, а не средний балл. Грейдер кодом — первым, LLM-as-judge — только для текстовой части отчёта и с калибровкой на людях. Трейсы — OpenTelemetry с атрибутами `gen_ai.*` в Langfuse, Phoenix или Tempo; сырые промпты с данными клиентов — по политике ИБ (F50).

**Портфолио:** после успешной проверки приложи решение, вывод `check` и отчёт eval по 5 попыткам на твоей фикстуре.
