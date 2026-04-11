#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

ROOT = Path("/mnt/c/Users/mrgbi/lge-site-analysis")
RAW_DIR = ROOT / "data" / "raw"
UA = "Mozilla/5.0 (compatible; lge-site-analysis/1.0)"
RESTRICTED_PREFIXES = ["/shop/", "/add-to-cart/", "/my-page"]
ERROR_SNIPPETS = ["요청하신 페이지를", "찾을 수 없습니다."]


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
            href = (attr.get("href") or "").strip()
            text = (attr.get("aria-label") or "").strip()
            self.links.append({"href": href, "text": text})
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
    clean = parsed._replace(query=query, fragment="")
    return urlunparse(clean)


def file_slug(url: str) -> str:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    parsed = urlparse(url)
    path = parsed.path.strip("/").replace("/", "__") or "root"
    return f"{path[:80]}__{digest}"


def fetch(url: str) -> tuple[int, str]:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=30) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


def is_restricted(url: str) -> bool:
    path = urlparse(url).path
    return any(path.startswith(prefix) for prefix in RESTRICTED_PREFIXES)


def same_site(url: str) -> bool:
    host = urlparse(url).netloc
    return host.endswith("lge.co.kr")


def filtered_links(base_url: str, links: list[dict[str, str]]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in links:
        href = item["href"]
        if not href or href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
            continue
        abs_url = canonicalize(urljoin(base_url, href))
        if not same_site(abs_url):
            continue
        if abs_url in seen:
            continue
        seen.add(abs_url)
        result.append(abs_url)
    return result


def filtered_assets(base_url: str, assets: list[dict[str, str]]) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in assets:
        src = item["src"]
        if not src:
            continue
        abs_url = canonicalize(urljoin(base_url, src))
        if abs_url in seen:
            continue
        seen.add(abs_url)
        result.append({"src": abs_url, "alt": item["alt"]})
    return result


def asset_kind_from_url(src: str) -> str:
    lowered = src.lower()
    if lowered.endswith(".svg") or ".svg?" in lowered:
        return "icon"
    if any(ext in lowered for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]):
        return "image"
    return "asset"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--download-assets", action="store_true")
    args = parser.parse_args()

    seeds_path = RAW_DIR / "seed-urls.json"
    if not seeds_path.exists():
        print(f"Missing {seeds_path}. Run build_seed_urls.py first.", file=sys.stderr)
        return 1

    pages_dir = RAW_DIR / "pages"
    assets_dir = RAW_DIR / "assets"
    pages_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    seeds = json.loads(seeds_path.read_text(encoding="utf-8"))["seedUrls"]
    archive_index: list[dict[str, object]] = []

    for seed in seeds[: args.limit]:
        url = canonicalize(seed["url"])
        slug = file_slug(url)
        html_path = pages_dir / f"{slug}.html"
        meta_path = pages_dir / f"{slug}.json"

        if is_restricted(url):
            meta = {
                "url": url,
                "pageGroup": seed["pageGroup"],
                "crawlStatus": "restricted",
                "title": "Restricted Page Placeholder",
                "links": [],
                "assets": [],
                "headings": [],
                "errorDetected": False,
            }
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            archive_index.append(meta)
            continue

        try:
            status, html = fetch(url)
        except Exception as exc:  # noqa: BLE001
            meta = {
                "url": url,
                "pageGroup": seed["pageGroup"],
                "crawlStatus": "placeholder",
                "title": "Fetch Failed Placeholder",
                "links": [],
                "assets": [],
                "headings": [],
                "errorDetected": True,
                "error": str(exc),
            }
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            archive_index.append(meta)
            continue

        html_path.write_text(html, encoding="utf-8")
        parser_obj = PageParser()
        parser_obj.feed(html)
        error_detected = any(snippet in html for snippet in ERROR_SNIPPETS)
        assets = filtered_assets(url, parser_obj.images)

        meta = {
            "url": url,
            "pageGroup": seed["pageGroup"],
            "crawlStatus": "captured" if status == 200 and not error_detected else "placeholder",
            "status": status,
            "title": " ".join(parser_obj.title.split()).strip(),
            "links": filtered_links(url, parser_obj.links),
            "assets": assets,
            "assetCount": len(assets),
            "stylesheets": [canonicalize(urljoin(url, href)) for href in parser_obj.stylesheets],
            "scripts": [canonicalize(urljoin(url, src)) for src in parser_obj.scripts],
            "headings": parser_obj.headings[:50],
            "errorDetected": error_detected,
        }

        if args.download_assets:
            local_assets = []
            for idx, asset in enumerate(assets[:50]):
                src = asset["src"]
                ext_match = re.search(r"\.(png|jpg|jpeg|gif|svg|webp)(?:$|\?)", src, re.IGNORECASE)
                ext = ext_match.group(1).lower() if ext_match else "bin"
                asset_name = f"{slug}__{idx:03d}.{ext}"
                asset_path = assets_dir / asset_name
                try:
                    req = Request(src, headers={"User-Agent": UA})
                    with urlopen(req, timeout=30) as resp:
                        asset_path.write_bytes(resp.read())
                    local_assets.append(
                        {
                            "src": src,
                            "localPath": str(asset_path),
                            "alt": asset["alt"],
                            "kind": asset_kind_from_url(src),
                        }
                    )
                except Exception:
                    local_assets.append(
                        {
                            "src": src,
                            "localPath": None,
                            "alt": asset["alt"],
                            "kind": asset_kind_from_url(src),
                        }
                    )
            meta["assets"] = local_assets

        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        archive_index.append(meta)
        print(f"Archived {url} -> {meta['crawlStatus']}")

    (RAW_DIR / "archive-index.json").write_text(
        json.dumps(archive_index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved {RAW_DIR / 'archive-index.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
