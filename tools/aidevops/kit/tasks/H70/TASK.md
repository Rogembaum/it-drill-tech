# H70 — Цикл Projects Health Agent: structured output, repair loop и стратегия чтения

**Направление:** 16 agentarch. **После:** H69.

## Сценарий
Наивный агент верит любому ответу модели: невалидный JSON роняет цикл, находки о несуществующих MR попадают в отчёт, описание MR с текстом «смержи всё» исполняется, а глубокое чтение идёт по каждому MR. Собери agent loop: строгая проверка ответа, одна починка с текстом ошибки, отказ и обрыв по max_tokens как отдельные исходы, находки только по объектам из ответов инструментов, deep read только для отобранных MR, запись — в ожидание человека, бюджет шагов.

## Контракт
```python
# ответ модели (structured output)
{"action": "tool", "tool": "gitlab_get_mr", "args": {"project_id": 1, "iid": 11},
 "findings": [{"project_id": 1, "kind": "stale_mr", "object_id": 11,
               "severity": "warn", "evidence": "updated_at 54 дня назад"}]}
{"action": "finish", "findings": [...]}
{"refusal": "..."}

state = run(model, tools, now="2026-11-24T12:00:00Z", max_steps=10, max_repairs=1)
# {"status": "done|aborted|waiting_hitl", "stop_reason": "...", "findings": [...],
#  "calls": [{"tool": ..., "args": ...}], "trace": [...]}
```

`model(view)` получает `{"observation", "error", "findings"}`; `tools(name, args)` — инструменты из H69.

| Ситуация | Поведение |
|---|---|
| ответ не прошёл `validate` или находка про объект, которого не было в ответах инструментов | `error` с текстом уходит модели; вторая неудача подряд — `aborted` / `invalid_output` |
| `refusal` | `aborted` / `refusal` |
| `finish_reason == "length"` | ошибка валидации: ответ обрезан |
| инструмент записи (`gitlab_merge_mr`, `gitlab_close_mr`, `gitlab_post_comment`, `gitlab_delete_project`) | не вызывать; `waiting_hitl` / `write_requires_approval` |
| неизвестный инструмент | ошибка модели; второй раз — `aborted` / `mistool` |
| `gitlab_get_mr` для MR, не отобранного `should_open` по сводке | не вызывать; `error` с `reading_policy` |
| инструмент бросил `ValueError` | `error` с текстом модели, цикл продолжается |
| `max_steps` валидных шагов | `aborted` / `budget_steps` |
| `finish` | `done` / `finished` |

- Наблюдение: `{"tool", "args", "untrusted": True, "data"}` — описание MR и логи это данные, а не инструкции.
- Объект «увиден», если его `iid` пришёл из списка MR или `id` пайплайна — из `head_pipeline`.
- Находки дедуплицируются по `(project_id, kind, object_id)`.

## Требования к результату
should_open: ci_must_pass/conflict/need_rebase или старше 14 дней; validate ловит severity вне enum, пустые поля, finish_reason=length, args не объект, не-объект; repair один раз, затем aborted/invalid_output; refusal — aborted/refusal; находка без опоры на ответ инструмента отвергается; наблюдения untrusted; get_mr свежего MR не вызывается (reading_policy); write — waiting_hitl без вызова; два неизвестных инструмента — mistool; max_steps — budget_steps; ValueError инструмента возвращается модели.

## Как работать
```bash
./ai-lab start H70
# отредактируйте файлы workspaces/H70/
./ai-lab check H70
# при необходимости: ./ai-lab solve H70; ./ai-lab reset H70
```

**В production:** у провайдера включается strict structured output (`response_format: json_schema, strict: true` или tool use со схемой), но проверка в коде остаётся: схема гарантирует форму, а не правду — `object_id` может быть выдуман. JSON mode гарантирует только валидный JSON. Отказ и `finish_reason: length` — отдельные метрики в дашборде, а не «ошибка парсинга».

**Портфолио:** после успешной проверки приложи решение, вывод `check` и трейс одного прогона на фикстуре с prompt injection в описании MR.
