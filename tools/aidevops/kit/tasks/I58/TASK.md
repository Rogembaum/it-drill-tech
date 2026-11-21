# I58 — Допуск модели в контур: быстрый деплой с обязательной проверкой ИБ

**Направление:** 14 inference.

## Сценарий
Новая модель выходит — разработчики хотят её завтра, ИБ хочет проверку. Сейчас всё решается в переписке, и одна модель с pickle-весами уже попала в кластер. Напиши автоматический gate по карточке модели: что можно проверить машиной — проверяется машиной, на ручное ревью уходит только то, что требует человека.

## Контракт
```python
card = {
    "name": "Qwen/Qwen2.5-Coder-32B-Instruct", "revision": "0eb6a4c8...40 hex",
    "license": "apache-2.0", "source": "hf-mirror.corp.local",
    "files": ["config.json", "model-00001-of-00014.safetensors", "tokenizer.json"],
    "trust_remote_code": False,
    "scan": {"tool": "modelscan", "status": "clean", "revision": "0eb6a4c8..."},
    "eval": {"suite": "corp-code-v3", "score": 0.71},
    "security_ticket": "SEC-1234",
}
policy = {"licenses": ["apache-2.0", "mit"], "review_licenses": ["qwen", "llama3.1", "deepseek"],
          "sources": ["hf-mirror.corp.local"], "min_score": {"corp-code-v3": 0.6}, "ticket": r"^SEC-\d+$"}
admit(card, policy)  # {"decision": "approve", "reasons": []}
```

| Проверка | reason | Итог |
|---|---|---|
| `revision` — не 40 hex (ветка, тег) | `revision` | reject |
| файлы `.bin .pt .pth .pkl .ckpt` | `pickle:<файл>` | reject |
| `source` не из зеркал | `source` | reject |
| скана нет, не `clean` или другой ревизии | `scan` | reject |
| лицензия вне обоих списков | `license` | reject |
| лицензия из `review_licenses` | `license_review` | needs_review |
| `trust_remote_code: true` | `remote_code` | needs_review |
| eval ниже порога или отсутствует | `eval` | reject |
| набора eval нет в `min_score` | `eval_suite` | needs_review |
| нет тикета ИБ или не по шаблону | `security_ticket` | needs_review |

- Причины собираются **все сразу**, а не до первой: владелец исправит всё за один заход.
- Есть хоть один reject — `reject`; иначе хоть один review — `needs_review`; иначе `approve`.

## Требования к результату
reject: revision не commit sha, pickle-файлы, источник вне зеркал, нет чистого скана той же ревизии, лицензия вне списков, eval ниже порога; needs_review: trust_remote_code, лицензия из списка ревью, eval-набор без порога, нет тикета ИБ; approve — только без причин; reasons собирает все причины сразу.

## Как работать
```bash
./ai-lab start I58
# отредактируйте файлы workspaces/I58/
./ai-lab check I58
# при необходимости: ./ai-lab solve I58; ./ai-lab reset I58
```

**Конвейер «быстрый деплой»:** MR с карточкой → зеркалирование весов в корпоративный S3 → `modelscan` и проверка sha256 (L44) → eval на своём наборе (I60) → `admit()` → при `approve` веса попадают на PVC `models-approved` (I57), при `needs_review` — тикет в очередь ИБ с готовым списком причин.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
