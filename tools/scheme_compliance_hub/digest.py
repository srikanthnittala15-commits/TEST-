"""Build (and optionally email) a weekly digest for every subscriber.

    python digest.py              # print digests to stdout
    python digest.py --send       # send via SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM env vars)
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import smtplib
from email.message import EmailMessage

import db
import matcher
from classify import profile_tags


def build(profile: dict, schemes, compliances, announcements, today=None, horizon=30, since_days=7) -> str:
    today = today or dt.date.today()
    res = matcher.match(profile, schemes, compliances, today, horizon)
    tags = profile_tags(res["profile"])
    lines = [f"Your compliance deadlines - next {horizon} days"]
    due = [(d, c["title"]) for c in res["compliances"] for d in c["upcoming"]]
    lines += [f"  {d:%d %b}  {t}" for d, t in sorted(due)] or ["  (none)"]
    cutoff = today - dt.timedelta(days=since_days)
    new = [a for a in announcements if set(a["tags"]) & tags and dt.date.fromtimestamp(a["fetched_at"]) >= cutoff]
    lines += ["", "New announcements this week"]
    lines += [f"  - {a['title']}\n    {a['url']}" for a in new[:15]] or ["  (none)"]
    lines += ["", "Informational only - confirm on the official source."]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--send", action="store_true")
    args = ap.parse_args()
    schemes, compliances = matcher.load_yaml("schemes.yaml"), matcher.load_yaml("compliances.yaml")
    c = db.conn()
    ann = db.recent(c, 500)
    for sub in db.subscribers(c):
        body = build(sub["profile"], schemes, compliances, ann)
        if not args.send:
            print(f"=== {sub['email']} ===\n{body}\n")
            continue
        msg = EmailMessage()
        msg["Subject"], msg["From"], msg["To"] = "Your weekly scheme & compliance digest", os.environ["SMTP_FROM"], sub["email"]
        msg.set_content(body)
        with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", 587))) as s:
            s.starttls()
            s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
            s.send_message(msg)


if __name__ == "__main__":
    main()
