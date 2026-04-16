#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PAGES_DIR = RAW_DIR / "pages"
ARCHIVE_INDEX_PATH = RAW_DIR / "archive-index.json"
UA = "Mozilla/5.0 (compatible; clonellm-page-collector/1.0)"
ERROR_SNIPPETS = ["요청하신 페이지를", "찾을 수 없습니다."]

DEFAULT_PAGE_GROUPS = {
    "home": "home",
    "support": "support",
    "bestshop": "bestshop",
    "care-solutions": "care-solution",
    "care-solutions-pdp": "product-detail",
    "homestyle-home": "homestyle",
    "homestyle-pdp": "product-detail",
    "category-tvs": "category",
    "category-refrigerators": "category",
}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self.links: list[dict[str, str]] = []
        self.images: list[dict[str, str]] = []
        self.scripts: list[str] = []
        self.stylesheets: list[str] = []
        self.headings: list[dict[str, str]] = []
        self._current_heading: str | None = None
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "a":
            self.links.append(
                {
                    "href": (attr.get("href") or "").strip(),
                    "text": (attr.get("aria-label") or "").strip(),
                }
            )
        elif tag == "img":
            self.images.append(
                {
                    "src": (attr.get("src") or "").strip(),
                    "alt": (attr.get("alt") or "").strip(),
                }
            )
        elif tag == "script":
            src = (attr.get("src") or "").strip()
            if src:
                self.scripts.append(src)
        elif tag == "link" and (attr.get("rel") or "") == "stylesheet":
            href = (attr.get("href") or "").strip()
            if href:
                self.stylesheets.append(href)
        elif tag in {"h1", "h2", "h3"}:
            self._current_heading = tag
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif self._current_heading == tag:
            text = " ".join("".join(self._buffer).split()).strip()
            if text:
                self.headings.append({"tag": tag, "text": text})
            self._current_heading = None
            self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._current_heading:
            self._buffer.append(data)


def canonicalize(url: str) -> str:
    parsed = urlparse(url)
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    return urlunparse(parsed._replace(query=query, fragment=""))


def file_slug(url: str) -> str:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    parsed = urlparse(url)
    page_path = parsed.path.strip("/").replace("/", "__") or "root"
    return f"{page_path[:80]}__{digest}"


def fetch(url: str) -> tuple[int, str]:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=45) as response:
        return response.status, response.read().decode("utf-8", errors="replace")


def same_site(url: str) -> bool:
    return urlparse(url).netloc.endswith("lge.co.kr")


def filtered_links(base_url: str, links: list[dict[str, str]]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in links:
        href = item["href"]
        if not href or href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
            continue
        absolute = canonicalize(urljoin(base_url, href))
        if not same_site(absolute):
            continue
        if absolute in seen:
            continue
        seen.add(absolute)
        result.append(absolute)
    return result


def filtered_assets(base_url: str, assets: list[dict[str, str]]) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in assets:
        src = item["src"]
        if not src:
            continue
        absolute = canonicalize(urljoin(base_url, src))
        if absolute in seen:
            continue
        seen.add(absolute)
        result.append({"src": absolute, "alt": item["alt"]})
    return result


def asset_kind_from_url(src: str) -> str:
    lowered = src.lower()
    if lowered.endswith(".svg") or ".svg?" in lowered:
        return "icon"
    if any(ext in lowered for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]):
        return "image"
    return "asset"


def parse_target(raw: str) -> tuple[str, str, str]:
    parts = raw.split("|", 2)
    if len(parts) == 3:
        page_id, page_group, url = parts
        return page_id.strip(), page_group.strip(), canonicalize(url.strip())
    if len(parts) == 2:
        page_id, url = parts
        return page_id.strip(), DEFAULT_PAGE_GROUPS.get(page_id.strip(), "other"), canonicalize(url.strip())
    raise ValueError(f"invalid target format: {raw}")


def write_page_capture(page_id: str, page_group: str, url: str) -> dict[str, object]:
    status, html = fetch(url)
    slug = file_slug(url)
    html_path = PAGES_DIR / f"{slug}.html"
    json_path = PAGES_DIR / f"{slug}.json"
    html_path.write_text(html, encoding="utf-8")

    parser = PageParser()
    parser.feed(html)
    error_detected = any(snippet in html for snippet in ERROR_SNIPPETS)
    assets = filtered_assets(url, parser.images)
    meta: dict[str, object] = {
        "pageId": page_id,
        "url": url,
        "pageGroup": page_group,
        "crawlStatus": "captured" if status == 200 and not error_detected else "placeholder",
        "status": status,
        "title": " ".join(parser.title.split()).strip(),
        "links": filtered_links(url, parser.links),
        "assets": assets,
        "assetSummary": {
            "imageCount": sum(1 for item in assets if asset_kind_from_url(item["src"]) == "image"),
            "iconCount": sum(1 for item in assets if asset_kind_from_url(item["src"]) == "icon"),
            "otherCount": sum(1 for item in assets if asset_kind_from_url(item["src"]) == "asset"),
        },
        "stylesheets": parser.stylesheets,
        "scripts": parser.scripts,
        "headings": parser.headings,
        "errorDetected": error_detected,
    }
    json_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return meta


def rebuild_archive_index() -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for json_path in sorted(PAGES_DIR.glob("*.json")):
        try:
            entries.append(json.loads(json_path.read_text(encoding="utf-8")))
        except Exception as exc:  # noqa: BLE001
            print(f"warning: failed to parse {json_path.name}: {exc}", file=sys.stderr)
    entries.sort(key=lambda item: str(item.get("url", "")))
    ARCHIVE_INDEX_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    return entries


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--target",
        action="append",
        default=[],
        help="pageId|pageGroup|url 또는 pageId|url 형식. 여러 번 지정 가능",
    )
    parser.add_argument("--reindex-only", action="store_true")
    args = parser.parse_args()

    PAGES_DIR.mkdir(parents=True, exist_ok=True)

    if not args.reindex_only and not args.target:
        print("no targets provided", file=sys.stderr)
        return 1

    if not args.reindex_only:
        for raw_target in args.target:
            try:
                page_id, page_group, url = parse_target(raw_target)
                meta = write_page_capture(page_id, page_group, url)
                print(f"captured {page_id}: {meta.get('title') or url}")
            except Exception as exc:  # noqa: BLE001
                print(f"failed {raw_target}: {exc}", file=sys.stderr)
                return 1

    index = rebuild_archive_index()
    print(f"archive index rebuilt: {len(index)} pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
