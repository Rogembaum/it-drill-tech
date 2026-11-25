"""Поиск прямых подключений к LLM-агрегаторам по access.log Squid и ACL «только шлюз»."""
import ipaddress
from urllib.parse import urlsplit


def _host(method, url):
    if method == "CONNECT":
        return url.rsplit(":", 1)[0].lower()
    return (urlsplit(url).hostname or "").lower()


def _match(host, domains):
    for d in domains:
        if host == d or host.endswith("." + d):
            return d
    return None


def findings(lines, allowed_sources, domains):
    nets = [ipaddress.ip_network(c) for c in allowed_sources]
    groups = {}
    for line in lines:
        parts = line.split()
        if len(parts) < 7:
            continue
        try:
            ts, client = float(parts[0]), ipaddress.ip_address(parts[2])
            status, size = int(parts[3].split("/")[1]), int(parts[4])
        except (ValueError, IndexError):
            continue
        domain = _match(_host(parts[5], parts[6]), domains)
        if domain is None or any(client in n for n in nets):
            continue
        g = groups.setdefault((str(client), domain), {
            "client": str(client), "domain": domain, "count": 0, "allowed": 0, "denied": 0,
            "bytes": 0, "first": ts, "last": ts})
        g["count"] += 1
        g["bytes"] += size
        g["denied" if status >= 400 else "allowed"] += 1
        g["first"], g["last"] = min(g["first"], ts), max(g["last"], ts)
    out = sorted(groups.values(), key=lambda g: (-g["count"], g["client"]))
    for g in out:
        g["severity"] = "high" if g["allowed"] else "low"
    return out


def squid_acl(domains, gateway_cidrs):
    return "\n".join([
        "acl llm_gateway src " + " ".join(gateway_cidrs),
        "acl ai_aggregators dstdomain " + " ".join("." + d for d in domains),
        "http_access allow llm_gateway ai_aggregators",
        "http_access deny ai_aggregators",
    ]) + "\n"
