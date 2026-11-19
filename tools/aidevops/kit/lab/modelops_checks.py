"""Offline checks for ModelOps labs L41-L44 (gateway, serving SLO, autoscaling, model artifacts).
Same rules as extra_checks: run student code from workspaces, never touch a real cluster.
"""
import hashlib
import tempfile
from pathlib import Path

NEW_IDS = set('L41 L42 L43 L44'.split())
DAY = 86400


def raises(fn, *exc):
    try:
        fn()
    except exc:
        return True
    return False


def modelops_checker(t, r, W, ROOT):
    from checks import load_module
    base = W / t
    test = r.check

    if t == 'L41':
        m = load_module(base / 'gateway.py')
        lim = {'a': {'rpm': 2, 'daily_tokens': 10**6}, 'b': {'rpm': 2, 'daily_tokens': 10**6}}
        test('неизвестный tenant -> 403', lambda: m.Gateway(lim).admit('ghost', 100, 0)['status'] == 403)
        test('max_tokens <= 0 -> 400', lambda: m.Gateway(lim).admit('a', 0, 0)['status'] == 400)

        def rate():
            g = m.Gateway(lim)
            first = [g.admit('a', 10, 100.0)['status'] for _ in range(2)]
            third = g.admit('a', 10, 100.5)
            return first == [200, 200] and third['status'] == 429 and third.get('reason') == 'rate' \
                and 0 < third.get('retry_after', 0) <= 30
        test('rpm=2: третий запрос подряд -> 429 rate с retry_after', rate)

        def refill():
            g = m.Gateway(lim)
            for _ in range(2):
                g.admit('a', 10, 100.0)
            return g.admit('a', 10, 100.0)['status'] == 429 and g.admit('a', 10, 131.0)['status'] == 200
        test('bucket пополняется со временем', refill)

        def isolated():
            g = m.Gateway(lim)
            for _ in range(3):
                g.admit('a', 10, 100.0)
            return g.admit('b', 10, 100.0)['status'] == 200
        test('квота одного tenant не трогает другого', isolated)

        blim = {'a': {'rpm': 100, 'daily_tokens': 1000}}

        def budget():
            g = m.Gateway(blim)
            ok = g.admit('a', 600, 10.0)['status'] == 200
            x = g.admit('a', 600, 11.0)
            return ok and x['status'] == 429 and x.get('reason') == 'budget' and x.get('retry_after') == DAY - 11
        test('бюджет считает резерв max_tokens, retry_after до 00:00 UTC', budget)

        def settle():
            g = m.Gateway(blim)
            g.admit('a', 600, 10.0)
            g.settle('a', 600, 100, 12.0)
            return g.admit('a', 600, 13.0)['status'] == 200
        test('settle возвращает неиспользованный резерв', settle)

        def new_day():
            g = m.Gateway(blim)
            g.admit('a', 1000, 10.0)
            return g.admit('a', 1000, DAY + 1.0)['status'] == 200
        test('бюджет сбрасывается в новые сутки', new_day)

    elif t == 'L42':
        m = load_module(base / 'slo.py')
        ev = [{'t': .4, 'type': 'token'}, {'t': .5, 'type': 'token'}, {'t': .7, 'type': 'token'}, {'t': .75, 'type': 'done'}]
        test('TTFT — до первого токена, e2e — до done',
             lambda: (lambda x: abs(x['ttft'] - .4) < 1e-9 and abs(x['e2e'] - .75) < 1e-9 and x['tokens'] == 3)(m.stream_metrics(ev)))
        test('TPOT — между токенами, без первого', lambda: abs(m.stream_metrics(ev)['tpot'] - .15) < 1e-9)
        test('p95 по nearest-rank, не среднее', lambda: m.p95(list(range(1, 21))) == 19 and m.p95([]) is None)

        def req(ttft, status=200):
            if status != 200:
                return {'status': status, 'events': []}
            return {'status': 200, 'events': [{'t': ttft, 'type': 'token'}, {'t': ttft + .05, 'type': 'token'},
                                              {'t': ttft + .1, 'type': 'done'}]}
        slo = {'ttft_p95': 1.0, 'tpot_p95': .08, 'error_rate': .01}

        def errors():
            x = m.evaluate([req(.2)] * 19 + [req(0, 500)], slo)
            return abs(x['error_rate'] - .05) < 1e-9 and abs(x['ttft_p95'] - .2) < 1e-9 \
                and x['violations'] == ['error_rate'] and x['ok'] is False
        test('ошибки не входят в latency, но считаются в error_rate', errors)

        def tail():
            x = m.evaluate([req(.2)] * 18 + [req(3.0)] * 2, slo)
            return 'ttft_p95' in x['violations'] and x['ok'] is False
        test('медленный хвост виден в p95, хотя среднее в норме', tail)
        test('здоровый трафик -> ok, без нарушений',
             lambda: (lambda x: x['ok'] is True and x['violations'] == [])(m.evaluate([req(.2)] * 20, slo)))

    elif t == 'L43':
        import yaml
        doc = yaml.safe_load((base / 'scaledobject.yaml').read_text(encoding='utf-8'))
        spec = doc['spec']
        trig = spec.get('triggers') or []
        test('KEDA ScaledObject на Deployment vllm', lambda: doc['apiVersion'] == 'keda.sh/v1alpha1'
             and doc['kind'] == 'ScaledObject' and spec['scaleTargetRef']['name'] == 'vllm')
        test('масштаб по очереди vLLM, без cpu/memory', lambda: trig and all(x['type'] == 'prometheus' for x in trig)
             and any('sum(' in x['metadata']['query'] and 'vllm:num_requests_waiting' in x['metadata']['query'] for x in trig))
        test('threshold > 0 и serverAddress Prometheus', lambda: all(float(x['metadata']['threshold']) > 0
             and str(x['metadata']['serverAddress']).startswith('http') for x in trig))
        test('minReplicaCount >= 1: без холодного старта весов', lambda: int(spec.get('minReplicaCount', 0)) >= 1)
        test('maxReplicaCount <= 4: в пределах GPU-квоты',
             lambda: int(spec.get('minReplicaCount', 0)) <= int(spec['maxReplicaCount']) <= 4)
        test('scaleDown стабилизирован >= 300 с', lambda: int(spec['advanced']['horizontalPodAutoscalerConfig']
             ['behavior']['scaleDown']['stabilizationWindowSeconds']) >= 300)
        r.skip('LIVE: масштабирование под нагрузкой', 'Нужны KEDA, Prometheus и vLLM с метриками в kind-ai-labs; '
               'приложи kubectl get hpa,scaledobject -w под нагрузкой')

    elif t == 'L44':
        m = load_module(base / 'loader.py')
        sha = lambda b: hashlib.sha256(b).hexdigest()
        rev = 'a' * 40
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            files = {'model.safetensors': b'\x00weights' * 1000, 'config.json': b'{"hidden_size": 8}',
                     'pytorch_model.bin': b'pickle'}
            for n, b in files.items():
                (root / n).write_bytes(b)
            good = {'model.safetensors': sha(files['model.safetensors']), 'config.json': sha(files['config.json'])}
            man = lambda **kw: {'repo': 'org/model', 'revision': kw.get('revision', rev), 'files': kw.get('files', good)}

            test('корректный манифест: пути проверены и возвращены',
                 lambda: [p.name for p in m.verify(man(), root)] == ['config.json', 'model.safetensors'])
            test('подменённый файл -> ValueError',
                 lambda: raises(lambda: m.verify(man(files={**good, 'config.json': sha(b'other')}), root), ValueError))
            test('pickle (.bin) запрещён -> PermissionError',
                 lambda: raises(lambda: m.verify(man(files={'pytorch_model.bin': sha(files['pytorch_model.bin'])}), root), PermissionError))
            test('revision=main запрещён -> ValueError', lambda: raises(lambda: m.verify(man(revision='main'), root), ValueError))
            test('путь ../ запрещён -> PermissionError',
                 lambda: raises(lambda: m.verify(man(files={'../x.json': sha(b'')}), root), PermissionError))
            test('нет файла -> FileNotFoundError',
                 lambda: raises(lambda: m.verify(man(files={'tokenizer.json': sha(b'')}), root), FileNotFoundError))
    return r
