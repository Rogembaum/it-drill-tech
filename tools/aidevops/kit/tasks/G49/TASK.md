# G49 — Shadow AI: найти и закрыть прямые подключения к агрегаторам

**Направление:** 12 gateway.

## Сценарий
Шлюз есть, но часть команд ходит в OpenRouter, OpenAI и DeepSeek напрямую со своих личных ключей, мимо биллинга, маскирования и аудита. Разбери access.log egress-прокси (Squid), найди такие подключения по источникам, отличи реальную утечку от заблокированной попытки и сгенерируй ACL, который оставляет доступ к агрегаторам только шлюзу.

## Контракт
```python
lines = [
  "1732170000.123    250 10.20.3.14 TCP_TUNNEL/200 5123 CONNECT openrouter.ai:443 - HIER_DIRECT/104.18.2.3 -",
  "1732170100.500     12 10.20.3.14 TCP_DENIED/403 0 CONNECT api.openai.com:443 - HIER_NONE/- text/html",
  "1732170200.000    120 10.50.0.7 TCP_TUNNEL/200 900 CONNECT openrouter.ai:443 - HIER_DIRECT/104.18.2.3 -",
]
findings(lines, allowed_sources=["10.50.0.0/24"], domains=["openrouter.ai", "openai.com", "deepseek.com"])
# [{"client": "10.20.3.14", "domain": "openrouter.ai", "count": 1, "allowed": 1, "denied": 0,
#   "bytes": 5123, "first": 1732170000.123, "last": 1732170000.123, "severity": "high"}, ...]
squid_acl(["openrouter.ai", "openai.com"], gateway_cidrs=["10.50.0.0/24"])
```

- Формат строки Squid native: `time elapsed client code/status bytes method url user hierarchy type`. URL — `host:443` для CONNECT или `http(s)://host/...`.
- `api.openai.com` относится к `openai.com`, а `notopenai.com` и `openai.com.evil.net` — нет.
- Источники из `allowed_sources` (CIDR шлюза) — не находка.
- Группировка по `(client, domain)`; сортировка по `count` по убыванию, затем по client.
- `severity`: `high`, если хоть один запрос прошёл (`allowed > 0`, данные ушли), иначе `low` (попытка, прокси её закрыл).
- Битые строки пропускаются без исключения.
- `squid_acl` возвращает текст: `acl llm_gateway src ...`, `acl ai_aggregators dstdomain .openrouter.ai ...`, затем `http_access allow llm_gateway ai_aggregators` и **после** него `http_access deny ai_aggregators`. Squid применяет первое совпавшее правило.

## Требования к результату
findings() матчит домен и поддомены, но не похожие домены; исключает CIDR шлюза; группирует по (client, domain) с count, bytes, first/last ts, allowed/denied; severity high при пропущенных запросах; битые строки пропускает; squid_acl() — allow для шлюза строго перед deny для всех.

## Как работать
```bash
./ai-lab start G49
# отредактируйте файлы workspaces/G49/
./ai-lab check G49
# при необходимости: ./ai-lab solve G49; ./ai-lab reset G49
```

**В production:** контроль в три слоя — egress только через прокси (NetworkPolicy, файрвол), ACL прокси, DNS-RPZ на домены агрегаторов. Находки уходят в SIEM, а ИБ с владельцем сервиса переводит команду на шлюз: ключ OpenRouter у шлюза один, корпоративный. Список доменов веди в Git: агрегаторы появляются каждый месяц.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
