import datetime as dt
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["HUB_DB"] = os.path.join(tempfile.mkdtemp(), "t.sqlite3")

import collectors  # noqa: E402
import db  # noqa: E402
import matcher  # noqa: E402
from classify import classify  # noqa: E402

S, C = matcher.load_yaml("schemes.yaml"), matcher.load_yaml("compliances.yaml")
TODAY = dt.date(2026, 10, 22)


def ids(items):
    return {i["id"] for i in items}


class MatcherTests(unittest.TestCase):
    def test_all_rules_have_required_keys(self):
        for r in S:
            self.assertTrue({"id", "title", "summary", "when", "source"} <= r.keys(), r["id"])
        for r in C:
            self.assertTrue({"id", "title", "when", "source"} <= r.keys(), r["id"])
        self.assertEqual(len(ids(S)), len(S))
        self.assertEqual(len(ids(C)), len(C))

    def test_pvt_ltd_gst_monthly(self):
        p = {"audience": "business", "entity_type": "pvt_ltd", "turnover": 30_000_000,
             "registrations": ["gst", "tan", "pf"], "employees": 25, "state": "karnataka"}
        r = matcher.match(p, S, C, TODAY)
        cid = ids(r["compliances"])
        self.assertTrue({"gstr1-monthly", "gstr3b-monthly", "tds-payment", "epf-monthly", "aoc4", "professional-tax",
                         "bonus", "tax-audit-report", "itr-company"} <= cid)
        self.assertNotIn("cmp08", cid)
        self.assertNotIn("llp-form11", cid)
        g = next(c for c in r["compliances"] if c["id"] == "gstr3b-monthly")
        self.assertEqual(g["upcoming"][0], dt.date(2026, 11, 20))

    def test_composition_and_qrmp_are_exclusive(self):
        base = {"audience": "business", "entity_type": "proprietorship", "turnover": 1_000_000}
        comp = ids(matcher.match({**base, "registrations": ["gst", "gst_composition"]}, S, C, TODAY)["compliances"])
        self.assertIn("cmp08", comp)
        self.assertNotIn("gstr3b-monthly", comp)
        q = ids(matcher.match({**base, "registrations": ["gst", "gst_qrmp"]}, S, C, TODAY)["compliances"])
        self.assertIn("gstr3b-qrmp", q)
        self.assertNotIn("gstr1-monthly", q)

    def test_tax_audit_threshold(self):
        p = lambda t, **k: matcher.derive({"audience": "business", "turnover": t, **k})
        self.assertFalse(p(9_000_000)["tax_audit"])
        self.assertTrue(p(20_000_000)["tax_audit"])
        self.assertFalse(p(20_000_000, mostly_digital=True)["tax_audit"])
        self.assertFalse(p(20_000_000, presumptive=True)["tax_audit"])

    def test_farmer_schemes_and_no_business_rules(self):
        p = {"audience": "individual", "entity_type": "individual", "occupation": "farmer", "income": 150000,
             "age": 45, "state": "telangana"}
        r = matcher.match(p, S, C, TODAY)
        self.assertTrue({"pm-kisan", "kcc", "pmfby", "rythu-bharosa"} <= ids(r["schemes"]))
        self.assertNotIn("ts-ipass", ids(r["schemes"]))
        self.assertNotIn("gstr3b-monthly", ids(r["compliances"]))

    def test_state_scheme_filtered_by_state(self):
        p = {"audience": "business", "entity_type": "pvt_ltd", "state": "kerala", "new_business": True}
        self.assertNotIn("ts-ipass", ids(matcher.match(p, S, C, TODAY)["schemes"]))
        p["state"] = "telangana"
        self.assertIn("ts-ipass", ids(matcher.match(p, S, C, TODAY)["schemes"]))

    def test_missing_facts_add_notes_not_exclusions(self):
        r = matcher.match({"audience": "business", "entity_type": "llp"}, S, C, TODAY)
        mudra = next(s for s in r["schemes"] if s["id"] == "mudra")
        self.assertIn("Confirm annual turnover", mudra["notes"])

    def test_year_rollover_and_month_clamp(self):
        d = matcher.next_dates({"dates": [[1, 31]], "monthly_day": 31}, dt.date(2026, 12, 20), 60)
        self.assertIn(dt.date(2027, 1, 31), d)
        d = matcher.next_dates({"monthly_day": 31}, dt.date(2027, 2, 1), 30)
        self.assertEqual(d, [dt.date(2027, 2, 28)])


class CollectorTests(unittest.TestCase):
    def test_parse_rss_and_html(self):
        rss = "<rss><channel><item><title>GST due date extended for GSTR-9</title><link>http://x/1</link><pubDate>Mon</pubDate></item></channel></rss>"
        self.assertEqual(collectors.parse_rss(rss)[0][:2], ("GST due date extended for GSTR-9", "http://x/1"))
        html = '<a href="/n/1.pdf">Notification No. 12/2026 - Central Tax</a><a href="#">short</a><a href="/n/1.pdf">Notification No. 12/2026 - Central Tax</a>'
        items = collectors.parse_html(html, "http://g.in/a/", "a")
        self.assertEqual(items, [("Notification No. 12/2026 - Central Tax", "http://g.in/n/1.pdf", "")])

    def test_classify(self):
        tags, kind = classify("Due date extended for filing GSTR-3B for September")
        self.assertIn("gst", tags)
        self.assertEqual(kind, "compliance")
        tags, kind = classify("Government launches new subsidy scheme for farmers")
        self.assertIn("agri", tags)
        self.assertEqual(kind, "scheme")

    def test_db_dedup(self):
        c = db.conn()
        self.assertTrue(db.add_announcement(c, "s", "t", "u", "", ["gst"], "compliance"))
        self.assertFalse(db.add_announcement(c, "s", "t", "u", "", ["gst"], "compliance"))


class AppTests(unittest.TestCase):
    def test_pages(self):
        import app as hub
        cl = hub.app.test_client()
        self.assertEqual(cl.get("/").status_code, 200)
        r = cl.post("/results", data={"entity_type": "pvt_ltd", "turnover": "3,00,00,000", "registrations": ["gst", "tan"],
                                      "state": "karnataka", "employees": "30"})
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"GSTR-3B", r.data)
        j = cl.post("/api/match", json={"entity_type": "individual", "occupation": "farmer", "income": 100000})
        self.assertIn("pm-kisan", {s["id"] for s in j.get_json()["schemes"]})
        self.assertEqual(cl.post("/subscribe", data={"email": "bad"}).status_code, 400)
        self.assertEqual(cl.post("/subscribe", data={"email": "a@b.co", "entity_type": "individual"}).status_code, 302)


if __name__ == "__main__":
    unittest.main()
