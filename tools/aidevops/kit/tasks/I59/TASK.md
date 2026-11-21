# I59 — Пробник стрима: TTFT, обрывы и зависания по сырому SSE

**Направление:** 14 inference. **После:** L42.

## Сценарий
Провайдеры без SLA: на старте ответы то обрываются на середине, то зависают, а OpenRouter шлёт комментарии-keepalive, которые наш замер считает первым токеном. Напиши синтетический пробник, который по сырым строкам SSE OpenAI-совместимого API считает TTFT и классифицирует исход каждого запроса, а по выборке — долю обрывов, ошибок и p95 TTFT.

## Контракт
```python
events = [  # (секунды от отправки запроса, сырая строка SSE)
    (0.20, ": OPENROUTER PROCESSING"),
    (0.45, 'data: {"choices":[{"delta":{"role":"assistant"}}]}'),
    (0.90, 'data: {"choices":[{"delta":{"content":"Привет"}}]}'),
    (1.10, 'data: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}'),
    (1.11, "data: [DONE]"),
]
probe(events, stall_after=30)
# {"ttft": 0.9, "e2e": 1.11, "tokens": 2, "max_gap": 0.2, "outcome": "ok"}
aggregate([...])
# {"n": 20, "drop_rate": 0.05, "error_rate": 0.0, "stall_rate": 0.0, "ttft_p50": 0.8, "ttft_p95": 2.1}
```

- Строки `: ...` (комментарии SSE, keepalive) и пустые — не события.
- Токен — чанк с непустым `delta.content` **или** `delta.reasoning_content` (DeepSeek R1 и аналоги думают вслух); дельта с одной `role` — не токен.
- `tokens` — число токен-чанков, `max_gap` — наибольший интервал между соседними токен-чанками, `e2e` — время последней строки.
- Исход, по приоритету:
  1. `error` — JSON с ключом `error` (OpenRouter шлёт ошибку посреди стрима) или битый JSON;
  2. `empty` — ни одного токена;
  3. `dropped` — нет `[DONE]` и ни одного `finish_reason`;
  4. `stalled` — `max_gap > stall_after`;
  5. `ok`.
- `aggregate`: доли по исходам от всех запросов; p50/p95 TTFT — nearest-rank по запросам, где TTFT есть; пустой список — `None`.

## Требования к результату
TTFT — первый чанк с непустым content или reasoning_content, комментарии и role-only дельты не считаются; исходы error > empty > dropped > stalled > ok; [DONE] или finish_reason — признак завершения; битый JSON и error-объект — error; aggregate даёт drop/error/stall rate и p50/p95 TTFT по nearest-rank.

## Как работать
```bash
./ai-lab start I59
# отредактируйте файлы workspaces/I59/
./ai-lab check I59
# при необходимости: ./ai-lab solve I59; ./ai-lab reset I59
```

**Живой замер:** `curl -N` или `httpx.stream` к `/v1/chat/completions` с `"stream": true`, на каждую строку — `(time.monotonic() - t0, line)`. Запускай пробник по cron на каждую модель шлюза (локальную и облачные), а результаты отдавай в Prometheus как `llm_ttft_seconds` и `llm_stream_dropped_total` — алерты на них в W66.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
