# W65 — MCP registry: допуск MCP-серверов (GitLab, Jira, Confluence, k8s) по политике

**Направление:** 15 platform. **После:** M06.

## Сценарий
Разработчики подключают к агентам MCP-серверы из интернета: npx без версии, удалённые серверы без авторизации, инструменты записи в Jira и GitLab без согласования. Сделай корпоративный registry-gate: сервер допускается, только если издатель доверенный, версия и digest образа совпадают с одобренными, удалённый транспорт — внутренний HTTPS с OAuth, а инструменты записи явно согласованы. На выходе — готовый конфиг для клиента.

## Контракт
```python
manifest = {  # по мотивам server.json из MCP Registry
    "name": "io.corp/gitlab-readonly", "version": "1.4.2",
    "packages": [{"registry_type": "oci", "identifier": "registry.corp.local/mcp/gitlab",
                  "digest": "sha256:9f2c...", "transport": {"type": "stdio"}}],
    "remotes": [],
    "tools": [{"name": "get_pipeline", "access": "read"}, {"name": "get_job_trace", "access": "read"}],
}
registry = {
    "publishers": ["io.corp"], "oci_registries": ["registry.corp.local"],
    "approved": {"io.corp/gitlab-readonly": {"version": "1.4.2", "digest": "sha256:9f2c...", "write_tools": []}},
}
review(manifest, registry)
# {"decision": "allow", "reasons": [],
#  "client_config": {"mcpServers": {"gitlab-readonly": {"command": "docker",
#      "args": ["run", "--rm", "-i", "--read-only", "registry.corp.local/mcp/gitlab@sha256:9f2c..."]}}}}
```

| Проверка | reason |
|---|---|
| издатель (часть `name` до `/`) не в `publishers` | `publisher` |
| сервера нет в `approved` | `not_approved` |
| `version` не равна одобренной | `version` |
| пакет не `oci` (npm, pypi — скачиваются и исполняются при каждом запуске) | `package_type` |
| хост образа не в `oci_registries` | `registry` |
| `digest` не равен одобренному | `digest` |
| remote: не `https`, хост не `*.corp.local` или `auth != "oauth2"` | `remote` |
| инструмент с `access: write` не в `write_tools` | `write_tool:<имя>` |
| инструмент без `access` | `tool_access:<имя>` |

- Причины собираются все; любая — `deny` и `client_config: None`.
- Имя сервера в конфиге — часть `name` после `/`. Образ — строго по digest: тег можно перезаписать, digest — нет.

## Требования к результату
deny: издатель вне списка, сервер не одобрен, версия или digest не совпадают, образ не из корпоративного registry, npm/pypi-пакеты, remote не https внутренний или без oauth2, write-инструмент без согласования, инструмент без access; allow — client_config с docker run --rm -i --read-only и образом по @sha256.

## Как работать
```bash
./ai-lab start W65
# отредактируйте файлы workspaces/W65/
./ai-lab check W65
# при необходимости: ./ai-lab solve W65; ./ai-lab reset W65
```

**В production:** внутренний MCP registry (свой экземпляр или каталог в Git) — единственный источник конфигов для OpenWebUI, Claude Code, opencode и Codex; согласование write-инструментов (создать задачу в Jira, перезапустить job в GitLab, отправить письмо через Exchange, провести документ в SAP) — заявка в ИБ с владельцем системы. Live-доступ к k8s и GitLab через MCP — с сервисными учётками на чтение (M04–M06).

**Портфолио:** после успешной проверки приложи решение, вывод `check` и объяснение архитектурных решений. Не публикуй реальные ключи и логи с приватными данными.
