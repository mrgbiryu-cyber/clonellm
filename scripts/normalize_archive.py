#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import hashlib
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path("/mnt/c/Users/mrgbi/lge-site-analysis")
RAW_DIR = ROOT / "data" / "raw"
NORMALIZED_DIR = ROOT / "data" / "normalized"


def slug_from_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/") or "root"
    base = re.sub(r"[^a-zA-Z0-9_-]+", "-", path)[:100]
    if not parsed.query:
        return base
    digest = hashlib.sha1(parsed.query.encode("utf-8")).hexdigest()[:8]
    return f"{base}-{digest}"


def component_templates(page_group: str, title: str) -> list[dict[str, object]]:
    base = [
        {"componentType": "global-header", "name": "Header"},
        {"componentType": "global-footer", "name": "Footer"},
    ]
    if page_group == "home":
        middle = [
            {"componentType": "hero-banner", "name": "Hero Banner"},
            {"componentType": "promo-carousel", "name": "Promotion Carousel"},
            {"componentType": "product-card-grid", "name": "Featured Products"},
            {"componentType": "cta-banner", "name": "CTA Banner"},
        ]
    elif page_group == "category":
        middle = [
            {"componentType": "category-nav", "name": "Category Navigation"},
            {"componentType": "filter-sort-bar", "name": "Filter / Sort"},
            {"componentType": "product-card-grid", "name": title or "Product Grid"},
            {"componentType": "price-benefit-panel", "name": "Benefits Summary"},
        ]
    elif page_group == "care-solution":
        middle = [
            {"componentType": "hero-banner", "name": "Subscription Hero"},
            {"componentType": "product-card-grid", "name": "Subscription Products"},
            {"componentType": "cta-banner", "name": "Subscription CTA"},
        ]
    elif page_group == "support":
        middle = [
            {"componentType": "support-shortcuts", "name": "Support Shortcuts"},
            {"componentType": "cta-banner", "name": "Support CTA"},
        ]
    elif page_group == "brand":
        middle = [
            {"componentType": "hero-banner", "name": "Brand Hero"},
            {"componentType": "promo-carousel", "name": "Brand Story Blocks"},
            {"componentType": "cta-banner", "name": "Brand CTA"},
        ]
    elif page_group == "bestshop":
        middle = [
            {"componentType": "hero-banner", "name": "Bestshop Hero"},
            {"componentType": "cta-banner", "name": "Store CTA"},
        ]
    else:
        middle = [{"componentType": "restricted-page-placeholder", "name": "Placeholder"}]
    return base[:1] + middle + base[1:]


def infer_component_candidates(item: dict[str, object]) -> list[dict[str, object]]:
    headings = item.get("headings", [])
    title = item.get("title", "")
    page_group = item.get("pageGroup", "other")
    links = item.get("links", [])
    asset_count = int(item.get("assetCount", len(item.get("assets", []))))

    candidates: list[dict[str, object]] = []

    if page_group in {"home", "brand", "care-solution", "bestshop"}:
        candidates.append({"type": "hero-banner", "reason": "top-level landing style page"})
    if page_group == "category":
        candidates.append({"type": "category-nav", "reason": "category landing"})
        candidates.append({"type": "product-card-grid", "reason": "multiple product links detected"})
        if "혜택" in title or any("혜택" in h.get("text", "") for h in headings):
            candidates.append({"type": "price-benefit-panel", "reason": "benefit keyword detected"})
    if page_group == "support":
        candidates.append({"type": "support-shortcuts", "reason": "support page group"})
    if page_group == "brand":
        candidates.append({"type": "promo-carousel", "reason": "brand/story layout"})
    if asset_count >= 8:
        candidates.append({"type": "hero-banner", "reason": "many visual assets"})
    if len(links) >= 20:
        candidates.append({"type": "link-dense-section", "reason": "many internal links"})

    dedup = {}
    for candidate in candidates:
        dedup[candidate["type"]] = candidate
    return list(dedup.values())


def main() -> int:
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    index_path = RAW_DIR / "archive-index.json"
    if not index_path.exists():
        print(f"Missing {index_path}. Run archive_pages.py first.", file=sys.stderr)
        return 1

    archive = json.loads(index_path.read_text(encoding="utf-8"))
    pages = []
    assets = []
    component_candidates = []
    components = {
        "global-header",
        "global-footer",
        "hero-banner",
        "promo-carousel",
        "product-card-grid",
        "filter-sort-bar",
        "category-nav",
        "price-benefit-panel",
        "cta-banner",
        "support-shortcuts",
        "restricted-page-placeholder",
        "link-dense-section",
    }

    group_counter: Counter[str] = Counter()
    component_usage: Counter[str] = Counter()
    asset_kind_counter: Counter[str] = Counter()
    pages_by_group: dict[str, list[str]] = defaultdict(list)

    for item in archive:
        page_id = slug_from_url(item["url"])
        group_counter[item["pageGroup"]] += 1
        pages_by_group[item["pageGroup"]].append(page_id)
        sections = []
        templates = component_templates(item["pageGroup"], item.get("title", ""))
        for order, template in enumerate(templates, start=1):
            component_usage[template["componentType"]] += 1
            sections.append(
                {
                    "id": f"{page_id}-section-{order}",
                    "name": template["name"],
                    "componentType": template["componentType"],
                    "instanceId": f"{page_id}-instance-{order}",
                    "visible": True,
                    "order": order,
                    "props": {
                        "pageTitle": item.get("title", ""),
                        "sourceUrl": item["url"],
                    },
                    "assetIds": [],
                    "interactions": [],
                }
            )

        overlay_sections = []
        if item["crawlStatus"] == "restricted":
            overlay_sections.append(
                {
                    "id": f"{page_id}-overlay-1",
                    "kind": "popup",
                    "triggerSource": "restricted-route",
                    "componentType": "restricted-page-placeholder",
                    "props": {
                        "message": "크롤링 제한 경로는 공통 페이지로 대체 처리",
                        "sourceUrl": item["url"],
                    },
                    "assetIds": [],
                }
            )

        for idx, asset in enumerate(item.get("assets", [])[:20], start=1):
            asset_id = f"{page_id}-asset-{idx}"
            kind = asset.get("kind") if isinstance(asset, dict) else "image"
            asset_kind_counter[kind] += 1
            assets.append(
                {
                    "id": asset_id,
                    "kind": kind or "image",
                    "sourceUrl": asset["src"] if isinstance(asset, dict) else asset,
                    "localPath": asset.get("localPath") if isinstance(asset, dict) else None,
                    "sourcePageId": page_id,
                }
            )
            if sections:
                sections[min(1, len(sections) - 1)]["assetIds"].append(asset_id)

        page_candidates = infer_component_candidates(item)
        component_candidates.append(
            {
                "pageId": page_id,
                "pageGroup": item["pageGroup"],
                "title": item.get("title", ""),
                "candidates": page_candidates,
            }
        )

        pages.append(
            {
                "id": page_id,
                "url": item["url"],
                "crawlStatus": item["crawlStatus"],
                "pageGroup": item["pageGroup"],
                "title": item.get("title", ""),
                "sections": sections,
                "overlays": overlay_sections,
                "responsive": {
                    "desktop": {"direction": "column"},
                    "mobile": {"direction": "column", "stack": True},
                },
            }
        )

    payload = {
        "siteId": "lge-co-kr",
        "source": "crawl",
        "pages": pages,
        "components": [
            {"type": comp, "category": "content", "editableProps": ["pageTitle", "sourceUrl"]}
            for comp in sorted(components)
        ],
        "componentInstances": [],
        "assets": assets,
        "componentCandidates": component_candidates,
        "analysisSummary": {
            "pageCountByGroup": dict(group_counter),
            "componentUsage": dict(component_usage),
            "assetKindCounts": dict(asset_kind_counter),
            "pagesByGroup": dict(pages_by_group),
        },
    }

    out_path = NORMALIZED_DIR / "site-document.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (NORMALIZED_DIR / "component-candidates.json").write_text(
        json.dumps(component_candidates, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    editable_payload = {
        "siteId": payload["siteId"],
        "pages": [
            {
                "id": page["id"],
                "title": page["title"],
                "pageGroup": page["pageGroup"],
                "sections": [
                    {
                        "id": section["id"],
                        "name": section["name"],
                        "componentType": section["componentType"],
                        "visible": section["visible"],
                        "order": section["order"],
                        "props": section["props"],
                    }
                    for section in page["sections"]
                ],
            }
            for page in pages
        ],
    }
    (NORMALIZED_DIR / "editable-prototype.json").write_text(
        json.dumps(editable_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved {out_path}")
    print(f"Saved {NORMALIZED_DIR / 'component-candidates.json'}")
    print(f"Saved {NORMALIZED_DIR / 'editable-prototype.json'}")
    print(f"Pages: {len(pages)}")
    print(f"Assets: {len(assets)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
