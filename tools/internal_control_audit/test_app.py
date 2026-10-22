import json, os, tempfile, threading, unittest, urllib.request, urllib.error
from http.server import ThreadingHTTPServer
import server


def call(base, method, path, body=None, user="alice"):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-User": user, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


class AppTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        server.DB_PATH = os.path.join(cls.tmp, "t.db")
        server.init_db()
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def j(self, *a, **k):
        s, b = call(self.base, *a, **k)
        return s, json.loads(b)

    def test_full_flow(self):
        s, c = self.j("POST", "/api/clients", {"name": "Acme Pvt Ltd", "financial_year": "2025-26"}); self.assertEqual(s, 200)
        cid = c["id"]
        s, r = self.j("POST", f"/api/clients/{cid}/load-template", {}); self.assertEqual(r["loaded"], len(server.RCM_TEMPLATE))
        s, _ = self.j("POST", f"/api/clients/{cid}/load-template", {}); self.assertEqual(s, 409)
        controls = self.j("GET", f"/api/clients/{cid}/controls")[1]
        key = next(x for x in controls if x["is_key"] and x["risk_rating"] == "High")
        # unattributed writes rejected
        self.assertEqual(call(self.base, "POST", "/api/clients", {"name": "x"}, user="")[0], 401)
        # validation
        s, _ = self.j("POST", f"/api/controls/{key['id']}/tests", {"procedure": "p", "result": "Effective", "prepared_by": "alice", "sample_size": 5, "exceptions": 2}); self.assertEqual(s, 400)
        s, t = self.j("POST", f"/api/controls/{key['id']}/tests", {"procedure": "re-performance", "result": "Ineffective", "prepared_by": "alice", "sample_size": 25, "exceptions": 4}); self.assertEqual(s, 200)
        # unreviewed tests do not count
        self.assertIn("incomplete", self.j("GET", f"/api/clients/{cid}/dashboard")[1]["indication"].lower())
        # segregation of duties
        s, _ = self.j("POST", f"/api/tests/{t['id']}/review", {"reviewed_by": "Alice", "status": "Approved"}); self.assertEqual(s, 403)
        s, _ = self.j("POST", f"/api/tests/{t['id']}/review", {"reviewed_by": "bob", "status": "Rejected"}); self.assertEqual(s, 400)
        s, _ = self.j("POST", f"/api/tests/{t['id']}/review", {"reviewed_by": "bob", "status": "Approved"}, user="bob"); self.assertEqual(s, 200)
        s, _ = self.j("POST", f"/api/tests/{t['id']}/review", {"reviewed_by": "carol", "status": "Approved"}); self.assertEqual(s, 409)  # locked
        # cannot delete a control with test evidence
        self.assertEqual(self.j("DELETE", f"/api/controls/{key['id']}")[0], 409)
        # findings lifecycle
        s, f = self.j("POST", f"/api/clients/{cid}/findings", {"title": "3-way match bypassed", "severity": "High", "control_id": key["id"], "due_date": "2020-01-01"}); self.assertEqual(s, 200)
        self.assertEqual(self.j("GET", f"/api/clients/{cid}/dashboard")[1]["overdue_findings"], 1)
        self.assertEqual(self.j("PUT", f"/api/findings/{f['id']}", {"status": "Closed"})[0], 400)
        self.assertEqual(self.j("PUT", f"/api/findings/{f['id']}", {"status": "Closed", "closure_note": "Re-tested 25 samples, no exceptions"})[0], 200)
        self.assertEqual(self.j("PUT", f"/api/findings/{f['id']}", {"status": "Open"})[0], 409)
        # report + escaping
        self.j("POST", f"/api/clients/{cid}/findings", {"title": "<script>alert(1)</script>", "severity": "Low"})
        s, body = call(self.base, "GET", f"/report/{cid}")
        self.assertEqual(s, 200); self.assertNotIn(b"<script>alert", body); self.assertIn(b"Internal Control Audit Report", body)
        # path traversal
        self.assertEqual(call(self.base, "GET", "/..%2fserver.py")[0], 404)
        self.assertEqual(call(self.base, "GET", "/")[0], 200)

    def test_hash_chain_detects_tampering(self):
        self.j("POST", "/api/clients", {"name": "Chain Co"})
        self.assertTrue(self.j("GET", "/api/log/verify")[1]["valid"])
        con = server.connect(); con.execute("UPDATE audit_log SET detail='forged' WHERE id=1"); con.commit(); con.close()
        self.assertFalse(self.j("GET", "/api/log/verify")[1]["valid"])


if __name__ == "__main__":
    unittest.main()
