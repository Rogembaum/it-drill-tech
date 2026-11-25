"""Поиск прямых подключений к LLM-агрегаторам. Сейчас ищет подстроку и считает всё подряд."""


def findings(lines, allowed_sources, domains):
    out = []
    for line in lines:
        for d in domains:
            if d in line:
                out.append({"client": line.split()[2], "domain": d, "count": 1})
    return out


def squid_acl(domains, gateway_cidrs):
    return "http_access deny all\nhttp_access allow all\n"
