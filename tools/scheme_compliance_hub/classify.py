"""Keyword classification of announcements and mapping of profiles to relevant tags."""
from __future__ import annotations

KEYWORDS = {
    "gst": ["gst", "gstr", "cbic", "input tax credit", "e-invoice", "e-way"],
    "income-tax": ["income tax", "income-tax", "itr", "cbdt", "advance tax", "tax audit", "section 80", "form 3cd"],
    "tds": ["tds", "tcs", "tax deducted"],
    "mca": ["companies act", "mca", "roc ", "llp", "aoc-4", "mgt-7", "din ", "director kyc"],
    "labour": ["epfo", "epf", "esic", "labour code", "code on wages", "minimum wage", "gratuity", "bonus"],
    "export": ["dgft", "export", "import", "iec", "customs", "foreign trade"],
    "startup": ["startup", "dpiit", "seed fund"],
    "msme": ["msme", "udyam", "mudra", "cgtmse", "micro and small"],
    "agri": ["farmer", "kisan", "agricultur", "crop", "pm-kisan"],
    "fssai": ["fssai", "food safety"],
    "housing": ["awas", "housing"],
    "education": ["scholarship", "education loan", "student"],
    "health": ["ayushman", "health insurance"],
    "pension": ["pension", "nps", "atal pension"],
}
SCHEME_WORDS = ["scheme", "yojana", "subsidy", "incentive", "grant", "mission", "launch", "applications invited"]
COMPLIANCE_WORDS = ["due date", "extension", "extended", "last date", "deadline", "mandatory", "notification",
                    "circular", "amendment", "compliance", "filing", "return", "penalty", "waiver", "advisory"]


def classify(title: str, source_tags: list[str] | None = None) -> tuple[list[str], str]:
    t = f" {title.lower()} "
    tags = {k for k, words in KEYWORDS.items() if any(w in t for w in words)}
    tags.update(source_tags or [])
    is_s = any(w in t for w in SCHEME_WORDS)
    is_c = any(w in t for w in COMPLIANCE_WORDS)
    kind = "compliance" if is_c else "scheme" if is_s else "general"
    return sorted(tags), kind


def profile_tags(p: dict) -> set[str]:
    """Tags of announcements likely relevant to this profile."""
    tags: set[str] = set()
    regs = set(p.get("registrations", []))
    et = p.get("entity_type")
    if p.get("audience") == "individual":
        tags |= {"income-tax", "pension", "health", "housing"}
        occ = p.get("occupation")
        if occ == "farmer":
            tags.add("agri")
        if occ == "student":
            tags |= {"education"}
    else:
        tags |= {"income-tax", "msme", "scheme"}
    if regs & {"gst", "gst_composition", "gst_qrmp"}:
        tags.add("gst")
    if "tan" in regs:
        tags.add("tds")
    if regs & {"pf", "esi"} or p.get("employees"):
        tags.add("labour")
    if et in {"pvt_ltd", "public_ltd", "opc", "llp"}:
        tags.add("mca")
    if "fssai" in regs or p.get("sector") == "food":
        tags.add("fssai")
    if "iec" in regs or p.get("exporter"):
        tags |= {"export", "dgft"}
    if p.get("startup"):
        tags.add("startup")
    if p.get("sector") == "agri":
        tags.add("agri")
    return tags
