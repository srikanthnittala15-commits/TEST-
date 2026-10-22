"""Poll official sources (RSS / HTML link lists) and store classified announcements.

    python collectors.py            # fetch all sources, store new items
    python collectors.py --check    # fetch and report item counts only (no DB writes)
"""
from __future__ import annotations

import argparse
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
import yaml
from bs4 import BeautifulSoup

import db
from classify import classify

UA = "Mozilla/5.0 (compatible; SchemeComplianceHub/1.0; +research)"
MIN_TITLE = 15


def load_sources() -> list[dict]:
    with open(Path(__file__).parent / "data" / "sources.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def parse_rss(text: str) -> list[tuple[str, str, str]]:
    root = ET.fromstring(text)
    items = []
    for it in root.iter("item"):
        items.append(((it.findtext("title") or "").strip(), (it.findtext("link") or "").strip(),
                      (it.findtext("pubDate") or "").strip()))
    for ent in root.iter("{http://www.w3.org/2005/Atom}entry"):
        link = ent.find("{http://www.w3.org/2005/Atom}link")
        items.append(((ent.findtext("{http://www.w3.org/2005/Atom}title") or "").strip(),
                      link.get("href", "") if link is not None else "",
                      (ent.findtext("{http://www.w3.org/2005/Atom}updated") or "").strip()))
    return items


def parse_html(text: str, base: str, selector: str) -> list[tuple[str, str, str]]:
    soup = BeautifulSoup(text, "html.parser")
    seen, items = set(), []
    for a in soup.select(selector):
        title = " ".join(a.get_text(" ", strip=True).split())
        href = a.get("href")
        if not href or len(title) < MIN_TITLE or href.startswith(("#", "javascript:")):
            continue
        url = urllib.parse.urljoin(base, href)
        if (title, url) not in seen:
            seen.add((title, url))
            items.append((title, url, ""))
    return items


def fetch(src: dict, timeout: int = 30) -> list[tuple[str, str, str]]:
    r = requests.get(src["url"], headers={"User-Agent": UA}, timeout=timeout)
    r.raise_for_status()
    if src["type"] == "rss":
        return parse_rss(r.text)
    return parse_html(r.text, src["url"], src.get("selector", "a"))


def run(check_only: bool = False) -> int:
    c = None if check_only else db.conn()
    new_total = 0
    for src in load_sources():
        try:
            items = fetch(src)
        except Exception as exc:  # network/parse failures must not stop other sources
            print(f"[FAIL] {src['id']}: {exc}", file=sys.stderr)
            continue
        added = 0
        for title, url, published in items:
            tags, kind = classify(title, src.get("tags"))
            if c is not None and db.add_announcement(c, src["name"], title, url, published, tags, kind):
                added += 1
        if c is not None:
            c.commit()
        new_total += added
        print(f"[ OK ] {src['id']}: {len(items)} items" + ("" if check_only else f", {added} new"))
        if not items:
            print(f"       warning: 0 items - selector/URL for '{src['id']}' probably needs updating", file=sys.stderr)
    return new_total


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    run(ap.parse_args().check)
