#!/usr/bin/env python3
import json
import math
import re
from html import unescape
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_INDEX_PATH = ROOT / "data" / "raw" / "archive-index.json"
ARCHIVE_PAGES_DIR = ROOT / "data" / "raw" / "pages"
OUTPUT_DIR = ROOT / "data" / "normalized" / "slot-snapshots"
REFERENCE_RAW_DIR = ROOT / "data" / "raw" / "reference-live"
DESKTOP_UA = "Mozilla/5.0 (compatible; lge-site-analysis/1.0)"
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)


def slug_from_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    pathname = parsed.path.strip("/") or "root"
    base = re.sub(r"[^a-zA-Z0-9_-]+", "-", pathname)[:100]
    if not parsed.query:
        return base
    import hashlib

    digest = hashlib.sha1(parsed.query.encode()).hexdigest()[:8]
    return f"{base}-{digest}"


def archive_slug_from_url(raw_url: str) -> str:
    import hashlib

    digest = hashlib.sha1(raw_url.encode()).hexdigest()[:12]
    parsed = urlparse(raw_url)
    page_path = parsed.path.strip("/") or "root"
    normalized = page_path.replace("/", "__")[:80]
    return f"{normalized}__{digest}"


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def find_match(pattern: str, html: str, flags=0):
    return re.search(pattern, html, flags)


def find_group(pattern: str, html: str, group=1, default="", flags=0):
    match = find_match(pattern, html, flags)
    if not match:
        return default
    return match.group(group)


def parse_viewport_width(html: str):
    viewport = find_group(r'<meta name="viewport" content="([^"]+)"', html)
    width = find_group(r"width\s*=\s*(\d+)", viewport)
    return int(width) if width else None


def fetch_live_html(url: str, mobile: bool = False) -> str:
    ua = MOBILE_UA if mobile else DESKTOP_UA
    req = Request(url, headers={"User-Agent": ua})
    with urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def extract_header_top(html: str):
    top_html = find_group(r'<section class="CommonPcGnb_top__[^"]*">([\s\S]*?)</section>', html)
    logo_href = find_group(
        r'<h1 class="CommonPcGnb_logo__[^"]*">[\s\S]*?<a[^>]*href="([^"]+)"',
        top_html,
    )
    utility_items = []
    for match in re.finditer(r'<li class="CommonPcGnb_(search|mp|cart)__[^"]*">', top_html):
        utility_items.append({"kind": match.group(1)})

    utility_links = []
    company_href = find_group(
        r'<a[^>]*class="link_company"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>',
        top_html,
        group=1,
        flags=re.S,
    )
    company_label = clean_text(
        find_group(
            r'<a[^>]*class="link_company"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>',
            top_html,
            group=2,
            flags=re.S,
        )
    )
    if company_href and company_label:
        utility_links.append({"label": company_label, "href": company_href})

    business_href = find_group(
        r'<div class="business">[\s\S]*?<a href="([^"]+)">([\s\S]*?)</a>',
        top_html,
        group=1,
        flags=re.S,
    )
    business_label = clean_text(
        find_group(
            r'<div class="business">[\s\S]*?<a href="([^"]+)">([\s\S]*?)</a>',
            top_html,
            group=2,
            flags=re.S,
        )
    )
    if business_href and business_label:
        utility_links.append({"label": business_label, "href": business_href})

    return {
        "slotId": "header-top",
        "kind": "header",
        "structure": "two-tier-header",
        "containerMode": "full",
        "layout": {
            "tier": 1,
            "containerRule": "full-bleed",
            "rowCountDesktop": 1,
            "align": "baseline",
            "density": "compact",
        },
        "logoHref": logo_href,
        "utilityItems": utility_items,
        "utilityLinks": utility_links,
    }


def extract_header_bottom(html: str):
    bottom_match = find_match(r'<section class="CommonPcGnb_bottom__[^"]*"[\s\S]*?</section>', html)
    bottom_html = bottom_match.group(0) if bottom_match else ""

    main_menus = []
    for match in re.finditer(r'<a[^>]*class="CommonPcGnb_item__[^"]*"[^>]*>([\s\S]*?)</a>', bottom_html):
        label = clean_text(match.group(1))
        if label:
            main_menus.append(label)

    brand_tabs = []
    for match in re.finditer(r'<ul class="CommonPcGnb_brand_link__[^"]*">([\s\S]*?)</ul>', bottom_html, re.S):
        list_html = match.group(1)
        for link_match in re.finditer(r'<a[^>]*>([\s\S]*?)</a>', list_html, re.S):
            inner_html = link_match.group(1)
            label = clean_text(inner_html)
            if not label:
                label = clean_text(find_group(r'<img[^>]*alt="([^"]+)"', inner_html))
            if label:
                brand_tabs.append(label)

    return {
        "slotId": "header-bottom",
        "kind": "header",
        "containerMode": "full",
        "layout": {
            "tier": 2,
            "containerRule": "full-bleed",
            "rowCountDesktop": 1,
            "align": "center",
            "density": "compact",
            "containsBrandTabs": True,
            "containsHomeStyle": True,
        },
        "mainMenus": main_menus,
        "brandTabs": brand_tabs,
        "hasNavArrow": 'CommonPcGnb_btn_nav_arrow__' in bottom_html,
    }


def extract_hero(html: str):
    hero_match = find_match(r'<section class="HomePcBannerHero_banner_hero__[^"]*"[\s\S]*?</section>', html)
    hero_html = hero_match.group(0) if hero_match else ""
    if not hero_html:
        fallback_match = find_match(r'<section[^>]*data-area="메인 배너 영역"[\s\S]*?</section>', html)
        hero_html = fallback_match.group(0) if fallback_match else ""

    return {
        "slotId": "hero",
        "kind": "hero",
        "containerMode": "full",
        "layout": {
            "containerRule": "full-bleed",
            "rowCountDesktop": 1,
            "contentMode": "split-copy-visual",
            "horizontalPadding": 0,
        },
        "imageSrc": find_group(r'<img[^>]*src="([^"]+)"', hero_html),
        "headline": clean_text(
            find_group(
                r'<strong class="HomePcBannerHero_banner_hero_headline__[^"]*"[^>]*>([\s\S]*?)</strong>',
                hero_html,
                flags=re.S,
            )
        ),
        "description": clean_text(
            find_group(
                r'<p class="HomePcBannerHero_banner_hero_description__[^"]*"[^>]*>([\s\S]*?)</p>',
                hero_html,
                flags=re.S,
            )
        ),
        "badge": clean_text(
            find_group(
                r'<span[^>]*class="HomePcBannerHero_banner_hero_badge__[^"]*"[^>]*>([\s\S]*?)</span>',
                hero_html,
                flags=re.S,
            )
        ),
    }


def extract_desktop_hero_slides(html: str):
    hero_match = find_match(r'<section class="HomePcBannerHero_banner_hero__[^"]*"[\s\S]*?</section>', html)
    hero_html = hero_match.group(0) if hero_match else ""
    slides = []
    slide_pattern = re.compile(
        r'<div class="swiper-slide">[\s\S]*?<a class="HomePcBannerHero_banner_hero_item__[^"]*"[^>]*href="([^"]+)"[^>]*>'
        r'([\s\S]*?)</a></div>',
        re.S,
    )
    for match in slide_pattern.finditer(hero_html):
        anchor_html = match.group(2)
        slides.append(
            {
                "href": match.group(1),
                "badge": clean_text(find_group(r'<span class="HomePcBannerHero_banner_hero_badge__[^"]*"[^>]*>([\s\S]*?)</span>', anchor_html, flags=re.S)),
                "headline": clean_text(find_group(r'<strong class="HomePcBannerHero_banner_hero_headline__[^"]*"[^>]*>([\s\S]*?)</strong>', anchor_html, flags=re.S)),
                "description": clean_text(find_group(r'<p class="HomePcBannerHero_banner_hero_description__[^"]*"[^>]*>([\s\S]*?)</p>', anchor_html, flags=re.S)),
                "imageSrc": find_group(r'<img[^>]*src="([^"]+)"', anchor_html),
            }
        )
    return slides


def extract_quickmenu(html: str):
    quick_match = find_match(r'<section class="HomePcQuickmenu_quickmenu__[^"]*"[\s\S]*?</section>', html)
    quick_html = quick_match.group(0) if quick_match else ""

    items = []
    pattern = re.compile(
        r'<div class="swiper-slide">\s*<a href="([^"]+)"[^>]*>[\s\S]*?'
        r'<strong class="HomePcQuickmenu_quickmenu_title__[^"]*"[^>]*>([\s\S]*?)</strong>[\s\S]*?'
        r'<img[^>]*src="([^"]+)"',
        re.S,
    )
    for match in pattern.finditer(quick_html):
        items.append(
            {
                "href": match.group(1),
                "title": clean_text(match.group(2)),
                "imageSrc": match.group(3),
            }
        )

    columns = 5 if len(items) >= 10 else max(1, min(5, len(items)))
    rows = math.ceil(len(items) / columns) if columns else 0
    return {
        "slotId": "quickmenu",
        "kind": "quickmenu",
        "containerMode": "narrow",
        "layout": {
            "containerRule": "narrow-after-hero",
            "rowCountDesktop": rows,
            "columnCountDesktop": columns,
            "iconShape": "circle",
            "density": "compact",
        },
        "itemCount": len(items),
        "expectedColumnsDesktop": columns,
        "expectedRowsDesktop": rows,
        "items": items,
    }


def extract_mobile_header_top(html: str):
    header_html = find_group(r'<header class="CommonMoGnb_main__[^"]*">([\s\S]*?)</header>', html)
    logo_href = find_group(r'<h1 class="CommonMoGnb_logo__[^"]*">[\s\S]*?<a[^>]*href="([^"]+)"', header_html)
    utility_items = []
    if "CommonMoGnb_util_search__" in header_html:
        utility_items.append({"kind": "search"})
    if "CommonMoGnb_util_cart__" in header_html:
        utility_items.append({"kind": "cart"})
    if "CommonMoGnb_util_mp__" in header_html:
        utility_items.append({"kind": "mp"})

    return {
        "slotId": "header-top",
        "kind": "header",
        "structure": "mobile-header",
        "containerMode": "full",
        "layout": {
            "tier": 1,
            "containerRule": "full-bleed",
            "rowCountDesktop": 1,
            "align": "center",
            "density": "compact",
            "mobileOnly": True,
        },
        "logoHref": logo_href,
        "utilityItems": utility_items,
        "utilityLinks": [],
    }


def extract_mobile_header_bottom(_html: str):
    return {
        "slotId": "header-bottom",
        "kind": "header",
        "containerMode": "full",
        "layout": {
            "tier": 2,
            "containerRule": "none",
            "rowCountDesktop": 0,
            "align": "none",
            "density": "compact",
            "mobileMenuDrawer": True,
        },
        "mainMenus": [],
        "brandTabs": [],
        "hasNavArrow": False,
    }


def extract_mobile_hero(html: str):
    hero_match = find_match(r'<section class="HomeMoBannerHero_banner_hero__[^"]*"[\s\S]*?</section>', html)
    hero_html = hero_match.group(0) if hero_match else ""
    slides = []
    slide_pattern = re.compile(
        r'<div class="swiper-slide">[\s\S]*?<a class="HomeMoBannerHero_banner_hero_item__[^"]*"[^>]*href="([^"]+)"[^>]*>'
        r'([\s\S]*?)</a></div>',
        re.S,
    )
    for match in slide_pattern.finditer(hero_html):
        anchor_html = match.group(2)
        badge = clean_text(find_group(r'<span class="HomeMoBannerHero_banner_hero_badge__[^"]*"[^>]*>([\s\S]*?)</span>', anchor_html, flags=re.S))
        headline = clean_text(find_group(r'<strong class="HomeMoBannerHero_banner_hero_headline__[^"]*"[^>]*>([\s\S]*?)</strong>', anchor_html, flags=re.S))
        description = clean_text(find_group(r'<p class="HomeMoBannerHero_banner_hero_description__[^"]*"[^>]*>([\s\S]*?)</p>', anchor_html, flags=re.S))
        image_src = find_group(r'<img[^>]*src="([^"]+)"', anchor_html)
        slides.append(
            {
                "href": match.group(1),
                "badge": badge,
                "headline": headline,
                "description": description,
                "imageSrc": image_src,
            }
        )
    primary = next((slide for slide in slides if slide["headline"]), slides[0] if slides else {})
    return {
        "slotId": "hero",
        "kind": "hero",
        "containerMode": "full",
        "layout": {
            "containerRule": "full-bleed",
            "rowCountDesktop": 1,
            "contentMode": "mobile-stack",
            "horizontalPadding": 0,
            "slideCount": len(slides),
        },
        "imageSrc": primary.get("imageSrc", ""),
        "headline": primary.get("headline", ""),
        "description": primary.get("description", ""),
        "badge": primary.get("badge", ""),
        "slides": slides,
    }


def extract_mobile_quickmenu(html: str):
    quick_match = find_match(r'<section class="HomeMoQuickmenu_quickmenu__[^"]*"[\s\S]*?</section>', html)
    quick_html = quick_match.group(0) if quick_match else ""
    items = []
    pattern = re.compile(
        r'<li><a href="([^"]+)">([\s\S]*?)</a></li>',
        re.S,
    )
    for match in pattern.finditer(quick_html):
        anchor_html = match.group(2)
        items.append(
            {
                "href": match.group(1),
                "title": clean_text(find_group(r'<strong class="HomeMoQuickmenu_quickmenu_title__[^"]*"[^>]*>([\s\S]*?)</strong>', anchor_html, flags=re.S)),
                "imageSrc": find_group(r'<img[^>]*src="([^"]+)"', anchor_html),
            }
        )
    columns = 5 if len(items) >= 10 else max(1, min(5, len(items)))
    rows = math.ceil(len(items) / columns) if columns else 0
    return {
        "slotId": "quickmenu",
        "kind": "quickmenu",
        "containerMode": "narrow",
        "layout": {
            "containerRule": "narrow-after-hero",
            "rowCountDesktop": rows,
            "columnCountDesktop": columns,
            "iconShape": "circle",
            "density": "compact",
            "mobileOnly": True,
        },
        "itemCount": len(items),
        "expectedColumnsDesktop": columns,
        "expectedRowsDesktop": rows,
        "items": items,
    }


def extract_common_columns(block_html: str):
    columns = []
    column_pattern = re.compile(r'<div class="CommonPcGnb_column__[^"]*">([\s\S]*?)</div>', re.S)
    for column_match in column_pattern.finditer(block_html):
        column_html = column_match.group(1)
        items = []
        item_pattern = re.compile(
            r'<p class="CommonPcGnb_sub_cate_tit__[^"]*">\s*(?:<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>|([\s\S]*?))\s*</p>\s*(?:<ul class="CommonPcGnb_sub_cate_list__[^"]*">([\s\S]*?)</ul>)?',
            re.S,
        )
        for item_match in item_pattern.finditer(column_html):
            children = []
            child_html = item_match.group(4) or ""
            child_pattern = re.compile(r'<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', re.S)
            for child_match in child_pattern.finditer(child_html):
                children.append(
                    {
                        "href": child_match.group(1),
                        "label": clean_text(child_match.group(2)),
                    }
                )
            label = clean_text(item_match.group(2) or item_match.group(3))
            href = item_match.group(1) or "#"
            if not label:
                continue
            items.append(
                {
                    "href": href,
                    "label": label,
                    "children": children,
                }
            )
        if items:
            columns.append(items)
    return columns


def extract_gnb_menu_open(html: str, menu_id: str, state_id: str):
    start = html.find(f'class="CommonPcGnb_nav_cate__KkLVL" id="{menu_id}"')
    if start == -1:
        return None
    end = html.find('</section>', start)
    snippet = html[start:end] if end > start else html[start : start + 50000]

    tabs = []
    tab_pattern = re.compile(
        r'<div aria-controls="([^"]+)" class="CommonPcGnb_scroll_item__[^"]*">'
        r'<a[^>]*>([\s\S]*?)</a></div>',
        re.S,
    )
    for match in tab_pattern.finditer(snippet):
        tabs.append({"id": match.group(1), "label": clean_text(match.group(2))})

    panels = []
    panel_pattern = re.compile(
        r'<div class="CommonPcGnb_nav_cate_list__[^"]*" id="([^"]+)">([\s\S]*?)</div>\s*</div>',
        re.S,
    )
    for match in panel_pattern.finditer(snippet):
        panel_id = match.group(1)
        columns = extract_common_columns(match.group(2))
        if columns:
            panels.append({"id": panel_id, "columns": columns})

    if not tabs:
        columns = extract_common_columns(snippet)
        if columns:
            panels.append({"id": menu_id, "columns": columns})

    if not panels:
        return None

    return {
        "stateId": state_id,
        "kind": "gnb-open",
        "slotId": "header-bottom",
        "menuId": menu_id,
        "tabCount": len(tabs),
        "panelCount": len(panels),
        "tabs": tabs,
        "panels": panels,
    }


def build_reference_snapshot(page_id: str, url: str, html: str):
    gnb_states = [
        extract_gnb_menu_open(html, "제품/소모품", "gnb-product-open"),
        extract_gnb_menu_open(html, "가전 구독", "gnb-care-open"),
        extract_gnb_menu_open(html, "고객지원", "gnb-support-open"),
        extract_gnb_menu_open(html, "혜택/이벤트", "gnb-benefits-open"),
        extract_gnb_menu_open(html, "스토리", "gnb-story-open"),
        extract_gnb_menu_open(html, "베스트샵", "gnb-bestshop-open"),
        extract_gnb_menu_open(html, "LG AI", "gnb-lgai-open"),
    ]
    return {
        "pageId": page_id,
        "source": "reference",
        "url": url,
        "viewport": {
            "width": parse_viewport_width(html),
            "height": None,
        },
        "slots": [
            extract_header_top(html),
            extract_header_bottom(html),
            extract_hero(html),
            extract_quickmenu(html),
        ],
        "states": [state for state in gnb_states if state],
    }


def build_mobile_reference_snapshot(page_id: str, url: str, html: str):
    hero = extract_mobile_hero(html)
    slides = hero.get("slides", [])
    hero_states = []
    for index, slide in enumerate(slides, start=1):
        hero_states.append(
            {
                "stateId": f"hero-slide-{index}",
                "kind": "hero-slide",
                "slotId": "hero",
                "slideIndex": index,
                "headline": slide.get("headline", ""),
                "description": slide.get("description", ""),
                "href": slide.get("href", ""),
            }
        )
    return {
        "pageId": page_id,
        "source": "reference",
        "url": url,
        "viewport": {
            "width": 390,
            "height": None,
        },
        "slots": [
            extract_mobile_header_top(html),
            extract_mobile_header_bottom(html),
            hero,
            extract_mobile_quickmenu(html),
        ],
        "states": hero_states,
    }


def build_hybrid_home_reference_snapshot(desktop_url: str, desktop_html: str, mobile_url: str, mobile_html: str):
    hero = extract_hero(desktop_html)
    hero_slides = extract_desktop_hero_slides(desktop_html)
    if hero_slides:
        hero["slides"] = hero_slides
        hero["layout"]["slideCount"] = len(hero_slides)

    gnb_states = [
        extract_gnb_menu_open(desktop_html, "제품/소모품", "gnb-product-open"),
        extract_gnb_menu_open(desktop_html, "가전 구독", "gnb-care-open"),
        extract_gnb_menu_open(desktop_html, "고객지원", "gnb-support-open"),
        extract_gnb_menu_open(desktop_html, "혜택/이벤트", "gnb-benefits-open"),
        extract_gnb_menu_open(desktop_html, "스토리", "gnb-story-open"),
        extract_gnb_menu_open(desktop_html, "베스트샵", "gnb-bestshop-open"),
        extract_gnb_menu_open(desktop_html, "LG AI", "gnb-lgai-open"),
    ]
    hero_states = []
    for index, slide in enumerate(hero_slides, start=1):
        hero_states.append(
            {
                "stateId": f"hero-slide-{index}",
                "kind": "hero-slide",
                "slotId": "hero",
                "slideIndex": index,
                "headline": slide.get("headline", ""),
                "description": slide.get("description", ""),
                "href": slide.get("href", ""),
            }
        )

    return {
        "pageId": "home",
        "source": "reference",
        "mode": "hybrid",
        "url": mobile_url,
        "visualUrl": mobile_url,
        "structuralUrl": desktop_url,
        "viewport": {
            "width": 1460,
            "height": None,
        },
        "zones": [
            {
                "zoneId": "header-zone",
                "mode": "desktop-like",
                "sourceUrl": desktop_url,
                "slotIds": ["header-top", "header-bottom"],
            },
            {
                "zoneId": "hero-zone",
                "mode": "desktop-like",
                "sourceUrl": desktop_url,
                "slotIds": ["hero"],
            },
            {
                "zoneId": "content-zone",
                "mode": "mobile-like",
                "sourceUrl": mobile_url,
                "slotIds": ["quickmenu"],
            },
        ],
        "slots": [
            extract_header_top(desktop_html),
            extract_header_bottom(desktop_html),
            hero,
            extract_mobile_quickmenu(mobile_html),
        ],
        "states": [state for state in gnb_states if state] + hero_states,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REFERENCE_RAW_DIR.mkdir(parents=True, exist_ok=True)
    archive = json.loads(ARCHIVE_INDEX_PATH.read_text())
    count = 0
    built_home_mobile = False
    for row in archive:
        url = row.get("url")
        if not url:
            continue
        page_id = slug_from_url(url)
        if page_id == "home":
            archive_slug = archive_slug_from_url(url)
            desktop_path = ARCHIVE_PAGES_DIR / f"{archive_slug}.html"
            if desktop_path.exists():
                desktop_html = desktop_path.read_text(errors="ignore")
            else:
                desktop_html = fetch_live_html("https://www.lge.co.kr/home", mobile=False)
            (REFERENCE_RAW_DIR / "home.desktop.html").write_text(desktop_html, encoding="utf-8")
            mobile_url = "https://www.lge.co.kr/m/home"
            mobile_html = fetch_live_html(mobile_url, mobile=True)
            (REFERENCE_RAW_DIR / "home.mobile.html").write_text(mobile_html, encoding="utf-8")
            snapshot = build_hybrid_home_reference_snapshot(url, desktop_html, mobile_url, mobile_html)
            built_home_mobile = True
        else:
            archive_slug = archive_slug_from_url(url)
            html_path = ARCHIVE_PAGES_DIR / f"{archive_slug}.html"
            if not html_path.exists():
                continue
            html = html_path.read_text(errors="ignore")
            snapshot = build_reference_snapshot(page_id, url, html)
        output_path = OUTPUT_DIR / f"reference.{page_id}.json"
        output_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2))
        count += 1
    if not built_home_mobile:
        desktop_url = "https://www.lge.co.kr/home"
        desktop_html = fetch_live_html(desktop_url, mobile=False)
        (REFERENCE_RAW_DIR / "home.desktop.html").write_text(desktop_html, encoding="utf-8")
        mobile_url = "https://www.lge.co.kr/m/home"
        mobile_html = fetch_live_html(mobile_url, mobile=True)
        (REFERENCE_RAW_DIR / "home.mobile.html").write_text(mobile_html, encoding="utf-8")
        snapshot = build_hybrid_home_reference_snapshot(desktop_url, desktop_html, mobile_url, mobile_html)
        output_path = OUTPUT_DIR / "reference.home.json"
        output_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2))
        count += 1
    print(f"built {count} slot snapshot file(s) in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
