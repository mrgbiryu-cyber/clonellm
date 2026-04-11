#!/usr/bin/env python3
import json
from pathlib import Path

from build_slot_snapshots import REFERENCE_RAW_DIR, clean_text, extract_desktop_hero_slides, extract_mobile_quickmenu, fetch_live_html

ROOT = Path(__file__).resolve().parents[1]
INTERACTION_OUTPUT_DIR = ROOT / "data" / "normalized" / "interaction-snapshots"


def build_hybrid_home_reference_interactions(desktop_html: str, mobile_html: str):
    hero_slides = extract_desktop_hero_slides(desktop_html)
    quickmenu = extract_mobile_quickmenu(mobile_html)

    interactions = [
        {
            "interactionId": "logo-home-nav",
            "kind": "navigation",
            "slotId": "header-top",
            "trigger": {
                "type": "click",
                "target": "logo",
            },
            "result": {
                "targetKey": "home",
                "targetUrl": "/clone/home",
            },
            "coverageStatus": "captured",
        },
        {
            "interactionId": "header-search-open",
            "kind": "search-open",
            "slotId": "header-top",
            "trigger": {
                "type": "click",
                "target": "search-button",
            },
            "result": {
                "overlay": "search",
            },
            "coverageStatus": "captured",
        },
        {
            "interactionId": "header-cart-nav",
            "kind": "navigation",
            "slotId": "header-top",
            "trigger": {
                "type": "click",
                "target": "cart-link",
            },
            "result": {
                "targetKey": "cart",
                "targetUrl": "/shop/cart/index",
            },
            "coverageStatus": "captured",
        },
        {
            "interactionId": "quickmenu-default",
            "kind": "quickmenu-default",
            "slotId": "quickmenu",
            "trigger": {
                "type": "default",
                "target": "quickmenu",
            },
            "result": {
                "itemCount": quickmenu.get("itemCount", 0),
                "rowCount": quickmenu.get("expectedRowsDesktop", 0),
                "columnCount": quickmenu.get("expectedColumnsDesktop", 0),
            },
            "coverageStatus": "captured",
        },
    ]

    for interaction_id, label in [
        ("gnb-product-open", "제품/소모품"),
        ("gnb-care-open", "가전 구독"),
        ("gnb-support-open", "고객지원"),
        ("gnb-benefits-open", "혜택/이벤트"),
        ("gnb-story-open", "스토리"),
        ("gnb-bestshop-open", "베스트샵"),
        ("gnb-lgai-open", "LG AI"),
    ]:
        interactions.append(
            {
                "interactionId": interaction_id,
                "kind": "gnb-open",
                "slotId": "header-bottom",
                "trigger": {
                    "type": "hover-or-click",
                    "target": label,
                },
                "result": {
                    "menuLabel": label,
                },
                "coverageStatus": "captured",
            }
        )

    for index, slide in enumerate(hero_slides, start=1):
        interactions.append(
            {
                "interactionId": f"hero-slide-{index}",
                "kind": "hero-slide",
                "slotId": "hero",
                "trigger": {
                    "type": "swipe-or-pagination",
                    "target": "hero-carousel",
                },
                "result": {
                    "slideIndex": index,
                    "headline": slide.get("headline", ""),
                    "targetUrl": slide.get("href", ""),
                },
                "coverageStatus": "captured",
            }
        )

    for index, item in enumerate(quickmenu.get("items", []), start=1):
        interactions.append(
            {
                "interactionId": f"quickmenu-nav-{index}",
                "kind": "navigation",
                "slotId": "quickmenu",
                "trigger": {
                    "type": "click",
                    "target": f"quickmenu-item-{index}",
                    "label": clean_text(item.get("title", "")),
                },
                "result": {
                    "targetUrl": item.get("href", ""),
                },
                "coverageStatus": "captured",
            }
        )

    return {
        "pageId": "home",
        "source": "reference",
        "url": "https://www.lge.co.kr/m/home",
        "visualUrl": "https://www.lge.co.kr/m/home",
        "structuralUrl": "https://www.lge.co.kr/home",
        "mode": "hybrid",
        "interactions": interactions,
    }


def main():
    INTERACTION_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REFERENCE_RAW_DIR.mkdir(parents=True, exist_ok=True)

    mobile_html_path = REFERENCE_RAW_DIR / "home.mobile.html"
    desktop_html_path = REFERENCE_RAW_DIR / "home.desktop.html"
    if mobile_html_path.exists():
        mobile_html = mobile_html_path.read_text(encoding="utf-8", errors="ignore")
    else:
        mobile_html = fetch_live_html("https://www.lge.co.kr/m/home", mobile=True)
        mobile_html_path.write_text(mobile_html, encoding="utf-8")
    if desktop_html_path.exists():
        desktop_html = desktop_html_path.read_text(encoding="utf-8", errors="ignore")
    else:
        desktop_html = fetch_live_html("https://www.lge.co.kr/home", mobile=False)
        desktop_html_path.write_text(desktop_html, encoding="utf-8")

    snapshot = build_hybrid_home_reference_interactions(desktop_html, mobile_html)
    output_path = INTERACTION_OUTPUT_DIR / "reference.home.json"
    output_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"built 1 interaction snapshot file in {INTERACTION_OUTPUT_DIR}")


if __name__ == "__main__":
    main()
