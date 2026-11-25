# F54 — Перечень угроз: OWASP LLM Top 10 + КТ → контроли, владельцы, проверки

**Направление:** 13 aisec.

## Сценарий
ИБ прислала перечень угроз и просит до запуска платформы показать, чем закрыта каждая. Черновик неполный: половины пунктов OWASP LLM Top 10 (2025) нет, у остальных TBD вместо контролей, а принятые риски без подписи ИБ и без срока. Доведи реестр до вида, который ИБ может согласовать.

## OWASP Top 10 for LLM Applications 2025
| ID | Угроза |
|---|---|
| LLM01 | Prompt Injection |
| LLM02 | Sensitive Information Disclosure |
| LLM03 | Supply Chain |
| LLM04 | Data and Model Poisoning |
| LLM05 | Improper Output Handling |
| LLM06 | Excessive Agency |
| LLM07 | System Prompt Leakage |
| LLM08 | Vector and Embedding Weaknesses |
| LLM09 | Misinformation |
| LLM10 | Unbounded Consumption |

Плюс внутренняя угроза **KT01** — утечка коммерческой тайны во внешний контур (облачные модели, агрегаторы, личные ключи).

## Формат записи
```yaml
threats:
  - id: LLM01
    title: Prompt Injection
    severity: critical          # low | medium | high | critical
    owner: ai-platform          # команда, которая чинит
    status: implemented         # implemented | planned | accepted
    controls:
      - id: input-guard
        type: preventive        # preventive | detective | corrective
        implemented_by: F53 scan_input в шлюзе
    tests: [F53, F55]           # ID задач этого стенда, которые проверяют контроль
```

- `accepted` (риск принят) — только с `risk_acceptance: {approver: "<кто из ИБ>", expires: YYYY-MM-DD}`; в approver должно быть «ИБ» или «security».
- `high` и `critical` — минимум один `preventive` и один `detective` контроль.
- LLM01, LLM02 и KT01 — не ниже `high`.
- Никаких `TBD` и `TODO`. Проверка сверяет `tests` с `tasks.json` стенда.

## Требования к результату
Есть LLM01–LLM10 и KT01 по одному разу; у каждой угрозы severity, owner, status, controls с типом и исполнителем, tests со ссылками на существующие задачи стенда; у high/critical есть preventive и detective; LLM01, LLM02, KT01 не ниже high; accepted — только с подписью ИБ и сроком; нет TBD/TODO.

## Как работать
```bash
./ai-lab start F54
# отредактируйте файлы workspaces/F54/
./ai-lab check F54
# при необходимости: ./ai-lab solve F54; ./ai-lab reset F54
```

**Работа с ИБ:** реестр живёт в Git рядом с кодом платформы, ИБ — обязательный approver в CODEOWNERS. На согласовании показываешь не слайды, а зелёные проверки из `tests`. Принятые риски пересматриваются к дате `expires`; просроченное принятие — повод остановить релиз.

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
