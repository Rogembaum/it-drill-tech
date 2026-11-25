import hashlib
import json
import os

TERMINAL = {"done", "aborted"}
TRANSITIONS = {
    "planning": {"acting", "aborted"},
    "acting": {"acting", "reflecting", "waiting_hitl", "done", "aborted"},
    "reflecting": {"acting", "done", "aborted"},
    "waiting_hitl": {"acting", "aborted"},
    "done": set(),
    "aborted": set(),
}
KEEP_KINDS = {"decision", "finding"}


def transition(state, to):
    current = state["status"]
    if to not in TRANSITIONS.get(current, set()):
        raise ValueError("переход %s -> %s запрещён" % (current, to))
    new = dict(state)
    new["status"] = to
    new["history"] = list(state.get("history", [])) + [[current, to]]
    return new


class Store:
    def __init__(self, root):
        self.root = root
        os.makedirs(root, exist_ok=True)

    def _path(self, run_id):
        return os.path.join(self.root, "%s.json" % run_id)

    def save(self, run_id, state):
        path = self._path(run_id)
        tmp = path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(state, fh, ensure_ascii=False, sort_keys=True)
                fh.flush()
                os.fsync(fh.fileno())
        except BaseException:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise
        os.replace(tmp, path)

    def load(self, run_id):
        path = self._path(run_id)
        if not os.path.exists(path):
            return None
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)


def idem_key(action, args):
    canonical = json.dumps(args, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "%s:%s" % (action, hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32])


def apply_effect(state, action, args, effect):
    key = idem_key(action, args)
    done = state.setdefault("effects", {})
    if key in done:
        return done[key]
    result = effect(idempotency_key=key, **args)
    done[key] = result
    return result


def compact(history, keep_last=2):
    if len(history) <= keep_last:
        return list(history)
    cut = len(history) - keep_last
    head, tail = history[:cut], history[cut:]
    kept = [e for e in head if e.get("kind") in KEEP_KINDS]
    tools = [e.get("tool", "?") for e in head if e.get("kind") == "tool"]
    summary = {"kind": "summary", "text": "вызовы: %s; сырые ответы удалены" % (", ".join(tools) or "нет"),
               "dropped": len(head) - len(kept)}
    return [summary] + kept + list(tail)


def remember(memory, episode, limit=50):
    memory.append(episode)
    del memory[:-limit]
    return memory


def recall(memory, project_id, k=3):
    return [e for e in reversed(memory) if e.get("project_id") == project_id][:k]
