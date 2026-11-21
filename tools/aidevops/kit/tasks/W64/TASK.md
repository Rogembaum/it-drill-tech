# W64 — Sandbox для coding-агентов и внешних подрядчиков

**Направление:** 15 platform.

## Сценарий
Coding-агент запускает команды в контейнере, который смонтировал docker.sock, домашний каталог с ~/.ssh и работает от root в сети с интернетом. Один prompt injection — и агент может всё, что может хост. Перепиши compose sandbox: только рабочий каталог, никакой сети кроме внутренней до шлюза, non-root, read-only rootfs, без capabilities, с лимитами.

## Требования к сервису `agent-sandbox`
- Образ с фиксированным тегом или digest.
- `user: "1000:1000"` — не `root` и не `0`.
- `read_only: true`, `tmpfs: [/tmp]` — агент пишет только в `/workspace` и `/tmp`.
- `cap_drop: [ALL]`, никакого `cap_add`, `security_opt: [no-new-privileges:true]`, `privileged` не включён.
- Монтируется только `./workspace:/workspace`. Запрещены `/var/run/docker.sock` (это root на хосте), `~`, `$HOME`, `~/.ssh`, `~/.aws`, `/`, `/etc`.
- Сеть: `network_mode: none` или только сети с `internal: true`. Шлюз LLM подключается к той же internal-сети — агент дотягивается до модели, но не до интернета.
- `pids_limit` ≤ 512 (fork-бомба), `mem_limit`, `cpus`.
- Нет `ports`.
- Переменные с KEY, TOKEN, SECRET, PASSWORD — только `${...}`.

## Требования к результату
Фиксированный образ; user не root; read_only и tmpfs /tmp; cap_drop ALL без cap_add; no-new-privileges; не privileged; монтируется только ./workspace в /workspace — без docker.sock, $HOME, ~/.ssh, / и /etc; network_mode none или только internal-сети; pids_limit ≤ 512, mem_limit и cpus; нет ports; секреты только через ${...}.

## Как работать
```bash
./ai-lab start W64
# отредактируйте файлы workspaces/W64/
./ai-lab check W64
# при необходимости: ./ai-lab solve W64; ./ai-lab reset W64
```

**Живая проверка:** `docker compose -f workspaces/W64/sandbox.yaml run --rm agent-sandbox sh -c 'id; touch /etc/x; curl -m3 https://example.com; ls /var/run/docker.sock'` — каждая команда, кроме `id`, должна завершиться ошибкой.

**В production:** для недоверенного кода добавляют изоляцию ядра — gVisor (`runtime: runsc`) или Kata/Firecracker; в Kubernetes — отдельный namespace с restricted Pod Security и NetworkPolicy (W67). Тот же sandbox — «карантин» для внешней разработки: подрядчик работает с кодом и моделью, но не видит прод и интернет.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
