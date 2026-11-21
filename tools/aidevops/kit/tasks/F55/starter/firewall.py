"""AI firewall. Сейчас: маскирование до гвардов, ошибки гвардов игнорируются, в аудит пишется промпт."""


class Firewall:
    def __init__(self, input_guards, output_guards, vault_factory, llm, audit):
        self.input_guards = input_guards
        self.output_guards = output_guards
        self.vault_factory = vault_factory
        self.llm = llm
        self.audit = audit

    def handle(self, request_id, prompt):
        vault = self.vault_factory()
        masked = vault.mask(prompt)
        for guard in self.input_guards:
            try:
                guard(masked)
            except Exception:
                pass
        text = self.llm(prompt)
        self.audit({"request_id": request_id, "prompt": prompt, "answer": text})
        return {"status": 200, "text": vault.unmask(text)}
