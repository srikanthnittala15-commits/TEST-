from tally_checks.checks import c11_blank_narrations as c


def test_counts_by_ledger(df, cfg):
    r = c.run(df, cfg["checks"][11])
    by = {x["ledger"]: x for x in r.rows}
    assert by["Rent"]["count"] == 2 and by["Rent"]["total_amount"] == 50000.0
    assert by["Office Exp"]["count"] == 2
    assert "Salary" not in by
    assert len(r.detail) == sum(x["count"] for x in r.rows)
