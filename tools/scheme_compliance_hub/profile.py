"""Parse and validate profile input (form fields or JSON) into the dict the matcher expects."""
from __future__ import annotations

ENTITY_TYPES = {
    "individual": "Individual / salaried", "proprietorship": "Proprietorship", "partnership": "Partnership firm",
    "llp": "LLP", "pvt_ltd": "Private Limited", "public_ltd": "Public Limited", "opc": "One Person Company",
    "trust_ngo": "Trust / NGO / Section 8", "huf": "HUF",
}
SECTORS = ["manufacturing", "services", "trading", "retail", "agri", "it", "food", "construction", "export"]
REGISTRATIONS = {
    "gst": "GST (regular)", "gst_composition": "GST composition", "gst_qrmp": "GST QRMP (quarterly)",
    "tan": "TAN (deduct TDS)", "pf": "EPF", "esi": "ESI", "fssai": "FSSAI", "iec": "IEC (import-export)",
    "udyam": "Udyam / MSME", "fcra": "FCRA",
}
OCCUPATIONS = ["farmer", "farm_labour", "student", "artisan", "street_vendor", "daily_wage", "gig_worker",
               "salaried", "self_employed", "homemaker", "retired"]
STATES = ["andhra_pradesh", "arunachal_pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana",
          "himachal_pradesh", "jharkhand", "karnataka", "kerala", "madhya_pradesh", "maharashtra", "manipur",
          "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil_nadu", "telangana",
          "tripura", "uttar_pradesh", "uttarakhand", "west_bengal", "delhi", "jammu_kashmir", "ladakh",
          "chandigarh", "puducherry", "andaman_nicobar", "lakshadweep", "dadra_nagar_haveli_daman_diu"]


def _num(v):
    if v in (None, ""):
        return None
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def _bool(v):
    if v in (None, ""):
        return None
    return str(v).lower() in ("1", "true", "yes", "on", "y")


def parse(src) -> dict:
    """`src` is a dict-like (werkzeug MultiDict or plain dict)."""
    get = src.get
    getlist = src.getlist if hasattr(src, "getlist") else (lambda k: src.get(k) or [])
    p: dict = {"audience": "individual" if get("entity_type") in ("individual", "huf") else "business"}
    if get("audience") in ("individual", "business"):
        p["audience"] = get("audience")
    for k in ("entity_type", "sector", "state", "gender", "category", "occupation"):
        if get(k):
            p[k] = get(k)
    for k in ("turnover", "employees", "age", "income"):
        n = _num(get(k))
        if n is not None:
            p[k] = n
    for k in ("startup", "exporter", "new_business", "owns_house", "mostly_digital", "presumptive"):
        b = _bool(get(k))
        if b is not None:
            p[k] = b
    p["registrations"] = [r for r in getlist("registrations") if r in REGISTRATIONS]
    return p
