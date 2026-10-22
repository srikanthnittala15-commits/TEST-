"""SQLite storage for announcements and email subscriptions."""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time

DB_PATH = os.environ.get("HUB_DB", os.path.join(os.path.dirname(__file__), "hub.sqlite3"))


def conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.executescript("""
    CREATE TABLE IF NOT EXISTS announcements(
        id TEXT PRIMARY KEY, source TEXT, title TEXT, url TEXT, published TEXT,
        tags TEXT, kind TEXT, fetched_at REAL);
    CREATE TABLE IF NOT EXISTS subscriptions(
        email TEXT PRIMARY KEY, profile TEXT, created_at REAL);
    CREATE INDEX IF NOT EXISTS idx_ann_time ON announcements(fetched_at);
    """)
    return c


def add_announcement(c, source: str, title: str, url: str, published: str, tags: list[str], kind: str) -> bool:
    aid = hashlib.sha1(f"{source}|{url}|{title}".encode()).hexdigest()
    cur = c.execute("INSERT OR IGNORE INTO announcements VALUES(?,?,?,?,?,?,?,?)",
                    (aid, source, title, url, published, json.dumps(tags), kind, time.time()))
    return cur.rowcount == 1


def recent(c, limit: int = 100) -> list[dict]:
    rows = c.execute("SELECT * FROM announcements ORDER BY fetched_at DESC, rowid DESC LIMIT ?", (limit,)).fetchall()
    return [{**dict(r), "tags": json.loads(r["tags"])} for r in rows]


def subscribe(c, email: str, profile: dict) -> None:
    c.execute("INSERT OR REPLACE INTO subscriptions VALUES(?,?,?)", (email.lower(), json.dumps(profile), time.time()))
    c.commit()


def subscribers(c) -> list[dict]:
    return [{"email": r["email"], "profile": json.loads(r["profile"])} for r in c.execute("SELECT * FROM subscriptions")]
