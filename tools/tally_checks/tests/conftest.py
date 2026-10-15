import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).parent))

from sample_data import write_sample_xlsx  # noqa: E402
from tally_checks.loader import load_daybook  # noqa: E402


@pytest.fixture(scope="session")
def cfg():
    return yaml.safe_load((ROOT / "config.yaml").read_text())


@pytest.fixture(scope="session")
def daybook_path(tmp_path_factory):
    p = tmp_path_factory.mktemp("d") / "daybook.xlsx"
    write_sample_xlsx(p)
    return p


@pytest.fixture(scope="session")
def df(daybook_path, cfg):
    return load_daybook(daybook_path, cfg["columns"])
