import json
import os
import uuid

TERMINAL = {"done", "aborted"}
TRANSITIONS = {}


def transition(state, to):
    # TODO: только разрешённые переходы, история переходов
    state["status"] = to
    return state


class Store:
    def __init__(self, root):
        self.root = root
        os.makedirs(root, exist_ok=True)

    def save(self, run_id, state):
        # TODO: атомарная запись
        with open(os.path.join(self.root, "%s.json" % run_id), "w", encoding="utf-8") as fh:
            json.dump(state, fh)

    def load(self, run_id):
        with open(os.path.join(self.root, "%s.json" % run_id), encoding="utf-8") as fh:
            return json.load(fh)


def idem_key(action, args):
    # TODO: ключ из действия и аргументов, а не случайный
    return "%s:%s" % (action, uuid.uuid4().hex)


def apply_effect(state, action, args, effect):
    return effect(**args)


def compact(history, keep_last=2):
    return history[-keep_last:]


def remember(memory, episode, limit=50):
    memory.append(episode)
    return memory


def recall(memory, project_id, k=3):
    return memory[:k]
