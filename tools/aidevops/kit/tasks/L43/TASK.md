# L43 — Автомасштабирование vLLM по очереди запросов (KEDA)

**Направление:** 11 models.

## Сценарий
vLLM масштабируется по CPU: под нагрузкой GPU занят на 100%, а CPU почти простаивает, очередь растёт и реплики не добавляются; ночью сервис уходит в ноль, и первый утренний запрос ждёт загрузки весов несколько минут. Переведи ScaledObject на метрику очереди vllm:num_requests_waiting из Prometheus, оставь одну тёплую реплику, ограничь максимум квотой GPU и замедли scale-down.

## Что важно
- Узкое место LLM-инференса — GPU и KV-cache, а не CPU. Сигнал перегрузки — запросы, ждущие в очереди планировщика vLLM: gauge `vllm:num_requests_waiting`.
- Метрика на под суммируется по всем репликам: `sum(...)`. KEDA делит значение на `threshold` и получает желаемое число реплик.
- `minReplicaCount: 0` экономит GPU, но каждый всплеск платит холодным стартом: скачать или прочитать веса, загрузить их в память, прогреть. Для интерактивного сервиса держат минимум одну реплику.
- `cooldownPeriod` в KEDA действует только при переходе в ноль. Скорость scale-down между 1 и N задаётся HPA behavior в `advanced.horizontalPodAutoscalerConfig`.
- `maxReplicaCount` — это физический потолок: число GPU в пуле или квота namespace. Выше него поды останутся в Pending.

## Требования к результату
KEDA ScaledObject keda.sh/v1alpha1 на Deployment vllm; trigger prometheus с sum(vllm:num_requests_waiting...), без cpu/memory; minReplicaCount >= 1; maxReplicaCount <= 4; HPA behavior scaleDown.stabilizationWindowSeconds >= 300. Live-проверка требует KEDA, Prometheus и vLLM.

## Как работать
```bash
./ai-lab start L43
# отредактируйте файлы workspaces/L43/
./ai-lab check L43
# при необходимости: ./ai-lab solve L43; ./ai-lab reset L43
```

Live: установи KEDA (`helm install keda kedacore/keda -n keda --create-namespace`) и Prometheus в учебный кластер, разверни vLLM (без GPU — CPU-сборка vLLM и модель на 0.5–1.5B параметров), примени манифест и дай нагрузку. Смотри `kubectl get hpa,scaledobject -n ai-lab -w`.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
