from dataclasses import dataclass, field


@dataclass
class CheckResult:
    id: int
    name: str
    severity: str
    rows: list            # findings, list of dicts (the report sheet)
    total_amount: float
    detail: list = field(default_factory=list)   # optional second sheet
    delete_candidates: list = field(default_factory=list)  # voucher refs for delete_list.csv

    @property
    def count(self):
        return len(self.rows)


def fmt_date(ts):
    return ts.strftime("%Y-%m-%d")


from . import c01_phantom_duplicates, c03_suspense_items, c11_blank_narrations  # noqa: E402

REGISTRY = {
    1: c01_phantom_duplicates.run,
    3: c03_suspense_items.run,
    11: c11_blank_narrations.run,
}
