"""Подключение модели OpenRouter в LiteLLM. Сейчас пропускает любую модель и кладёт ключ в конфиг."""


class PolicyError(ValueError):
    pass


def onboard(entry, policy):
    return {
        "model_name": entry["id"],
        "litellm_params": {"model": "openrouter/" + entry["id"], "api_key": "sk-or-v1-PASTE-KEY-HERE"},
    }
