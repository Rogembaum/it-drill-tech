# W67 — Карантинный контур: namespace для внешней разработки в Kubernetes

**Направление:** 15 platform. **После:** S14.

## Сценарий
Подрядчику нужен доступ к коду и к LLM-шлюзу, но не к проду, интернету и GPU. Сейчас его namespace ничем не отличается от остальных: Pod Security не включён, сеть открыта, квот нет, можно создать LoadBalancer. Опиши карантинный контур: restricted Pod Security, default-deny, egress только в DNS, шлюз и git-зеркало, квоты без GPU и внешних сервисов.

## Что должно быть в quarantine.yaml
- `Namespace quarantine` с лейблом `pod-security.kubernetes.io/enforce: restricted`.
- `NetworkPolicy` default-deny: `podSelector: {}`, `policyTypes: [Ingress, Egress]`, без правил.
- Egress-разрешения (отдельными политиками или одной):
  - DNS: namespace `kube-system`, pod `k8s-app: kube-dns`, порт 53 UDP и TCP;
  - LLM-шлюз: namespace `llm-gateway`, pod `app: litellm`, TCP 4000;
  - git-зеркало: namespace `git-mirror`, pod `app: gitlab`, TCP 443.
  Namespace выбирай по `kubernetes.io/metadata.name` — этот лейбл ставит сам Kubernetes.
- Нигде нет `ipBlock` с `0.0.0.0/0`.
- `ResourceQuota`: `requests.cpu`, `requests.memory`, `pods`, `requests.nvidia.com/gpu: "0"`, `services.loadbalancers: "0"`, `services.nodeports: "0"`.
- `LimitRange` с `default` (limits) и `defaultRequest` для контейнеров — иначе квота не даст создать pod без ресурсов.

## Требования к результату
Namespace quarantine с pod-security enforce=restricted; NetworkPolicy default-deny для Ingress и Egress; egress только DNS в kube-system (53 UDP/TCP), llm-gateway app=litellm:4000, git-mirror app=gitlab:443; нет ipBlock 0.0.0.0/0; ResourceQuota с cpu/memory/pods, requests.nvidia.com/gpu 0, services.loadbalancers 0, services.nodeports 0; LimitRange с default limits.

## Как работать
```bash
./ai-lab start W67
# отредактируйте файлы workspaces/W67/
./ai-lab check W67
# при необходимости: ./ai-lab solve W67; ./ai-lab reset W67
```

**Живая проверка в kind:** `kubectl --context kind-ai-labs apply -f workspaces/W67/quarantine.yaml`, затем pod в `quarantine`: `nslookup kubernetes.default` работает, `curl https://example.com` — нет, privileged pod отклоняется admission. NetworkPolicy фильтрует только при CNI с enforcement (Calico, Cilium).

**Работа с ИБ:** доступ подрядчика — группа в IdP с RoleBinding только на `quarantine`, заявка с владельцем и сроком; выход кода из карантина — через MR с ревью и сканированием (C11, N31).

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
