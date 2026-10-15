from tally_checks.checks import c01_phantom_duplicates as c


def test_planted_phantom_found_exactly(df, cfg):
    r = c.run(df, cfg["checks"][1])
    pairs = {(x["keep_voucher_no"], x["phantom_voucher_no"]) for x in r.rows}
    # Rent 101/102 and the same-voucher-key and voucher-number-reuse cases
    assert ("101", "102") in pairs
    assert ("1", "1") in pairs                 # Payment 1 vs Receipt 1: distinct vouchers
    assert not any(x["phantom_voucher_no"] == "103" for x in r.rows)  # 10 days away
    assert not any(x["ledger"] == "Salary" for x in r.rows)           # both narrated
    assert not any(x["ledger"] == "Office Exp" for x in r.rows)       # both blank
    assert not any(x["keep_voucher_no"] == "130" for x in r.rows)     # same voucher
    assert r.count == 2


def test_delete_candidates_deduped_and_totalled(df, cfg):
    r = c.run(df, cfg["checks"][1])
    assert [d["voucher_no"] for d in r.delete_candidates] == ["102", "1"]
    assert r.total_amount == 25118.0


def test_window_is_configurable(df, cfg):
    wide = dict(cfg["checks"][1], window_days=12)
    r = c.run(df, wide)
    assert any(x["phantom_voucher_no"] == "103" for x in r.rows)
