# H69 — GitLab API как инструменты агента: схемы, пагинация, response_format

**Направление:** 16 agentarch. **После:** H68.

## Сценарий
Наивный Projects Health Agent получил один инструмент «выполни любой запрос к GitLab» и тянет в контекст по 400 MR с описаниями. Спроектируй узкие read-only инструменты поверх GitLab REST: строгие JSON Schema, префикс gitlab_, список MR без описаний с пагинацией по x-next-page и потолком, один MR с head_pipeline и режимом concise/detailed, упавшие jobs без логов. Ошибки аргументов — понятный текст для repair loop.

## Контракт
```python
TOOLS = [{"name": "gitlab_list_open_mrs", "access": "read", "description": "...",
          "input_schema": {"type": "object", "properties": {...}, "required": [...],
                           "additionalProperties": False}}, ...]

call("gitlab_list_open_mrs", {"project_id": 1}, api)
# {"items": [{"iid": 11, "title": "...", "updated_at": "...", "draft": False,
#             "detailed_merge_status": "ci_must_pass"}, ...], "truncated": True}
call("gitlab_get_mr", {"project_id": 1, "iid": 11, "response_format": "concise"}, api)
# {..., "head_pipeline": {"id": 900, "status": "failed"}, "description": "<≤1000 символов>"}
call("gitlab_list_failed_jobs", {"project_id": 1, "pipeline_id": 900}, api)
# {"items": [{"name": "test", "stage": "test", "failure_reason": "script_failure"}]}
```

`api.get(path, params)` возвращает `(body, headers)` и повторяет GitLab REST v4:

| Запрос | Что важно |
|---|---|
| `GET /projects/:id/merge_requests?state=opened&per_page=100&page=N` | `head_pipeline` в списке нет; следующая страница — заголовок `x-next-page` (пусто — конец) |
| `GET /projects/:id/merge_requests/:iid` | `head_pipeline`, `description`, `detailed_merge_status` |
| `GET /projects/:id/pipelines/:pipeline_id/jobs?scope[]=failed` | jobs содержат `trace` — в контекст агента он не попадает |

- `validate_args(schema, args)` — список ошибок: нет обязательного поля, лишнее поле, тип (`bool` — не `integer`), `minimum`, `enum`, `pattern`.
- `call` бросает `PermissionError` для неизвестного инструмента и `ValueError("; ".join(errors))` для неверных аргументов.
- Список: не больше `MAX_ITEMS = 200`, `truncated: True`, если GitLab вернул бы ещё.

## Требования к результату
3–6 read-инструментов gitlab_* со схемами type object, required, additionalProperties false и разными описаниями; список: state=opened, per_page=100, страницы по x-next-page, не больше 200, флаг truncated, поля iid/title/updated_at/draft/detailed_merge_status; get_mr: head_pipeline, concise режет description до 1000; failed jobs: scope[]=failed без trace; неверные args — ValueError, неизвестный инструмент — PermissionError.

## Как работать
```bash
./ai-lab start H69
# отредактируйте файлы workspaces/H69/
./ai-lab check H69
# при необходимости: ./ai-lab solve H69; ./ai-lab reset H69
```

**В production:** токен GitLab — сервисная учётка с `read_api` из Vault или CI-переменной, не в коде и не в промпте. Те же определения инструментов публикуются через MCP-сервер (M04–M06, W65), чтобы Claude Code, Cursor и свой агент видели один контракт. Поле `merge_status` устарело с GitLab 15.6 — используйте `detailed_merge_status`.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и сравнение токенов: сырой ответ GitLab против сводки инструмента на 100 MR.
