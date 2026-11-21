"""AI firewall: входные гварды -> маскирование -> LLM -> выходные гварды -> демаскирование. Fail-closed."""


class GuardBlocked(Exception):
    def __init__(self, name):
        self.name = name


class Firewall:
    def __init__(self, input_guards, output_guards, vault_factory, llm, audit):
        self.input_guards = input_guards
        self.output_guards = output_guards
        self.vault_factory = vault_factory
        self.llm = llm
        self.audit = audit

    def _run(self, guards, text, verdicts):
        for guard in guards:
            result = guard(text)
            verdicts[result["name"]] = result["verdict"]
            if result["verdict"] == "block":
                raise GuardBlocked(result["name"])

    def _process(self, prompt, verdicts):
        try:
            self._run(self.input_guards, prompt, verdicts)
        except GuardBlocked as e:
            return {"status": 403, "reason": e.name}
        except Exception:
            return {"status": 503, "reason": "guard_error"}

        vault = self.vault_factory()
        try:
            answer = self.llm(vault.mask(prompt))
        except Exception:
            return {"status": 502, "reason": "upstream"}

        try:
            self._run(self.output_guards, answer, verdicts)
        except GuardBlocked as e:
            return {"status": 403, "reason": e.name}
        except Exception:
            return {"status": 503, "reason": "guard_error"}
        return {"status": 200, "text": vault.unmask(answer)}

    def handle(self, request_id, prompt):
        verdicts = {}
        result = self._process(prompt, verdicts)
        event = {"request_id": request_id, "status": result["status"], "verdicts": verdicts}
        if "reason" in result:
            event["reason"] = result["reason"]
        self.audit(event)
        return result
