"""Synthetic Day Book with known planted errors (no real client data)."""
import pandas as pd

HEADER = ["Date", "Particulars", "Vch Type", "Vch No.", "Debit Amount", "Credit Amount", "Narration"]

# (date, ledger, type, no, debit, credit, narration)
ROWS = [
    # Planted phantom pair on Rent: V101 keeper, V102 blank two days later (check 1)
    ("2025-04-02", "Rent", "Payment", "101", 25000, 0, "April rent"),
    ("2025-04-04", "Rent", "Payment", "102", 25000, 0, ""),
    # Same amount, blank, but 10 days apart: must NOT be flagged
    ("2025-04-14", "Rent", "Payment", "103", 25000, 0, ""),
    # Both narrated: must NOT be flagged
    ("2025-05-02", "Salary", "Payment", "110", 40000, 0, "May salary"),
    ("2025-05-03", "Salary", "Payment", "111", 40000, 0, "Salary advance"),
    # Both blank: not a phantom pair by spec
    ("2025-06-02", "Office Exp", "Payment", "120", 900, 0, ""),
    ("2025-06-03", "Office Exp", "Payment", "121", 900, 0, ""),
    # Same voucher key twice (multi-line): must NOT pair with itself
    ("2025-06-10", "Freight", "Journal", "130", 500, 0, "Freight"),
    ("2025-06-10", "Freight", "Journal", "130", 500, 0, ""),
    # Voucher number reused on another date/type: distinct vouchers
    ("2025-07-01", "Bank Charges", "Payment", "1", 118, 0, "Charges"),
    ("2025-07-02", "Bank Charges", "Receipt", "1", 118, 0, ""),
    # Suspense entries (check 3), mixed spelling and case, trailing space
    ("2025-08-01", "Suspense A/c", "Payment", "140", 7000, 0, "Unknown payment"),
    ("2025-08-05", "SUSPENC ", "Receipt", "141", 0, 3000, "Unknown receipt"),
    ("2025-08-09", "Cash", "Payment", "142", 100, 0, "Plain cash"),
]


def make_dataframe():
    return pd.DataFrame(ROWS, columns=HEADER).assign(
        Date=lambda d: pd.to_datetime(d["Date"]).dt.strftime("%d-%b-%Y"))


def write_sample_xlsx(path):
    """Tally-style: title rows above the header, totals row below."""
    df = make_dataframe()
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        pd.DataFrame([["SAMPLE TRADERS (synthetic)"], ["Day Book"], ["1-Apr-25 to 31-Mar-26"], [None]]
                     ).to_excel(xw, index=False, header=False, startrow=0)
        df.to_excel(xw, index=False, startrow=4)
        n = len(df)
        pd.DataFrame([["Grand Total", None, None, None, df["Debit Amount"].sum(), df["Credit Amount"].sum(), None]]
                     ).to_excel(xw, index=False, header=False, startrow=5 + n)


if __name__ == "__main__":
    import sys
    write_sample_xlsx(sys.argv[1])
