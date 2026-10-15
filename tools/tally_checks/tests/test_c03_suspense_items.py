from tally_checks.checks import c03_suspense_items as c


def test_suspense_variants_found(df, cfg):
    r = c.run(df, cfg["checks"][3])
    assert [x["voucher_no"] for x in r.rows] == ["140", "141"]
    assert r.total_amount == 10000.0
