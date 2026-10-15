# Tally check scripts (Phase 1)

Read-only data-quality checks on a Tally Day Book export. Spec: "Tally Check Scripts — Build Spec (v1)".

**Phase 1 scope:** Excel Day Book loader, checks 1 (phantom duplicates), 3 (suspense items), 11 (blank narrations), report writer.
Not yet built: XML API loader, checks 2, 4-10, 12, bank reconciliation, reversal journals.

```
pip install -r requirements.txt
python run_checks.py --company "ABC Traders" --from 2025-04-01 --to 2026-03-31 \
    --daybook daybook.xlsx --checks all --out E:\Client_Data\abc\_checks\2026-10-15
# or: .\run_checks.ps1 -Company "ABC Traders" -DayBook daybook.xlsx -Out <folder>
pytest
```

Outputs: `report.xlsx`, `report.json`, `summary.md`, `delete_list.csv` (phantom vouchers: number + date + type + amount).

Rules kept: never writes to Tally; vouchers joined on number + date + type; ledger names compared case-insensitively with spaces stripped; thresholds and column aliases in `config.yaml`.
If your export uses different column headings, add aliases under `columns:` in `config.yaml`.
`samples/sample_daybook_SYNTHETIC.xlsx` is made-up data, not a real company.
Note: `report.json`, `summary.md`, `delete_list.csv` are byte-for-byte deterministic; `report.xlsx` has fixed metadata but zip timestamps may differ.
