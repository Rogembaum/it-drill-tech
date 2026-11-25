"""Подключение модели из каталога OpenRouter в LiteLLM model_list по корпоративной политике."""
import re


class PolicyError(ValueError):
    pass


def _price(entry, kind):
    try:
        value = float(entry["pricing"][kind])
    except (KeyError, TypeError, ValueError):
        raise PolicyError("pricing: no %s price" % kind)
    if value < 0:
        raise PolicyError("pricing: negative %s price" % kind)
    return value


def onboard(entry, policy):
    model_id = entry.get("id", "")
    vendor, _, name = model_id.partition("/")
    if vendor not in policy["vendors"] or not name:
        raise PolicyError("vendor: %s is not allowed" % vendor)
    if model_id.endswith(":free"):
        raise PolicyError("free: free endpoints may log prompts")
    prompt, completion = _price(entry, "prompt"), _price(entry, "completion")
    caps = policy["max_per_1m"]
    if prompt * 1e6 > caps["prompt"] or completion * 1e6 > caps["completion"]:
        raise PolicyError("price: above cap")
    context = entry.get("context_length") or 0
    if context < policy["min_context"]:
        raise PolicyError("context: %s < %s" % (context, policy["min_context"]))
    if policy.get("require_tools") and "tools" not in entry.get("supported_parameters", []):
        raise PolicyError("tools: tool calling not supported")
    return {
        "model_name": "or-" + re.sub(r"[/:]", "-", model_id.lower()),
        "litellm_params": {
            "model": "openrouter/" + model_id,
            "api_key": "os.environ/OPENROUTER_API_KEY",
            "rpm": policy["rpm"],
            "extra_body": {"provider": {"data_collection": "deny", "zdr": True}},
        },
        "model_info": {
            "locality": "cloud",
            "input_cost_per_token": prompt,
            "output_cost_per_token": completion,
            "max_input_tokens": context,
        },
    }
