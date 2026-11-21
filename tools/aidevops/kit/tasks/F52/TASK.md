# F52 — Детектор КТ и секретов: block / local_only / allow

**Направление:** 13 aisec.

## Сценарий
ИБ требует: коммерческая тайна не уходит во внешние модели, а секреты не уходят никуда. Сейчас фильтр ищет слово «секрет» и пропускает гриф с невидимым символом внутри. Напиши классификатор, который по тексту выбирает действие: block для секретов, local_only для КТ, кодовых имён проектов и внутренних хостов, allow для остального — и не срабатывает на «КТ головного мозга».

## Контракт
```python
classify("Гриф: КТ. Проект FALCON, сервер db1.corp.local", codenames=["falcon", "orion"])
# {"action": "local_only", "reasons": ["codename:falcon", "host:internal", "marker:kt"]}
classify("ключ glpat-AbCdEfGhIjKlMnOpQrSt12", codenames=[])
# {"action": "block", "reasons": ["secret:gitlab_token"]}
```

| Правило | reason | action |
|---|---|---|
| `-----BEGIN ... PRIVATE KEY-----` | `secret:private_key` | block |
| `AKIA` + 16 символов `[0-9A-Z]` | `secret:aws_key` | block |
| `glpat-` + 20+ символов | `secret:gitlab_token` | block |
| `sk-` + 20+ символов | `secret:api_key` | block |
| `scheme://user:password@host` | `secret:dsn_password` | block |
| «коммерческая тайна», «конфиденциально», «для служебного пользования», trade secret, confidential, `Гриф: КТ/ДСП`, `[КТ]`, `[ДСП]` | `marker:kt` | local_only |
| кодовое имя проекта целым словом, без учёта регистра | `codename:<имя>` | local_only |
| хост `*.corp.local` или `*.internal` | `host:internal` | local_only |

- Перед проверкой: `unicodedata.normalize("NFKC", ...)` и удаление zero-width символов (`\u200b-\u200d`, `\u2060`, `\ufeff`) — иначе «ком\u200bмерческая тайна» проходит.
- `block` важнее `local_only`, `local_only` важнее `allow`. `reasons` — отсортированный список без дублей.
- «КТ головного мозга», «тайна следствия», «Project falconry» — `allow`.

## Требования к результату
Ключи, токены и пароли в строках подключения — block; гриф «коммерческая тайна», «Гриф: КТ», [ДСП], confidential, кодовые имена целым словом, хосты *.corp.local — local_only; нормализация NFKC и удаление zero-width; reasons перечисляет все сработавшие правила; ложных срабатываний на обычном тексте нет.

## Как работать
```bash
./ai-lab start F52
# отредактируйте файлы workspaces/F52/
./ai-lab check F52
# при необходимости: ./ai-lab solve F52; ./ai-lab reset F52
```

**В production:** словарь кодовых имён и перечень грифов — от ИБ, хранится в Git, изменения через MR с ИБ-ревьюером. Регулярки дополняют классификатором (fine-tuned BERT или LLM-гвард на локальной модели) для КТ без грифа, а решение `local_only` передаётся маршрутизатору (I56). Ложные срабатывания собирай в датасет и прогоняй как регрессионный eval.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
