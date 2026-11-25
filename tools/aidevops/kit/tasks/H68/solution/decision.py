SHELL_TOOLS = {"run", "shell", "exec", "bash", "run_command"}
MAX_TOOLS = 12


def classify(task):
    if not task.get("acts_on_env"):
        return {"kind": "chat", "pattern": None, "hitl": False, "reasons": ["no_env_actions"]}
    if task.get("route_known"):
        kind = "workflow" if task.get("branches") else "pipeline"
        return {"kind": kind, "pattern": None, "hitl": False, "reasons": ["route_known"]}
    reasons = ["route_depends_on_observations"]
    if task.get("steps_enumerable"):
        pattern = "plan_execute"
        reasons.append("steps_enumerable")
    else:
        pattern = "react"
        reasons.append("next_step_from_observation")
    hitl = task.get("error_cost") == "high" or bool(task.get("writes"))
    if hitl:
        reasons.append("hitl")
    return {"kind": "agent", "pattern": pattern, "hitl": hitl, "reasons": reasons}


def audit(design):
    tools = design.get("tools") or []
    names = [t.get("name", "") for t in tools]
    descriptions = [str(t.get("description", "")).strip().lower() for t in tools]
    issues = []
    if design.get("route_known"):
        issues.append("agent_for_known_route")
    if not design.get("max_steps"):
        issues.append("no_step_budget")
    if any(t.get("name") in SHELL_TOOLS or "command" in (t.get("params") or []) for t in tools):
        issues.append("shell_tool")
    if len(tools) > MAX_TOOLS:
        issues.append("too_many_tools")
    if len(set(names)) != len(names) or len(set(descriptions)) != len(descriptions):
        issues.append("overlapping_tools")
    if any(t.get("access") == "write" for t in tools) and not design.get("hitl"):
        issues.append("write_without_hitl")
    if design.get("policy") == "prompt":
        issues.append("policy_only_in_prompt")
    return issues
