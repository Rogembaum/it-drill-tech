# G45 — LiteLLM: config.yaml внутреннего шлюза (локальные модели + OpenRouter)

**Направление:** 12 gateway.

## Сценарий
Конфиг LiteLLM собран «на коленке»: ключ OpenRouter и master key лежат в файле, локальная модель смотрит в публичный адрес, критичная локальная модель при сбое молча падает в облако. Приведи config.yaml к виду, который можно отдать в ревью ИБ: секреты только из окружения, локальный vLLM по внутреннему адресу, метка locality на каждой модели, fallback только из облака в локальный контур, лимиты и таймауты.

## Что должно быть в конфиге
- `model_list`: минимум одна локальная модель (`hosted_vllm/...` на `http://<svc>.<ns>.svc:8000/v1`) и одна облачная (`openrouter/...`).
- Секреты: `api_key: os.environ/OPENROUTER_API_KEY`, `general_settings.master_key: os.environ/LITELLM_MASTER_KEY`, `general_settings.database_url: os.environ/DATABASE_URL`. Никаких `sk-...` в файле.
- `model_info.locality: local | cloud` у каждой модели — по этой метке маршрутизатор (I56) и ИБ понимают, куда уходят данные.
- `router_settings.fallbacks`: из облачной модели в локальную можно, из локальной в облачную нельзя — иначе КТ уйдёт наружу при первом же сбое GPU.
- `rpm` у облачной модели — защита корпоративного счёта агрегатора от runaway-агента.
- `router_settings.num_retries` 1–3, `router_settings.timeout` 1–600 секунд.

## Требования к результату
Нет литеральных ключей; все api_key/master_key/database_url — os.environ/; локальная модель — hosted_vllm с api_base *.svc; у каждой модели model_info.locality; fallbacks ссылаются на существующие модели и не ведут из local в cloud; у облачной модели есть rpm; router_settings.num_retries 1–3 и timeout 1–600.

## Как работать
```bash
./ai-lab start G45
# отредактируйте файлы workspaces/G45/
./ai-lab check G45
# при необходимости: ./ai-lab solve G45; ./ai-lab reset G45
```

**Живая проверка:** `docker run --rm -p 4000:4000 -v $PWD/workspaces/G45/config.yaml:/app/config.yaml -e LITELLM_MASTER_KEY -e OPENROUTER_API_KEY -e DATABASE_URL ghcr.io/berriai/litellm:<pinned-tag> --config /app/config.yaml`, затем `curl localhost:4000/health/readiness` и `curl localhost:4000/v1/models -H "Authorization: Bearer $LITELLM_MASTER_KEY"`.

**В production:** конфиг лежит в Git, секреты приходят из Vault/External Secrets, изменения model_list идут через MR с ревью ИБ. Метки locality дублируй в LiteLLM access groups, чтобы команды без допуска к облаку не видели облачные модели.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
