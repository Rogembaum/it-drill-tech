# H71 — Состояние агента: state-машина, персистентность, идемпотентность, память

**Направление:** 16 agentarch. **После:** H70.

## Сценарий
Projects Health Agent падает посреди прогона и после рестарта пишет второй комментарий в тот же MR; при длинной истории контекст забит сырыми ответами GitLab, а прошлые прогоны забыты. Сделай слой состояния: явная state-машина, атомарное сохранение на диск, ключ идемпотентности из действия и аргументов, повтор эффекта без дубля после рестарта, компактизация истории с сохранением решений и находок, эпизодическая память по проектам.

## Контракт
```python
TRANSITIONS = {"planning": {"acting", "aborted"},
               "acting": {"acting", "reflecting", "waiting_hitl", "done", "aborted"},
               "reflecting": {"acting", "done", "aborted"},
               "waiting_hitl": {"acting", "aborted"}, "done": set(), "aborted": set()}
transition({"status": "planning"}, "acting")
# {"status": "acting", "history": [["planning", "acting"]]}  — новый dict

store = Store("/var/lib/health-agent"); store.save("run-42", state); store.load("run-42")
idem_key("post_comment", {"iid": 11, "body": "stale"})   # "post_comment:<sha256[:32]>"
apply_effect(state, "post_comment", {"iid": 11, "body": "stale"}, effect)
# effect(idempotency_key=..., iid=11, body="stale") вызывается один раз на ключ
compact(history, keep_last=2)
# [{"kind": "summary", "text": "...", "dropped": N}, <decision/finding из головы>, <хвост>]
remember(memory, {"project_id": 1, "run": "run-42", "summary": "..."}, limit=50)
recall(memory, project_id=1, k=3)   # свежие первыми
```

- Запрещённый переход — `ValueError`. Состояние не мутируется.
- `save`: запись во временный файл, `fsync`, `os.replace`; при исключении временный файл удаляется, прошлое состояние цело.
- Ключ — из канонического JSON (`sort_keys`, без пробелов), а не `uuid4` при каждом вызове: после рестарта ключ должен совпасть.
- `apply_effect` хранит результат в `state["effects"]` — он переживает `json.dumps`/`json.loads`.

## Требования к результату
transition: разрешённые переходы, история, исходное состояние не меняется, done/aborted терминальны; Store: save через tmp + os.replace, сбой сериализации не портит прошлый файл, load отсутствующего — None; idem_key детерминирован и не зависит от порядка ключей; apply_effect после json-рестарта не вызывает эффект повторно и передаёт idempotency_key; compact: сводка + decision/finding + хвост без сырых данных; remember/recall: лимит 50, свежие эпизоды проекта первыми.

## Как работать
```bash
./ai-lab start H71
# отредактируйте файлы workspaces/H71/
./ai-lab check H71
# при необходимости: ./ai-lab solve H71; ./ai-lab reset H71
```

**В production:** checkpointer (Postgres, Redis) сохраняет состояние после каждого шага, рестарт продолжает тот же `thread_id`. Если эффект прошёл, а запись результата не успела, повтор с тем же ключом спасает только внешняя дедупликация (заголовок `Idempotency-Key`, поиск своего комментария по маркеру). Если ответ потерян, исход «неизвестно» — сначала проверить, потом повторять. Узел, который ждёт человека, при resume выполняется заново — всё до точки ожидания должно быть идемпотентным.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и схему состояний агента с точками сохранения.
