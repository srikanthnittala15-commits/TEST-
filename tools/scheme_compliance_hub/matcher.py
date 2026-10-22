"""Rules engine: match a user profile against schemes / compliance rules and compute due dates."""
from __future__ import annotations

import calendar
import datetime as dt
from pathlib import Path

import yaml

DATA = Path(__file__).parent / "data"


def load_yaml(name: str) -> list[dict]:
    with open(DATA / name, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or []


def derive(profile: dict) -> dict:
    """Add derived facts (audit applicability etc.) to a raw profile."""
    p = dict(profile)
    p.setdefault("registrations", [])
    t = p.get("turnover")
    if p.get("audience") == "individual":
        p["tax_audit"] = False
    if p.get("audience") == "business" and t is not None:
        digital_limit = 10_00_00_000
        limit = digital_limit if p.get("mostly_digital") else 1_00_00_000
        p["tax_audit"] = t > limit and not p.get("presumptive")
        # Udyam classification (turnover limits only; investment limit not captured)
        p["msme_class"] = "micro" if t <= 5_00_00_000 else "small" if t <= 50_00_00_000 else "medium" if t <= 250_00_00_000 else "large"
    return p


def _in(value, allowed):
    return value is None or value == "" or not allowed or value in allowed


def eligible(rule: dict, p: dict) -> tuple[bool, list[str]]:
    """Return (matches, notes). Missing profile facts never exclude a rule; they add a verify note."""
    c = rule.get("when", {})
    notes: list[str] = []

    def num(key, profile_key, cmp, label):
        if key not in c:
            return True
        v = p.get(profile_key)
        if v in (None, ""):
            notes.append(f"Confirm {label}")
            return True
        return cmp(float(v), float(c[key]))

    if c.get("audience") and p.get("audience") not in (c["audience"] if isinstance(c["audience"], list) else [c["audience"]]):
        return False, []
    if not _in(p.get("entity_type"), c.get("entity_types")):
        return False, []
    if not _in(p.get("sector"), c.get("sectors")):
        return False, []
    if c.get("states") and p.get("state") and p["state"] not in c["states"]:
        return False, []
    if not _in(p.get("gender"), c.get("gender")):
        return False, []
    if not _in(p.get("category"), c.get("categories")):
        return False, []
    if c.get("occupations") and p.get("occupation") and p["occupation"] not in c["occupations"]:
        return False, []
    if c.get("msme_class") and p.get("msme_class") and p["msme_class"] not in c["msme_class"]:
        return False, []
    checks = [
        num("max_turnover", "turnover", lambda a, b: a <= b, "annual turnover"),
        num("min_turnover", "turnover", lambda a, b: a >= b, "annual turnover"),
        num("max_employees", "employees", lambda a, b: a <= b, "employee count"),
        num("min_employees", "employees", lambda a, b: a >= b, "employee count"),
        num("min_age", "age", lambda a, b: a >= b, "age"),
        num("max_age", "age", lambda a, b: a <= b, "age"),
        num("max_income", "income", lambda a, b: a <= b, "annual income"),
        num("min_income", "income", lambda a, b: a >= b, "annual income"),
    ]
    if not all(checks):
        return False, []
    regs = set(p.get("registrations", []))
    if c.get("requires_registrations") and not set(c["requires_registrations"]) <= regs:
        return False, []
    if c.get("any_registration") and not (set(c["any_registration"]) & regs):
        return False, []
    if c.get("excludes_registrations") and set(c["excludes_registrations"]) & regs:
        return False, []
    for flag in ("startup", "tax_audit", "exporter", "female_led", "new_business", "has_loan", "owns_house"):
        if c.get(flag) is not None and flag in p and bool(p[flag]) != bool(c[flag]):
            return False, []
        if c.get(flag) is not None and flag not in p:
            notes.append(f"Confirm: {flag.replace('_', ' ')}")
    return True, sorted(set(notes))


def _clamp(year: int, month: int, day: int) -> dt.date:
    return dt.date(year, month, min(day, calendar.monthrange(year, month)[1]))


def next_dates(rule: dict, today: dt.date, horizon_days: int = 120) -> list[dt.date]:
    """Dates (>= today, <= today+horizon) on which a compliance rule falls due."""
    end = today + dt.timedelta(days=horizon_days)
    out: list[dt.date] = []
    for year in (today.year, today.year + 1):
        if "monthly_day" in rule:
            for m in range(1, 13):
                out.append(_clamp(year, m, rule["monthly_day"]))
        for m, d in rule.get("dates", []):
            out.append(_clamp(year, m, d))
    return sorted(d for d in set(out) if today <= d <= end)


def match(profile: dict, schemes: list[dict], compliances: list[dict], today: dt.date | None = None,
          horizon_days: int = 120) -> dict:
    today = today or dt.date.today()
    p = derive(profile)
    s_out, c_out = [], []
    for s in schemes:
        ok, notes = eligible(s, p)
        if ok:
            s_out.append({**s, "notes": notes})
    for c in compliances:
        ok, notes = eligible(c, p)
        if not ok:
            continue
        dates = next_dates(c, today, horizon_days) if ("monthly_day" in c or c.get("dates")) else []
        c_out.append({**c, "notes": notes, "upcoming": dates})
    c_out.sort(key=lambda x: (x["upcoming"][0] if x["upcoming"] else dt.date.max))
    return {"profile": p, "schemes": s_out, "compliances": c_out}
