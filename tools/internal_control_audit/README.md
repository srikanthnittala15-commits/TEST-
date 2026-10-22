# Internal Control & Audit Tool

A self-hosted web app for running internal control / IFC audits across one or many clients.
Python standard library only (sqlite + `http.server`); no installs needed.

## Run

```bash
python server.py --port 8000          # optional: --db path/to/audit.db
python -m unittest test_app           # tests
```

Open http://127.0.0.1:8000, enter your name under **Acting as** (required for any change), create a client, then load the starter RCM.

## What it covers

| Tab | Purpose |
|---|---|
| Risk & Controls | Risk & Control Matrix (RCM): process, risk, control, type, nature, frequency, key flag, assertion, rating, owner. One-click Indian starter RCM (P2P, O2C, payroll, fixed assets, inventory, financial close, GST/TDS/ROC compliance, ITGC; 33 controls) |
| Testing | Workpapers: procedure, sample size, exceptions, evidence reference, result, preparer, reviewer sign-off |
| Findings | Observation, severity, recommendation, management response, owner, due date, closure |
| Dashboard | Coverage by process, open/overdue findings, indicative IFC conclusion |
| Audit trail | Hash-chained log of every action, with an integrity check |
| Report | Printable report at `/report/<client_id>` |

## Controls built into the tool itself

- **Segregation of duties:** a test's reviewer cannot be its preparer.
- **Locked records:** reviewed tests and closed findings cannot be edited; controls with test evidence cannot be deleted.
- **Only reviewed work counts:** unreviewed tests are excluded from the dashboard and report.
- **Closure needs evidence:** a finding cannot be closed without a closure note.
- **Tamper-evident log:** each entry carries a SHA-256 hash of the previous one; edits to history break the chain.
- Rejected reviews require a reason; "Effective" cannot be recorded when exceptions were found.

## Framework notes (India)

The starter RCM is mapped to Companies Act 2013 s.143(3)(i) (auditor's IFC report), s.134(5)(e), s.177(9), s.188, CARO 2020, SA 315/330/240/265, Ind AS 24, and GST/TDS/PF-ESI/MSME (s.43B(h)) compliance. The dashboard conclusion
(material weakness / significant deficiency indicator) is a rule-based indication only: the final opinion is the auditor's professional judgement.
Sample-size defaults by frequency are common practice, not a standard: set them per SA 530 and your firm's methodology.

## Known limits (v1)

- Names are self-declared (no login/passwords), so use only on a trusted network or put it behind a reverse proxy with authentication before wider use. The log is tamper-evident, not tamper-proof against someone with database access who rewrites the whole chain.
- Evidence is a reference field; files are not uploaded.
- Single-tenant database (clients share one file, separated by client id).
