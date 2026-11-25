def should_open(mr, now):
    # TODO: блокирующий detailed_merge_status или MR старше 14 дней
    return True


def validate(payload):
    # TODO: строгая проверка ответа модели, см. TASK.md
    return []


def run(model, tools, now, max_steps=10, max_repairs=1):
    # TODO: цикл с repair, guardrail на запись, правилом глубокого чтения и бюджетом шагов
    state = {"status": "acting", "stop_reason": None, "findings": [], "calls": [], "trace": []}
    view = {"observation": None, "error": None, "findings": []}
    while True:
        raw = model(view)
        state["findings"].extend(raw.get("findings", []))
        if raw.get("action") == "finish":
            state["status"], state["stop_reason"] = "done", "finished"
            return state
        data = tools(raw["tool"], raw["args"])
        state["calls"].append({"tool": raw["tool"], "args": raw["args"]})
        view = {"observation": {"data": data}, "error": None, "findings": state["findings"]}
