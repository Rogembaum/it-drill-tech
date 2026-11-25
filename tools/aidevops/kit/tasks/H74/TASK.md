# H74 — Мультиагентный разбор GitLab: когда делить, роутинг, изоляция, merge

**Направление:** 16 agentarch. **После:** H73.

## Сценарий
Один агент на 300 проектов не влезает в контекст, и команда предлагает пять агентов «для всего». Реши формально, когда мультиагентность окупается, реализуй статический, условный и динамический роутинг с fallback на supervisor, запусти воркеры на изолированных копиях входа и слей находки: dedup по ключу, максимум severity, evidence без дублей, источники и флаг конфликта.

## Контракт
```python
should_split({"parallel_subtasks": 3, "shared_context": False, "context_tokens": 150000,
              "window": 200000, "value": "high"})
# {"split": True, "reason": "parallel_and_context_bound"}

route({"kind": "mr"}, "static")                               # "mrs"
route(item, "conditional", rules=[(lambda i: i["pipeline"] == "failed", "pipelines")])
route(item, "dynamic", classifier=llm_pick, workers={"mrs", "pipelines"})

merge([("mrs", [finding, ...]), ("pipelines", [...])])
# [{"project_id": 1, "kind": "stale_mr", "object_id": 11, "severity": "warn",
#   "evidence": ["age 54d", "draft"], "sources": ["mrs", "pipelines"], "conflict": False}]
supervise(items, {"mrs": ..., "pipelines": ..., "supervisor": ...}, route_fn)
```

| `should_split` — первая сработавшая причина | `reason` |
|---|---|
| подзадачи делят контекст и решения | `tight_coupling` (`split: False`) |
| меньше двух параллельных подзадач | `nothing_to_parallelize` |
| `value != "high"` — мульти стоит в разы больше токенов | `low_value_for_cost` |
| `context_tokens <= window // 2` | `fits_single_agent` |
| иначе | `parallel_and_context_bound` (`split: True`) |

- Статический роутинг: `mr → mrs`, `pipeline → pipelines`, `security → security`, прочее — `supervisor`. Условный: первое совпавшее правило. Динамический: ответ классификатора принимается только из `workers`.
- Ключ находки — `(project_id, kind, str(object_id))`: `11` и `"11"` — одна находка.
- `evidence` может прийти строкой или списком; итог — список без повторов в порядке появления.
- `conflict: True`, если для ключа были и `info`, и `crit` — такой результат идёт на ревью человеку, а не молча берётся максимум.
- Воркер получает `copy.deepcopy(item)`: изолированное состояние, общий только итоговый merge.

## Требования к результату
should_split: tight_coupling, nothing_to_parallelize, low_value_for_cost, fits_single_agent или split; route static/conditional/dynamic, неизвестное и выдуманное моделью — supervisor; merge: ключ с object_id как строкой, порядок первого появления, max severity, evidence из строки и списка без дублей, sources, conflict при разнице info/crit, повторный merge не падает; supervise: воркеры получают deepcopy, результат слит.

## Как работать
```bash
./ai-lab start H74
# отредактируйте файлы workspaces/H74/
./ai-lab check H74
# при необходимости: ./ai-lab solve H74; ./ai-lab reset H74
```

**В production:** воркеры только читают (сбор по проектам параллелится), запись и итоговое решение — у одного агента или человека: неявные решения параллельных писателей конфликтуют. Supervisor пересказывает ответы воркеров и теряет детали — отдавайте пользователю результат воркера напрямую, если пересказ не нужен. Бюджет токенов делится на воркеров заранее (H72), трейс — общий, со span на воркер (H73).

**Портфолио:** после успешной проверки приложи решение, вывод `check` и сравнение одного агента и supervisor + воркеры по токенам и качеству на 10 проектах.
