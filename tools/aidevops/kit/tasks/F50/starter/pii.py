"""Маскирование PII. Сейчас: только e-mail, без восстановления, любые 10+ цифр считаются ИНН."""
import re


class Vault:
    def mask(self, text):
        text = re.sub(r"\S+@\S+", "<EMAIL>", text)
        return re.sub(r"\d{10,}", "<INN>", text)

    def unmask(self, text):
        return text
