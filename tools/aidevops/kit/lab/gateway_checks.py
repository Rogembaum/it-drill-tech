"""Offline checks for LLM gateway labs G45-G49 (LiteLLM config, virtual keys, billing, OpenRouter, shadow AI).
Same rules as extra_checks: run student code from workspaces, never call real providers.
"""
import re
from decimal import Decimal

NEW_IDS = set('G45 G46 G47 G48 G49'.split())
DAY = 86400


def raises(fn, *exc):
    try:
        fn()
    except exc:
        return True
    return False


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from strings(k)
            yield from strings(v)
    elif isinstance(obj, (list, tuple, set, frozenset)):
        for v in obj:
            yield from strings(v)
    elif hasattr(obj, '__dict__'):
        yield from strings(vars(obj))


def gateway_checker(t, r, W, ROOT):
    from checks import load_module
    base = W / t
    test = r.check

    if t == 'G45':
        import yaml
        text = (base / 'config.yaml').read_text(encoding='utf-8')
        cfg = yaml.safe_load(text)
        models = cfg.get('model_list') or []
        names = {m['model_name']: m for m in models}
        loc = {n: (m.get('model_info') or {}).get('locality') for n, m in names.items()}
        router = cfg.get('router_settings') or {}
        general = cfg.get('general_settings') or {}

        test('нет литеральных ключей (sk-...) в файле', lambda: not re.search(r'sk-[A-Za-z0-9-]{3,}', text))

        def env_only():
            vals = [m['litellm_params'].get('api_key') for m in models if 'api_key' in m['litellm_params']]
            vals += [general.get('master_key'), general.get('database_url')]
            return all(isinstance(v, str) and v.startswith('os.environ/') for v in vals)
        test('api_key, master_key, database_url — только os.environ/', env_only)

        def local_internal():
            local = [m for m in models if m['litellm_params']['model'].startswith('hosted_vllm/')]
            return local and all(re.match(r'^https?://[a-z0-9-]+\.[a-z0-9-]+\.svc(\.cluster\.local)?(:\d+)?/',
                                          m['litellm_params'].get('api_base', '')) for m in local)
        test('локальная модель hosted_vllm на внутреннем адресе *.svc', local_internal)
        test('есть облачная модель openrouter/',
             lambda: any(m['litellm_params']['model'].startswith('openrouter/') for m in models))

        def localities():
            for m in models:
                want = 'cloud' if m['litellm_params']['model'].startswith('openrouter/') else 'local'
                if loc[m['model_name']] != want:
                    return False
            return True
        test('model_info.locality у каждой модели и соответствует провайдеру', localities)

        def fallbacks():
            fb = router.get('fallbacks') or []
            pairs = [(src, dst) for item in fb for src, dsts in item.items() for dst in dsts]
            return pairs and all(s in names and d in names for s, d in pairs) \
                and not any(loc[s] == 'local' and loc[d] == 'cloud' for s, d in pairs)
        test('fallbacks на существующие модели и без local -> cloud', fallbacks)
        test('у облачных моделей задан rpm', lambda: all(int(m['litellm_params'].get('rpm', 0)) > 0
                                                       for m in models if loc[m['model_name']] == 'cloud'))
        test('router_settings: num_retries 1–3, timeout 1–600',
             lambda: 1 <= int(router['num_retries']) <= 3 and 0 < float(router['timeout']) <= 600)
        r.skip('LIVE: LiteLLM поднимается с этим конфигом',
               'docker run ghcr.io/berriai/litellm --config config.yaml; приложи /health/readiness и /v1/models')

    elif t == 'G46':
        m = load_module(base / 'keys.py')
        now = 1_000_000.0

        def issue():
            reg = m.KeyRegistry()
            k1, id1 = reg.issue('team-a', ['qwen'], 3600, now)
            k2, id2 = reg.issue('team-a', ['qwen'], 3600, now)
            return isinstance(k1, str) and len(k1) >= 32 and k1 != k2 and id1 != id2 and k1 not in (id1, id2)
        test('ключ случайный, ≥ 32 символов, key_id отдельно', issue)

        def no_plain():
            reg = m.KeyRegistry()
            k, _ = reg.issue('team-a', ['qwen'], 3600, now)
            return not any(k in s for s in strings(reg))
        test('в реестре нет открытого текста ключа', no_plain)

        def authorize():
            reg = m.KeyRegistry()
            k, kid = reg.issue('team-a', ['qwen'], 3600, now)
            ok = reg.authorize(k, 'qwen', now)
            return ok.get('ok') is True and ok.get('team') == 'team-a' and ok.get('key_id') == kid \
                and reg.authorize(k, 'deepseek', now) == {'ok': False, 'reason': 'model'} \
                and reg.authorize('sk-garbage-' + 'x' * 30, 'qwen', now) == {'ok': False, 'reason': 'unknown'}
        test('authorize: team, scope по моделям, unknown', authorize)

        def tenants():
            reg = m.KeyRegistry()
            ka, _ = reg.issue('team-a', ['qwen'], 3600, now)
            kb, _ = reg.issue('team-b', ['qwen'], 3600, now)
            return reg.authorize(ka, 'qwen', now)['team'] == 'team-a' and reg.authorize(kb, 'qwen', now)['team'] == 'team-b'
        test('ключи разных команд не путаются', tenants)

        def expiry():
            reg = m.KeyRegistry()
            k, _ = reg.issue('team-a', ['qwen'], 3600, now)
            return reg.authorize(k, 'qwen', now + 3599)['ok'] and reg.authorize(k, 'qwen', now + 3600) == {'ok': False, 'reason': 'expired'}
        test('ключ истекает по TTL', expiry)

        def rotate():
            reg = m.KeyRegistry()
            k, kid = reg.issue('team-a', ['qwen'], 10 * DAY, now)
            new = reg.rotate(kid, now, grace=600)
            return new != k and reg.authorize(k, 'qwen', now + 300)['ok'] and reg.authorize(new, 'qwen', now + 300)['ok'] \
                and not reg.authorize(k, 'qwen', now + 601)['ok'] and reg.authorize(new, 'qwen', now + 601)['ok'] \
                and reg.authorize(new, 'qwen', now + 601)['team'] == 'team-a'
        test('rotate: старый ключ живёт только grace, новый наследует команду', rotate)

        def revoke():
            reg = m.KeyRegistry()
            k, kid = reg.issue('team-a', ['qwen'], 3600, now)
            reg.revoke(kid)
            return reg.authorize(k, 'qwen', now) == {'ok': False, 'reason': 'revoked'}
        test('revoke действует сразу', revoke)

        def bad_issue():
            reg = m.KeyRegistry()
            return raises(lambda: reg.issue('team-a', ['*'], 3600, now), ValueError) \
                and raises(lambda: reg.issue('team-a', [], 3600, now), ValueError) \
                and raises(lambda: reg.issue('team-a', ['qwen'], 91 * DAY, now), ValueError) \
                and raises(lambda: reg.issue('team-a', ['qwen'], 0, now), ValueError) \
                and raises(lambda: reg.issue('', ['qwen'], 3600, now), ValueError)
        test('wildcard, пустой список, TTL > 90 дней, без команды -> ValueError', bad_issue)

    elif t == 'G47':
        m = load_module(base / 'billing.py')
        prices = {'ds': {'input': '0.27', 'output': '1.10', 'cached_input': '0.07', 'aggregator': True},
                  'local': {'input': 0, 'output': 0},
                  'glm': {'input': 0.6, 'output': 2.2}}
        u = lambda rid, team, model, p, c, cached=0: {'request_id': rid, 'team': team, 'model': model,
                                                    'prompt_tokens': p, 'completion_tokens': c, 'cached_tokens': cached}

        def basic():
            x = m.invoice([u('r1', 'a', 'ds', 1_000_000, 500_000)], prices, markup='0.055')
            return x['teams']['a'] == Decimal('0.87') and isinstance(x['teams']['a'], Decimal)
        test('Decimal, цена за 1M, комиссия агрегатора: 0.82 × 1.055 = 0.87', basic)

        def no_markup():
            x = m.invoice([u('r1', 'b', 'glm', 1_000_000, 1_000_000)], prices, markup='0.055')
            return x['teams']['b'] == Decimal('2.80')
        test('комиссия только для aggregator-моделей', no_markup)

        def cached():
            x = m.invoice([u('r1', 'a', 'ds', 1_000_000, 0, 800_000)], prices, markup='0')
            return x['teams']['a'] == Decimal('0.11')
        test('кешированные токены по cached_input (0.054 + 0.056)', cached)

        def dedup():
            x = m.invoice([u('r1', 'b', 'glm', 1_000_000, 0)] * 3, prices)
            return x['teams']['b'] == Decimal('0.60')
        test('ретраи с тем же request_id учитываются один раз', dedup)

        def unknown():
            x = m.invoice([u('r1', 'a', 'glm', 1_000_000, 0), u('r9', 'a', 'gpt-x', 10**9, 10**9)], prices)
            return x['unknown'] == ['r9'] and x['teams']['a'] == Decimal('0.60') and x['total'] == Decimal('0.60')
        test('неизвестная модель не стоит 0: в unknown, вне сумм', unknown)

        def rounding():
            usage = [u('r%d' % i, 'a', 'glm', 1000, 0) for i in range(10)]
            return m.invoice(usage, prices)['teams']['a'] == Decimal('0.01')
        test('округление по итогу команды, не по запросу (10 × 0.0006 = 0.01)', rounding)
        test('total = сумма команд', lambda: m.invoice([u('1', 'a', 'glm', 10**6, 0), u('2', 'b', 'glm', 0, 10**6)], prices)['total'] == Decimal('2.80'))
        test('отрицательные токены -> ValueError', lambda: raises(lambda: m.invoice([u('r1', 'a', 'glm', -5, 0)], prices), ValueError))

        def reconcile():
            a = m.reconcile(Decimal('812.40'), Decimal('815.00'), tolerance='0.02')
            b = m.reconcile(Decimal('700.00'), Decimal('815.00'), tolerance='0.02')
            return a['ok'] is True and a['diff'] == Decimal('-2.60') and b['ok'] is False
        test('reconcile: diff и допуск', reconcile)

    elif t == 'G48':
        m = load_module(base / 'onboard.py')
        policy = {'vendors': ['deepseek', 'qwen', 'z-ai', 'moonshotai'], 'max_per_1m': {'prompt': 1.0, 'completion': 4.0},
                  'min_context': 32000, 'require_tools': True, 'rpm': 60}
        good = {'id': 'z-ai/glm-4.6', 'context_length': 202752, 'pricing': {'prompt': '0.0000006', 'completion': '0.0000022'},
                'supported_parameters': ['tools', 'tool_choice', 'temperature']}
        rejects = lambda **kw: raises(lambda: m.onboard({**good, **kw}, policy), m.PolicyError, ValueError)

        def entry():
            x = m.onboard(good, policy)
            p = x['litellm_params']
            return x['model_name'] == 'or-z-ai-glm-4.6' and p['model'] == 'openrouter/z-ai/glm-4.6' \
                and p['api_key'] == 'os.environ/OPENROUTER_API_KEY' and p['rpm'] == 60
        test('запись model_list: имя, openrouter/<id>, ключ из окружения, rpm', entry)

        def privacy():
            prov = m.onboard(good, policy)['litellm_params']['extra_body']['provider']
            return prov.get('data_collection') == 'deny' and prov.get('zdr') is True
        test('провайдер: data_collection=deny, zdr=true', privacy)

        def info():
            i = m.onboard(good, policy)['model_info']
            return i['locality'] == 'cloud' and abs(i['input_cost_per_token'] - 6e-7) < 1e-12 \
                and abs(i['output_cost_per_token'] - 2.2e-6) < 1e-12 and i['max_input_tokens'] == 202752
        test('model_info: locality=cloud, цены за токен, контекст', info)
        test('PolicyError — подкласс ValueError', lambda: issubclass(m.PolicyError, ValueError))
        test('вендор вне allowlist -> отказ', lambda: rejects(id='openai/gpt-4o'))
        test(':free -> отказ', lambda: rejects(id='deepseek/deepseek-chat-v3.1:free'))
        test('нет цены -> отказ', lambda: rejects(pricing={'prompt': '0.0000001'}))
        test('цена выше потолка -> отказ', lambda: rejects(pricing={'prompt': '0.000002', 'completion': '0.000002'}))
        test('контекст меньше минимума -> отказ', lambda: rejects(context_length=8192))
        test('нет tools -> отказ', lambda: rejects(supported_parameters=['temperature']))

    elif t == 'G49':
        m = load_module(base / 'shadow.py')
        domains = ['openrouter.ai', 'openai.com', 'deepseek.com']
        L = lambda ts, ip, code, size, method, url: '%s %6d %s %s %d %s %s - HIER_DIRECT/1.2.3.4 -' % (ts, 100, ip, code, size, method, url)
        lines = [
            L('1732170000.100', '10.20.3.14', 'TCP_TUNNEL/200', 5000, 'CONNECT', 'openrouter.ai:443'),
            L('1732170050.000', '10.20.3.14', 'TCP_TUNNEL/200', 1000, 'CONNECT', 'openrouter.ai:443'),
            L('1732170100.500', '10.20.3.14', 'TCP_DENIED/403', 0, 'CONNECT', 'api.openai.com:443'),
            L('1732170200.000', '10.50.0.7', 'TCP_TUNNEL/200', 900, 'CONNECT', 'openrouter.ai:443'),
            L('1732170300.000', '10.20.9.9', 'TCP_MISS/200', 300, 'GET', 'http://api.deepseek.com/v1/models'),
            L('1732170400.000', '10.20.9.9', 'TCP_TUNNEL/200', 300, 'CONNECT', 'notopenai.com:443'),
            L('1732170500.000', '10.20.9.9', 'TCP_TUNNEL/200', 300, 'CONNECT', 'openai.com.evil.net:443'),
            'garbage line', '',
        ]
        res = lambda: m.findings(lines, ['10.50.0.0/24'], domains)
        key = lambda: {(f['client'], f['domain']): f for f in res()}
        test('битые строки не роняют разбор', lambda: isinstance(res(), list))
        test('шлюз 10.50.0.0/24 исключён', lambda: not any(f['client'].startswith('10.50.') for f in res()))
        test('поддомены матчатся, похожие домены — нет',
             lambda: set(key()) == {('10.20.3.14', 'openrouter.ai'), ('10.20.3.14', 'openai.com'), ('10.20.9.9', 'deepseek.com')})

        def grouped():
            f = key()[('10.20.3.14', 'openrouter.ai')]
            return f['count'] == 2 and f['bytes'] == 6000 and f['first'] == 1732170000.1 and f['last'] == 1732170050.0 \
                and res()[0] is not None and res()[0]['domain'] == 'openrouter.ai'
        test('группировка (client, domain): count, bytes, first/last, сортировка по count', grouped)

        def severity():
            k = key()
            return k[('10.20.3.14', 'openai.com')]['severity'] == 'low' and k[('10.20.3.14', 'openai.com')]['denied'] == 1 \
                and k[('10.20.3.14', 'openrouter.ai')]['severity'] == 'high' and k[('10.20.9.9', 'deepseek.com')]['allowed'] == 1
        test('severity: high при пропущенных запросах, low — только denied', severity)

        def acl():
            text = m.squid_acl(['openrouter.ai', 'openai.com'], ['10.50.0.0/24'])
            rows = [x.strip() for x in text.splitlines() if x.strip()]
            allow = next(i for i, x in enumerate(rows) if x.startswith('http_access allow'))
            deny = next(i for i, x in enumerate(rows) if x.startswith('http_access deny'))
            src = next(x for x in rows if x.startswith('acl') and ' src ' in x)
            dst = next(x for x in rows if x.startswith('acl') and ' dstdomain ' in x)
            return allow < deny and '10.50.0.0/24' in src and '.openrouter.ai' in dst and '.openai.com' in dst \
                and src.split()[1] in rows[allow] and dst.split()[1] in rows[allow] and dst.split()[1] in rows[deny] \
                and 'all' not in rows[allow].split()
        test('squid_acl: allow для шлюза перед deny агрегаторов, домены с точкой', acl)
        r.skip('LIVE: ACL применён на egress-прокси', 'squid -k parse и попытка curl https://openrouter.ai не из шлюза -> 403')
    return r
