# it-drill-tech
https://www.it-drill.tech

## CI и слияние изменений

GitHub Actions запускает проверки при открытии или обновлении pull request в `main`, а также после push в `main`. Gitleaks сканирует git-историю на утечки секретов, Checkov проверяет Terraform-конфигурацию, а остальные шаги проверяют синтаксис JavaScript, структуру вопросов и кейсов, ссылки на скрипты в `index.html`, форматирование Terraform и валидность конфигурации. Для репозитория организации Gitleaks требует secret `GITLEAKS_LICENSE` (для персонального аккаунта он не нужен). Checkov исключает `CKV_OPENSTACK_1`, который ошибочно считает ссылку на sensitive-переменную пароля жёстко заданным паролем. Terraform-провайдеры закреплены в `terraform/.terraform.lock.hcl`; CI инициализирует их без подключения к удалённому state, учётные данные Selectel не нужны.

Чтобы запретить прямые изменения `main`, откройте **Settings → Rules → Rulesets** (либо **Branches → Add branch protection rule**) и добавьте правило для `main`: требовать pull request перед слиянием, требовать прохождения status check **`CI / ci`**, запретить обход правила и, если в репозитории есть доступный ревьюер, требовать хотя бы одно одобрение. Полезно также включить разрешение всех review conversations и сброс одобрений при новых коммитах. Сами настройки защиты ветки в этом репозитории этим workflow не меняются.

Локально можно повторить CI-команды: `node tools/validate.mjs`, затем из `terraform/` выполнить `terraform fmt -check -recursive`, `terraform init -backend=false -input=false -lockfile=readonly` и `terraform validate`.
