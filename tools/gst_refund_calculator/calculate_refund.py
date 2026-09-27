#!/usr/bin/env python3
"""
GST Refund Calculator
Computes refund amounts under:
  - Rule 89(4) of the CGST Rules, 2017: Export of goods/services without payment of tax (LUT/Bond)
  - Rule 89(5) of the CGST Rules, 2017: Inverted duty structure

Usage:
    python calculate_refund.py --input clients.csv --output refund_working.csv

Input CSV columns (see sample_input.csv):
    client_name, period, category
    category = "export_lut":
        zero_rated_turnover_goods, zero_rated_turnover_services,
        domestic_like_supply_value, adjusted_total_turnover, net_itc
    category = "inverted_duty":
        inverted_turnover, adjusted_total_turnover, net_itc_inputs, tax_payable_inverted
"""

import argparse
import sys
import pandas as pd

REQUIRED_EXPORT_LUT_COLS = [
    "zero_rated_turnover_goods",
    "zero_rated_turnover_services",
    "domestic_like_supply_value",
    "adjusted_total_turnover",
    "net_itc",
]

REQUIRED_INVERTED_COLS = [
    "inverted_turnover",
    "adjusted_total_turnover",
    "net_itc_inputs",
    "tax_payable_inverted",
]


def compute_export_lut_refund(row):
    """Rule 89(4): Refund = (Turnover of zero-rated supply) x Net ITC / Adjusted Total Turnover.

    Zero-rated goods turnover is capped at 1.5x the value of like domestic
    supplies (proviso to Rule 89(4)(C), inserted w.e.f. 23-03-2020).
    """
    goods = row["zero_rated_turnover_goods"]
    services = row["zero_rated_turnover_services"]
    domestic_like = row["domestic_like_supply_value"]
    net_itc = row["net_itc"]
    adjusted_total_turnover = row["adjusted_total_turnover"]

    cap = 1.5 * domestic_like if domestic_like > 0 else goods
    capped_goods = min(goods, cap)
    zero_rated_turnover = capped_goods + services

    if adjusted_total_turnover == 0:
        return {
            "zero_rated_turnover_used": zero_rated_turnover,
            "goods_capped": capped_goods < goods,
            "refund_amount": 0.0,
            "warning": "adjusted_total_turnover is zero",
        }

    refund = zero_rated_turnover * net_itc / adjusted_total_turnover
    refund = min(refund, net_itc)  # refund cannot exceed available Net ITC

    warning = ""
    if capped_goods < goods:
        warning = (
            f"Zero-rated goods turnover capped at 1.5x domestic like supply "
            f"({goods:.2f} -> {capped_goods:.2f})"
        )

    return {
        "zero_rated_turnover_used": round(zero_rated_turnover, 2),
        "goods_capped": capped_goods < goods,
        "refund_amount": round(refund, 2),
        "warning": warning,
    }


def compute_inverted_duty_refund(row):
    """Rule 89(5): Max Refund = (Inverted turnover x Net ITC[inputs] / Adjusted Total Turnover)
    minus tax payable on such inverted rated supply. Net ITC here = ITC on INPUTS only
    (input services and capital goods excluded, per the substituted formula effective 18-04-2018).
    """
    inverted_turnover = row["inverted_turnover"]
    net_itc_inputs = row["net_itc_inputs"]
    adjusted_total_turnover = row["adjusted_total_turnover"]
    tax_payable = row["tax_payable_inverted"]

    if adjusted_total_turnover == 0:
        return {
            "gross_refund_before_tax_payable": 0.0,
            "refund_amount": 0.0,
            "warning": "adjusted_total_turnover is zero",
        }

    gross = inverted_turnover * net_itc_inputs / adjusted_total_turnover
    refund = gross - tax_payable

    warning = ""
    if refund < 0:
        warning = "Computed refund is negative (tax payable exceeds proportionate ITC) - refund is NIL"
    refund = max(refund, 0.0)

    return {
        "gross_refund_before_tax_payable": round(gross, 2),
        "refund_amount": round(refund, 2),
        "warning": warning,
    }


def validate_columns(df):
    if "category" not in df.columns:
        sys.exit("ERROR: input file must have a 'category' column (export_lut / inverted_duty)")

    missing_report = []
    for idx, row in df.iterrows():
        cat = str(row["category"]).strip()
        if cat == "export_lut":
            required = REQUIRED_EXPORT_LUT_COLS
        elif cat == "inverted_duty":
            required = REQUIRED_INVERTED_COLS
        else:
            missing_report.append(f"Row {idx}: unknown category '{cat}'")
            continue
        for col in required:
            if col not in df.columns or pd.isna(row.get(col)):
                missing_report.append(f"Row {idx} ({cat}): missing value for '{col}'")

    if missing_report:
        print("Input validation errors:", file=sys.stderr)
        for msg in missing_report:
            print(f"  - {msg}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Compute GST refunds under Rule 89(4) and 89(5)")
    parser.add_argument("--input", required=True, help="Path to input CSV or XLSX")
    parser.add_argument("--output", required=True, help="Path to write the refund working (CSV)")
    args = parser.parse_args()

    if args.input.endswith(".xlsx"):
        df = pd.read_excel(args.input)
    else:
        df = pd.read_csv(args.input)

    validate_columns(df)

    results = []
    for _, row in df.iterrows():
        cat = str(row["category"]).strip()
        base = {"client_name": row.get("client_name", ""), "period": row.get("period", ""), "category": cat}
        if cat == "export_lut":
            base.update(compute_export_lut_refund(row))
        elif cat == "inverted_duty":
            base.update(compute_inverted_duty_refund(row))
        results.append(base)

    out_df = pd.DataFrame(results)
    out_df.to_csv(args.output, index=False)

    total = out_df["refund_amount"].sum()
    print(f"Processed {len(out_df)} row(s). Total refund computed: {total:,.2f}")
    print(f"Working saved to: {args.output}")
    for _, r in out_df.iterrows():
        if r.get("warning"):
            print(f"  [warning] {r['client_name']} / {r['period']}: {r['warning']}")


if __name__ == "__main__":
    main()
