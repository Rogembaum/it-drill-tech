# TODO: узкие read-only инструменты GitLab со строгими JSON Schema, см. TASK.md
TOOLS = [
    {"name": "run", "access": "write", "description": "Выполнить любой запрос к GitLab",
     "input_schema": {"type": "object", "properties": {"command": {"type": "string"}}}},
]


def validate_args(schema, args):
    return []


def call(name, args, api):
    body, _ = api.get(args.get("command", "/"), {})
    return body
