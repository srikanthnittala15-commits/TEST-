"""Check 1: same ledger, same amount, dates within N days, one narration blank.

The blank-narration voucher is the suspected phantom; the other is the keeper.
"""
from . import CheckResult, fmt_date


def run(df, cfg):
    window = int(cfg.get("window_days", 3))
    rows, seen_phantoms = [], {}
    for (_, _, _), g in df.groupby(["ledger_key", "amount", "side"], sort=True):
        g = g.sort_values(["date", "voucher_no"], kind="mergesort")
        recs = g.to_dict("records")
        for i, a in enumerate(recs):
            for b in recs[i + 1:]:
                if (b["date"] - a["date"]).days > window:
                    break
                if a["vkey"] == b["vkey"] or a["narration_blank"] == b["narration_blank"]:
                    continue
                keep, ph = (b, a) if a["narration_blank"] else (a, b)
                rows.append({
                    "ledger": keep["ledger"], "amount": keep["amount"], "side": keep["side"],
                    "keep_voucher_no": keep["voucher_no"], "keep_date": fmt_date(keep["date"]),
                    "keep_type": keep["voucher_type"], "keep_narration": keep["narration"],
                    "phantom_voucher_no": ph["voucher_no"], "phantom_date": fmt_date(ph["date"]),
                    "phantom_type": ph["voucher_type"], "phantom_narration": ph["narration"],
                })
                seen_phantoms[ph["vkey"]] = {
                    "voucher_no": ph["voucher_no"], "date": fmt_date(ph["date"]),
                    "voucher_type": ph["voucher_type"], "amount": ph["amount"]}
    rows.sort(key=lambda r: (r["ledger"].casefold(), r["phantom_date"], r["phantom_voucher_no"]))
    delete = sorted(seen_phantoms.values(),
                    key=lambda d: (d["date"], d["voucher_no"], d["voucher_type"]))
    total = round(sum(d["amount"] for d in delete), 2)
    return CheckResult(1, cfg["name"], cfg["severity"], rows, total, delete_candidates=delete)
