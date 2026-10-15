import csv
import hashlib
import json

from run_checks import main


def run(daybook, out):
    main(["--company", "Sample", "--daybook", str(daybook), "--out", str(out), "--checks", "all"])


def test_outputs_and_determinism(daybook_path, tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    run(daybook_path, a)
    run(daybook_path, b)
    for f in ("report.xlsx", "report.json", "summary.md", "delete_list.csv"):
        assert (a / f).exists()
    for f in ("report.json", "summary.md", "delete_list.csv"):
        assert (a / f).read_bytes() == (b / f).read_bytes()
    rows = list(csv.reader(open(a / "delete_list.csv")))
    assert rows[0] == ["voucher_no", "date", "voucher_type", "amount"] and len(rows) == 3
    doc = json.loads((a / "report.json").read_text())
    assert [c["id"] for c in doc["checks"]] == [1, 3, 11]


def test_subset_of_checks(daybook_path, tmp_path):
    main(["--company", "S", "--daybook", str(daybook_path), "--out", str(tmp_path), "--checks", "3"])
    assert [c["id"] for c in json.loads((tmp_path / "report.json").read_text())["checks"]] == [3]
