"""Допуск модели в контур: автоматические проверки + список причин для ручного ревью ИБ."""
import re

PICKLE = (".bin", ".pt", ".pth", ".pkl", ".ckpt")
SHA = re.compile(r"[0-9a-f]{40}")


def admit(card, policy):
    reject, review = [], []
    revision = str(card.get("revision", ""))
    if not SHA.fullmatch(revision):
        reject.append("revision")
    reject += ["pickle:" + f for f in card.get("files", []) if f.lower().endswith(PICKLE)]
    if card.get("source") not in policy["sources"]:
        reject.append("source")
    scan = card.get("scan") or {}
    if scan.get("status") != "clean" or scan.get("revision") != revision:
        reject.append("scan")

    lic = card.get("license")
    if lic in policy.get("review_licenses", []):
        review.append("license_review")
    elif lic not in policy["licenses"]:
        reject.append("license")
    if card.get("trust_remote_code"):
        review.append("remote_code")

    ev = card.get("eval") or {}
    if "score" not in ev:
        reject.append("eval")
    elif ev.get("suite") not in policy["min_score"]:
        review.append("eval_suite")
    elif ev["score"] < policy["min_score"][ev["suite"]]:
        reject.append("eval")

    if not re.fullmatch(policy["ticket"], str(card.get("security_ticket") or "")):
        review.append("security_ticket")

    decision = "reject" if reject else "needs_review" if review else "approve"
    return {"decision": decision, "reasons": reject + review}
