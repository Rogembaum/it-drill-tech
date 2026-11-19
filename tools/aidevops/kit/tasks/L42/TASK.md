# L42 — Serving SLO: TTFT, TPOT и p95 по стриму токенов

**Направление:** 11 models.

## Сценарий
Дашборд LLM-сервиса показывает «среднее время ответа 0.5 с», а пользователи жалуются на долгое ожидание первого слова. Посчитай метрики по событиям стрима: TTFT — до первого токена, TPOT — между токенами, p95 по nearest-rank вместо среднего, error rate отдельно от latency. Верни список нарушенных SLO.

## Контракт
```python
events = [{"t": 0.42, "type": "token"}, {"t": 0.47, "type": "token"},
          {"t": 0.53, "type": "token"}, {"t": 0.55, "type": "done"}]   # t — секунды от отправки запроса
stream_metrics(events)
# {"ttft": 0.42, "tpot": 0.055, "tokens": 3, "e2e": 0.55}

p95([...])            # nearest-rank: sorted(v)[ceil(0.95 * n) - 1]; пустой список -> None

evaluate(requests, {"ttft_p95": 1.0, "tpot_p95": 0.08, "error_rate": 0.01})
# requests: [{"status": 200, "events": [...]}, {"status": 500, "events": []}, ...]
# {"ttft_p95": .., "tpot_p95": .., "error_rate": .., "violations": ["error_rate"], "ok": False}
```

- TPOT = (время последнего токена − время первого) / (токенов − 1). Первый токен в TPOT не входит: его задержка — это TTFT.
- Неуспешные запросы не участвуют в latency, но входят в знаменатель error rate.
- Нет ни одного успешного ответа — это нарушение latency-SLO, а не «0 секунд».

## Требования к результату
stream_metrics(events) даёт ttft/tpot/tokens/e2e; p95(values) — nearest-rank; evaluate(requests, slo) исключает ошибки из latency, считает error_rate и перечисляет violations; один медленный хвост виден в p95, хотя среднее в норме.

## Как работать
```bash
./ai-lab start L42
# отредактируйте файлы workspaces/L42/
./ai-lab check L42
# при необходимости: ./ai-lab solve L42; ./ai-lab reset L42
```

**В production:** vLLM отдаёт эти величины гистограммами `vllm:time_to_first_token_seconds` и `vllm:time_per_output_token_seconds`; p95 считают через `histogram_quantile(0.95, sum by (le) (rate(..._bucket[5m])))`, как в S15.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
