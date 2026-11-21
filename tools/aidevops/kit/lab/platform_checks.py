"""Offline checks for AI platform labs W62-W67 (OpenWebUI, coding harness, sandbox, MCP registry, alerts, quarantine).
Same rules as extra_checks: structural checks of student files; live parts are reported as SKIP.
"""
import json
import re

NEW_IDS = set('W62 W63 W64 W65 W66 W67'.split())
SECRET_NAME = re.compile(r'SECRET|PASSWORD|KEY|TOKEN')


def pinned(image):
    if '@sha256:' in image:
        return True
    tag = image.rsplit('/', 1)[-1].partition(':')[2]
    return bool(tag) and tag not in ('latest', 'main', 'dev', 'nightly')


def env_map(svc):
    env = svc.get('environment') or {}
    if isinstance(env, list):
        env = dict(x.split('=', 1) if '=' in x else (x, '') for x in env)
    return {k: str(v) for k, v in env.items()}


def duration(s):
    m = re.fullmatch(r'(\d+)([smhd])', str(s).strip())
    return int(m.group(1)) * {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}[m.group(2)] if m else 0


def platform_checker(t, r, W, ROOT):
    from checks import load_module
    import yaml
    base = W / t
    test = r.check

    if t == 'W62':
        doc = yaml.safe_load((base / 'compose.yaml').read_text(encoding='utf-8'))
        svcs = doc['services']
        ui = next(s for s in svcs.values() if 'open-webui' in s.get('image', ''))
        pg = next((s for s in svcs.values() if s.get('image', '').startswith('postgres')), None)
        pg_name = next((n for n, s in svcs.items() if s is pg), None)
        env = env_map(ui)

        test('образы с фиксированными тегами', lambda: all(pinned(s['image']) for s in svcs.values()))
        test('секреты только ${...}', lambda: all('${' in v for s in svcs.values() for k, v in env_map(s).items()
                                                   if SECRET_NAME.search(k)) and 'WEBUI_SECRET_KEY' in env)
        test('регистрация закрыта, новые — pending, auth включён', lambda: env.get('ENABLE_SIGNUP', '').lower() == 'false'
             and env.get('DEFAULT_USER_ROLE') == 'pending' and env.get('WEBUI_AUTH', 'true').lower() != 'false')
        test('модели только через внутренний LiteLLM', lambda: re.match(r'^http://litellm:4000/v1/?$',
             env.get('OPENAI_API_BASE_URL', env.get('OPENAI_API_BASE_URLS', ''))) is not None)
        test('direct connections, Ollama API и community sharing выключены', lambda: all(
            env.get(k, '').lower() == 'false' for k in ('ENABLE_DIRECT_CONNECTIONS', 'ENABLE_OLLAMA_API', 'ENABLE_COMMUNITY_SHARING')))
        test('DATABASE_URL на Postgres из compose', lambda: pg is not None
             and re.match(r'^postgres(ql)?://[^:]+:\$\{[^}]+\}@%s:5432/' % re.escape(pg_name), env.get('DATABASE_URL', '')) is not None)
        test('volume /app/backend/data и healthcheck', lambda: any(str(v).endswith(':/app/backend/data') for v in ui.get('volumes', []))
             and ui.get('healthcheck', {}).get('test'))
        test('порт OpenWebUI только на 127.0.0.1', lambda: ui.get('ports') and all(str(p).startswith('127.0.0.1:') for p in ui['ports']))
        test('Postgres без ports, с healthcheck; depends_on service_healthy', lambda: not pg.get('ports') and pg.get('healthcheck')
             and ui['depends_on'][pg_name]['condition'] == 'service_healthy')
        r.skip('LIVE: OpenWebUI поднят и видит модели шлюза', 'docker compose up -d; вход через SSO, в списке моделей только модели LiteLLM')

    elif t == 'W63':
        text = (base / 'opencode.json').read_text(encoding='utf-8')
        cfg = json.loads(text)
        prov = cfg.get('provider') or {}
        corp = prov.get('corp') or {}
        opts = corp.get('options') or {}
        perm = cfg.get('permission') or {}
        bash = perm.get('bash') if isinstance(perm.get('bash'), dict) else {}

        test('$schema opencode', lambda: cfg.get('$schema') == 'https://opencode.ai/config.json')
        test('единственный провайдер corp на @ai-sdk/openai-compatible', lambda: list(prov) == ['corp']
             and corp.get('npm') == '@ai-sdk/openai-compatible' and corp.get('models'))
        test('baseURL — внутренний шлюз, apiKey из {env:...}',
             lambda: re.match(r'^https?://[a-z0-9.-]+\.(corp\.local|svc|internal)(:\d+)?/', opts.get('baseURL', ''))
             and re.fullmatch(r'\{env:[A-Z_][A-Z0-9_]*\}', opts.get('apiKey', '')))
        test('model и small_model из corp', lambda: str(cfg.get('model', '')).startswith('corp/')
             and str(cfg.get('small_model', '')).startswith('corp/'))
        test('внешние провайдеры выключены', lambda: cfg.get('enabled_providers') == ['corp']
             or {'openai', 'anthropic', 'openrouter', 'google'} <= set(cfg.get('disabled_providers', [])))
        test('share=disabled, autoupdate=false', lambda: cfg.get('share') == 'disabled' and cfg.get('autoupdate') is False)
        test('edit ask, webfetch deny, bash * ask', lambda: perm.get('edit') == 'ask' and perm.get('webfetch') == 'deny'
             and bash.get('*') == 'ask')
        test('rm -rf, git push, curl|sh — deny', lambda: any(k.startswith('rm -rf') and v == 'deny' for k, v in bash.items())
             and any(k.startswith('git push') and v == 'deny' for k, v in bash.items())
             and any('curl' in k and 'sh' in k and v == 'deny' for k, v in bash.items()))
        test('нет литеральных ключей', lambda: not re.search(r'sk-[A-Za-z0-9-]{8,}', text))
        r.skip('LIVE: opencode ходит только в шлюз', 'opencode с этим конфигом; в логах LiteLLM запросы с ключом команды, прямых запросов к провайдерам нет')

    elif t == 'W64':
        doc = yaml.safe_load((base / 'sandbox.yaml').read_text(encoding='utf-8'))
        s = doc['services']['agent-sandbox']
        nets = doc.get('networks') or {}
        vols = [str(v) if not isinstance(v, dict) else '%s:%s' % (v.get('source'), v.get('target')) for v in s.get('volumes', [])]

        test('фиксированный образ', lambda: pinned(s['image']))
        test('не root', lambda: str(s.get('user', '')).split(':')[0] not in ('', '0', 'root'))
        test('read_only + tmpfs /tmp', lambda: s.get('read_only') is True
             and any(str(x).split(':')[0] == '/tmp' for x in (s.get('tmpfs') if isinstance(s.get('tmpfs'), list) else [s.get('tmpfs')])))
        test('cap_drop ALL, без cap_add, no-new-privileges, не privileged', lambda: 'ALL' in s.get('cap_drop', [])
             and not s.get('cap_add') and any('no-new-privileges' in str(x) and 'false' not in str(x) for x in s.get('security_opt', []))
             and not s.get('privileged'))
        test('монтируется только ./workspace -> /workspace', lambda: vols and all(
            v.split(':')[0] in ('./workspace', 'workspace') and v.split(':')[1] == '/workspace' for v in vols))
        test('нет docker.sock, $HOME, ~/.ssh', lambda: not any(x in v for v in vols for x in ('docker.sock', '~', '$HOME', '.ssh', '.aws')))

        def network():
            if s.get('network_mode') == 'none':
                return True
            joined = s.get('networks') or []
            joined = list(joined) if isinstance(joined, (list, dict)) else []
            return joined and all((nets.get(n) or {}).get('internal') is True for n in joined) and 'network_mode' not in s
        test('сеть: none или только internal', network)
        test('pids_limit ≤ 512, mem_limit и cpus', lambda: 0 < int(s.get('pids_limit', 0)) <= 512 and s.get('mem_limit') and s.get('cpus'))
        test('нет ports', lambda: not s.get('ports'))
        test('секреты только ${...}', lambda: all('${' in v for k, v in env_map(s).items() if SECRET_NAME.search(k)))
        r.skip('LIVE: побег из sandbox не удаётся', 'docker compose run: touch /etc/x, curl наружу, docker.sock — всё с ошибкой')

    elif t == 'W65':
        m = load_module(base / 'registry.py')
        dig = 'sha256:' + '9f2c' * 16
        registry = {'publishers': ['io.corp'], 'oci_registries': ['registry.corp.local'],
                    'approved': {'io.corp/gitlab-readonly': {'version': '1.4.2', 'digest': dig, 'write_tools': []},
                                 'io.corp/jira': {'version': '2.0.0', 'digest': dig, 'write_tools': ['create_issue']}}}
        pkg = {'registry_type': 'oci', 'identifier': 'registry.corp.local/mcp/gitlab', 'digest': dig, 'transport': {'type': 'stdio'}}
        good = {'name': 'io.corp/gitlab-readonly', 'version': '1.4.2', 'packages': [pkg], 'remotes': [],
                'tools': [{'name': 'get_pipeline', 'access': 'read'}, {'name': 'get_job_trace', 'access': 'read'}]}
        rv = lambda **kw: m.review({**good, **kw}, registry)
        denied = lambda x, reason: x['decision'] == 'deny' and reason in x['reasons'] and x['client_config'] is None

        def allow():
            x = rv()
            srv = x['client_config']['mcpServers']['gitlab-readonly']
            return x['decision'] == 'allow' and x['reasons'] == [] and srv['command'] == 'docker' \
                and srv['args'][-1] == 'registry.corp.local/mcp/gitlab@' + dig \
                and all(a in srv['args'] for a in ('--rm', '-i', '--read-only'))
        test('одобренный сервер -> allow, docker по @sha256, --rm -i --read-only', allow)
        test('чужой издатель -> publisher', lambda: denied(rv(name='com.random/gitlab'), 'publisher'))
        test('не одобрен -> not_approved', lambda: denied(rv(name='io.corp/new-thing'), 'not_approved'))
        test('другая версия -> version', lambda: denied(rv(version='1.5.0'), 'version'))
        test('другой digest -> digest', lambda: denied(rv(packages=[{**pkg, 'digest': 'sha256:' + '0' * 64}]), 'digest'))
        test('образ не из корпоративного registry -> registry',
             lambda: denied(rv(packages=[{**pkg, 'identifier': 'docker.io/someone/gitlab-mcp'}]), 'registry'))
        test('npm-пакет -> package_type', lambda: denied(rv(packages=[{'registry_type': 'npm', 'identifier': '@x/gitlab-mcp'}]), 'package_type'))
        test('remote не https/внутренний/без oauth2 -> remote', lambda: all(denied(rv(remotes=[x]), 'remote') for x in (
            {'type': 'streamable-http', 'url': 'http://mcp.corp.local/gitlab', 'auth': 'oauth2'},
            {'type': 'streamable-http', 'url': 'https://mcp.example.com/gitlab', 'auth': 'oauth2'},
            {'type': 'streamable-http', 'url': 'https://mcp.corp.local/gitlab', 'auth': 'none'})))
        test('write-инструмент без согласования -> deny', lambda: denied(rv(tools=good['tools'] + [{'name': 'retry_job', 'access': 'write'}]),
                                                                       'write_tool:retry_job'))
        test('согласованный write-инструмент -> allow', lambda: m.review({**good, 'name': 'io.corp/jira', 'version': '2.0.0',
             'tools': [{'name': 'create_issue', 'access': 'write'}]}, registry)['decision'] == 'allow')
        test('инструмент без access -> deny', lambda: denied(rv(tools=[{'name': 'mystery'}]), 'tool_access:mystery'))

    elif t == 'W66':
        doc = yaml.safe_load((base / 'llm-rules.yaml').read_text(encoding='utf-8'))
        rules = [x for g in doc['spec']['groups'] for x in g['rules']]
        alerts = [x for x in rules if 'alert' in x]
        records = {x['record']: re.sub(r'\s+', ' ', x['expr']) for x in rules if 'record' in x}
        exprs = [re.sub(r'\s+', ' ', str(x['expr'])) for x in rules]
        p95 = lambda e: re.search(r'histogram_quantile\(\s*0\.95\s*,\s*sum\s*by\s*\(([^)]*)\)\s*\(\s*rate\(llm_ttft_seconds_bucket\[', e)

        test('PrometheusRule monitoring.coreos.com/v1', lambda: doc['kind'] == 'PrometheusRule' and doc['apiVersion'] == 'monitoring.coreos.com/v1')
        test('recording rule p95 TTFT с le в by', lambda: any(p95(e) and 'le' in [s.strip() for s in p95(e).group(1).split(',')]
                                                            for e in records.values()))
        test('алерт на p95 TTFT', lambda: any(any(rec in a['expr'] for rec in records if 'ttft' in rec) or 'llm_ttft_seconds_bucket' in a['expr']
                                             for a in alerts))
        test('алерт на долю обрывов стрима', lambda: any('llm_stream_dropped_total' in a['expr'] and '/' in a['expr']
                                                        and 'llm_requests_total' in a['expr'] for a in alerts))
        test('алерт на долю 5xx', lambda: any(re.search(r'status\s*=~\s*"5', a['expr']) and '/' in a['expr'] for a in alerts))
        test('алерт на 80% бюджета команды', lambda: any('llm_spend_usd_total' in a['expr'] and 'llm_team_budget_usd' in a['expr']
                                                        and '0.8' in a['expr'] for a in alerts))
        test('окна rate/increase ≥ 2m', lambda: all(duration(w) >= 120 for e in exprs
                                                  for w in re.findall(r'(?:rate|increase)\([^\[]*\[(\w+)\]', e)))
        test('for ≥ 5m у каждого алерта', lambda: alerts and all(duration(a.get('for', '0s')) >= 300 for a in alerts))
        test('severity, summary, runbook_url', lambda: all(a.get('labels', {}).get('severity') and a.get('annotations', {}).get('summary')
                                                          and str(a.get('annotations', {}).get('runbook_url', '')).startswith('http') for a in alerts))
        r.skip('LIVE: правила загружены в Prometheus', 'promtool check rules и kubectl apply в kind с kube-prometheus-stack')

    elif t == 'W67':
        docs = [d for d in yaml.safe_load_all((base / 'quarantine.yaml').read_text(encoding='utf-8')) if d]
        ns = next(d for d in docs if d['kind'] == 'Namespace')
        nps = [d for d in docs if d['kind'] == 'NetworkPolicy']
        quota = next((d for d in docs if d['kind'] == 'ResourceQuota'), {'spec': {'hard': {}}})['spec']['hard']
        lr = next((d for d in docs if d['kind'] == 'LimitRange'), None)

        def peers():
            out = []
            for p in nps:
                for rule in p['spec'].get('egress') or []:
                    ports = {(x.get('protocol', 'TCP'), int(x['port'])) for x in rule.get('ports') or []}
                    for to in rule.get('to') or []:
                        out.append((to, ports))
            return out

        def allows(namespace, pod, port_set):
            for to, ports in peers():
                nsl = (to.get('namespaceSelector') or {}).get('matchLabels') or {}
                pl = (to.get('podSelector') or {}).get('matchLabels') or {}
                if nsl.get('kubernetes.io/metadata.name') == namespace and pod.items() <= pl.items() and port_set <= ports:
                    return True
            return False

        test('Namespace quarantine, Pod Security restricted', lambda: ns['metadata']['name'] == 'quarantine'
             and ns['metadata'].get('labels', {}).get('pod-security.kubernetes.io/enforce') == 'restricted')
        test('default-deny Ingress и Egress', lambda: any(p['spec'].get('podSelector') == {} and
             {'Ingress', 'Egress'} <= set(p['spec'].get('policyTypes', [])) and not p['spec'].get('ingress')
             and not p['spec'].get('egress') for p in nps))
        test('все политики в namespace quarantine', lambda: all(p['metadata'].get('namespace') == 'quarantine' for p in nps))
        test('DNS: kube-dns, 53 UDP и TCP', lambda: allows('kube-system', {'k8s-app': 'kube-dns'}, {('UDP', 53), ('TCP', 53)}))
        test('LLM-шлюз: llm-gateway app=litellm:4000', lambda: allows('llm-gateway', {'app': 'litellm'}, {('TCP', 4000)}))
        test('git-зеркало: git-mirror app=gitlab:443', lambda: allows('git-mirror', {'app': 'gitlab'}, {('TCP', 443)}))
        test('нет ipBlock 0.0.0.0/0 и пустых to', lambda: all('ipBlock' not in to and to for to, _ in peers())
             and all(rule.get('to') for p in nps for rule in p['spec'].get('egress') or []))
        test('квота: cpu, memory, pods; GPU, LoadBalancer, NodePort = 0', lambda: all(k in quota for k in ('requests.cpu', 'requests.memory', 'pods'))
             and all(str(quota.get(k)) == '0' for k in ('requests.nvidia.com/gpu', 'services.loadbalancers', 'services.nodeports')))
        test('LimitRange с default и defaultRequest', lambda: lr and any(x.get('default') and x.get('defaultRequest')
                                                                         for x in lr['spec']['limits']))
        r.skip('LIVE: карантин в kind', 'kubectl apply в kind-ai-labs с Calico/Cilium; nslookup работает, curl наружу и privileged pod — нет')
    return r
