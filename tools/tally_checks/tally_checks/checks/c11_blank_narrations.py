"""Check 11: vouchers with no narration, summarised by ledger (detail on 2nd sheet)."""
from . import CheckResult, fmt_date


def run(df, cfg):
    blank = df[df["narration_blank"]]
    rows, detail = [], []
    for key, g in blank.groupby("ledger_key", sort=True):
        rows.append({"ledger": g["ledger"].iloc[0], "count": int(len(g)),
                     "total_amount": round(float(g["amount"].sum()), 2)})
        for r in g.to_dict("records"):
            detail.append({"ledger": r["ledger"], "date": fmt_date(r["date"]),
                           "voucher_no": r["voucher_no"], "voucher_type": r["voucher_type"],
                           "amount": r["amount"], "side": r["side"]})
    detail.sort(key=lambda d: (d["ledger"].casefold(), d["date"], d["voucher_no"]))
    return CheckResult(11, cfg["name"], cfg["severity"], rows,
                       round(float(blank["amount"].sum()), 2), detail=detail)
