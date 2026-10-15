#!/usr/bin/env python3
"""
Portfolio & Risk Analyzer (read-only)

Takes a Kite holdings export (CSV from Console, or JSON from Kite MCP / Kite
Connect `holdings()`), and reports P&L, weights, sector concentration and
risk flags. It never connects to a broker and cannot place orders.

Usage:
    python analyze_portfolio.py --input holdings.csv --sectors sector_map.csv \
        --output portfolio_report.xlsx
"""

import argparse
import json
import sys
import pandas as pd

# Accepted header spellings -> canonical name (Kite Console CSV and Kite API JSON)
COLUMN_ALIASES = {
    "symbol": ["symbol", "instrument", "tradingsymbol", "trading symbol"],
    "qty": ["qty", "qty.", "quantity"],
    "avg_cost": ["avg_cost", "avg. cost", "avg cost", "average_price", "average price"],
    "ltp": ["ltp", "last_price", "last price"],
}

DEFAULT_LIMITS = {
    "single_stock_pct": 20.0,
    "sector_pct": 40.0,
    "top5_pct": 70.0,
    "loss_pct": -15.0,
}


def load_holdings(path):
    if path.lower().endswith(".json"):
        with open(path) as f:
            data = json.load(f)
        if isinstance(data, dict):
            data = data.get("data", data.get("holdings", []))
        df = pd.DataFrame(data)
    elif path.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)

    lookup = {c.strip().lower(): c for c in df.columns}
    rename = {}
    for canon, options in COLUMN_ALIASES.items():
        for opt in options:
            if opt in lookup:
                rename[lookup[opt]] = canon
                break
    missing = [c for c in COLUMN_ALIASES if c not in rename.values()]
    if missing:
        sys.exit(f"Input is missing columns: {', '.join(missing)}. Found: {list(df.columns)}")

    df = df.rename(columns=rename)[list(COLUMN_ALIASES)]
    df["symbol"] = df["symbol"].astype(str).str.strip().str.upper()
    for c in ("qty", "avg_cost", "ltp"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["qty", "avg_cost", "ltp"])
    df = df[df["qty"] > 0]
    # A symbol can appear twice (e.g. T1 and settled holdings): merge them
    df = (
        df.assign(invested=df["qty"] * df["avg_cost"])
        .groupby("symbol", as_index=False)
        .agg(qty=("qty", "sum"), invested=("invested", "sum"), ltp=("ltp", "last"))
    )
    df["avg_cost"] = df["invested"] / df["qty"]
    return df


def analyze(df, sector_map=None):
    df = df.copy()
    df["current"] = df["qty"] * df["ltp"]
    df["pnl"] = df["current"] - df["invested"]
    df["pnl_pct"] = df["pnl"] / df["invested"] * 100
    total = df["current"].sum()
    df["weight_pct"] = df["current"] / total * 100
    df["sector"] = df["symbol"].map(sector_map or {}).fillna("Unmapped")
    return df.sort_values("current", ascending=False).reset_index(drop=True)


def sector_table(df):
    s = df.groupby("sector", as_index=False).agg(
        current=("current", "sum"), invested=("invested", "sum"), pnl=("pnl", "sum")
    )
    s["weight_pct"] = s["current"] / s["current"].sum() * 100
    return s.sort_values("current", ascending=False).reset_index(drop=True)


def risk_flags(df, sectors, limits):
    flags = []
    for _, r in df[df["weight_pct"] > limits["single_stock_pct"]].iterrows():
        flags.append(f"{r['symbol']} is {r['weight_pct']:.1f}% of the portfolio (limit {limits['single_stock_pct']:.0f}%)")
    for _, r in sectors[(sectors["weight_pct"] > limits["sector_pct"]) & (sectors["sector"] != "Unmapped")].iterrows():
        flags.append(f"Sector {r['sector']} is {r['weight_pct']:.1f}% (limit {limits['sector_pct']:.0f}%)")
    top5 = df["weight_pct"].head(5).sum()
    if top5 > limits["top5_pct"]:
        flags.append(f"Top 5 holdings are {top5:.1f}% of the portfolio (limit {limits['top5_pct']:.0f}%)")
    for _, r in df[df["pnl_pct"] <= limits["loss_pct"]].iterrows():
        flags.append(f"{r['symbol']} is down {abs(r['pnl_pct']):.1f}% from cost (review the thesis; don't average down blindly)")
    unmapped = df[df["sector"] == "Unmapped"]["symbol"].tolist()
    if unmapped:
        flags.append(f"No sector mapped for: {', '.join(unmapped)} (add them to the sector map)")
    return flags


def print_report(df, sectors, flags):
    invested, current = df["invested"].sum(), df["current"].sum()
    pnl = current - invested
    print(f"\nInvested: {invested:,.0f}   Current: {current:,.0f}   "
          f"P&L: {pnl:,.0f} ({pnl / invested * 100:+.1f}%)\n")
    cols = ["symbol", "qty", "avg_cost", "ltp", "current", "pnl", "pnl_pct", "weight_pct", "sector"]
    print(df[cols].round(2).to_string(index=False))
    print("\nSector allocation")
    print(sectors.round(2).to_string(index=False))
    print("\nRisk flags")
    print("\n".join(f"  - {f}" for f in flags) if flags else "  none")
    print()


def main():
    p = argparse.ArgumentParser(description="Read-only portfolio & risk analyzer for Kite holdings exports")
    p.add_argument("--input", required=True, help="Holdings export (.csv, .xlsx or .json)")
    p.add_argument("--sectors", help="CSV with columns symbol,sector")
    p.add_argument("--output", help="Write an .xlsx report here")
    p.add_argument("--max-stock", type=float, default=DEFAULT_LIMITS["single_stock_pct"])
    p.add_argument("--max-sector", type=float, default=DEFAULT_LIMITS["sector_pct"])
    p.add_argument("--max-top5", type=float, default=DEFAULT_LIMITS["top5_pct"])
    p.add_argument("--loss-alert", type=float, default=DEFAULT_LIMITS["loss_pct"],
                   help="Flag holdings at or below this %% P&L (negative number)")
    a = p.parse_args()

    limits = {"single_stock_pct": a.max_stock, "sector_pct": a.max_sector,
              "top5_pct": a.max_top5, "loss_pct": a.loss_alert}

    sector_map = None
    if a.sectors:
        sm = pd.read_csv(a.sectors)
        sector_map = dict(zip(sm["symbol"].str.strip().str.upper(), sm["sector"]))

    df = analyze(load_holdings(a.input), sector_map)
    if df.empty:
        sys.exit("No valid holdings found in input.")
    sectors = sector_table(df)
    flags = risk_flags(df, sectors, limits)
    print_report(df, sectors, flags)

    if a.output:
        with pd.ExcelWriter(a.output) as xw:
            df.round(2).to_excel(xw, sheet_name="Holdings", index=False)
            sectors.round(2).to_excel(xw, sheet_name="Sectors", index=False)
            pd.DataFrame({"risk_flag": flags or ["none"]}).to_excel(xw, sheet_name="Risk flags", index=False)
        print(f"Report written to {a.output}")


if __name__ == "__main__":
    main()
