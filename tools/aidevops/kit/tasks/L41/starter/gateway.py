"""LLM gateway. Сейчас пропускает любой запрос: нет ни квоты, ни бюджета."""


class Gateway:
    def __init__(self, limits):
        self.limits = limits

    def admit(self, tenant, max_tokens, now):
        return {"status": 200, "reserved": max_tokens}

    def settle(self, tenant, reserved, used, now):
        pass
