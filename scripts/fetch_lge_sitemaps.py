#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path("/mnt/c/Users/mrgbi/lge-site-analysis")
RAW_DIR = ROOT / "data" / "raw"
SITEMAP_INDEX_URL = "https://www.lge.co.kr/sitemap.xml"
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
UA = "Mozilla/5.0 (compatible; lge-site-analysis/1.0)"


def fetch_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_sitemap_index(xml_text: str) -> list[str]:
    root = ET.fromstring(xml_text)
    return [node.text for node in root.findall(".//sm:sitemap/sm:loc", NS) if node.text]


def parse_urlset(xml_text: str) -> list[str]:
    root = ET.fromstring(xml_text)
    return [node.text for node in root.findall(".//sm:url/sm:loc", NS) if node.text]


def group_for_url(url: str) -> str:
    path = urlparse(url).path.strip("/")
    if path == "home":
        return "home"
    if path.startswith("category/"):
        if "care-solutions" in path:
            return "care-solution"
        return "category"
    if path.startswith("care-solutions"):
        return "care-solution"
    if path.startswith("support"):
        return "support"
    if path.startswith("bestshop"):
        return "bestshop"
    if path.startswith("lg-signature") or path.startswith("objet-collection") or path.startswith("lg-thinq"):
        return "brand"
    if path:
        parts = path.split("/")
        if len(parts) == 2 and not parts[0].startswith("category"):
            return "product-detail"
    return "other"


def top_prefix(url: str) -> str:
    path = urlparse(url).path.strip("/")
    parts = [p for p in path.split("/") if p]
    if not parts:
        return "root"
    if len(parts) == 1:
        return parts[0]
    return "/".join(parts[:2])


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    sitemap_index_xml = fetch_text(SITEMAP_INDEX_URL)
    sitemap_urls = parse_sitemap_index(sitemap_index_xml)

    sitemap_payload: dict[str, list[str]] = {}
    group_counts: Counter[str] = Counter()
    prefix_counts: Counter[str] = Counter()
    grouped_urls: dict[str, list[str]] = defaultdict(list)

    for sitemap_url in sitemap_urls:
        urls = parse_urlset(fetch_text(sitemap_url))
        sitemap_payload[sitemap_url] = urls
        for url in urls:
            group = group_for_url(url)
            group_counts[group] += 1
            prefix_counts[top_prefix(url)] += 1
            grouped_urls[group].append(url)

    summary = {
        "sitemap_index_url": SITEMAP_INDEX_URL,
        "sitemaps": sitemap_urls,
        "sitemap_counts": {k: len(v) for k, v in sitemap_payload.items()},
        "group_counts": dict(group_counts),
        "top_prefix_counts": dict(prefix_counts.most_common(50)),
        "samples": {group: urls[:20] for group, urls in grouped_urls.items()},
    }

    (RAW_DIR / "sitemap-index.xml").write_text(sitemap_index_xml, encoding="utf-8")
    (RAW_DIR / "sitemaps.json").write_text(
        json.dumps(sitemap_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (RAW_DIR / "sitemap-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("Saved:")
    print(f"- {RAW_DIR / 'sitemaps.json'}")
    print(f"- {RAW_DIR / 'sitemap-summary.json'}")
    print("Group counts:")
    for group, count in sorted(group_counts.items()):
        print(f"  {group}: {count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
