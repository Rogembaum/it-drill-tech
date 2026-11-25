"""Offline checks for secure inference labs I56-I61 (routing, vLLM manifest, model admission, SSE probe, pass@k, ASR WER).
Same rules as extra_checks: run student code from workspaces, no GPU and no real providers.
"""
import json

NEW_IDS = set('I56 I57 I58 I59 I60 I61'.split())
SHA = 'a' * 40


def raises(fn, *exc):
    try:
        fn()
    except exc:
        return True
    return False


def inference_checker(t, r, W, ROOT):
    from checks import load_module
    base = W / t
    test = r.check

    if t == 'I56':
        m = load_module(base / 'routing.py')
        policy = {'critical_repos': ['payments-core'], 'cloud_tenants': ['team-web'],
                  'local': {'code': 'qwen-local', 'chat': 'qwen-chat'}, 'cloud': {'code': 'or-ds', 'chat': 'or-glm'}}
        up = {'local': True, 'cloud': True}
        req = lambda **kw: {'repo': 'web-shop', 'classification': 'internal', 'task': 'code', 'tenant': 'team-web', **kw}
        go = lambda rq, health=up: m.route(rq, policy, health)

        test('критичный репозиторий -> local', lambda: go(req(repo='payments-core')) ==
             {'status': 200, 'target': 'local', 'model': 'qwen-local', 'reason': 'critical_repo'})
        test('КТ -> local даже у команды с облаком', lambda: go(req(classification='kt'))['target'] == 'local')
        test('локальный лёг: критичное -> 503, не облако',
             lambda: go(req(repo='payments-core'), {'local': False, 'cloud': True}) == {'status': 503, 'reason': 'local_unavailable'}
             and go(req(classification='kt'), {'local': False, 'cloud': True})['status'] == 503)
        test('нет классификации -> как КТ', lambda: go({'repo': 'web-shop', 'task': 'code', 'tenant': 'team-web'})['target'] == 'local'
             and go({'repo': 'web-shop', 'task': 'code', 'tenant': 'team-web'}, {'local': False, 'cloud': True})['status'] == 503)
        test('секрет -> 403', lambda: go(req(classification='secret')) == {'status': 403, 'reason': 'secret'})
        test('обычный запрос -> облако', lambda: go(req()) ==
             {'status': 200, 'target': 'cloud', 'model': 'or-ds', 'reason': 'cloud_default'})
        test('облако лежит -> fallback в local', lambda: go(req(), {'local': True, 'cloud': False})['reason'] == 'cloud_fallback')
        test('оба лежат -> 503', lambda: go(req(), {'local': False, 'cloud': False})['status'] == 503)
        test('команда без допуска к облаку -> local', lambda: go(req(tenant='team-x'))['target'] == 'local'
             and go(req(tenant='team-x'), {'local': False, 'cloud': True})['status'] == 503)
        test('неизвестная задача -> 400', lambda: go(req(task='video')) == {'status': 400, 'reason': 'task'})

    elif t == 'I57':
        import yaml
        docs = [d for d in yaml.safe_load_all((base / 'vllm.yaml').read_text(encoding='utf-8')) if d]
        dep = next(d for d in docs if d['kind'] == 'Deployment')
        svc = next(d for d in docs if d['kind'] == 'Service')
        pod = dep['spec']['template']['spec']
        c = next(x for x in pod['containers'] if 'vllm' in x['image'])
        args = [str(a) for a in c.get('args') or []]
        env = {e['name']: e for e in c.get('env') or []}
        mounts = {v['mountPath']: v for v in c.get('volumeMounts') or []}
        vols = {v['name']: v for v in pod.get('volumes') or []}

        def arg(name):
            for i, a in enumerate(args):
                if a == name and i + 1 < len(args):
                    return args[i + 1]
                if a.startswith(name + '='):
                    return a.split('=', 1)[1]
            return None

        test('образ vllm/vllm-openai с фиксированной версией', lambda: c['image'].startswith('vllm/vllm-openai')
             and ('@sha256:' in c['image'] or (':' in c['image'] and not c['image'].endswith(':latest'))))
        test('модель из /models на readOnly PVC', lambda: (arg('--model') or '').startswith('/models/')
             and mounts['/models'].get('readOnly') is True and 'persistentVolumeClaim' in vols[mounts['/models']['name']])
        test('HF_HUB_OFFLINE=1, без HF-токена', lambda: str(env['HF_HUB_OFFLINE'].get('value')) == '1'
             and not any('TOKEN' in k for k in env))
        test('VLLM_API_KEY из Secret, не в аргументах', lambda: 'secretKeyRef' in env['VLLM_API_KEY'].get('valueFrom', {})
             and '--api-key' not in ' '.join(args))
        test('без --trust-remote-code, с --max-model-len', lambda: '--trust-remote-code' not in args and int(arg('--max-model-len')) > 0)

        def gpu():
            res = c['resources']
            tol = any(t.get('key') == 'nvidia.com/gpu' for t in pod.get('tolerations') or [])
            return int(res['limits']['nvidia.com/gpu']) >= 1 and tol and res['requests']['memory'] == res['limits']['memory']
        test('GPU: лимит nvidia.com/gpu, toleration, memory requests = limits', gpu)

        def probes():
            sp = c['startupProbe']
            return sp['httpGet']['path'] == '/health' and int(sp['failureThreshold']) * int(sp.get('periodSeconds', 10)) >= 600 \
                and c['readinessProbe']['httpGet']['path'] == '/health' and c['livenessProbe']['httpGet']['path'] == '/health'
        test('startupProbe ≥ 10 минут, readiness и liveness на /health', probes)

        def hardening():
            psc, csc = pod.get('securityContext') or {}, c.get('securityContext') or {}
            return (psc.get('runAsNonRoot') or csc.get('runAsNonRoot')) is True and csc.get('allowPrivilegeEscalation') is False \
                and 'ALL' in (csc.get('capabilities') or {}).get('drop', []) and pod.get('automountServiceAccountToken') is False
        test('non-root, без эскалации, drop ALL, без токена SA', hardening)
        test('/dev/shm — emptyDir в памяти', lambda: vols[mounts['/dev/shm']['name']]['emptyDir'].get('medium') == 'Memory')
        test('Service ClusterIP на 8000', lambda: svc['spec'].get('type', 'ClusterIP') == 'ClusterIP'
             and any(int(p['port']) == 8000 for p in svc['spec']['ports']))
        r.skip('LIVE: vLLM Ready на GPU-узле', 'kubectl apply в GPU-кластере; приложи логи загрузки весов и /v1/models с ключом')

    elif t == 'I58':
        m = load_module(base / 'admission.py')
        policy = {'licenses': ['apache-2.0', 'mit'], 'review_licenses': ['qwen', 'deepseek'], 'sources': ['hf-mirror.corp.local'],
                  'min_score': {'corp-code-v3': 0.6}, 'ticket': r'^SEC-\d+$'}
        good = {'name': 'Qwen/Qwen2.5-Coder-32B-Instruct', 'revision': SHA, 'license': 'apache-2.0', 'source': 'hf-mirror.corp.local',
                'files': ['config.json', 'model-00001-of-00014.safetensors'], 'trust_remote_code': False,
                'scan': {'tool': 'modelscan', 'status': 'clean', 'revision': SHA},
                'eval': {'suite': 'corp-code-v3', 'score': 0.71}, 'security_ticket': 'SEC-1234'}
        a = lambda **kw: m.admit({**good, **kw}, policy)
        test('чистая карточка -> approve без причин', lambda: a() == {'decision': 'approve', 'reasons': []})
        test('revision=main -> reject', lambda: a(revision='main')['decision'] == 'reject' and 'revision' in a(revision='main')['reasons'])
        test('pickle-файл -> reject с именем файла', lambda: 'pickle:pytorch_model.bin' in a(files=good['files'] + ['pytorch_model.bin'])['reasons'])
        test('источник вне зеркал -> reject', lambda: a(source='huggingface.co') == {'decision': 'reject', 'reasons': ['source']})
        test('скан грязный, отсутствует или другой ревизии -> reject', lambda: all(
            a(scan=s)['reasons'] == ['scan'] for s in ({'status': 'infected', 'revision': SHA}, None, {'status': 'clean', 'revision': 'b' * 40})))
        test('лицензия из списка ревью -> needs_review', lambda: a(license='qwen') == {'decision': 'needs_review', 'reasons': ['license_review']})
        test('неизвестная лицензия -> reject', lambda: a(license='cc-by-nc-4.0')['decision'] == 'reject')
        test('trust_remote_code -> needs_review', lambda: a(trust_remote_code=True)['reasons'] == ['remote_code'])
        test('eval ниже порога -> reject, неизвестный набор -> review',
             lambda: a(eval={'suite': 'corp-code-v3', 'score': 0.5})['reasons'] == ['eval']
             and a(eval={'suite': 'humaneval', 'score': 0.9}) == {'decision': 'needs_review', 'reasons': ['eval_suite']})
        test('нет тикета ИБ -> needs_review', lambda: a(security_ticket='') == {'decision': 'needs_review', 'reasons': ['security_ticket']}
             and a(security_ticket='JIRA-1')['decision'] == 'needs_review')

        def all_reasons():
            x = a(revision='main', source='huggingface.co', trust_remote_code=True, security_ticket=None)
            return x['decision'] == 'reject' and {'revision', 'source', 'remote_code', 'security_ticket'} <= set(x['reasons'])
        test('все причины сразу, reject важнее review', all_reasons)

    elif t == 'I59':
        m = load_module(base / 'probe.py')
        tok = lambda text, fin=None: 'data: ' + json.dumps({'choices': [{'delta': {'content': text}, 'finish_reason': fin}]})
        ok_events = [(0.2, ': OPENROUTER PROCESSING'), (0.45, 'data: {"choices":[{"delta":{"role":"assistant"}}]}'),
                     (0.9, tok('Привет')), (1.1, tok('!', 'stop')), (1.11, 'data: [DONE]')]

        def ok():
            x = m.probe(ok_events)
            return x['outcome'] == 'ok' and abs(x['ttft'] - 0.9) < 1e-9 and x['tokens'] == 2 \
                and abs(x['e2e'] - 1.11) < 1e-9 and abs(x['max_gap'] - 0.2) < 1e-9
        test('TTFT без keepalive и role-only, tokens, e2e, max_gap', ok)
        test('reasoning_content считается токеном', lambda: abs(m.probe([
            (0.3, 'data: ' + json.dumps({'choices': [{'delta': {'reasoning_content': 'думаю'}}]})),
            (2.0, tok('ответ', 'stop'))])['ttft'] - 0.3) < 1e-9)
        test('finish_reason без [DONE] — завершён', lambda: m.probe([(0.5, tok('a', 'stop'))])['outcome'] == 'ok')
        test('обрыв на середине -> dropped', lambda: m.probe([(0.5, tok('a')), (0.7, tok('b'))])['outcome'] == 'dropped')
        test('только keepalive -> empty', lambda: m.probe([(1, ': ping'), (2, ': ping'), (3, 'data: [DONE]')])['outcome'] == 'empty')
        test('error-объект или битый JSON -> error', lambda: m.probe([(0.5, tok('a')),
             (0.6, 'data: {"error":{"code":502,"message":"provider"}}')])['outcome'] == 'error'
             and m.probe([(0.5, tok('a')), (0.6, 'data: {oops'), (0.7, 'data: [DONE]')])['outcome'] == 'error')
        test('пауза между токенами > stall_after -> stalled',
             lambda: m.probe([(0.5, tok('a')), (40.0, tok('b', 'stop'))], stall_after=30)['outcome'] == 'stalled')

        def agg():
            res = [{'ttft': float(i), 'outcome': 'ok'} for i in range(1, 19)]
            res += [{'ttft': 19.0, 'outcome': 'dropped'}, {'ttft': None, 'outcome': 'error'}]
            x = m.aggregate(res)
            return x['n'] == 20 and abs(x['drop_rate'] - .05) < 1e-9 and abs(x['error_rate'] - .05) < 1e-9 \
                and x['stall_rate'] == 0 and x['ttft_p95'] == 19.0 and x['ttft_p50'] == 10.0 \
                and m.aggregate([{'ttft': None, 'outcome': 'empty'}])['ttft_p95'] is None
        test('aggregate: доли исходов и p50/p95 nearest-rank', agg)

    elif t == 'I60':
        m = load_module(base / 'bench.py')
        test('pass@1 = c/n', lambda: abs(m.pass_at_k(10, 3, 1) - 0.3) < 1e-9)
        test('pass@5 несмещённый', lambda: abs(m.pass_at_k(10, 3, 5) - (1 - 21 / 252)) < 1e-9)
        test('n − c < k -> 1.0, c = 0 -> 0.0', lambda: m.pass_at_k(10, 8, 5) == 1.0 and m.pass_at_k(10, 0, 3) == 0.0)
        test('некорректные n/c/k -> ValueError', lambda: all(raises(lambda a=a: m.pass_at_k(*a), ValueError)
                                                           for a in ((10, 3, 0), (10, 3, 11), (10, 11, 1), (10, -1, 1))))
        results = [
            {'model': 'glm-4.6', 'local': False, 'ttft_p95': 1.4, 'cost_per_1m': 2.2, 'tasks': {'code': {'n': 20, 'c': 15}}},
            {'model': 'deepseek-v3.1', 'local': False, 'ttft_p95': 2.1, 'cost_per_1m': 1.1, 'tasks': {'code': {'n': 20, 'c': 15}}},
            {'model': 'qwen3-coder-30b', 'local': True, 'ttft_p95': 0.6, 'cost_per_1m': 0.0, 'tasks': {'code': {'n': 20, 'c': 12}}},
            {'model': 'deepseek-coder-lite', 'local': True, 'ttft_p95': 0.4, 'cost_per_1m': 0.0, 'tasks': {'code': {'n': 5, 'c': 5}}},
            {'model': 'kimi-k2', 'local': False, 'ttft_p95': 4.5, 'cost_per_1m': 2.5, 'tasks': {'code': {'n': 20, 'c': 18}}},
            {'model': 'gigaam', 'local': True, 'ttft_p95': 0.1, 'cost_per_1m': 0.0, 'tasks': {'asr': {'n': 50, 'c': 45}}},
        ]
        prof = {'task': 'code', 'k': 1, 'critical': False, 'max_ttft_p95': 3.0, 'min_n': 20}

        def normal():
            x = m.select(results, prof)
            return x['model'] == 'deepseek-v3.1' and [n for n, _ in x['ranking']] == ['deepseek-v3.1', 'glm-4.6', 'qwen3-coder-30b']
        test('лучший pass@k, ничья -> дешевле', normal)
        test('отсев с причинами: ttft, insufficient_samples, no_results', lambda: m.select(results, prof)['rejected'] == {
            'deepseek-coder-lite': 'insufficient_samples', 'kimi-k2': 'ttft', 'gigaam': 'no_results'})

        def critical():
            x = m.select(results, {**prof, 'critical': True})
            return x['model'] == 'qwen3-coder-30b' and x['rejected']['glm-4.6'] == 'cloud_for_critical' \
                and x['rejected']['kimi-k2'] == 'cloud_for_critical'
        test('critical -> только локальные модели', critical)
        test('нет кандидатов -> model None', lambda: m.select(results, {**prof, 'max_ttft_p95': 0.01})['model'] is None)

    elif t == 'I61':
        m = load_module(base / 'asr_eval.py')
        test('normalize: регистр, ё, пунктуация, тире', lambda: m.normalize('Ёлка, ёжик — и т.д.!') == 'елка ежик и т д'
             and m.normalize('  Кто-то   пришёл ') == 'кто то пришел')
        test('wer по словам', lambda: abs(m.wer('мама мыла раму', 'мама мыла рамы') - 1 / 3) < 1e-9
             and abs(m.wer('мама мыла раму', 'мама раму') - 1 / 3) < 1e-9 and m.wer('Ёлка, да', 'елка да') == 0)
        test('вставки учитываются (WER может быть > 1)', lambda: m.wer('да', 'да нет нет') == 2.0)
        test('пустой эталон -> ValueError', lambda: raises(lambda: m.wer('  ', 'что-то'), ValueError))
        test('corpus_wer — сумма правок / сумма слов', lambda: abs(m.corpus_wer(
            [('да', 'нет'), ('один два три четыре', 'один два три четыре')]) - 0.2) < 1e-9)
        test('rtf = обработка / аудио', lambda: abs(m.rtf(12.0, 60.0) - 0.2) < 1e-9)

        ref = [('созвон по релизу в пятницу', ''), ('проверь логи пайплайна', ''), ('выкатываем во вторник', '')]
        hyp = lambda bad: [(r, ' '.join(r.split()[:-1] + ['ошибка'] if i < bad else r.split())) for i, (r, _) in enumerate(ref)]
        models = {
            'whisper-small': {'pairs': hyp(3), 'processing_seconds': 30, 'audio_seconds': 600},
            'whisper-large-v3-turbo': {'pairs': hyp(0), 'processing_seconds': 240, 'audio_seconds': 600},
            'gigaam-v2-ctc': {'pairs': hyp(1), 'processing_seconds': 20, 'audio_seconds': 600},
        }

        def choose():
            x = m.choose(models, max_rtf=0.3)
            return x['model'] == 'gigaam-v2-ctc' and set(x['scores']) == set(models) \
                and abs(x['scores']['whisper-large-v3-turbo']['rtf'] - 0.4) < 1e-9 and x['scores']['whisper-large-v3-turbo']['wer'] == 0
        test('choose: лучший WER среди моделей с RTF ≤ порога', choose)
        test('никто не прошёл по RTF -> None', lambda: m.choose(models, max_rtf=0.01)['model'] is None)
    return r
