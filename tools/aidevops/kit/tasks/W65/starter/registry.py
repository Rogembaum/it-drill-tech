"""MCP registry gate. Сейчас пропускает любой сервер и запускает пакет через npx без версии."""


def review(manifest, registry):
    short = manifest["name"].split("/")[-1]
    pkg = manifest["packages"][0]
    return {"decision": "allow", "reasons": [],
            "client_config": {"mcpServers": {short: {"command": "npx", "args": ["-y", pkg["identifier"]]}}}}
