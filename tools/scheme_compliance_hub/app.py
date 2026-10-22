"""Flask app: profile form -> matched schemes, compliance calendar and relevant announcements.

    python app.py               # http://127.0.0.1:5000
"""
from __future__ import annotations

import datetime as dt
import os

from flask import Flask, jsonify, redirect, render_template, request

import db
import matcher
import profile as prof
from classify import profile_tags

app = Flask(__name__)
SCHEMES = matcher.load_yaml("schemes.yaml")
COMPLIANCES = matcher.load_yaml("compliances.yaml")


def results_for(p: dict, horizon: int = 120) -> dict:
    res = matcher.match(p, SCHEMES, COMPLIANCES, horizon_days=horizon)
    tags = profile_tags(res["profile"])
    c = db.conn()
    ann = [a for a in db.recent(c, 300) if set(a["tags"]) & tags][:60]
    res["announcements"] = ann
    return res


@app.get("/")
def index():
    return render_template("index.html", entity_types=prof.ENTITY_TYPES, sectors=prof.SECTORS,
                           registrations=prof.REGISTRATIONS, occupations=prof.OCCUPATIONS, states=prof.STATES)


@app.route("/results", methods=["GET", "POST"])
def results():
    p = prof.parse(request.values)
    res = results_for(p)
    return render_template("results.html", r=res, today=dt.date.today(), args=request.values.to_dict(flat=False))


@app.post("/api/match")
def api_match():
    p = prof.parse(request.get_json(force=True) or {})
    res = results_for(p)
    return jsonify(res)


@app.post("/subscribe")
def subscribe():
    email = (request.form.get("email") or "").strip()
    if "@" not in email:
        return "Valid email required", 400
    db.subscribe(db.conn(), email, prof.parse(request.form))
    return redirect("/?subscribed=1")


@app.get("/healthz")
def healthz():
    return {"ok": True, "schemes": len(SCHEMES), "compliances": len(COMPLIANCES)}


@app.template_filter("fmtdate")
def fmtdate(d):
    return d.strftime("%d %b %Y")


@app.template_filter("pretty")
def pretty(s):
    return str(s).replace("_", " ").title()


if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", 5000)))
