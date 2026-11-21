# W66 — Наблюдаемость шлюза: PrometheusRule на TTFT, обрывы, ошибки и бюджет команд

**Направление:** 15 platform. **После:** I59.

## Сценарий
Метрики шлюза и пробника (I59) есть, а алерты срабатывают раз в неделю случайно: p95 TTFT посчитан без by (le), окно rate 30 секунд, нет for, нет runbook, про обрывы стрима и бюджет команд ничего. Напиши PrometheusRule, по которому дежурный узнаёт о деградации модели раньше пользователей, а владелец бюджета — до того, как команда упрётся в лимит.

## Метрики
| Метрика | Тип | Лейблы |
|---|---|---|
| `llm_requests_total` | counter | `model`, `team`, `status` |
| `llm_ttft_seconds_bucket` | histogram | `model`, `le` |
| `llm_stream_dropped_total` | counter | `model` |
| `llm_spend_usd_total` | counter | `team` |
| `llm_team_budget_usd` | gauge (месячный бюджет) | `team` |

## Что нужно
- `kind: PrometheusRule`, `apiVersion: monitoring.coreos.com/v1`.
- Recording rule `llm:ttft_seconds:p95_5m` = `histogram_quantile(0.95, sum by (le, model) (rate(llm_ttft_seconds_bucket[5m])))`. Без `le` в `by` квантиль считается неверно.
- Алерты (имена любые, проверяется содержимое):
  - p95 TTFT выше порога — через recording rule или `histogram_quantile`;
  - доля обрывов: `llm_stream_dropped_total` / `llm_requests_total`;
  - доля ошибок: `llm_requests_total{status=~"5.."}` / все запросы;
  - бюджет: `llm_spend_usd_total` против `llm_team_budget_usd` с порогом `0.8`.
- Окна `rate`/`increase` — не меньше `2m` (минимум 4 скрейпа).
- У каждого алерта `for` ≥ `5m`, `labels.severity`, `annotations.summary`, `annotations.runbook_url`.

## Требования к результату
PrometheusRule monitoring.coreos.com/v1; recording rule p95 TTFT через histogram_quantile(0.95, sum by (le, model) (rate(llm_ttft_seconds_bucket[5m]))); алерты на TTFT p95, долю обрывов llm_stream_dropped_total / llm_requests_total, 5xx, бюджет команды ≥ 80% по llm_spend_usd_total и llm_team_budget_usd; окна rate ≥ 2m; for ≥ 5m; severity, summary, runbook_url.

## Как работать
```bash
./ai-lab start W66
# отредактируйте файлы workspaces/W66/
./ai-lab check W66
# при необходимости: ./ai-lab solve W66; ./ai-lab reset W66
```

**Живая проверка:** вынеси `spec` в отдельный файл и прогони `promtool check rules`; в kind с kube-prometheus-stack — `kubectl apply` и проверь правило в Prometheus UI → Rules. Дашборд Grafana строй на тех же recording rules, а трейсы конкретных запросов смотри в LangFuse (практикум «LangFuse self-hosted»).

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
