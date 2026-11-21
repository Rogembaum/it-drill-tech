# G48 — OpenRouter: подключить новую модель за 15 минут без нарушения политики

**Направление:** 12 gateway. **После:** G45.

## Сценарий
Разработчики просят «дай GLM/Kimi/новый DeepSeek прямо сейчас». Подключение должно занимать минуты, но не обходить политику: разрешённые вендоры, потолок цены, минимальный контекст, поддержка tools, запрет :free-вариантов, запрет сбора данных у провайдера. Напиши onboard(), который из карточки модели каталога OpenRouter делает запись model_list для LiteLLM или отклоняет модель с причиной.

## Контракт
```python
entry = {  # элемент GET https://openrouter.ai/api/v1/models
    "id": "z-ai/glm-4.6", "context_length": 202752,
    "pricing": {"prompt": "0.0000006", "completion": "0.0000022"},  # USD за токен, строкой
    "supported_parameters": ["tools", "tool_choice", "temperature"],
}
policy = {"vendors": ["deepseek", "qwen", "z-ai", "moonshotai"],
          "max_per_1m": {"prompt": 1.0, "completion": 4.0},
          "min_context": 32000, "require_tools": True, "rpm": 60}
onboard(entry, policy)
# {"model_name": "or-z-ai-glm-4.6",
#  "litellm_params": {"model": "openrouter/z-ai/glm-4.6", "api_key": "os.environ/OPENROUTER_API_KEY", "rpm": 60,
#                     "extra_body": {"provider": {"data_collection": "deny", "zdr": True}}},
#  "model_info": {"locality": "cloud", "input_cost_per_token": 6e-07, "output_cost_per_token": 2.2e-06,
#                 "max_input_tokens": 202752}}
```

- Отказ — `PolicyError(ValueError)` с понятной причиной: `vendor`, `free`, `pricing`, `price`, `context`, `tools`.
- `:free`-варианты запрещены всегда: у бесплатных эндпоинтов провайдер может логировать промпты.
- Цена за 1M = цена за токен × 1 000 000; отсутствующая или нечисловая цена — отказ.
- `model_name`: `or-` + id в нижнем регистре, `/` и `:` заменены на `-`.
- Цены в `model_info` — float за токен: так LiteLLM считает spend, и он совпадает с G47.

## Требования к результату
Вендор вне allowlist, :free, нет цены, цена выше потолка, контекст меньше минимума, нет tools — PolicyError; запись содержит openrouter/<id>, api_key из os.environ, rpm, extra_body.provider с data_collection=deny и zdr=true, model_info.locality=cloud и цены за токен как в каталоге.

## Как работать
```bash
./ai-lab start G48
# отредактируйте файлы workspaces/G48/
./ai-lab check G48
# при необходимости: ./ai-lab solve G48; ./ai-lab reset G48
```

**Регламент «15 минут»:** запрос в MR → `onboard()` в CI по свежему `/api/v1/models` → запись добавлена в config.yaml (G45) → smoke `/v1/chat/completions` и замер TTFT (I59) → merge с ревью ИБ → LiteLLM подхватывает конфиг. Человек проверяет только то, что автомат проверить не может.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
