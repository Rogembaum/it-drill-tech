# H68 — Агент или workflow: decision framework и аудит антипаттернов

**Направление:** 16 agentarch. **После:** A01.

## Сценарий
Команда хочет «сделать агента» для каждого регламента: релиз, ротация секретов, отчёт о здоровье проектов GitLab. Напиши формальный decision framework: по свойствам задачи выбрать чат, pipeline, workflow или агента, для агента — ReAct или Plan→Execute и нужен ли человек в контуре. Вторая функция — аудит дизайна агента на типовые антипаттерны до того, как его начнут строить.

## Контракт
```python
classify({"acts_on_env": True, "route_known": True, "branches": True})
# {"kind": "workflow", "pattern": None, "hitl": False, "reasons": ["route_known"]}
classify({"acts_on_env": True, "steps_enumerable": True, "writes": True})
# {"kind": "agent", "pattern": "plan_execute", "hitl": True,
#  "reasons": ["route_depends_on_observations", "steps_enumerable", "hitl"]}

audit({"route_known": True, "tools": [...], "max_steps": None, "policy": "prompt", "hitl": False})
# ["agent_for_known_route", "no_step_budget", "policy_only_in_prompt"]
```

| Свойство задачи | Решение |
|---|---|
| `acts_on_env` ложно — нужен только текст | `chat` |
| `route_known` — шаги известны до старта | `pipeline`, при `branches` — `workflow`; `pattern: None` |
| маршрут зависит от наблюдений, `steps_enumerable` | `agent` + `plan_execute` |
| маршрут зависит от наблюдений, следующий шаг — из результата прошлого | `agent` + `react` |
| у агента `writes` или `error_cost == "high"` | `hitl: True` |

| Антипаттерн в `audit` | Код |
|---|---|
| агент для задачи с известным маршрутом | `agent_for_known_route` |
| нет `max_steps` | `no_step_budget` |
| инструмент `run`/`shell`/`exec`/`bash`/`run_command` или параметр `command` | `shell_tool` |
| больше 12 инструментов | `too_many_tools` |
| совпадают имена или описания инструментов | `overlapping_tools` |
| есть `access: write`, а `hitl` выключен | `write_without_hitl` |
| `policy == "prompt"` — ограничения только в промпте | `policy_only_in_prompt` |

## Требования к результату
classify: нет действий в среде — chat; маршрут известен — pipeline или workflow (с ветвлениями) без паттерна цикла; маршрут зависит от наблюдений — agent, plan_execute при перечислимых шагах, иначе react; запись или высокая цена ошибки — hitl. audit: agent_for_known_route, no_step_budget, shell_tool, too_many_tools (>12), overlapping_tools, write_without_hitl, policy_only_in_prompt.

## Как работать
```bash
./ai-lab start H68
# отредактируйте файлы workspaces/H68/
./ai-lab check H68
# при необходимости: ./ai-lab solve H68; ./ai-lab reset H68
```

**В production:** решение «агент или нет» фиксируется в ADR до написания кода: что известно о маршруте, цена ошибки, кто подтверждает запись. Релиз и ротация секретов — workflow в GitLab CI с ручным approve; агент оправдан там, где следующий шаг зависит от прочитанного (разбор инцидента, отчёт по сотням MR). Политика (запрет записи, лимиты) живёт в коде гейта, а не в системном промпте.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и ADR «агент или workflow» для одной реальной задачи команды.
