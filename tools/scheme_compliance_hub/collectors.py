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

try:  # use the OS certificate store (fixes "unable to get local issuer certificate" on Windows)
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
           "Accept-Language": "en-IN,en;q=0.9"}
MIN_TITLE = 15


def load_sources() -> list[dict]:
    with open(Path(__file__).parent / "data" / "sources.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def parse_rss(text: str | bytes) -> list[tuple[str, str, str]]:
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


def get_text(src: dict, timeout: int = 30) -> str:
    """Fetch page text. Sources with `render: true` are loaded in a headless browser (JavaScript sites)."""
    if src.get("render"):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise RuntimeError("needs a browser: pip install playwright && playwright install chromium")
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(user_agent=UA)
            page.goto(src["url"], wait_until="networkidle", timeout=timeout * 1000)
            html = page.content()
            browser.close()
            return html
    r = requests.get(src["url"], headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    return r.text


def fetch(src: dict, timeout: int = 30) -> list[tuple[str, str, str]]:
    if src["type"] == "rss":
        # parse raw bytes so the XML parser honours the declared encoding/BOM (requests guesses wrongly for text/xml)
        r = requests.get(src["url"], headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return parse_rss(r.content)
    return parse_html(get_text(src, timeout), src["url"], src.get("selector", "a"))


def debug(source_id: str) -> None:
    """Save the raw response and print what the site actually sends, to help fix a URL/selector."""
    src = next(s for s in load_sources() if s["id"] == source_id)
    try:
        if src.get("render"):
            text, status, ctype = get_text(src), "rendered", "text/html"
        else:
            r = requests.get(src["url"], headers=HEADERS, timeout=30)
            text, status, ctype = (r.content.decode("utf-8-sig", "replace") if src["type"] == "rss" else r.text,
                                   r.status_code, r.headers.get("content-type"))
    except Exception as exc:
        print(f"request failed: {exc}")
        return
    out = Path(f"debug_{source_id}.html")
    out.write_text(text, encoding="utf-8")
    soup = BeautifulSoup(text, "html.parser" if src["type"] != "rss" else "html.parser")
    links = [(a.get_text(' ', strip=True), a['href']) for a in soup.find_all("a", href=True)]
    print(f"status={status} type={ctype} bytes={len(text)} links={len(links)} saved={out}")
    print("first 300 chars:", text[:300].replace("\n", " "))
    for t, h in [l for l in links if len(l[0]) >= MIN_TITLE][:15]:
        print(f"  {t[:70]!r} -> {h[:90]}")


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
    ap.add_argument("--debug", metavar="SOURCE_ID", help="save and summarise one source's raw response")
    a = ap.parse_args()
    debug(a.debug) if a.debug else run(a.check)
