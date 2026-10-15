"""Check 3: every entry in (or against) a ledger named like Suspense / Suspenc."""
from . import CheckResult, fmt_date
from ..loader import norm_ledger


def run(df, cfg):
    pats = [p.casefold() for p in cfg.get("ledger_patterns", ["suspense", "suspenc"])]

    def hit(name):
        k = norm_ledger(name)
        return any(p in k for p in pats)

    rows = []
    for r in df.to_dict("records"):
        if hit(r["ledger"]):
            sus, other = r["ledger"], r["counter_ledger"]
        elif hit(r["counter_ledger"]):
            sus, other = r["counter_ledger"], r["ledger"]
        else:
            continue
        rows.append({
            "date": fmt_date(r["date"]), "voucher_no": r["voucher_no"],
            "voucher_type": r["voucher_type"], "suspense_ledger": sus,
            "amount": r["amount"], "side": r["side"], "narration": r["narration"],
            "counter_ledger": other,
        })
    rows.sort(key=lambda x: (x["date"], x["voucher_no"], x["suspense_ledger"].casefold()))
    return CheckResult(3, cfg["name"], cfg["severity"], rows,
                       round(sum(r["amount"] for r in rows), 2))
