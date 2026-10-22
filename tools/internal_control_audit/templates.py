"""Starter Risk & Control Matrix library (Indian context).

Each row: (process, risk, control, type, nature, frequency, key, ifc_assertion, rating)
Reference points: Companies Act 2013 s.143(3)(i) (auditor's IFC reporting), s.134(5)(e)
(director's responsibility), ICAI Guidance Note on Audit of IFC over Financial Reporting,
SA 315 / SA 330 / SA 265, and statutory compliance under GST / TDS / PF-ESI.
"""

RCM_TEMPLATE = [
    # Procure to Pay
    ("Procure to Pay", "Purchases made without approved PO", "System blocks GRN/invoice posting without an approved PO", "Preventive", "Automated", "Continuous", 1, "Occurrence", "High"),
    ("Procure to Pay", "Payment to vendor for goods not received", "Three-way match (PO, GRN, invoice) before payment release", "Preventive", "Automated", "Continuous", 1, "Existence", "High"),
    ("Procure to Pay", "Unauthorised or fictitious vendor creation", "Vendor master changes approved by a person independent of AP; KYC (PAN/GSTIN/bank proof) checked", "Preventive", "Manual", "Per event", 1, "Occurrence", "High"),
    ("Procure to Pay", "Duplicate payment of invoices", "Duplicate invoice check (vendor + invoice no. + amount) in system", "Detective", "Automated", "Continuous", 0, "Completeness", "Medium"),
    ("Procure to Pay", "TDS not deducted or deducted at wrong rate on vendor payments", "TDS section/rate mapped at vendor master; monthly TDS reconciliation reviewed by finance head", "Preventive", "Manual", "Monthly", 1, "Presentation", "High"),
    ("Procure to Pay", "Ineligible or excess ITC claimed", "Monthly GSTR-2B vs books reconciliation; Rule 36(4)/Sec 16(2)(c) exceptions reviewed before GSTR-3B filing", "Detective", "Manual", "Monthly", 1, "Valuation", "High"),
    ("Procure to Pay", "MSME vendors paid beyond 45 days (Sec 43B(h) IT Act / MSMED Act)", "MSME ageing report reviewed fortnightly; payment priority flagged", "Detective", "Manual", "Fortnightly", 0, "Presentation", "Medium"),
    # Order to Cash
    ("Order to Cash", "Sales to customers beyond credit limit", "System credit-limit block; overrides approved by Sales Head and Finance", "Preventive", "Automated", "Continuous", 1, "Valuation", "High"),
    ("Order to Cash", "Revenue recorded without delivery (cut-off error)", "Invoice raised only on dispatch / POD; month-end cut-off review of last 5 days' dispatches", "Detective", "Manual", "Monthly", 1, "Cut-off", "High"),
    ("Order to Cash", "Incorrect GST rate / HSN on outward invoices", "HSN-rate master locked; changes approved by tax head; GSTR-1 vs books reconciliation", "Preventive", "Automated", "Continuous", 1, "Accuracy", "High"),
    ("Order to Cash", "E-invoice / e-way bill not generated where mandatory", "System generates IRN before invoice print; weekly exception report of invoices without IRN/EWB", "Preventive", "Automated", "Continuous", 1, "Presentation", "Medium"),
    ("Order to Cash", "Receivables not collected / unprovided doubtful debts", "Monthly debtor ageing reviewed; ECL / provision approved by CFO", "Detective", "Manual", "Monthly", 1, "Valuation", "Medium"),
    ("Order to Cash", "Unauthorised credit notes", "Credit notes above threshold approved by Finance Head; monthly credit note register review", "Preventive", "Manual", "Per event", 0, "Occurrence", "Medium"),
    # Payroll & HR
    ("Payroll & HR", "Payments to ghost employees", "Monthly payroll vs HR headcount reconciliation; new joiner/leaver changes approved by HR head", "Detective", "Manual", "Monthly", 1, "Existence", "High"),
    ("Payroll & HR", "Incorrect salary due to unauthorised master data change", "Payroll master change log reviewed by someone independent of payroll processing", "Detective", "Manual", "Monthly", 1, "Accuracy", "High"),
    ("Payroll & HR", "Late or short deposit of PF / ESI / PT / TDS on salary (s.192)", "Statutory calendar with owner and due dates; challan vs payroll register reconciliation", "Detective", "Manual", "Monthly", 1, "Presentation", "High"),
    # Fixed assets & Inventory
    ("Fixed Assets", "Capex without approval", "Capex approved per Delegation of Authority matrix before PO", "Preventive", "Manual", "Per event", 1, "Occurrence", "Medium"),
    ("Fixed Assets", "Assets not physically existing / not tagged", "Annual physical verification of fixed assets; differences investigated and approved", "Detective", "Manual", "Annual", 1, "Existence", "Medium"),
    ("Fixed Assets", "Incorrect depreciation", "Depreciation run reviewed against asset register and Sch II / IT Act rates", "Detective", "Manual", "Monthly", 0, "Valuation", "Low"),
    ("Inventory", "Inventory differences between books and physical", "Periodic physical count by independent team; variance above tolerance approved by management (CARO 2020 cl. 2)", "Detective", "Manual", "Quarterly", 1, "Existence", "High"),
    ("Inventory", "Slow/obsolete stock not provided for", "Quarterly ageing review and NRV assessment approved by CFO", "Detective", "Manual", "Quarterly", 0, "Valuation", "Medium"),
    # Financial close & reporting
    ("Financial Close", "Unauthorised or erroneous manual journal entries", "Manual JEs above threshold require independent approval; JE report reviewed monthly for unusual entries (SA 240)", "Detective", "Manual", "Monthly", 1, "Occurrence", "High"),
    ("Financial Close", "Bank balances misstated", "Bank reconciliations prepared by one person, reviewed by another within 7 days of month end; old items cleared", "Detective", "Manual", "Monthly", 1, "Existence", "High"),
    ("Financial Close", "Intercompany / related-party transactions not identified (Ind AS 24, s.188)", "Related-party register maintained; transactions approved by Audit Committee where required", "Preventive", "Manual", "Quarterly", 1, "Presentation", "High"),
    ("Financial Close", "Incorrect or incomplete disclosures in financial statements", "Disclosure checklist (Sch III / Ind AS) completed and reviewed before approval by Board", "Detective", "Manual", "Quarterly", 1, "Presentation", "Medium"),
    ("Financial Close", "Subledger and GL out of agreement", "Automated and manual reconciliation of AP, AR, inventory, FA subledgers to GL at month end", "Detective", "Manual", "Monthly", 1, "Completeness", "Medium"),
    # Statutory compliance
    ("Statutory Compliance", "GST returns (GSTR-1/3B/9/9C) filed late or mismatched", "Compliance calendar; GSTR-3B vs GSTR-1 vs books reconciliation signed off before filing", "Detective", "Manual", "Monthly", 1, "Presentation", "High"),
    ("Statutory Compliance", "TDS/TCS returns (24Q/26Q/27Q) late or with errors", "Quarterly TDS return reconciled to books and Form 26AS/AIS before filing", "Detective", "Manual", "Quarterly", 1, "Presentation", "High"),
    ("Statutory Compliance", "ROC filings (AOC-4, MGT-7, DIR-3 KYC) missed", "Company secretary maintains ROC calendar; status reported to Board quarterly", "Detective", "Manual", "Quarterly", 0, "Presentation", "Medium"),
    # IT general controls
    ("IT General Controls", "Unauthorised access to financial systems", "Quarterly user access review by system owner; leavers removed within 2 working days", "Detective", "Manual", "Quarterly", 1, "Occurrence", "High"),
    ("IT General Controls", "Unauthorised changes to application / master configuration", "Changes tested, approved and migrated through a change-management process with segregated roles", "Preventive", "Manual", "Per event", 1, "Accuracy", "High"),
    ("IT General Controls", "Data loss", "Daily backups with quarterly restoration test", "Detective", "Automated", "Daily", 0, "Completeness", "Medium"),
    ("Entity Level", "Weak tone at the top / no whistle-blower mechanism (s.177(9))", "Vigil mechanism in place; complaints reported to Audit Committee", "Detective", "Manual", "Quarterly", 0, "Presentation", "Medium"),
]

# Typical minimum sample sizes by control frequency (common audit practice; adjust per risk and SA 530)
SAMPLE_GUIDE = {
    "Annual": 1, "Quarterly": 2, "Monthly": 2, "Fortnightly": 3, "Weekly": 5,
    "Daily": 25, "Continuous": 1, "Per event": 25,
}
