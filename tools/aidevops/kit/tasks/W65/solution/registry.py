"""MCP registry gate: доверенный издатель, pinned версия и digest, внутренний remote с OAuth, согласованные write-инструменты."""
from urllib.parse import urlsplit


def review(manifest, registry):
    reasons = []
    name = manifest.get("name", "")
    publisher, _, short = name.partition("/")
    if publisher not in registry["publishers"]:
        reasons.append("publisher")
    approved = registry["approved"].get(name)
    if approved is None:
        reasons.append("not_approved")
        approved = {}
    elif manifest.get("version") != approved["version"]:
        reasons.append("version")

    images = []
    for pkg in manifest.get("packages", []):
        if pkg.get("registry_type") != "oci":
            reasons.append("package_type")
            continue
        if pkg["identifier"].split("/", 1)[0] not in registry["oci_registries"]:
            reasons.append("registry")
        if pkg.get("digest") != approved.get("digest"):
            reasons.append("digest")
        images.append("%s@%s" % (pkg["identifier"], pkg.get("digest")))

    for remote in manifest.get("remotes", []):
        u = urlsplit(remote.get("url", ""))
        if u.scheme != "https" or not (u.hostname or "").endswith(".corp.local") or remote.get("auth") != "oauth2":
            reasons.append("remote")

    for tool in manifest.get("tools", []):
        access = tool.get("access")
        if access not in ("read", "write"):
            reasons.append("tool_access:" + tool["name"])
        elif access == "write" and tool["name"] not in approved.get("write_tools", []):
            reasons.append("write_tool:" + tool["name"])

    if reasons:
        return {"decision": "deny", "reasons": reasons, "client_config": None}
    servers = {}
    if images:
        servers[short] = {"command": "docker", "args": ["run", "--rm", "-i", "--read-only", images[0]]}
    elif manifest.get("remotes"):
        servers[short] = {"type": "streamable-http", "url": manifest["remotes"][0]["url"]}
    return {"decision": "allow", "reasons": [], "client_config": {"mcpServers": servers}}
