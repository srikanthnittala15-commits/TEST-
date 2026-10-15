#!/usr/bin/env python3
"""Entry point.

python run_checks.py --company "<name>" --from 2025-04-01 --to 2026-03-31 \
    --checks all --daybook daybook.xlsx --out <folder>

Phase 1: Excel Day Book input; checks 1, 3, 11.
"""
import argparse
import sys
from pathlib import Path

import yaml

from tally_checks.checks import REGISTRY
from tally_checks.loader import load_daybook
from tally_checks.report import write_report


def parse_checks(spec, available):
    if spec.strip().lower() == "all":
        return sorted(available)
    ids = sorted({int(x) for x in spec.split(",") if x.strip()})
    bad = [i for i in ids if i not in available]
    if bad:
        raise SystemExit(f"Checks not implemented yet: {bad}. Available: {sorted(available)}")
    return ids


def main(argv=None):
    p = argparse.ArgumentParser(description="Read-only Tally data-quality checks")
    p.add_argument("--company", required=True)
    p.add_argument("--from", dest="date_from")
    p.add_argument("--to", dest="date_to")
    p.add_argument("--checks", default="all")
    p.add_argument("--daybook", required=True, help="Day Book .xlsx export")
    p.add_argument("--out", required=True, help="Output folder, e.g. E:\\Client_Data\\<client>\\_checks\\<date>")
    p.add_argument("--config", default=str(Path(__file__).with_name("config.yaml")))
    a = p.parse_args(argv)

    cfg = yaml.safe_load(Path(a.config).read_text(encoding="utf-8"))
    df = load_daybook(a.daybook, cfg["columns"], a.date_from, a.date_to)
    ids = parse_checks(a.checks, REGISTRY)
    results = [REGISTRY[i](df, cfg["checks"][i]) for i in ids]
    meta = {"company": a.company, "from": a.date_from, "to": a.date_to,
            "daybook": Path(a.daybook).name, "voucher_lines": int(len(df)),
            "checks_run": ids}
    print(write_report(results, meta, a.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
