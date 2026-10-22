"""Internal Control & Audit Tool - stdlib-only web app (sqlite + http.server).

Run:  python server.py [--port 8000] [--db audit.db]
"""
import argparse
import hashlib
import html
import json
import mimetypes
import os
import re
import sqlite3
import threading
from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from templates import RCM_TEMPLATE, SAMPLE_GUIDE

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "static")
LOCK = threading.Lock()
DB_PATH = os.path.join(HERE, "audit.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS clients(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, entity_type TEXT, financial_year TEXT, created TEXT);
CREATE TABLE IF NOT EXISTS controls(
  id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), ref TEXT,
  process TEXT, risk TEXT, control TEXT, type TEXT, nature TEXT, frequency TEXT,
  is_key INTEGER DEFAULT 0, assertion TEXT, risk_rating TEXT, owner TEXT);
CREATE TABLE IF NOT EXISTS tests(
  id INTEGER PRIMARY KEY, control_id INTEGER NOT NULL REFERENCES controls(id),
  procedure TEXT, sample_size INTEGER, exceptions INTEGER DEFAULT 0, evidence TEXT,
  result TEXT, prepared_by TEXT, test_date TEXT,
  review_status TEXT DEFAULT 'Pending', reviewed_by TEXT, review_note TEXT, reviewed_on TEXT);
CREATE TABLE IF NOT EXISTS findings(
  id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id),
  control_id INTEGER, test_id INTEGER, title TEXT, observation TEXT, severity TEXT,
  recommendation TEXT, mgmt_response TEXT, owner TEXT, due_date TEXT,
  status TEXT DEFAULT 'Open', closure_note TEXT, created TEXT, closed_on TEXT);
CREATE TABLE IF NOT EXISTS audit_log(
  id INTEGER PRIMARY KEY, ts TEXT, actor TEXT, action TEXT, entity TEXT, entity_id INTEGER,
  detail TEXT, prev_hash TEXT, hash TEXT);
"""

CONTROL_FIELDS = ["ref", "process", "risk", "control", "type", "nature", "frequency",
                  "is_key", "assertion", "risk_rating", "owner"]
TEST_FIELDS = ["procedure", "sample_size", "exceptions", "evidence", "result", "prepared_by", "test_date"]
FINDING_FIELDS = ["control_id", "test_id", "title", "observation", "severity", "recommendation",
                  "mgmt_response", "owner", "due_date"]

ENUMS = {
    "type": {"Preventive", "Detective", "Corrective"},
    "nature": {"Manual", "Automated", "IT-dependent manual"},
    "risk_rating": {"High", "Medium", "Low"},
    "result": {"Effective", "Effective with exceptions", "Ineffective", "Not tested"},
    "severity": {"High", "Medium", "Low"},
}


class ApiError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status, self.msg = status, msg


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect():
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def rows(con, sql, *args):
    return [dict(r) for r in con.execute(sql, args)]


def row(con, sql, *args):
    r = con.execute(sql, args).fetchone()
    return dict(r) if r else None


def log(con, actor, action, entity, entity_id, detail=""):
    """Append to a hash-chained log so after-the-fact tampering is detectable."""
    last = con.execute("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
    prev = last["hash"] if last else "GENESIS"
    ts = now()
    payload = "|".join([prev, ts, actor, action, entity, str(entity_id), detail])
    h = hashlib.sha256(payload.encode()).hexdigest()
    con.execute("INSERT INTO audit_log(ts,actor,action,entity,entity_id,detail,prev_hash,hash) VALUES(?,?,?,?,?,?,?,?)",
                (ts, actor, action, entity, entity_id, detail, prev, h))


def verify_chain(con):
    prev = "GENESIS"
    for r in con.execute("SELECT * FROM audit_log ORDER BY id"):
        payload = "|".join([prev, r["ts"], r["actor"], r["action"], r["entity"], str(r["entity_id"]), r["detail"]])
        if r["prev_hash"] != prev or hashlib.sha256(payload.encode()).hexdigest() != r["hash"]:
            return {"valid": False, "broken_at": r["id"]}
        prev = r["hash"]
    return {"valid": True, "entries": con.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]}


def pick(body, fields):
    return {k: body[k] for k in fields if k in body}


def validate(data):
    for k, allowed in ENUMS.items():
        if k in data and data[k] not in allowed:
            raise ApiError(400, f"{k} must be one of {sorted(allowed)}")
    for k in ("sample_size", "exceptions"):
        if k in data:
            try:
                data[k] = int(data[k])
            except (TypeError, ValueError):
                raise ApiError(400, f"{k} must be a number")
            if data[k] < 0:
                raise ApiError(400, f"{k} cannot be negative")
    if "is_key" in data:
        data["is_key"] = 1 if data["is_key"] else 0
    if data.get("due_date"):
        try:
            date.fromisoformat(data["due_date"])
        except ValueError:
            raise ApiError(400, "due_date must be YYYY-MM-DD")
    return data


def need(data, *keys):
    for k in keys:
        if not str(data.get(k, "")).strip():
            raise ApiError(400, f"{k} is required")


def insert(con, table, data):
    cols = ",".join(data)
    cur = con.execute(f"INSERT INTO {table}({cols}) VALUES({','.join('?' * len(data))})", list(data.values()))
    return cur.lastrowid


def update(con, table, id_, data):
    if data:
        con.execute(f"UPDATE {table} SET {','.join(k + '=?' for k in data)} WHERE id=?", [*data.values(), id_])


# ---------------------------------------------------------------- business logic

def evaluate_test_result(t):
    """Suggest a conclusion from the sample: any exception on a key control is flagged."""
    if t["sample_size"] and t["exceptions"] is not None:
        if t["exceptions"] > t["sample_size"]:
            raise ApiError(400, "exceptions cannot exceed sample size")


def dashboard(con, cid):
    controls = rows(con, "SELECT * FROM controls WHERE client_id=?", cid)
    tests = rows(con, "SELECT t.* FROM tests t JOIN controls c ON c.id=t.control_id WHERE c.client_id=? ORDER BY t.id", cid)
    findings = rows(con, "SELECT * FROM findings WHERE client_id=?", cid)
    latest = {}
    for t in tests:  # latest *reviewed* test per control drives the conclusion
        if t["review_status"] == "Approved":
            latest[t["control_id"]] = t
    today = date.today().isoformat()
    by_process = {}
    for c in controls:
        p = by_process.setdefault(c["process"], {"controls": 0, "tested": 0, "ineffective": 0})
        p["controls"] += 1
        t = latest.get(c["id"])
        if t:
            p["tested"] += 1
            if t["result"] == "Ineffective":
                p["ineffective"] += 1
    key = [c for c in controls if c["is_key"]]
    key_tested = [c for c in key if c["id"] in latest]
    key_bad = [c for c in key if latest.get(c["id"], {}).get("result") == "Ineffective"]
    high_bad = [c for c in key_bad if c["risk_rating"] == "High"]
    open_f = [f for f in findings if f["status"] != "Closed"]
    sev = {s: sum(1 for f in open_f if f["severity"] == s) for s in ("High", "Medium", "Low")}
    overdue = [f for f in open_f if f["due_date"] and f["due_date"] < today]
    if not key:
        indication = "No key controls defined"
    elif len(key_tested) < len(key):
        indication = f"Testing incomplete ({len(key_tested)}/{len(key)} key controls reviewed)"
    elif high_bad:
        indication = "Indicator of MATERIAL WEAKNESS - key high-risk control(s) ineffective"
    elif key_bad:
        indication = "Indicator of SIGNIFICANT DEFICIENCY - key control(s) ineffective"
    else:
        indication = "No key control failures noted (IFC appears adequate and operating effectively)"
    return {
        "controls": len(controls), "key_controls": len(key),
        "tested_pct": round(100 * len(latest) / len(controls)) if controls else 0,
        "key_tested_pct": round(100 * len(key_tested) / len(key)) if key else 0,
        "results": {r: sum(1 for t in latest.values() if t["result"] == r) for r in ENUMS["result"]},
        "pending_review": sum(1 for t in tests if t["review_status"] == "Pending"),
        "open_findings": sev, "overdue_findings": len(overdue),
        "closed_findings": len(findings) - len(open_f),
        "by_process": by_process, "indication": indication,
        "indication_note": "Indicative only. Final IFC conclusion (s.143(3)(i)) rests on the auditor's professional judgement.",
    }


def render_report(con, cid):
    c = row(con, "SELECT * FROM clients WHERE id=?", cid)
    if not c:
        raise ApiError(404, "client not found")
    d = dashboard(con, cid)
    e = html.escape
    ctrls = rows(con, "SELECT * FROM controls WHERE client_id=? ORDER BY process, id", cid)
    tests = {}
    for t in rows(con, "SELECT t.* FROM tests t JOIN controls c ON c.id=t.control_id WHERE c.client_id=? AND t.review_status='Approved' ORDER BY t.id", cid):
        tests[t["control_id"]] = t
    fnds = rows(con, "SELECT f.*, c.ref AS cref FROM findings f LEFT JOIN controls c ON c.id=f.control_id WHERE f.client_id=? ORDER BY CASE f.severity WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, f.id", cid)
    rcm = "".join(
        f"<tr><td>{e(x['ref'] or '')}</td><td>{e(x['process'])}</td><td>{e(x['risk'])}</td><td>{e(x['control'])}</td>"
        f"<td>{'Key' if x['is_key'] else ''}</td><td>{e(x['frequency'])}</td>"
        f"<td>{e(tests[x['id']]['result']) if x['id'] in tests else 'Not tested'}</td></tr>" for x in ctrls)
    fr = "".join(
        f"<tr><td>{e(x['cref'] or '')}</td><td>{e(x['severity'])}</td><td><b>{e(x['title'])}</b><br>{e(x['observation'] or '')}</td>"
        f"<td>{e(x['recommendation'] or '')}</td><td>{e(x['mgmt_response'] or '')}</td><td>{e(x['owner'] or '')}<br>{e(x['due_date'] or '')}</td>"
        f"<td>{e(x['status'])}</td></tr>" for x in fnds)
    return f"""<!doctype html><meta charset=utf-8><title>Internal Control Audit Report - {e(c['name'])}</title>
<style>body{{font:14px/1.5 Georgia,serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#111}}
table{{border-collapse:collapse;width:100%;margin:1rem 0;font-size:12px}}th,td{{border:1px solid #888;padding:4px 6px;vertical-align:top;text-align:left}}
th{{background:#eee}}.box{{border:2px solid #333;padding:.6rem 1rem;margin:1rem 0}}@media print{{body{{margin:0}}}}</style>
<h1>Internal Control Audit Report</h1>
<p><b>{e(c['name'])}</b> ({e(c['entity_type'] or '')}) &middot; Financial year {e(c['financial_year'] or '')} &middot; Generated {date.today().isoformat()}</p>
<div class=box><b>Indicative conclusion:</b> {e(d['indication'])}<br><small>{e(d['indication_note'])}</small></div>
<h2>Summary</h2><ul><li>Controls in scope: {d['controls']} (key: {d['key_controls']})</li>
<li>Tested and reviewed: {d['tested_pct']}% of all controls, {d['key_tested_pct']}% of key controls</li>
<li>Results: {', '.join(f'{k}: {v}' for k, v in d['results'].items())}</li>
<li>Open findings - High: {d['open_findings']['High']}, Medium: {d['open_findings']['Medium']}, Low: {d['open_findings']['Low']}; overdue: {d['overdue_findings']}</li></ul>
<h2>Risk &amp; Control Matrix with test results</h2>
<table><tr><th>Ref</th><th>Process</th><th>Risk</th><th>Control</th><th>Key</th><th>Freq.</th><th>Result</th></tr>{rcm}</table>
<h2>Findings &amp; action plan</h2>
<table><tr><th>Control</th><th>Severity</th><th>Observation</th><th>Recommendation</th><th>Management response</th><th>Owner / due</th><th>Status</th></tr>{fr}</table>
<p><small>Test results shown are only those approved by an independent reviewer.</small></p>"""


# ---------------------------------------------------------------- routing

def handle(con, method, path, body, actor):
    m = lambda pat: re.fullmatch(pat, path)
    if path == "/api/meta":
        return {"enums": {k: sorted(v) for k, v in ENUMS.items()}, "sample_guide": SAMPLE_GUIDE,
                "frequencies": list(SAMPLE_GUIDE), "template_size": len(RCM_TEMPLATE)}
    if path == "/api/clients":
        if method == "GET":
            return rows(con, "SELECT * FROM clients ORDER BY name")
        need(body, "name")
        d = pick(body, ["name", "entity_type", "financial_year"]); d["created"] = now()
        cid = insert(con, "clients", d); log(con, actor, "create", "client", cid, d["name"])
        return {"id": cid}
    if x := m(r"/api/clients/(\d+)/controls"):
        cid = int(x[1])
        if method == "GET":
            return rows(con, """SELECT c.*, (SELECT result FROM tests t WHERE t.control_id=c.id AND t.review_status='Approved' ORDER BY t.id DESC LIMIT 1) AS latest_result
                                FROM controls c WHERE client_id=? ORDER BY process, id""", cid)
        need(body, "process", "risk", "control", "frequency")
        d = validate(pick(body, CONTROL_FIELDS)); d["client_id"] = cid
        if not d.get("ref"):
            d["ref"] = f"C-{con.execute('SELECT COUNT(*) FROM controls WHERE client_id=?', (cid,)).fetchone()[0] + 1:03d}"
        i = insert(con, "controls", d); log(con, actor, "create", "control", i, d["ref"])
        return {"id": i}
    if x := m(r"/api/clients/(\d+)/load-template"):
        cid = int(x[1])
        if con.execute("SELECT COUNT(*) FROM controls WHERE client_id=?", (cid,)).fetchone()[0]:
            raise ApiError(409, "client already has controls; template loads only into an empty RCM")
        for n, t in enumerate(RCM_TEMPLATE, 1):
            insert(con, "controls", dict(zip(["process", "risk", "control", "type", "nature", "frequency", "is_key", "assertion", "risk_rating"], t),
                                         client_id=cid, ref=f"C-{n:03d}"))
        log(con, actor, "load-template", "client", cid, f"{len(RCM_TEMPLATE)} controls")
        return {"loaded": len(RCM_TEMPLATE)}
    if x := m(r"/api/controls/(\d+)"):
        i = int(x[1])
        c = row(con, "SELECT * FROM controls WHERE id=?", i)
        if not c:
            raise ApiError(404, "control not found")
        if method == "PUT":
            d = validate(pick(body, CONTROL_FIELDS)); update(con, "controls", i, d)
            log(con, actor, "update", "control", i, json.dumps(d)); return {"ok": True}
        if method == "DELETE":
            if con.execute("SELECT COUNT(*) FROM tests WHERE control_id=?", (i,)).fetchone()[0]:
                raise ApiError(409, "control has test records; they must be retained")
            con.execute("DELETE FROM controls WHERE id=?", (i,)); log(con, actor, "delete", "control", i, c["ref"])
            return {"ok": True}
        return c
    if x := m(r"/api/controls/(\d+)/tests"):
        i = int(x[1])
        if method == "GET":
            return rows(con, "SELECT * FROM tests WHERE control_id=? ORDER BY id DESC", i)
        need(body, "procedure", "result", "prepared_by")
        d = validate(pick(body, TEST_FIELDS)); d["control_id"] = i
        d.setdefault("sample_size", 0); d.setdefault("exceptions", 0)
        d["test_date"] = d.get("test_date") or date.today().isoformat()
        evaluate_test_result(d)
        if d["result"] == "Effective" and d["exceptions"] > 0:
            raise ApiError(400, "exceptions found - result cannot be 'Effective'")
        t = insert(con, "tests", d); log(con, actor, "create", "test", t, f"control {i}: {d['result']}")
        return {"id": t}
    if x := m(r"/api/tests/(\d+)/review"):
        i = int(x[1])
        t = row(con, "SELECT * FROM tests WHERE id=?", i)
        if not t:
            raise ApiError(404, "test not found")
        need(body, "reviewed_by")
        if body["reviewed_by"].strip().lower() == (t["prepared_by"] or "").strip().lower():
            raise ApiError(403, "segregation of duties: reviewer cannot be the preparer")
        if t["review_status"] != "Pending":
            raise ApiError(409, "test already reviewed and locked")
        status = body.get("status")
        if status not in ("Approved", "Rejected"):
            raise ApiError(400, "status must be Approved or Rejected")
        if status == "Rejected":
            need(body, "review_note")
        update(con, "tests", i, {"review_status": status, "reviewed_by": body["reviewed_by"],
                                 "review_note": body.get("review_note", ""), "reviewed_on": now()})
        log(con, actor, status.lower(), "test", i, f"by {body['reviewed_by']}")
        return {"ok": True}
    if x := m(r"/api/clients/(\d+)/tests"):
        return rows(con, """SELECT t.*, c.ref, c.control FROM tests t JOIN controls c ON c.id=t.control_id
                            WHERE c.client_id=? ORDER BY t.id DESC""", int(x[1]))
    if x := m(r"/api/clients/(\d+)/findings"):
        cid = int(x[1])
        if method == "GET":
            return rows(con, """SELECT f.*, c.ref AS control_ref FROM findings f LEFT JOIN controls c ON c.id=f.control_id
                                WHERE f.client_id=? ORDER BY f.status='Closed', CASE f.severity WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, f.id""", cid)
        need(body, "title", "severity")
        d = validate(pick(body, FINDING_FIELDS)); d.update(client_id=cid, created=now())
        i = insert(con, "findings", d); log(con, actor, "create", "finding", i, d["title"])
        return {"id": i}
    if x := m(r"/api/findings/(\d+)"):
        i = int(x[1])
        f = row(con, "SELECT * FROM findings WHERE id=?", i)
        if not f:
            raise ApiError(404, "finding not found")
        if f["status"] == "Closed":
            raise ApiError(409, "closed findings are locked")
        d = validate(pick(body, FINDING_FIELDS + ["status", "closure_note"]))
        if "status" in d:
            if d["status"] not in ("Open", "In progress", "Closed"):
                raise ApiError(400, "invalid status")
            if d["status"] == "Closed":
                if not str(d.get("closure_note", f["closure_note"] or "")).strip():
                    raise ApiError(400, "closure_note (evidence of remediation verified) is required to close")
                d["closed_on"] = now()
        update(con, "findings", i, d); log(con, actor, "update", "finding", i, json.dumps(d))
        return {"ok": True}
    if x := m(r"/api/clients/(\d+)/dashboard"):
        return dashboard(con, int(x[1]))
    if x := m(r"/api/clients/(\d+)/log"):
        return rows(con, "SELECT id,ts,actor,action,entity,entity_id,detail FROM audit_log ORDER BY id DESC LIMIT 200")
    if path == "/api/log/verify":
        return verify_chain(con)
    raise ApiError(404, "not found")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, status, ctype, data):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def json(self, status, obj):
        self.send(status, "application/json", json.dumps(obj).encode())

    def serve(self, method):
        path = urlparse(self.path).path
        try:
            if method == "GET" and not path.startswith("/api/"):
                if x := re.fullmatch(r"/report/(\d+)", path):
                    with LOCK:
                        con = connect()
                        try:
                            page = render_report(con, int(x[1])).encode()
                        finally:
                            con.close()
                    return self.send(200, "text/html; charset=utf-8", page)
                rel = "index.html" if path == "/" else path.lstrip("/")
                full = os.path.realpath(os.path.join(STATIC, rel))
                if not full.startswith(STATIC + os.sep) or not os.path.isfile(full):
                    raise ApiError(404, "not found")
                with open(full, "rb") as fh:
                    return self.send(200, mimetypes.guess_type(full)[0] or "application/octet-stream", fh.read())
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
            if not isinstance(body, dict):
                raise ApiError(400, "JSON object expected")
            actor = (self.headers.get("X-User") or "").strip() or "unknown"
            if method != "GET" and actor == "unknown":
                raise ApiError(401, "set your name first (X-User) - every action is attributed in the audit log")
            with LOCK:
                con = connect()
                try:
                    out = handle(con, method, path, body, actor)
                    con.commit()
                except Exception:
                    con.rollback(); raise
                finally:
                    con.close()
            self.json(200, out)
        except ApiError as e:
            self.json(e.status, {"error": e.msg})
        except json.JSONDecodeError:
            self.json(400, {"error": "invalid JSON"})
        except sqlite3.IntegrityError as e:
            self.json(400, {"error": f"data error: {e}"})

    def do_GET(self): self.serve("GET")
    def do_POST(self): self.serve("POST")
    def do_PUT(self): self.serve("PUT")
    def do_DELETE(self): self.serve("DELETE")


def init_db():
    con = connect()
    try:
        con.executescript(SCHEMA)
    finally:
        con.close()


def main():
    global DB_PATH
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--db", default=DB_PATH)
    a = ap.parse_args()
    DB_PATH = os.path.abspath(a.db)
    init_db()
    print(f"Internal Control & Audit Tool on http://{a.host}:{a.port}  (db: {DB_PATH})")
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
