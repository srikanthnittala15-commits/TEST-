def test_header_detected_and_totals_dropped(df):
    assert len(df) == 14                      # totals row and title rows excluded
    assert {"ledger_key", "vkey", "amount"} <= set(df.columns)


def test_ledger_key_normalised(df):
    assert "suspenc" in set(df["ledger_key"])  # 'SUSPENC ' -> case/space folded


def test_period_filter(daybook_path, cfg):
    from tally_checks.loader import load_daybook
    d = load_daybook(daybook_path, cfg["columns"], "2025-08-01", "2025-08-31")
    assert len(d) == 3
