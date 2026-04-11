#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path("/mnt/c/Users/mrgbi/lge-site-analysis")
RAW_DIR = ROOT / "data" / "raw"

GROUP_LIMITS = {
    "home": 1,
    "category": 20,
    "care-solution": 10,
    "brand": 5,
    "support": 10,
    "bestshop": 10,
    "product-detail": 20,
    "other": 0,
}


def main() -> int:
    summary_path = RAW_DIR / "sitemap-summary.json"
    if not summary_path.exists():
        print(f"Missing {summary_path}. Run fetch_lge_sitemaps.py first.", file=sys.stderr)
        return 1

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    samples: dict[str, list[str]] = summary["samples"]

    # Hard-code high-value pages for this project regardless of sample ordering.
    priority_urls = [
        {"url": "https://www.lge.co.kr/home", "pageGroup": "home"},
        {"url": "https://www.lge.co.kr/category/tvs", "pageGroup": "category"},
        {"url": "https://www.lge.co.kr/category/refrigerators", "pageGroup": "category"},
        {"url": "https://www.lge.co.kr/care-solutions", "pageGroup": "care-solution"},
        {"url": "https://www.lge.co.kr/support", "pageGroup": "support"},
        {"url": "https://www.lge.co.kr/bestshop", "pageGroup": "bestshop"},
        {"url": "https://www.lge.co.kr/lg-signature/info", "pageGroup": "brand"},
        {"url": "https://www.lge.co.kr/objet-collection/story", "pageGroup": "brand"},
    ]

    ordered: list[dict[str, str]] = []
    seen: set[str] = set()

    for item in priority_urls:
        if item["url"] not in seen:
            seen.add(item["url"])
            ordered.append(item)

    for group, limit in GROUP_LIMITS.items():
        for url in samples.get(group, []):
            if url in seen:
                continue
            if sum(1 for item in ordered if item["pageGroup"] == group) >= limit:
                break
            seen.add(url)
            ordered.append({"url": url, "pageGroup": group})

    result = {"seedUrls": ordered}

    out_path = RAW_DIR / "seed-urls.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {out_path}")
    print(f"Seed URL count: {len(result['seedUrls'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
