# I57 — vLLM в Kubernetes: локальный инференс Qwen/DeepSeek в защищённом контуре

**Направление:** 14 inference.

## Сценарий
Локальную модель для критичной разработки развернули по README из интернета: образ latest, веса качаются с Hugging Face при старте, API без ключа, Service типа LoadBalancer, trust-remote-code, root, без проб и лимитов GPU. Приведи Deployment и Service vLLM к виду, который пройдёт ревью ИБ и не будет падать при загрузке весов.

## Что исправить
- **Образ:** `vllm/vllm-openai:<версия>` или `@sha256:...`, не `latest`.
- **Веса:** `--model /models/<имя>` с PVC, смонтированного `readOnly: true`; `HF_HUB_OFFLINE=1` — в контуре нет выхода в интернет, и он не нужен. Веса попадают на PVC только после допуска (I58, L44).
- **Ключ API:** переменная `VLLM_API_KEY` из Secret (vLLM читает её сам); не `--api-key` в аргументах — аргументы видны в `ps` и `kubectl describe`.
- **Без `--trust-remote-code`:** он выполняет Python-код из репозитория модели.
- **`--max-model-len`:** иначе vLLM резервирует KV-cache под полный контекст модели и не помещается в GPU.
- **GPU:** `limits: nvidia.com/gpu: 1`, toleration `nvidia.com/gpu`, memory requests = limits.
- **Пробы:** `startupProbe` на `/health` с `failureThreshold × periodSeconds ≥ 600` — веса 32B грузятся минутами; потом `readinessProbe` и `livenessProbe` на `/health`.
- **securityContext:** `runAsNonRoot`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`; `automountServiceAccountToken: false`.
- **`/dev/shm`:** `emptyDir: {medium: Memory}` — без него tensor parallel падает на нехватке shared memory.
- **Service:** `ClusterIP`, порт 8000. Наружу — только через LiteLLM (G45).

## Требования к результату
Образ vllm/vllm-openai с фиксированным тегом или digest; модель из /models на readOnly PVC, HF_HUB_OFFLINE=1; VLLM_API_KEY из Secret; без --trust-remote-code; --max-model-len; лимит nvidia.com/gpu и toleration; startupProbe ≥ 10 минут, readiness и liveness на /health; non-root, без эскалации, drop ALL, без токена SA; /dev/shm в памяти; Service ClusterIP.

## Как работать
```bash
./ai-lab start I57
# отредактируйте файлы workspaces/I57/
./ai-lab check I57
# при необходимости: ./ai-lab solve I57; ./ai-lab reset I57
```

**Без GPU:** структуру проверяет `check`; на CPU можно отработать тот же манифест с Ollama или CPU-сборкой vLLM и маленькой моделью (практикум «Ollama и vLLM: локальный инференс»). На GPU-кластере: `kubectl apply`, `kubectl logs -f` до `Application startup complete`, затем `curl -H "Authorization: Bearer $VLLM_API_KEY" http://<svc>:8000/v1/models`.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
