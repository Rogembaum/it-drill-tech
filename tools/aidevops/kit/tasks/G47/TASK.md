# G47 — Биллинг по токенам: chargeback командам и сверка со счётом агрегатора

**Направление:** 12 gateway.

## Сценарий
Агрегатору платим с корпоративного счёта по токенам, а внутри компании расходы нужно раскидать по командам. Текущий скрипт считает во float, дважды учитывает ретраи шлюза, неизвестные модели оценивает в ноль и не учитывает комиссию агрегатора. Напиши расчёт chargeback и сверку с выставленным счётом.

## Контракт
```python
prices = {
    "deepseek-cloud": {"input": "0.27", "output": "1.10", "cached_input": "0.07", "aggregator": True},
    "qwen-coder-local": {"input": "0", "output": "0"},
}  # USD за 1M токенов
usage = [{"request_id": "r1", "team": "team-a", "model": "deepseek-cloud",
          "prompt_tokens": 1200, "completion_tokens": 300, "cached_tokens": 1000}, ...]
invoice(usage, prices, markup="0.055")
# {"teams": {"team-a": Decimal("0.01"), ...}, "total": Decimal(...), "unknown": ["r9"]}
reconcile(Decimal("812.40"), Decimal("815.00"), tolerance="0.02")  # {"ok": True, "diff": Decimal("-2.60")}
```

- Деньги только в `Decimal`; цены приводи через `Decimal(str(x))`. Округление `ROUND_HALF_UP` до центов один раз — по итогу команды, не по каждому запросу.
- `prompt_tokens` уже включает `cached_tokens` (семантика OpenAI): некешированные = prompt − cached; если `cached_input` нет — кешированные идут по `input`.
- Повторная запись с тем же `request_id` (ретрай шлюза) учитывается один раз.
- Модель без цены не оценивается в ноль: её `request_id` попадает в `unknown`, в суммы не входит.
- `markup` (комиссия агрегатора за пополнение) применяется только к моделям с `aggregator: True`.
- Отрицательные токены — `ValueError`.
- `reconcile`: `diff = ours − provider`, `ok`, если `|diff| / provider ≤ tolerance`.

## Требования к результату
invoice() считает в Decimal по цене за 1M токенов, кешированные токены по cached_input, дубли request_id один раз, комиссия только для aggregator-моделей, неизвестные модели в unknown, округление до центов на команду; отрицательные токены — ValueError; reconcile() сравнивает с допуском.

## Как работать
```bash
./ai-lab start G47
# отредактируйте файлы workspaces/G47/
./ai-lab check G47
# при необходимости: ./ai-lab solve G47; ./ai-lab reset G47
```

**В production:** источник usage — spend logs LiteLLM (`LiteLLM_SpendLogs`) или callback в свою БД; цены — `model_info.input_cost_per_token` и прайс OpenRouter `/api/v1/models`. Сверку запускай раз в сутки и алерть расхождение больше допуска — это ловит утечку ключа раньше, чем бухгалтерия.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
