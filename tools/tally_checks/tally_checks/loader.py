"""Excel Day Book loader. Read-only; never touches Tally."""
import re
from pathlib import Path

import pandas as pd

CANONICAL = ["date", "voucher_type", "voucher_no", "ledger",
             "counter_ledger", "debit", "credit", "narration"]
REQUIRED = ["date", "ledger", "debit", "credit"]


def _norm(s):
    return re.sub(r"\s+", " ", str(s)).strip().casefold()


def norm_ledger(s):
    """Ledger names: case-insensitive, trailing/extra spaces stripped."""
    return _norm(s) if isinstance(s, str) else ""


def _alias_map(columns_cfg):
    return {k: [_norm(a) for a in columns_cfg[k]] for k in columns_cfg}


def _find_header_row(raw, aliases):
    """Tally exports carry title rows above the header; find the real one."""
    for i in range(min(len(raw), 30)):
        cells = {_norm(c) for c in raw.iloc[i].tolist() if pd.notna(c)}
        if all(any(a in cells for a in aliases[k]) for k in REQUIRED):
            return i
    raise ValueError(
        "Could not find a header row with Date, Particulars/Ledger, Debit and Credit "
        "columns in the first 30 rows. Adjust 'columns' in config.yaml.")


def load_daybook(path, columns_cfg, date_from=None, date_to=None):
    """Return a normalised DataFrame, one row per voucher line.

    Columns: date, voucher_type, voucher_no, ledger, counter_ledger, side,
    amount, narration, ledger_key, narration_blank, vkey.
    """
    path = Path(path)
    raw = pd.read_excel(path, header=None, dtype=object)
    aliases = _alias_map(columns_cfg)
    hdr = _find_header_row(raw, aliases)
    headers = [_norm(c) if pd.notna(c) else "" for c in raw.iloc[hdr].tolist()]
    body = raw.iloc[hdr + 1:].reset_index(drop=True)

    out = pd.DataFrame(index=body.index)
    for key in CANONICAL:
        col = next((headers.index(a) for a in aliases.get(key, []) if a in headers), None)
        out[key] = body.iloc[:, col] if col is not None else None

    out["date"] = pd.to_datetime(out["date"], errors="coerce", dayfirst=True)
    out = out[out["date"].notna()].copy()  # drops totals / blank / carry-forward rows
    for c in ("debit", "credit"):
        out[c] = pd.to_numeric(out[c], errors="coerce").fillna(0.0)
    out = out[(out["debit"] != 0) | (out["credit"] != 0)].copy()

    out["side"] = (out["debit"] != 0).map({True: "Dr", False: "Cr"})
    out["amount"] = (out["debit"].abs() + out["credit"].abs()).round(2)
    for c in ("voucher_type", "voucher_no", "ledger", "counter_ledger", "narration"):
        out[c] = out[c].map(lambda v: "" if pd.isna(v) else str(v).strip())
    out["ledger_key"] = out["ledger"].map(norm_ledger)
    out["narration_blank"] = out["narration"].str.strip() == ""
    # Voucher numbers are not unique in Tally: join on number + date + type.
    out["vkey"] = list(zip(out["voucher_no"], out["date"].dt.strftime("%Y-%m-%d"),
                           out["voucher_type"].map(_norm)))

    if date_from:
        out = out[out["date"] >= pd.Timestamp(date_from)]
    if date_to:
        out = out[out["date"] <= pd.Timestamp(date_to)]
    out = out.drop(columns=["debit", "credit"])
    return out.sort_values(["date", "voucher_no", "ledger_key"], kind="mergesort").reset_index(drop=True)
