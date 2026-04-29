const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data", "normalized", "editable-prototype.json");
// TEST MODEL PROFILE (2026-04-29)
// 디버깅 중에는 flow 검증 비용을 낮추기 위해 저가 모델을 기본값으로 둔다.
// 구조 검증 완료 후 production/high-quality target은 anthropic/claude-sonnet-4.6 으로 복구한다.
const DEFAULT_OPENROUTER_TEXT_MODEL = "anthropic/claude-haiku-4.5";

const WORKSPACE_DEFAULT_PAGE_IDS = [
  "home",
  "support",
  "bestshop",
  "care-solutions",
  "care-solutions-pdp",
  "homestyle-home",
  "homestyle-pdp",
  "category-tvs",
  "category-refrigerators",
  "pdp-tv-general",
  "pdp-tv-premium",
  "pdp-refrigerator-general",
  "pdp-refrigerator-knockon",
  "pdp-refrigerator-glass",
];

const WORKSPACE_DEFAULT_PAGE_META = {
  home: {
    url: "https://www.lge.co.kr/home",
    title: "LGE.COM | LG전자",
    pageGroup: "home",
  },
  support: {
    url: "https://www.lge.co.kr/support",
    title: "고객지원 | LG전자",
    pageGroup: "support",
  },
  bestshop: {
    url: "https://www.lge.co.kr/bestshop",
    title: "베스트샵 | LG전자",
    pageGroup: "bestshop",
  },
  "care-solutions": {
    url: "https://www.lge.co.kr/care-solutions",
    title: "가전 구독 | LG전자",
    pageGroup: "care-solution",
  },
  "care-solutions-pdp": {
    url: "https://www.lge.co.kr/care-solutions/water-purifiers/wd523vc?dpType=careTab&subscCategoryKeyId=246021",
    title: "가전 구독 PDP - 정수기",
    pageGroup: "product-detail",
  },
  "homestyle-home": {
    url: "https://homestyle.lge.co.kr/home",
    title: "LG 홈스타일",
    pageGroup: "homestyle",
  },
  "homestyle-pdp": {
    url: "https://homestyle.lge.co.kr/item?productId=G26030036505",
    title: "LG 홈스타일 PDP",
    pageGroup: "product-detail",
  },
  "category-tvs": {
    url: "https://www.lge.co.kr/category/tvs",
    title: "TV | LG전자 | 공식몰 LGE.COM",
    pageGroup: "category",
  },
  "category-refrigerators": {
    url: "https://www.lge.co.kr/category/refrigerators",
    title: "냉장고 | LG전자 | 공식몰 LGE.COM",
    pageGroup: "category",
  },
  "pdp-tv-general": {
    url: "https://www.lge.co.kr/tvs/32lq635bkna-stand",
    title: "PDP - TV 일반형",
    pageGroup: "product-detail",
  },
  "pdp-tv-premium": {
    url: "https://www.lge.co.kr/tvs/oled97g5kna-stand",
    title: "PDP - TV 프리미엄형",
    pageGroup: "product-detail",
  },
  "pdp-refrigerator-general": {
    url: "https://www.lge.co.kr/refrigerators/t873mee111",
    title: "PDP - 냉장고 일반형",
    pageGroup: "product-detail",
  },
  "pdp-refrigerator-knockon": {
    url: "https://www.lge.co.kr/refrigerators/t875mee412",
    title: "PDP - 냉장고 노크온형",
    pageGroup: "product-detail",
  },
  "pdp-refrigerator-glass": {
    url: "https://www.lge.co.kr/refrigerators/h875gbb111",
    title: "PDP - 냉장고 글라스형",
    pageGroup: "product-detail",
  },
};

const DEFAULT_SECTION_NAME_MAP = {
  "header-top": "상단 헤더",
  "header-bottom": "주 메뉴",
  hero: "메인 비주얼",
  quickmenu: "퀵메뉴",
  timedeal: "타임딜",
  "md-choice": "MD 추천",
  "best-ranking": "베스트 랭킹",
  "space-renewal": "공간 리뉴얼",
  subscription: "가전 구독",
  "brand-showroom": "브랜드 쇼룸",
  "latest-product-news": "신제품 소식",
  "smart-life": "스마트 라이프",
  "summary-banner-2": "하단 배너",
  "missed-benefits": "혜택 모음",
  "lg-best-care": "LG 베스트 케어",
  "bestshop-guide": "베스트샵 안내",
  mainService: "주요 서비스",
  notice: "공지",
  tipsBanner: "팁 배너",
  bestcare: "베스트케어",
  shortcut: "바로가기",
  review: "리뷰",
  brandBanner: "브랜드 배너",
  ranking: "랭킹",
  benefit: "혜택",
  tabs: "탭",
  careBanner: "구독 배너",
  visual: "상품 비주얼",
  detailInfo: "상세 정보",
  noticeBanner: "공지 배너",
  reviewInfo: "리뷰 정보",
  quickMenu: "퀵 메뉴",
  labelBanner: "라벨 배너",
  brandStory: "브랜드 스토리",
  bestProduct: "추천 상품",
  guides: "가이드",
  seller: "판매 정보",
  banner: "상단 배너",
  filter: "필터",
  sort: "정렬",
  productGrid: "상품 그리드",
  firstRow: "첫 번째 상품열",
  firstProduct: "대표 상품",
  gallery: "상품 갤러리",
  summary: "상품 요약",
  price: "가격 정보",
  option: "옵션",
  sticky: "고정 구매 영역",
  review: "리뷰",
  qna: "문의",
};

function readRawPageMetaMap() {
  const rawPagesDir = path.join(ROOT, "data", "raw", "pages");
  const metaByPageId = {};
  try {
    const fileNames = fs.readdirSync(rawPagesDir).filter((fileName) => fileName.endsWith(".json"));
    for (const fileName of fileNames) {
      try {
        const item = JSON.parse(fs.readFileSync(path.join(rawPagesDir, fileName), "utf-8"));
        const pageId = rawPageIdFromUrl(item?.url || "");
        if (!pageId || metaByPageId[pageId]) continue;
        metaByPageId[pageId] = {
          url: item.url,
          title: item.title,
          pageGroup: item.pageGroup,
        };
      } catch {
        // ignore malformed raw page records
      }
    }
  } catch {
    // raw page capture is optional in some environments
  }
  return metaByPageId;
}

function rawPageIdFromUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const hostname = String(parsed.hostname || "").toLowerCase();
    const pathname = String(parsed.pathname || "").replace(/\/+$/g, "") || "/";
    const productId = String(parsed.searchParams.get("productId") || "").trim();
    if (hostname === "www.lge.co.kr") {
      if (pathname === "/home") return "home";
      if (pathname === "/support") return "support";
      if (pathname === "/bestshop") return "bestshop";
      if (pathname === "/care-solutions") return "care-solutions";
      if (pathname === "/care-solutions/water-purifiers/wd523vc") return "care-solutions-pdp";
      if (pathname === "/category/tvs") return "category-tvs";
      if (pathname === "/category/refrigerators") return "category-refrigerators";
    }
    if (hostname === "homestyle.lge.co.kr") {
      if (pathname === "/home" || pathname === "/") return "homestyle-home";
      if (pathname === "/item" && productId === "G26030036505") return "homestyle-pdp";
    }
  } catch {
    return "";
  }
  return "";
}

function defaultSectionName(slotId) {
  return DEFAULT_SECTION_NAME_MAP[String(slotId || "").trim()] || String(slotId || "").trim() || "섹션";
}

function buildDefaultSourceSet(prefix) {
  return [
    { sourceId: `captured-${prefix}`, sourceType: "captured", renderer: "iframe", status: "active" },
    { sourceId: `custom-${prefix}-v1`, sourceType: "custom", renderer: "component", status: "draft" },
    { sourceId: `figma-${prefix}-v1`, sourceType: "figma-derived", renderer: "component", status: "draft" },
  ];
}

function buildDefaultSlotEntry(pageId, slotId, componentType) {
  const prefix = `${pageId}-${slotId}`;
  return {
    slotId,
    componentType,
    activeSourceId: `captured-${prefix}`,
    sources: buildDefaultSourceSet(prefix),
  };
}

function buildDefaultHomeSlotRegistry() {
  return {
    pageId: "home",
    slots: [
      {
        slotId: "header-top",
        componentType: "header-top",
        activeSourceId: "captured-home-header-top",
        sources: [
          { sourceId: "captured-home-header-top", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-header-top-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-header-top-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "header-bottom",
        componentType: "header-bottom",
        activeSourceId: "captured-home-header-bottom",
        sources: [
          { sourceId: "captured-home-header-bottom", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-header-bottom-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-header-bottom-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "hero",
        componentType: "hero",
        activeSourceId: "captured-home-hero",
        sources: [
          { sourceId: "captured-home-hero", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-hero-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-hero-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "quickmenu",
        componentType: "quickmenu",
        activeSourceId: "captured-home-quickmenu",
        sources: [
          { sourceId: "captured-home-quickmenu", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-quickmenu-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-quickmenu-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "timedeal",
        componentType: "product-section",
        activeSourceId: "captured-home-timedeal",
        sources: [
          { sourceId: "captured-home-timedeal", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-timedeal-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-timedeal-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "md-choice",
        componentType: "product-section",
        activeSourceId: "captured-home-md-choice",
        sources: [
          { sourceId: "captured-home-md-choice", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-md-choice-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-md-choice-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "best-ranking",
        componentType: "product-section",
        activeSourceId: "custom-renderer",
        sources: [
          { sourceId: "custom-renderer", sourceType: "custom", renderer: "component", status: "active" },
          { sourceId: "figma-home-best-ranking-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "marketing-area",
        componentType: "home-lower",
        activeSourceId: "custom-renderer",
        sources: [
          { sourceId: "custom-renderer", sourceType: "custom", renderer: "component", status: "active" },
          { sourceId: "custom-live-current", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-marketing-area-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "space-renewal",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-space-renewal-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-space-renewal-v1", sourceType: "figma-derived", renderer: "component", status: "draft" },
          { sourceId: "hybrid-home-space-renewal-v1", sourceType: "custom", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "subscription",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-subscription-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-subscription-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "brand-showroom",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-brand-showroom-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-brand-showroom-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "latest-product-news",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-latest-product-news-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-latest-product-news-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "smart-life",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-smart-life-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-smart-life-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "summary-banner-2",
        componentType: "banner",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-summary-banner-2-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-summary-banner-2-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "missed-benefits",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-missed-benefits-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-missed-benefits-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "lg-best-care",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-lg-best-care-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-lg-best-care-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "bestshop-guide",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-bestshop-guide-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-bestshop-guide-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      }
    ]
  };
}

function buildDefaultServiceSlotRegistry(pageId) {
  const slotIdsByPage = {
    support: [
      ["mainService", "navigation"],
      ["notice", "content"],
      ["tipsBanner", "banner"],
      ["bestcare", "section"],
    ],
    bestshop: [
      ["hero", "hero"],
      ["shortcut", "navigation"],
      ["review", "content"],
      ["brandBanner", "banner"],
    ],
    "care-solutions": [
      ["hero", "hero"],
      ["ranking", "section"],
      ["benefit", "section"],
      ["tabs", "controls"],
      ["careBanner", "banner"],
    ],
    "care-solutions-pdp": [
      ["visual", "gallery"],
      ["detailInfo", "content"],
      ["noticeBanner", "banner"],
      ["reviewInfo", "content"],
    ],
    "homestyle-home": [
      ["quickMenu", "navigation"],
      ["labelBanner", "banner"],
      ["brandStory", "section"],
    ],
    "homestyle-pdp": [
      ["detailInfo", "content"],
      ["bestProduct", "product-list"],
      ["review", "content"],
      ["qna", "content"],
      ["guides", "content"],
      ["seller", "content"],
    ],
  };
  const slots = (slotIdsByPage[pageId] || []).map(([slotId, componentType]) =>
    buildDefaultSlotEntry(pageId, slotId, componentType)
  );
  return { pageId, slots };
}

function buildDefaultCategorySlotRegistry(pageId) {
  const slots = [
    ["banner", "banner"],
    ["filter", "controls"],
    ["sort", "controls"],
    ["productGrid", "product-list"],
    ["firstRow", "product-list"],
    ["firstProduct", "product-card"],
    ["gallery", "gallery"],
    ["summary", "content"],
    ["price", "content"],
    ["option", "controls"],
    ["sticky", "controls"],
    ["review", "content"],
    ["qna", "content"],
  ].map(([slotId, componentType]) => buildDefaultSlotEntry(pageId, slotId, componentType));
  return { pageId, slots };
}

function isPdpCasePageId(pageId) {
  return String(pageId || "").trim().startsWith("pdp-");
}

function buildDefaultPdpSlotRegistry(pageId) {
  const slots = [
    ["gallery", "gallery"],
    ["summary", "content"],
    ["price", "content"],
    ["option", "controls"],
    ["sticky", "controls"],
    ["review", "content"],
    ["qna", "content"],
  ].map(([slotId, componentType]) => buildDefaultSlotEntry(pageId, slotId, componentType));
  return { pageId, slots };
}

function buildDefaultSlotRegistry(pageId) {
  if (pageId === "home") return buildDefaultHomeSlotRegistry();
  if (["support", "bestshop", "care-solutions", "care-solutions-pdp", "homestyle-home", "homestyle-pdp"].includes(pageId)) {
    return buildDefaultServiceSlotRegistry(pageId);
  }
  if (isPdpCasePageId(pageId)) {
    return buildDefaultPdpSlotRegistry(pageId);
  }
  if (String(pageId || "").startsWith("category-")) {
    return buildDefaultCategorySlotRegistry(pageId);
  }
  return null;
}

function buildDefaultPageEntry(pageId, rawPageMetaMap = {}) {
  const fallbackMeta = WORKSPACE_DEFAULT_PAGE_META[pageId] || {
    url: `/clone/${pageId}`,
    title: pageId,
    pageGroup: "other",
  };
  const rawMeta = rawPageMetaMap[pageId] || {};
  const pageMeta = {
    ...fallbackMeta,
    ...Object.fromEntries(
      Object.entries(rawMeta).filter(([, value]) => typeof value === "string" && value.trim())
    ),
  };
  const slotRegistry = buildDefaultSlotRegistry(pageId);
  const sections = pageId === "home"
    ? [
        { name: "Header", componentType: "global-header" },
        { name: "Hero Banner", componentType: "hero-banner" },
        { name: "Promotion Carousel", componentType: "promo-carousel" },
        { name: "Featured Products", componentType: "product-card-grid" },
        { name: "CTA Banner", componentType: "cta-banner" },
        { name: "Footer", componentType: "global-footer" },
      ]
    : (slotRegistry?.slots || []).map((slot) => ({
        name: defaultSectionName(slot.slotId),
        componentType: slot.componentType || "section",
        slotId: slot.slotId,
      }));

  return {
    id: pageId,
    title: pageMeta.title || pageId,
    pageGroup: pageMeta.pageGroup || "other",
    url: pageMeta.url || `/clone/${pageId}`,
    sections: sections.map((section, index) => ({
      id: `${pageId}-section-${index + 1}`,
      name: section.name,
      componentType: section.componentType,
      visible: true,
      order: index + 1,
      props: {
        pageTitle: pageMeta.title || pageId,
        sourceUrl: pageMeta.url || `/clone/${pageId}`,
        ...(section.slotId ? { slotId: section.slotId } : {}),
      },
    })),
  };
}

function normalizeSlotRegistry(existingRegistry, defaultRegistry) {
  const current = existingRegistry || {};
  const currentSlots = Array.isArray(current.slots) ? current.slots : [];
  return {
    pageId: defaultRegistry.pageId,
    slots: defaultRegistry.slots.map((defaultSlot) => {
      const existing = currentSlots.find((slot) => slot.slotId === defaultSlot.slotId) || {};
      const sources = Array.isArray(existing.sources) && existing.sources.length ? existing.sources : defaultSlot.sources;
      const capturedSource = sources.find((source) => source.sourceType === "captured") || defaultSlot.sources[0];
      const requestedActiveSourceId =
        typeof existing.activeSourceId === "string" && sources.some((source) => source.sourceId === existing.activeSourceId)
          ? existing.activeSourceId
          : capturedSource.sourceId;
      return {
        ...defaultSlot,
        ...existing,
        activeSourceId: requestedActiveSourceId,
        sources: sources.map((source) => ({
          ...source,
          status:
            source.sourceId === requestedActiveSourceId
              ? "active"
              : source.sourceType === "captured"
                ? "validated"
                : "draft",
        })),
      };
    }),
  };
}

function normalizeEditableData(data) {
  const next = JSON.parse(JSON.stringify(data || {}));
  next.pages = Array.isArray(next.pages) ? next.pages : [];
  next.slotRegistries = Array.isArray(next.slotRegistries) ? next.slotRegistries : [];
  next.componentPatches = Array.isArray(next.componentPatches) ? next.componentPatches : [];
  next.acceptanceResults = Array.isArray(next.acceptanceResults) ? next.acceptanceResults : [];
  const rawPageMetaMap = readRawPageMetaMap();
  const existingPageIds = new Set(
    next.pages.map((page) => String(page?.id || "").trim()).filter(Boolean)
  );
  for (const pageId of WORKSPACE_DEFAULT_PAGE_IDS) {
    if (existingPageIds.has(pageId)) continue;
    next.pages.push(buildDefaultPageEntry(pageId, rawPageMetaMap));
  }
  for (const pageId of WORKSPACE_DEFAULT_PAGE_IDS) {
    const defaultRegistry = buildDefaultSlotRegistry(pageId);
    if (!defaultRegistry) continue;
    const registryIndex = next.slotRegistries.findIndex((item) => item.pageId === pageId);
    if (registryIndex < 0) {
      next.slotRegistries.push(defaultRegistry);
      continue;
    }
    next.slotRegistries[registryIndex] = normalizeSlotRegistry(next.slotRegistries[registryIndex], defaultRegistry);
  }
  return next;
}

function readEditableData() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return normalizeEditableData(JSON.parse(raw));
}

function writeEditableData(data) {
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(normalizeEditableData(data), null, 2)}\n`, "utf-8");
}

function findSlotRegistry(data, pageId) {
  const current = (data.slotRegistries || []).find((item) => item.pageId === pageId) || null;
  const fallback = buildDefaultSlotRegistry(pageId);
  if (!fallback) return current;
  const currentSlots = Array.isArray(current?.slots) ? current.slots : [];
  const currentMap = new Map(currentSlots.map((slot) => [String(slot?.slotId || "").trim(), slot]).filter(([slotId]) => Boolean(slotId)));
  const fallbackSlots = Array.isArray(fallback?.slots) ? fallback.slots : [];
  const mergedSlots = fallbackSlots.map((slot) => ({
    ...slot,
    ...(currentMap.get(String(slot?.slotId || "").trim()) || {}),
  }));
  currentSlots.forEach((slot) => {
    const slotId = String(slot?.slotId || "").trim();
    if (!slotId || mergedSlots.some((item) => String(item?.slotId || "").trim() === slotId)) return;
    mergedSlots.push(slot);
  });
  return {
    ...(fallback || {}),
    ...(current || {}),
    pageId,
    slots: mergedSlots,
  };
}

function findSlotConfig(data, pageId, slotId) {
  const registry = findSlotRegistry(data, pageId);
  return (registry?.slots || []).find((slot) => slot.slotId === slotId) || null;
}

function normalizeViewportProfile(value, fallback = "pc") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (normalized === "pc" || normalized === "mo" || normalized === "ta") return normalized;
  return fallback;
}

function normalizeHomeViewportProfile(value, fallback = "pc") {
  return normalizeViewportProfile(value, fallback);
}

function listComponentPatches(data, pageId = "", viewportProfile = "") {
  const patches = Array.isArray(data?.componentPatches) ? data.componentPatches : [];
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return patches;
  const normalizedViewportProfile = normalizedPageId === "home" && viewportProfile
    ? normalizeHomeViewportProfile(viewportProfile, "pc")
    : "";
  return patches.filter((entry) => {
    if (String(entry.pageId || "").trim() !== normalizedPageId) return false;
    if (normalizedPageId !== "home" || !normalizedViewportProfile) return true;
    return normalizeHomeViewportProfile(entry.viewportProfile, "pc") === normalizedViewportProfile;
  });
}

function findComponentPatch(data, pageId, componentId, sourceId = "", viewportProfile = "") {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  const patches = listComponentPatches(data, normalizedPageId, viewportProfile);
  if (!normalizedComponentId) return null;
  const exact =
    patches.find(
      (entry) =>
        String(entry.componentId || "").trim() === normalizedComponentId &&
        String(entry.sourceId || "").trim() === normalizedSourceId
    ) || null;
  if (exact) return exact;
  return (
    patches.find(
      (entry) =>
        String(entry.componentId || "").trim() === normalizedComponentId &&
        !String(entry.sourceId || "").trim()
    ) || null
  );
}

function upsertComponentPatch(data, pageId, componentId, sourceId, patch, viewportProfile = "") {
  const nextData = JSON.parse(JSON.stringify(data || {}));
  nextData.componentPatches = Array.isArray(nextData.componentPatches) ? nextData.componentPatches : [];
  const normalizedPageId = String(pageId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  const normalizedViewportProfile = normalizedPageId === "home"
    ? normalizeHomeViewportProfile(viewportProfile, "pc")
    : "";
  const nextPatch = patch && typeof patch === "object" ? JSON.parse(JSON.stringify(patch)) : {};
  const existingIndex = nextData.componentPatches.findIndex(
    (entry) =>
      String(entry.pageId || "").trim() === normalizedPageId &&
      String(entry.componentId || "").trim() === normalizedComponentId &&
      String(entry.sourceId || "").trim() === normalizedSourceId &&
      (
        normalizedPageId !== "home" ||
        normalizeHomeViewportProfile(entry.viewportProfile, "pc") === normalizedViewportProfile
      )
  );
  const record = {
    pageId: normalizedPageId,
    componentId: normalizedComponentId,
    sourceId: normalizedSourceId,
    ...(normalizedPageId === "home" ? { viewportProfile: normalizedViewportProfile } : {}),
    patch: nextPatch,
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) nextData.componentPatches[existingIndex] = record;
  else nextData.componentPatches.push(record);
  return nextData;
}

function mergeComponentPatch(currentPatch, partialPatch) {
  const base = currentPatch && typeof currentPatch === "object" ? currentPatch : {};
  const next = { ...base };
  for (const [key, value] of Object.entries(partialPatch || {})) {
    if (key === "styles" && value && typeof value === "object") {
      next.styles = { ...(base.styles || {}), ...value };
      continue;
    }
    next[key] = value;
  }
  return next;
}

function resolveComponentId(pageId, slotId) {
  return `${String(pageId || "").trim()}.${String(slotId || "").trim()}`;
}

function clampNumber(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(min, Math.min(max, num));
}

function clampCssPx(value, min, max) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const clamped = clampNumber(raw, min, max);
    return clamped == null ? "" : `${clamped}px`;
  }
  const match = raw.match(/^(-?\d+(?:\.\d+)?)px$/i);
  if (!match) return raw;
  const clamped = clampNumber(match[1], min, max);
  return clamped == null ? "" : `${clamped}px`;
}

function clampPaddingValue(value, min, max, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length || parts.some((part) => !/^-?\d+(?:\.\d+)?(?:px)?$/i.test(part))) {
    return raw;
  }
  return parts.map((part) => clampCssPx(part, min, max)).filter(Boolean).join(" ");
}

function isDarkBackgroundValue(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("#000") || normalized.includes("#111") || normalized.includes("#1f2937") || normalized.includes("#0f172a")) {
    return true;
  }
  return /linear-gradient\([^)]*(#000|#111|#1f2937|#0f172a)/i.test(normalized);
}

function buildHomePatchRule(slotId = "") {
  const normalized = String(slotId || "").trim();
  const base = {
    allowDarkBackground: normalized === "hero",
    defaultBackground: "#ffffff",
    padding: "40px 32px",
    titleSize: { min: 28, max: 34 },
    subtitleSize: { min: 14, max: 18 },
    minHeight: { min: 220, max: 420 },
    radius: "24px",
  };
  if (normalized === "hero") {
    return {
      ...base,
      allowDarkBackground: true,
      defaultBackground: "linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%)",
      padding: "56px 40px",
      titleSize: { min: 44, max: 56 },
      subtitleSize: { min: 18, max: 24 },
      minHeight: { min: 480, max: 640 },
      radius: "0px",
    };
  }
  if (normalized === "quickmenu") {
    return {
      ...base,
      defaultBackground: "#ffffff",
      padding: "24px 24px 16px",
      titleSize: { min: 24, max: 30 },
      subtitleSize: { min: 14, max: 16 },
      minHeight: { min: 120, max: 220 },
    };
  }
  if (normalized === "summary-banner-2") {
    return {
      ...base,
      defaultBackground: "linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%)",
      padding: "40px 32px",
      titleSize: { min: 30, max: 36 },
      subtitleSize: { min: 14, max: 18 },
      minHeight: { min: 220, max: 320 },
      radius: "28px",
    };
  }
  if (["subscription", "missed-benefits", "lg-best-care", "bestshop-guide"].includes(normalized)) {
    return {
      ...base,
      defaultBackground: "#f8fafc",
      minHeight: { min: 220, max: 360 },
    };
  }
  return base;
}

function normalizeHomeBuilderPatch(slotId = "", patch = {}) {
  const normalized = String(slotId || "").trim();
  const next = patch && typeof patch === "object" ? JSON.parse(JSON.stringify(patch)) : {};
  const styles = next.styles && typeof next.styles === "object" ? { ...next.styles } : {};
  const rule = buildHomePatchRule(normalized);
  if (styles.titleSize !== undefined) {
    styles.titleSize = clampCssPx(styles.titleSize, rule.titleSize.min, rule.titleSize.max) || undefined;
    if (styles.titleSize === undefined) delete styles.titleSize;
  }
  if (styles.subtitleSize !== undefined) {
    styles.subtitleSize = clampCssPx(styles.subtitleSize, rule.subtitleSize.min, rule.subtitleSize.max) || undefined;
    if (styles.subtitleSize === undefined) delete styles.subtitleSize;
  }
  if (styles.minHeight !== undefined) {
    styles.minHeight = clampCssPx(styles.minHeight, rule.minHeight.min, rule.minHeight.max) || undefined;
    if (styles.minHeight === undefined) delete styles.minHeight;
  }
  if (styles.height !== undefined) {
    styles.height = clampCssPx(styles.height, rule.minHeight.min, rule.minHeight.max) || undefined;
    if (styles.height === undefined) delete styles.height;
  }
  if (styles.padding !== undefined) {
    styles.padding = clampPaddingValue(styles.padding, 16, 64, rule.padding) || rule.padding;
  }
  if (styles.radius !== undefined) {
    styles.radius = clampCssPx(styles.radius, 0, 32) || rule.radius;
  }
  if (styles.background !== undefined) {
    const normalizedBackground = String(styles.background || "").trim();
    if (!normalizedBackground || (!rule.allowDarkBackground && isDarkBackgroundValue(normalizedBackground))) {
      styles.background = rule.defaultBackground;
    }
  }
  if (!styles.background && normalized !== "header-top" && normalized !== "header-bottom") {
    styles.background = rule.defaultBackground;
  }
  if (!styles.padding && normalized !== "header-top" && normalized !== "header-bottom") {
    styles.padding = rule.padding;
  }
  if (!styles.radius && normalized !== "hero" && normalized !== "header-top" && normalized !== "header-bottom") {
    styles.radius = rule.radius;
  }
  next.styles = styles;
  return next;
}

function inferPatchGovernance(slotId = "", pageId = "") {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedSlotId = String(slotId || "").trim();
  if (normalizedSlotId === "quickmenu") {
    return {
      resizePolicy: "uniform-items-only",
      widthPolicy: "container-only",
      forbiddenMoves: ["single-item-width-change", "single-item-height-change", "break-parent-grid"],
    };
  }
  if (["productGrid", "firstRow", "firstProduct"].includes(normalizedSlotId)) {
    return {
      resizePolicy: "uniform-items-only",
      widthPolicy: "container-only",
      forbiddenMoves: ["single-card-width-change", "single-card-height-change", "break-parent-grid"],
    };
  }
  if (normalizedSlotId === "gallery") {
    return {
      resizePolicy: "group-only",
      widthPolicy: "follow-parent-column",
      forbiddenMoves: ["independent-main-media-width-change", "break-thumbnail-rail"],
    };
  }
  if (["summary", "price", "option", "sticky"].includes(normalizedSlotId)) {
    return {
      resizePolicy: "container-only",
      widthPolicy: "follow-parent-column",
      forbiddenMoves: ["break-parent-column", "independent-width-expansion", "single-control-protrusion"],
    };
  }
  if (normalizedPageId === "home") {
    return {
      resizePolicy: "container-only",
      widthPolicy: "follow-layout-token",
      forbiddenMoves: ["independent-child-width-expansion", "break-section-shell"],
    };
  }
  return {
    resizePolicy: "container-only",
    widthPolicy: "follow-parent-container",
    forbiddenMoves: ["absolute-overlay-replacement", "independent-width-expansion"],
  };
}

function sanitizeGovernedPatch(slotId = "", pageId = "", patch = {}) {
  const source = patch && typeof patch === "object" ? JSON.parse(JSON.stringify(patch)) : {};
  const governance = inferPatchGovernance(slotId, pageId);
  const forbiddenMoves = new Set(governance.forbiddenMoves || []);
  const next = {};
  const violations = [];
  const blockedStyleKeys = new Set();
  if (
    ["follow-parent-column", "follow-parent-container", "follow-layout-token", "container-only"].includes(governance.widthPolicy) ||
    ["container-only", "group-only", "uniform-items-only"].includes(governance.resizePolicy)
  ) {
    ["width", "minWidth", "maxWidth"].forEach((key) => blockedStyleKeys.add(key));
  }
  if (forbiddenMoves.has("absolute-overlay-replacement")) {
    ["position", "top", "right", "bottom", "left", "zIndex", "transform"].forEach((key) => blockedStyleKeys.add(key));
  }
  ["itemWidth", "itemHeight", "cardWidth", "cardHeight", "thumbWidth", "thumbHeight", "controlWidth", "controlHeight"].forEach((key) =>
    blockedStyleKeys.add(key)
  );
  for (const [key, value] of Object.entries(source)) {
    if (key === "styles" && value && typeof value === "object") {
      const nextStyles = {};
      for (const [styleKey, styleValue] of Object.entries(value)) {
        if (blockedStyleKeys.has(styleKey)) {
          violations.push({ type: "style_blocked", key: styleKey, slotId: String(slotId || "").trim(), reason: governance.widthPolicy || governance.resizePolicy });
          continue;
        }
        nextStyles[styleKey] = styleValue;
      }
      if (Object.keys(nextStyles).length) next.styles = nextStyles;
      continue;
    }
    const childScoped = /(items?|cards?|thumbs?|thumbnails|controls?|options?|selectedState|selectedItem|activeIndex)/i.test(key);
    if (
      childScoped &&
      ["container-only", "group-only", "uniform-items-only"].includes(governance.resizePolicy) &&
      (Array.isArray(value) || (value && typeof value === "object"))
    ) {
      violations.push({ type: "child_scope_blocked", key, slotId: String(slotId || "").trim(), reason: governance.resizePolicy });
      continue;
    }
    next[key] = value;
  }
  return { patch: next, violations, governance };
}

function setSlotComponentPatch(data, pageId, slotId, sourceId, partialPatch, viewportProfile = "") {
  const componentId = resolveComponentId(pageId, slotId);
  const existing = findComponentPatch(data, pageId, componentId, sourceId, viewportProfile)?.patch || {};
  const normalizedPartial =
    String(pageId || "").trim() === "home"
      ? normalizeHomeBuilderPatch(slotId, partialPatch)
      : partialPatch;
  const governed = sanitizeGovernedPatch(slotId, pageId, normalizedPartial);
  const merged = mergeComponentPatch(existing, governed.patch);
  return upsertComponentPatch(data, pageId, componentId, sourceId, merged, viewportProfile);
}

function buildLlmSlotContext(data) {
  return (data.slotRegistries || []).map((registry) => ({
    pageId: registry.pageId,
    slots: (registry.slots || []).map((slot) => ({
      slotId: slot.slotId,
      componentType: slot.componentType,
      activeSourceId: slot.activeSourceId,
      sources: (slot.sources || []).map((source) => ({
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        status: source.status,
      })),
      componentId: resolveComponentId(registry.pageId, slot.slotId),
      currentPatch:
        findComponentPatch(data, registry.pageId, resolveComponentId(registry.pageId, slot.slotId), slot.activeSourceId)?.patch || null,
    })),
  }));
}

function buildSystemPrompt() {
  return [
    "You are an assistant that edits a page prototype JSON.",
    "Return valid JSON only.",
    "You must output an object with keys: summary, operations.",
    "operations must be an array of structured edits.",
    "Allowed actions: rename_section, toggle_section, reorder_section, update_page_title, update_slot_text, update_slot_image, update_hero_field, toggle_slot_source.",
    "Use slot operations when the request is about hero/banner copy, section copy, or switching captured/custom/figma sources.",
    "Use update_hero_field for the home hero badge/headline/description/ctaHref/imageSrc/imageAlt.",
    "Use update_slot_text for generic slot title/subtitle text edits.",
    "Use toggle_slot_source only with a sourceId that exists in the provided slot registry.",
    "Do not invent page ids or section ids that do not exist.",
    "Keep changes minimal and targeted to the request.",
  ].join(" ");
}

function buildUserPrompt(requestText, data) {
  const compact = {
    siteId: data.siteId,
    pages: (data.pages || []).map((page) => ({
      id: page.id,
      title: page.title,
      pageGroup: page.pageGroup,
      sections: (page.sections || []).map((section) => ({
        id: section.id,
        name: section.name,
        componentType: section.componentType,
        visible: section.visible,
        order: section.order,
      })),
    })),
    slotRegistries: buildLlmSlotContext(data),
  };

  return JSON.stringify(
    {
      task: "Apply a natural language change request to the prototype document.",
      request: requestText,
      document: compact,
      expectedSchema: {
        summary: "short summary string",
        operations: [
          {
            action:
              "rename_section | toggle_section | reorder_section | update_page_title | update_slot_text | update_slot_image | update_hero_field | toggle_slot_source",
            pageId: "string",
            sectionId: "string when needed",
            slotId: "string when needed",
            value: "new value when needed",
            field: "title | subtitle | badge | headline | description | ctaHref | imageSrc | imageAlt when needed",
            visible: "boolean when action is toggle_section",
            order: "number when action is reorder_section",
            sourceId: "string when action is toggle_slot_source",
            imageSrc: "string when action is update_slot_image",
            imageAlt: "string when action is update_slot_image",
          },
        ],
      },
    },
    null,
    2,
  );
}

function isDemoLlmEnabled() {
  return process.env.DEMO_MODE === "1" || process.env.LLM_DEMO_BYPASS === "1" || process.env.LLM_DEMO_FALLBACK === "1";
}

function normalizeCompareText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/["'`]/g, "");
}

function inferTargetPage(data, requestText) {
  const text = normalizeCompareText(requestText);
  const pages = Array.isArray(data.pages) ? data.pages : [];
  for (const page of pages) {
    const candidates = [page.id, page.title, page.pageGroup].map(normalizeCompareText).filter(Boolean);
    if (candidates.some((candidate) => candidate && text.includes(candidate))) {
      return page;
    }
  }
  const registryPageIds = Array.isArray(data.slotRegistries)
    ? data.slotRegistries.map((registry) => String(registry.pageId || "").trim()).filter(Boolean)
    : [];
  for (const pageId of registryPageIds) {
    const candidate = normalizeCompareText(pageId);
    if (!candidate || !text.includes(candidate)) continue;
    return pages.find((page) => page.id === pageId) || { id: pageId, title: pageId, pageGroup: pageId, sections: [] };
  }
  return pages.find((page) => page.id === "home") || pages[0] || null;
}

function inferTargetSection(page, requestText) {
  const text = normalizeCompareText(requestText);
  const sections = Array.isArray(page?.sections) ? page.sections : [];
  for (const section of sections) {
    const candidates = [section.id, section.name, section.componentType].map(normalizeCompareText).filter(Boolean);
    if (candidates.some((candidate) => candidate && text.includes(candidate))) {
      return section;
    }
  }
  return sections[0] || null;
}

function getSlotAliases(slotId = "") {
  const aliases = {
    hero: ["hero", "히어로", "메인배너", "메인 배너", "배너"],
    quickmenu: ["quickmenu", "quick menu", "퀵메뉴", "바로가기"],
    "header-top": ["header top", "상단헤더", "헤더상단"],
    "header-bottom": ["header bottom", "하단헤더", "헤더하단", "gnb", "메뉴"],
    banner: ["banner", "배너"],
    review: ["review", "리뷰"],
    notice: ["notice", "공지"],
    shortcut: ["shortcut", "쇼트컷", "바로가기"],
    mainService: ["main service", "메인서비스", "메인 서비스"],
    bestcare: ["bestcare", "best care", "베스트케어", "베스트 케어"],
    tabs: ["tabs", "tab", "탭"],
    productGrid: ["product grid", "상품그리드", "상품 그리드", "grid", "그리드"],
    firstProduct: ["first product", "첫상품", "첫 상품"],
    filter: ["filter", "필터"],
    sort: ["sort", "정렬"],
  };
  return aliases[slotId] || [];
}

function inferTargetSlot(data, page, requestText) {
  const text = normalizeCompareText(requestText);
  const slots = Array.isArray(findSlotRegistry(data, page?.id)?.slots) ? findSlotRegistry(data, page.id).slots : [];
  for (const slot of slots) {
    const candidates = [slot.slotId, slot.componentType, `${page.id}.${slot.slotId}`, ...getSlotAliases(slot.slotId)]
      .map(normalizeCompareText)
      .filter(Boolean);
    if (candidates.some((candidate) => candidate && text.includes(candidate))) {
      return slot;
    }
  }
  if (/(hero|히어로|배너)/.test(text)) {
    return slots.find((slot) => slot.slotId === "hero") || null;
  }
  return slots[0] || null;
}

function extractQuotedValue(requestText) {
  const match = String(requestText || "").match(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/);
  return match ? String(match[1] || "").trim() : "";
}

function extractUrlValue(requestText) {
  const match = String(requestText || "").match(/https?:\/\/[^\s"'“”‘’<>]+/i);
  return match ? String(match[0] || "").trim() : "";
}

function extractValueAfterPattern(requestText, pattern) {
  const match = String(requestText || "").match(pattern);
  return match ? String(match[1] || "").trim() : "";
}

function resolveRequestedSource(slot, requestText) {
  const text = normalizeCompareText(requestText);
  const sources = Array.isArray(slot?.sources) ? slot.sources : [];
  if (!sources.length) return null;
  const requestedType =
    /(figma|피그마)/.test(text)
      ? "figma-derived"
      : /(custom|커스텀|사용자|직접편집|수정본)/.test(text)
        ? "custom"
        : /(captured|capture|캡처|원본|기존소스|실캡처)/.test(text)
          ? "captured"
          : /(mobilederived|mobile-derived|모바일derived|모바일기반)/.test(text)
            ? "mobile-derived"
            : null;
  if (requestedType) {
    return sources.find((source) => source.sourceType === requestedType) || null;
  }
  const requestedSourceId = sources.find((source) => normalizeCompareText(source.sourceId) && text.includes(normalizeCompareText(source.sourceId)));
  return requestedSourceId || null;
}

function callDemoLlm(requestText, data) {
  const page = inferTargetPage(data, requestText);
  if (!page) {
    return { summary: "Demo fallback could not find a page", operations: [] };
  }
  const section = inferTargetSection(page, requestText);
  const slot = inferTargetSlot(data, page, requestText);
  const text = String(requestText || "");
  const normalized = normalizeCompareText(text);
  const quoted = extractQuotedValue(text);
  const urlValue = extractUrlValue(text);

  if (/(pagetitle|pagetitle|페이지제목|타이틀)/.test(normalized)) {
    const titleValue =
      quoted ||
      text.replace(/.*(?:page title|페이지 제목|타이틀)(?:을|를)?\s*/i, "").trim() ||
      `[Demo] ${page.title}`;
    return {
      summary: `Demo fallback updated page title for ${page.id}`,
      operations: [{ action: "update_page_title", pageId: page.id, value: titleValue }],
    };
  }

  if (slot) {
    const requestedSource = resolveRequestedSource(slot, text);
    if (requestedSource) {
      return {
        summary: `Demo fallback switched ${page.id}.${slot.slotId} to ${requestedSource.sourceId}`,
        operations: [{ action: "toggle_slot_source", pageId: page.id, slotId: slot.slotId, sourceId: requestedSource.sourceId }],
      };
    }
  }

  if (slot && page.id === "home" && slot.slotId === "hero") {
    if (/(이미지|image|img|배경이미지|heroimage)/.test(normalized) && urlValue) {
      return {
        summary: "Demo fallback updated home hero image",
        operations: [{ action: "update_slot_image", pageId: page.id, slotId: slot.slotId, imageSrc: urlValue }],
      };
    }
    if (/(링크|link|cta|href|버튼)/.test(normalized)) {
      const value = urlValue || quoted || extractValueAfterPattern(text, /(?:링크|link|cta|href)(?:를|을)?\s+(.+)$/i) || "/clone/home";
      return {
        summary: "Demo fallback updated home hero CTA",
        operations: [{ action: "update_hero_field", pageId: page.id, slotId: slot.slotId, field: "ctaHref", value }],
      };
    }
    if (/(badge|뱃지|배지)/.test(normalized)) {
      const value = quoted || extractValueAfterPattern(text, /(?:badge|뱃지|배지)(?:를|을)?\s+(.+)$/i) || "[Demo] Badge";
      return {
        summary: "Demo fallback updated home hero badge",
        operations: [{ action: "update_hero_field", pageId: page.id, slotId: slot.slotId, field: "badge", value }],
      };
    }
    if (/(description|desc|설명|카피설명|서브카피)/.test(normalized)) {
      const value = quoted || extractValueAfterPattern(text, /(?:description|desc|설명)(?:을|를)?\s+(.+)$/i) || "[Demo] Hero description";
      return {
        summary: "Demo fallback updated home hero description",
        operations: [{ action: "update_hero_field", pageId: page.id, slotId: slot.slotId, field: "description", value }],
      };
    }
    if (/(headline|headcopy|heading|헤드라인|메인카피|메인 카피|타이틀카피)/.test(normalized)) {
      const value = quoted || extractValueAfterPattern(text, /(?:headline|heading|헤드라인|메인카피|메인 카피)(?:을|를)?\s+(.+)$/i) || "[Demo] Hero headline";
      return {
        summary: "Demo fallback updated home hero headline",
        operations: [{ action: "update_hero_field", pageId: page.id, slotId: slot.slotId, field: "headline", value }],
      };
    }
  }

  if (slot && /(title|headline|heading|제목|타이틀|헤드라인|subtitle|sub title|서브타이틀|서브 타이틀|설명|description)/.test(normalized)) {
    const isSubtitle = /(subtitle|sub title|서브타이틀|서브 타이틀|설명|description)/.test(normalized);
    const field = isSubtitle ? "subtitle" : "title";
    const fallbackValue = isSubtitle ? `[Demo] ${slot.slotId} subtitle` : `[Demo] ${slot.slotId} title`;
    const value =
      quoted ||
      extractValueAfterPattern(
        text,
        isSubtitle
          ? /(?:subtitle|sub title|서브타이틀|서브 타이틀|설명|description)(?:을|를)?\s+(.+)$/i
          : /(?:title|headline|heading|제목|타이틀|헤드라인)(?:을|를)?\s+(.+)$/i
      ) ||
      fallbackValue;
    return {
      summary: `Demo fallback updated ${page.id}.${slot.slotId} ${field}`,
      operations: [{ action: "update_slot_text", pageId: page.id, slotId: slot.slotId, field, value }],
    };
  }

  if (!section) {
    return { summary: "Demo fallback could not find a section or slot", operations: [] };
  }

  if (/(숨기|hide|제거|비노출)/.test(normalized)) {
    return {
      summary: `Demo fallback hid section ${section.id}`,
      operations: [{ action: "toggle_section", pageId: page.id, sectionId: section.id, visible: false }],
    };
  }

  if (/(보이게|show|노출|표시)/.test(normalized)) {
    return {
      summary: `Demo fallback showed section ${section.id}`,
      operations: [{ action: "toggle_section", pageId: page.id, sectionId: section.id, visible: true }],
    };
  }

  if (/(맨위|top|first|첫번째|첫 번째|위로|reorder|move)/.test(normalized)) {
    return {
      summary: `Demo fallback moved section ${section.id} to top`,
      operations: [{ action: "reorder_section", pageId: page.id, sectionId: section.id, order: 1 }],
    };
  }

  const renameValue =
    quoted ||
    text.replace(/.*(?:rename|이름변경|이름을|제목을|섹션명을|rename section to)\s*/i, "").trim() ||
    `[Demo] ${section.name}`;
  return {
    summary: `Demo fallback renamed section ${section.id}`,
    operations: [{ action: "rename_section", pageId: page.id, sectionId: section.id, value: renameValue }],
  };
}

async function callOpenRouter(requestText, data) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    if (isDemoLlmEnabled()) {
      return callDemoLlm(requestText, data);
    }
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_TEXT_MODEL;
  const siteUrl = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
  const siteName = process.env.OPENROUTER_SITE_NAME || "lge-site-analysis";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": siteName,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(requestText, data) },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  return JSON.parse(content);
}

function resolveOpenRouterModel(...envKeys) {
  for (const key of envKeys.flat()) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_TEXT_MODEL;
}

function resolveOpenRouterModelCandidates(...envKeys) {
  const candidates = [];
  const seen = new Set();
  envKeys.flat().forEach((key) => {
    const raw = String(process.env[key] || "").trim();
    if (!raw) return;
    raw
      .split(",")
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .forEach((item) => {
        if (seen.has(item)) return;
        seen.add(item);
        candidates.push(item);
      });
  });
  return candidates;
}

function logModelFallbackFailure(stage = "llm", model = "", error = null) {
  const resolvedStage = String(stage || "llm").trim() || "llm";
  const resolvedModel = String(model || "").trim() || "unknown";
  const reason = String(error?.message || error || "").trim() || "unknown failure";
  console.warn(`[${resolvedStage}] fallback-failed model=${resolvedModel} reason=${reason}`);
}

function isRetryableOpenRouterFailure(errorOrMessage) {
  const message = String(errorOrMessage?.message || errorOrMessage || "").toLowerCase();
  const hasRetryableStatus = /request failed(?:\s*\[[^\]]+\])?:\s*(429)\b/.test(message);
  return (
    message.includes("timed out") ||
    message.includes("terminated") ||
    message.includes("fetch failed") ||
    hasRetryableStatus ||
    message.includes("non-json content") ||
    message.includes("empty content")
  );
}

function normalizeGeneratedAssetReference(item = {}) {
  const source = item && typeof item === "object" ? item : {};
  const width = Number.parseInt(source.width, 10);
  const height = Number.parseInt(source.height, 10);
  return {
    id: String(source.id || "").trim(),
    label: String(source.label || "").trim(),
    assetUrl: String(source.assetUrl || source.imageUrl || "").trim(),
    kind: String(source.kind || "visual").trim() || "visual",
    role: String(source.role || "").trim(),
    source: String(source.source || "generated").trim() || "generated",
    model: String(source.model || "").trim(),
    prompt: String(source.prompt || "").trim(),
    format: String(source.format || "").trim(),
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    aspectRatio: String(source.aspectRatio || "").trim(),
    slotId: String(source.slotId || "").trim(),
    componentId: String(source.componentId || "").trim(),
    tags: toStringArray(source.tags),
  };
}

function safeArray(values, limit = 20) {
  return (Array.isArray(values) ? values : []).slice(0, Math.max(0, Number(limit) || 0));
}

function safeObjectArray(values, limit = 20) {
  return safeArray(values, limit).filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function readReferenceVisualAssets(input = {}) {
  const plannerAssets = input?.referenceSummary?.designReferenceLibrary?.referenceVisualAssets;
  const builderAssets = input?.systemContext?.designReferenceLibrary?.referenceVisualAssets;
  const source = Array.isArray(builderAssets) ? builderAssets : (Array.isArray(plannerAssets) ? plannerAssets : []);
  const limit = Array.isArray(builderAssets) ? 3 : 2;
  return safeArray(source, limit)
    .map((item) => {
      const asset = item && typeof item === "object" ? item : {};
      const imageDataUrl = String(asset?.imageDataUrl || "").trim();
      if (!imageDataUrl) return null;
      return {
        id: String(asset?.id || "").trim(),
        label: String(asset?.label || "").trim(),
        sourceName: String(asset?.sourceName || "").trim(),
        sourceClass: String(asset?.sourceClass || "").trim(),
        targetLayer: String(asset?.targetLayer || "").trim(),
        targetComponents: toStringArray(asset?.targetComponents).slice(0, 8),
        why: toStringArray(asset?.why).slice(0, 4),
        avoid: toStringArray(asset?.avoid).slice(0, 4),
        sourceUrl: String(asset?.sourceUrl || "").trim(),
        imageDataUrl,
      };
    })
    .filter(Boolean);
}

function readWholePageContextAssets(input = {}) {
  const plannerAssets = input?.referenceSummary?.designReferenceLibrary?.wholePageContextAssets;
  const builderAssets = input?.systemContext?.designReferenceLibrary?.wholePageContextAssets;
  const source = Array.isArray(builderAssets) ? builderAssets : (Array.isArray(plannerAssets) ? plannerAssets : []);
  return safeArray(source, 4)
    .map((item) => {
      const asset = item && typeof item === "object" ? item : {};
      const imageDataUrl = String(asset?.imageDataUrl || "").trim();
      if (!imageDataUrl) return null;
      return {
        id: String(asset?.id || "").trim(),
        label: String(asset?.label || "").trim(),
        sourceName: String(asset?.sourceName || "").trim(),
        sourceClass: String(asset?.sourceClass || "").trim(),
        targetLayer: String(asset?.targetLayer || "").trim(),
        targetComponents: toStringArray(asset?.targetComponents).slice(0, 8),
        why: toStringArray(asset?.why).slice(0, 4),
        avoid: toStringArray(asset?.avoid).slice(0, 4),
        sourceUrl: String(asset?.sourceUrl || "").trim(),
        imageDataUrl,
      };
    })
    .filter(Boolean);
}

function readCompareModeVisualAssets(input = {}) {
  const compareMode = input?.systemContext?.compareMode || {};
  const visualAssets = compareMode?.visualAssets && typeof compareMode.visualAssets === "object"
    ? compareMode.visualAssets
    : {};
  const candidates = [
    {
      kind: "before",
      label: String(visualAssets?.beforeLabel || "before").trim() || "before",
      imageDataUrl: String(visualAssets?.beforeImageDataUrl || "").trim(),
      source: "compareMode.before",
    },
    {
      kind: "failed-after",
      label: String(visualAssets?.afterLabel || "failed after").trim() || "failed after",
      imageDataUrl: String(visualAssets?.afterImageDataUrl || "").trim(),
      source: "compareMode.failedAfter",
    },
    {
      kind: "reference",
      label: String(visualAssets?.referenceLabel || "reference").trim() || "reference",
      imageDataUrl: String(visualAssets?.referenceImageDataUrl || "").trim(),
      source: "compareMode.reference",
    },
    {
      kind: "focus-before",
      label: String(visualAssets?.focusLabel || "focus area").trim() || "focus area",
      imageDataUrl: String(visualAssets?.focusBeforeImageDataUrl || "").trim(),
      source: "compareMode.focusBefore",
    },
    {
      kind: "focus-failed-after",
      label: `${String(visualAssets?.focusLabel || "focus area").trim() || "focus area"} failed after`,
      imageDataUrl: String(visualAssets?.focusAfterImageDataUrl || "").trim(),
      source: "compareMode.focusAfter",
    },
  ];
  return candidates.filter((item) => item.imageDataUrl).slice(0, 6);
}

function buildReferenceVisualUserContent(promptText = "", input = {}, heading = "Reference screenshots", options = {}) {
  const content = [{ type: "text", text: String(promptText || "") }];
  const referenceLimit = Math.max(0, Number(options?.referenceLimit ?? 3) || 0);
  const wholePageLimit = Math.max(0, Number(options?.wholePageLimit ?? 4) || 0);
  const wholePageMode = String(options?.wholePageMode || "all").trim() || "all";
  const compareVisualAssets = readCompareModeVisualAssets(input);
  const allAssets = readReferenceVisualAssets(input);
  const allWholePageAssets = readWholePageContextAssets(input);
  const assets = allAssets.slice(0, referenceLimit);
  let wholePageAssets = allWholePageAssets.slice(0, wholePageLimit);
  if (wholePageMode === "planner-lite") {
    const fullPage = allWholePageAssets.find((item) => String(item?.id || "").trim() === "clone-original-fullpage") || null;
    const focus = allWholePageAssets.find((item) => String(item?.id || "").trim() === "clone-target-focus") || null;
    const overlay = allWholePageAssets.find((item) => String(item?.id || "").trim() === "clone-target-overlay") || null;
    wholePageAssets = [fullPage, focus || overlay].filter(Boolean).slice(0, wholePageLimit || 2);
  }
  if (!assets.length && !wholePageAssets.length && !compareVisualAssets.length) return content;
  if (compareVisualAssets.length) {
    content.push({
      type: "text",
      text: "Compare rerun visual evidence: inspect the original before state, then the failed after result, then the strongest reference. Use these screenshots directly to rebuild the next draft from scratch instead of inferring the failure only from text findings."
    });
    compareVisualAssets.forEach((asset, index) => {
      const lines = [
        `Compare visual ${index + 1}: ${asset.label || asset.kind || `compare-${index + 1}`}`,
        `Kind: ${asset.kind}`,
        asset.source ? `Source: ${asset.source}` : "",
      ].filter(Boolean).join("\n");
      content.push({ type: "text", text: lines });
      content.push({ type: "image_url", image_url: { url: asset.imageDataUrl } });
    });
  }
  if (wholePageAssets.length) {
    content.push({
      type: "text",
      text: "Whole-page context: inspect the original full-page clone first, then the highlighted target region, then the focus crop. Keep redesign decisions coherent with the surrounding page rhythm and hierarchy."
    });
    wholePageAssets.forEach((asset, index) => {
      const lines = [
        `Context ${index + 1}: ${asset.label || asset.id || `context-${index + 1}`}`,
        asset.sourceName ? `Source: ${asset.sourceName}` : "",
        asset.targetLayer ? `Target layer: ${asset.targetLayer}` : "",
        asset.targetComponents.length ? `Target components: ${asset.targetComponents.join(", ")}` : "",
        asset.why.length ? `Why: ${asset.why.join(" | ")}` : "",
        asset.avoid.length ? `Avoid: ${asset.avoid.join(" | ")}` : "",
      ].filter(Boolean).join("\n");
      content.push({ type: "text", text: lines });
      content.push({ type: "image_url", image_url: { url: asset.imageDataUrl } });
    });
  }
  if (!assets.length) return content;
  content.push({ type: "text", text: `${heading}: use these as strong visual anchors, not as literal copy targets.` });
  assets.forEach((asset, index) => {
    const lines = [
      `Reference ${index + 1}: ${asset.label || asset.id || `anchor-${index + 1}`}`,
      asset.sourceName ? `Source: ${asset.sourceName}` : "",
      asset.sourceClass ? `Class: ${asset.sourceClass}` : "",
      asset.targetLayer ? `Target layer: ${asset.targetLayer}` : "",
      asset.targetComponents.length ? `Target components: ${asset.targetComponents.join(", ")}` : "",
      asset.why.length ? `Why: ${asset.why.join(" | ")}` : "",
      asset.avoid.length ? `Avoid: ${asset.avoid.join(" | ")}` : "",
    ].filter(Boolean).join("\n");
    content.push({ type: "text", text: lines });
    content.push({ type: "image_url", image_url: { url: asset.imageDataUrl } });
  });
  return content;
}

function measureMessageChars(messages = []) {
  const visit = (value) => {
    if (typeof value === "string") return value.length;
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + visit(item), 0);
    if (value && typeof value === "object") {
      if (typeof value.text === "string") return value.text.length;
      if (value.image_url?.url) return 0;
      return Object.values(value).reduce((sum, item) => sum + visit(item), 0);
    }
    return 0;
  };
  return (Array.isArray(messages) ? messages : []).reduce((sum, message) => sum + visit(message?.content), 0);
}

function parseJsonResponseContent(content) {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content;
  }
  const rawContent = Array.isArray(content)
    ? content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            return String(item.text || item.content || "");
          }
          return "";
        })
        .join("\n")
    : content;
  const raw = String(rawContent || "").trim();
  if (!raw) {
    throw new Error("OpenRouter returned empty content");
  }
  const tryParse = (value) => {
    if (typeof value !== "string") return null;
    const source = value.trim();
    if (!source) return null;
    try {
      return JSON.parse(source);
    } catch {
      return null;
    }
  };
  const repairJsonLikeString = (value) =>
    String(value || "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const stripMarkdownJsonFences = (value) =>
    String(value || "")
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .replace(/```(?:json)?/gi, "")
      .trim();
  const extractBalancedJsonObject = (value) => {
    const source = String(value || "");
    const start = source.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const ch = source[index];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth += 1;
        continue;
      }
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return source.slice(start, index + 1);
        }
      }
    }
    return null;
  };
  const direct = tryParse(raw);
  if (direct) return direct;
  const stripped = stripMarkdownJsonFences(raw);
  if (stripped && stripped !== raw) {
    const strippedParsed = tryParse(stripped);
    if (strippedParsed) return strippedParsed;
    const strippedRepaired = tryParse(repairJsonLikeString(stripped));
    if (strippedRepaired) return strippedRepaired;
  }
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    const fencedParsed = tryParse(fenced[1]);
    if (fencedParsed) return fencedParsed;
    const fencedRepaired = tryParse(repairJsonLikeString(fenced[1]));
    if (fencedRepaired) return fencedRepaired;
  }
  const balanced = extractBalancedJsonObject(raw);
  if (balanced) {
    const balancedParsed = tryParse(balanced);
    if (balancedParsed) return balancedParsed;
    const balancedRepaired = tryParse(repairJsonLikeString(balanced));
    if (balancedRepaired) return balancedRepaired;
  }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const wideSlice = raw.slice(firstBrace, lastBrace + 1);
    const wideParsed = tryParse(wideSlice);
    if (wideParsed) return wideParsed;
    const wideRepaired = tryParse(repairJsonLikeString(wideSlice));
    if (wideRepaired) return wideRepaired;
  }
  throw new Error(`OpenRouter returned non-JSON content: ${raw.slice(0, 160)}`);
}

const OPENROUTER_ALLOWED_IMAGE_ASPECT_RATIOS = [
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
];

function parseOpenRouterAspectRatioValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const numeric = Number.parseFloat(raw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const width = Number.parseFloat(match[1]);
  const height = Number.parseFloat(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return null;
  return width / height;
}

function normalizeOpenRouterAspectRatio(value, fallback = "16:9") {
  const preferredRatio = parseOpenRouterAspectRatioValue(value);
  if (!preferredRatio) return fallback;
  let best = fallback;
  let bestDrift = Number.POSITIVE_INFINITY;
  OPENROUTER_ALLOWED_IMAGE_ASPECT_RATIOS.forEach((candidate) => {
    const candidateRatio = parseOpenRouterAspectRatioValue(candidate);
    if (!candidateRatio) return;
    const drift = Math.abs(candidateRatio - preferredRatio);
    if (drift < bestDrift) {
      best = candidate;
      bestDrift = drift;
    }
  });
  return best;
}

function resolveOpenRouterMaxTokens(value, fallback = null) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(512, parsed);
}

function inferOpenRouterAffordableMaxTokens(errorText = "") {
  const source = String(errorText || "");
  const affordableMatch = source.match(/can only afford\s+(\d+)/i);
  const requestedMatch = source.match(/requested up to\s+(\d+)/i);
  const affordable = affordableMatch ? Number.parseInt(affordableMatch[1], 10) : NaN;
  const requested = requestedMatch ? Number.parseInt(requestedMatch[1], 10) : NaN;
  if (!Number.isFinite(affordable) || affordable <= 0) return null;
  const candidate = Math.max(512, affordable - 256);
  if (Number.isFinite(requested) && candidate >= requested) {
    return Math.max(512, requested - 256);
  }
  return candidate;
}

async function callOpenRouterJson({
  model,
  messages,
  temperature = 0.1,
  demoFallback = null,
  timeoutMs: overrideTimeoutMs = null,
  maxTokens: overrideMaxTokens = null,
  maxAttempts: overrideMaxAttempts = null,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    if (typeof demoFallback === "function") return demoFallback();
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const siteUrl = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
  const siteName = process.env.OPENROUTER_SITE_NAME || "lge-site-analysis";
  const resolvedModel = model || resolveOpenRouterModel("OPENROUTER_MODEL");
  const timeoutMs = overrideTimeoutMs != null
    ? Math.max(20_000, Number(overrideTimeoutMs))
    : Math.max(20_000, Number(process.env.OPENROUTER_TIMEOUT_MS || 90_000));
  const maxAttempts = overrideMaxAttempts != null
    ? Math.max(1, Number(overrideMaxAttempts))
    : Math.max(1, Number(process.env.OPENROUTER_MAX_ATTEMPTS || 2));
  const configuredMaxTokens = resolveOpenRouterMaxTokens(
    overrideMaxTokens,
    resolveOpenRouterMaxTokens(process.env.OPENROUTER_MAX_TOKENS, null)
  );
  let lastError = null;
  let currentMaxTokens = configuredMaxTokens;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": siteUrl,
          "X-Title": siteName,
        },
        body: JSON.stringify({
          model: resolvedModel,
          temperature,
          response_format: { type: "json_object" },
          messages,
          ...(Number.isFinite(currentMaxTokens) && currentMaxTokens > 0 ? { max_tokens: currentMaxTokens } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        const text = await response.text();
        if (response.status === 402) {
          const affordableMaxTokens = inferOpenRouterAffordableMaxTokens(text);
          const canReduceBudget =
            Number.isFinite(affordableMaxTokens) &&
            affordableMaxTokens > 0 &&
            (!Number.isFinite(currentMaxTokens) || affordableMaxTokens < currentMaxTokens);
          if (canReduceBudget && attempt < maxAttempts) {
            currentMaxTokens = affordableMaxTokens;
            lastError = new Error(`OpenRouter request constrained [${resolvedModel}] to max_tokens=${currentMaxTokens}`);
            continue;
          }
        }
        throw new Error(`OpenRouter request failed [${resolvedModel}]: ${response.status} ${text}`);
      }
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      return parseJsonResponseContent(content);
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const message = String(error?.message || error || "").toLowerCase();
      const isTimeout = timedOut || error?.name === "AbortError" || message.includes("timed out");
      const isTransient =
        isTimeout ||
        message.includes("non-json content") ||
        message.includes("empty content") ||
        message.includes("terminated") ||
        message.includes("fetch failed") ||
        message.includes("socket") ||
        message.includes("econnreset") ||
        message.includes("network");
      if (attempt >= maxAttempts || !isTransient) {
        if (isTimeout) {
          lastError = new Error(`OpenRouter request timed out [${resolvedModel}] after ${timeoutMs}ms`);
        }
        break;
      }
    }
  }

  throw lastError || new Error("OpenRouter request failed");
}

async function callOpenRouterText({
  model,
  messages,
  temperature = 0.1,
  demoFallback = null,
  timeoutMs: overrideTimeoutMs = null,
  maxTokens: overrideMaxTokens = null,
  maxAttempts: overrideMaxAttempts = null,
  returnMeta = false,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    if (typeof demoFallback === "function") return demoFallback();
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const siteUrl = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
  const siteName = process.env.OPENROUTER_SITE_NAME || "lge-site-analysis";
  const resolvedModel = model || resolveOpenRouterModel("OPENROUTER_MODEL");
  const timeoutMs = overrideTimeoutMs != null
    ? Math.max(20_000, Number(overrideTimeoutMs))
    : Math.max(20_000, Number(process.env.OPENROUTER_TIMEOUT_MS || 90_000));
  const maxAttempts = overrideMaxAttempts != null
    ? Math.max(1, Number(overrideMaxAttempts))
    : Math.max(1, Number(process.env.OPENROUTER_MAX_ATTEMPTS || 2));
  const configuredMaxTokens = resolveOpenRouterMaxTokens(
    overrideMaxTokens,
    resolveOpenRouterMaxTokens(process.env.OPENROUTER_MAX_TOKENS, null)
  );
  let lastError = null;
  let currentMaxTokens = configuredMaxTokens;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": siteUrl,
          "X-Title": siteName,
        },
        body: JSON.stringify({
          model: resolvedModel,
          temperature,
          messages,
          ...(Number.isFinite(currentMaxTokens) && currentMaxTokens > 0 ? { max_tokens: currentMaxTokens } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        const text = await response.text();
        if (response.status === 402) {
          const affordableMaxTokens = inferOpenRouterAffordableMaxTokens(text);
          const canReduceBudget =
            Number.isFinite(affordableMaxTokens) &&
            affordableMaxTokens > 0 &&
            (!Number.isFinite(currentMaxTokens) || affordableMaxTokens < currentMaxTokens);
          if (canReduceBudget && attempt < maxAttempts) {
            currentMaxTokens = affordableMaxTokens;
            lastError = new Error(`OpenRouter text request constrained [${resolvedModel}] to max_tokens=${currentMaxTokens}`);
            continue;
          }
        }
        throw new Error(`OpenRouter text request failed [${resolvedModel}]: ${response.status} ${text}`);
      }
      const payload = await response.json();
      const choice = payload?.choices?.[0] || {};
      const finishReason = String(choice?.finish_reason || "").trim() || null;
      const usage = payload?.usage && typeof payload.usage === "object" ? payload.usage : null;
      const providerId = String(payload?.id || "").trim() || null;
      const content = choice?.message?.content;
      if (!content) throw new Error(`OpenRouter text request returned empty content [${resolvedModel}]`);
      const buildMeta = (text) => ({
        text,
        meta: {
          model: resolvedModel,
          providerId,
          finishReason,
          usage,
        },
      });
      if (Array.isArray(content)) {
        const text = content
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") return String(item.text || item.content || "").trim();
            return "";
          })
          .filter(Boolean)
          .join("\n")
          .trim();
        return returnMeta ? buildMeta(text) : text;
      }
      const text = String(content || "").trim();
      return returnMeta ? buildMeta(text) : text;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const message = String(error?.message || error || "").toLowerCase();
      const isTimeout = timedOut || error?.name === "AbortError" || message.includes("timed out");
      const isTransient =
        isTimeout ||
        message.includes("terminated") ||
        message.includes("fetch failed") ||
        message.includes("socket") ||
        message.includes("econnreset") ||
        message.includes("network");
      if (attempt >= maxAttempts || !isTransient) {
        if (isTimeout) {
          lastError = new Error(`OpenRouter text request timed out [${resolvedModel}] after ${timeoutMs}ms`);
        }
        break;
      }
    }
  }

  throw lastError || new Error("OpenRouter text request failed");
}

async function callOpenRouterImageGeneration({
  model,
  prompt,
  references = [],
  aspectRatio = "16:9",
  imageSize = "2K",
  timeoutMs: overrideTimeoutMs = null,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  const siteUrl = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
  const siteName = process.env.OPENROUTER_SITE_NAME || "lge-site-analysis";
  const resolvedModel = model || resolveOpenRouterModel("OPENROUTER_IMAGE_MODEL", "OPENROUTER_MODEL");
  const normalizedAspectRatio = normalizeOpenRouterAspectRatio(aspectRatio, "16:9");
  const timeoutMs =
    Number.isFinite(Number(overrideTimeoutMs)) && Number(overrideTimeoutMs) > 0
      ? Math.max(20_000, Number(overrideTimeoutMs))
      : Math.max(20_000, Number(process.env.OPENROUTER_IMAGE_TIMEOUT_MS || process.env.OPENROUTER_TIMEOUT_MS || 120_000));
  const maxAttempts = Math.max(1, Number(process.env.OPENROUTER_IMAGE_MAX_ATTEMPTS || process.env.OPENROUTER_MAX_ATTEMPTS || 2));
  const content = [{ type: "text", text: String(prompt || "").trim() }];
  safeArray(references, 4).forEach((item) => {
    const url = String(item?.imageDataUrl || item?.url || "").trim();
    if (!url) return;
    const label = String(item?.label || item?.id || "reference").trim();
    content.push({ type: "text", text: `Reference: ${label}` });
    content.push({ type: "image_url", image_url: { url } });
  });
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": siteUrl,
          "X-Title": siteName,
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
          image_config: {
            aspect_ratio: normalizedAspectRatio,
            image_size: String(imageSize || "2K").trim() || "2K",
          },
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter image generation failed [${resolvedModel}]: ${response.status} ${text}`);
      }
      const payload = await response.json();
      const message = payload?.choices?.[0]?.message || {};
      const images = Array.isArray(message?.images) ? message.images : [];
      const first = images[0] || null;
      const imageDataUrl = String(first?.image_url?.url || first?.imageUrl?.url || "").trim();
      if (!imageDataUrl) {
        throw new Error("OpenRouter image generation returned no image");
      }
      return {
        model: resolvedModel,
        imageDataUrl,
        text: typeof message?.content === "string" ? message.content.trim() : "",
      };
    } catch (error) {
      lastError = error;
      const reason = String(error?.message || error);
      const retryable =
        error?.name === "AbortError" ||
        /timed out|aborted|terminated|econnreset|returned no image/i.test(reason);
      if (!retryable || attempt >= maxAttempts) break;
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastError?.name === "AbortError") {
    throw new Error(`OpenRouter image generation timed out [${resolvedModel}] after ${timeoutMs}ms`);
  }
  throw lastError || new Error(`OpenRouter image generation failed [${resolvedModel}]`);
}

function withLlmTimeout(promise, label = "LLM request", timeoutMs = Math.max(30_000, Number(process.env.LLM_REQUEST_TIMEOUT_MS || 120_000))) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function toStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value
    .map((item) => {
      if (item == null) return "";
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        return String(item).trim();
      }
      if (typeof item === "object") {
        const candidateKeys = [
          "text",
          "message",
          "reason",
          "label",
          "title",
          "description",
          "summary",
          "slotId",
          "componentId",
          "id",
        ];
        for (const key of candidateKeys) {
          const value = String(item?.[key] || "").trim();
          if (value) return value;
        }
      }
      return "";
    })
    .filter(Boolean);
}

function hasNonPrimitiveArrayEntries(value) {
  if (!Array.isArray(value)) return false;
  return value.some((item) => item !== null && typeof item === "object");
}

function coerceNumericScore(value, fallback = 0) {
  if (Number.isFinite(Number(value))) return Number(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      const normalized = trimmed.replace(/,/g, "");
      const fractionMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
      if (fractionMatch) {
        const numerator = Number(fractionMatch[1]);
        const denominator = Number(fractionMatch[2]);
        if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
          return (numerator / denominator) * 100;
        }
      }
      const percentMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*%/);
      if (percentMatch) {
        const percent = Number(percentMatch[1]);
        if (Number.isFinite(percent)) return percent;
      }
      const outOfTenMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:out of|\/)\s*10\b/i);
      if (outOfTenMatch) {
        const outOfTen = Number(outOfTenMatch[1]);
        if (Number.isFinite(outOfTen)) return outOfTen * 10;
      }
      const numericMatch = normalized.match(/-?\d+(?:\.\d+)?/);
      if (numericMatch) {
        const candidate = Number(numericMatch[0]);
        if (Number.isFinite(candidate)) return candidate;
      }
    }
  }
  if (value && typeof value === "object") {
    const candidates = [
      value.value,
      value.score,
      value.numeric,
      value.amount,
      value.result,
      value.rating,
      value.points,
      value.raw,
      value.text,
      value.label,
    ];
    for (const candidate of candidates) {
      const coerced = coerceNumericScore(candidate, Number.NaN);
      if (Number.isFinite(coerced)) return coerced;
    }
  }
  return fallback;
}

function toJsonSafeValue(value, maxDepth = 6) {
  if (maxDepth <= 0) return null;
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => toJsonSafeValue(item, maxDepth - 1));
  }
  if (typeof value === "object") {
    const next = {};
    Object.entries(value).slice(0, 80).forEach(([key, entry]) => {
      next[key] = toJsonSafeValue(entry, maxDepth - 1);
    });
    return next;
  }
  return String(value);
}

function formatSlotLabel(slotId = "") {
  const map = {
    "header-top": "상단 헤더",
    "header-bottom": "주 메뉴",
    hero: "히어로",
    quickmenu: "퀵메뉴",
    timedeal: "타임딜",
    "md-choice": "MD 추천",
    "best-ranking": "베스트 랭킹",
    "marketing-area": "마케팅 영역",
    subscription: "구독 섹션",
    "space-renewal": "공간 리뉴얼",
    "brand-showroom": "브랜드 쇼룸",
    "latest-product-news": "신제품 소식",
    "smart-life": "스마트 라이프",
    "summary-banner-2": "하단 배너",
    "missed-benefits": "혜택 모음",
    "lg-best-care": "LG 베스트 케어",
    "bestshop-guide": "베스트샵 안내",
    banner: "배너",
    filter: "필터",
    sort: "정렬",
    productGrid: "상품 그리드",
    gallery: "갤러리",
    summary: "요약",
    price: "가격",
    option: "옵션",
    sticky: "고정 구매 영역",
    review: "리뷰",
    qna: "문의",
  };
  const normalized = String(slotId || "").trim();
  return map[normalized] || normalized || "section";
}

function toMarkdownBulletLines(values = []) {
  return toStringArray(values).map((line) => `- ${line}`);
}

function buildPlannerBudgetProfile(options = {}) {
  const interventionLayer = normalizeInterventionLayer(
    options?.interventionLayer || options?.userInput?.interventionLayer || options?.requirementPlan?.interventionLayer || "page",
    "page"
  );
  const profiles = {
    page: {
      requestSummary: { min: 5, max: 6, maxChars: 120 },
      planningDirection: { min: 5, max: 6, maxChars: 140 },
      designDirection: { min: 5, max: 6, maxChars: 140 },
      priority: { max: 4, reasonChars: 120 },
      guardrails: { max: 8, maxChars: 80 },
      mustKeep: { min: 3, max: 4, maxChars: 120 },
      mustChange: { min: 3, max: 4, maxChars: 120 },
      objectiveMaxChars: 180,
      focusSlotsMax: 6,
      proposalSectionsMax: 6,
      blueprintsMax: 6,
      changeChecklistMax: 6,
      referenceNotesMax: 5,
    },
    "section-group": {
      requestSummary: { min: 4, max: 5, maxChars: 110 },
      planningDirection: { min: 4, max: 5, maxChars: 130 },
      designDirection: { min: 4, max: 5, maxChars: 130 },
      priority: { max: 3, reasonChars: 110 },
      guardrails: { max: 6, maxChars: 72 },
      mustKeep: { min: 3, max: 3, maxChars: 110 },
      mustChange: { min: 3, max: 3, maxChars: 110 },
      objectiveMaxChars: 160,
      focusSlotsMax: 4,
      proposalSectionsMax: 3,
      blueprintsMax: 3,
      changeChecklistMax: 4,
      referenceNotesMax: 4,
    },
    component: {
      requestSummary: { min: 3, max: 4, maxChars: 100 },
      planningDirection: { min: 3, max: 4, maxChars: 120 },
      designDirection: { min: 3, max: 4, maxChars: 120 },
      priority: { max: 2, reasonChars: 100 },
      guardrails: { max: 5, maxChars: 68 },
      mustKeep: { min: 2, max: 3, maxChars: 100 },
      mustChange: { min: 2, max: 3, maxChars: 100 },
      objectiveMaxChars: 140,
      focusSlotsMax: 2,
      proposalSectionsMax: 2,
      blueprintsMax: 2,
      changeChecklistMax: 4,
      referenceNotesMax: 3,
    },
    element: {
      requestSummary: { min: 2, max: 3, maxChars: 90 },
      planningDirection: { min: 2, max: 3, maxChars: 110 },
      designDirection: { min: 2, max: 3, maxChars: 110 },
      priority: { max: 1, reasonChars: 90 },
      guardrails: { max: 4, maxChars: 64 },
      mustKeep: { min: 2, max: 2, maxChars: 90 },
      mustChange: { min: 2, max: 2, maxChars: 90 },
      objectiveMaxChars: 120,
      focusSlotsMax: 1,
      proposalSectionsMax: 1,
      blueprintsMax: 1,
      changeChecklistMax: 3,
      referenceNotesMax: 2,
    },
  };
  return {
    interventionLayer,
    ...(profiles[interventionLayer] || profiles.page),
  };
}

function truncateText(value = "", maxChars = 120) {
  const text = normalizeNarrativeLine(value);
  const limit = Math.max(24, Number(maxChars || 0));
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function truncateNarrativeList(values = [], maxChars = 120) {
  return uniqueNonEmptyLines(values).map((line) => truncateText(line, maxChars)).filter(Boolean);
}

function buildWireframeBlockLines(label = "", viewportLabel = "PC", details = {}) {
  const title = String(label || "섹션").trim() || "섹션";
  const emphasis = String(details.emphasis || "").trim();
  const visualCue = String(details.visualCue || "").trim();
  const keepNote = String(details.keepNote || "").trim();
  const lines = [
    "+----------------------------------------------------------------+",
    `| ${title.slice(0, 60).padEnd(60, " ")} |`,
    "+----------------------------------------------------------------+",
    `| viewport : ${viewportLabel.slice(0, 49).padEnd(49, " ")} |`,
    `| message  : ${(emphasis || "핵심 메시지와 시각 위계를 재정렬").slice(0, 49).padEnd(49, " ")} |`,
    `| visual   : ${(visualCue || "배경, 타이포, CTA, 여백 리듬을 재설계").slice(0, 49).padEnd(49, " ")} |`,
    `| keep     : ${(keepNote || "기존 역할과 핵심 사용자 흐름은 유지").slice(0, 49).padEnd(49, " ")} |`,
    "| zones    : badge / title / summary / action / support cue      |",
    "+----------------------------------------------------------------+",
  ];
  return lines;
}

function buildProposalSectionSpecs(requirementPlan = {}, pageContext = {}) {
  const budget = buildPlannerBudgetProfile({ requirementPlan });
  const builderBrief = requirementPlan?.builderBrief && typeof requirementPlan.builderBrief === "object" ? requirementPlan.builderBrief : {};
  const orderedSlotIds = uniqueNonEmptyLines([
    ...toStringArray(builderBrief?.suggestedFocusSlots),
    ...((Array.isArray(requirementPlan?.priority) ? requirementPlan.priority : []).map((item) => String(item?.target || "").trim())),
  ]).slice(0, budget.focusSlotsMax);
  const requestSummary = truncateNarrativeList(requirementPlan?.requestSummary, budget.requestSummary.maxChars);
  const planningDirection = truncateNarrativeList(requirementPlan?.planningDirection, budget.planningDirection.maxChars);
  const designDirection = truncateNarrativeList(requirementPlan?.designDirection, budget.designDirection.maxChars);
  const mustKeep = truncateNarrativeList(builderBrief?.mustKeep, budget.mustKeep.maxChars);
  const mustChange = truncateNarrativeList(builderBrief?.mustChange, budget.mustChange.maxChars);
  const pageLabel = String(pageContext?.pageLabel || pageContext?.workspacePageId || "페이지").trim();
  const fallbackLabels = ["상단 진입 영역", "주요 탐색 영역", "핵심 설득 영역", "보강 정보 영역"];
  const targetSlots = orderedSlotIds.length ? orderedSlotIds : fallbackLabels.map((item, index) => `fallback-${index + 1}:${item}`);
  return targetSlots.slice(0, budget.proposalSectionsMax).map((slotId, index) => {
    const isFallback = slotId.startsWith("fallback-");
    const fallbackLabel = isFallback ? slotId.split(":").slice(1).join(":").trim() : "";
    const label = isFallback ? fallbackLabel : formatSlotLabel(slotId);
    const why = truncateText(planningDirection[index] || planningDirection[index % Math.max(planningDirection.length, 1)] || requestSummary[0] || `${pageLabel}의 변화 이유를 더 분명하게 설명해야 합니다.`, budget.planningDirection.maxChars);
    const visual = truncateText(designDirection[index] || designDirection[index % Math.max(designDirection.length, 1)] || designDirection[0] || "타이포, 여백, 강조 포인트, CTA 밀도를 재정리합니다.", budget.designDirection.maxChars);
    const keep = truncateText(mustKeep[index] || mustKeep[index % Math.max(mustKeep.length, 1)] || "현재 페이지의 역할과 핵심 사용자 흐름은 유지합니다.", budget.mustKeep.maxChars);
    const change = truncateText(mustChange[index] || mustChange[index % Math.max(mustChange.length, 1)] || "이 구간의 메시지와 시각 위계를 명확하게 다시 설계합니다.", budget.mustChange.maxChars);
    const priorityReason = truncateText((Array.isArray(requirementPlan?.priority) ? requirementPlan.priority : [])[index]?.reason || why, budget.priority.reasonChars);
    return {
      slotId: isFallback ? "" : slotId,
      label,
      why,
      visual,
      keep,
      change,
      priorityReason,
      order: index + 1,
    };
  });
}

function buildLayoutMockupLines(viewportLabel = "PC", sectionSpecs = []) {
  const specs = Array.isArray(sectionSpecs) && sectionSpecs.length
    ? sectionSpecs
    : [
        { label: "상단 진입 영역" },
        { label: "주요 탐색/프로모션 영역" },
        { label: "주요 설득 영역" },
        { label: "보강 정보 영역" },
      ];
  return [
    `Viewport: ${viewportLabel}`,
    "",
    ...specs.flatMap((item) =>
      buildWireframeBlockLines(item.label, viewportLabel, {
        emphasis: item.change,
        visualCue: item.visual,
        keepNote: item.keep,
      }).concat([""])
    ),
  ].slice(0, -1);
}

function inferSectionArchetype(slotId = "") {
  const normalized = String(slotId || "").trim();
  const map = {
    hero: "hero",
    quickmenu: "icon-grid",
    "md-choice": "product-list",
    timedeal: "product-list",
    "best-ranking": "product-list",
    subscription: "banner-list",
    "space-renewal": "editorial-product",
    "brand-showroom": "editorial",
    "latest-product-news": "editorial",
    "smart-life": "editorial",
    "summary-banner-2": "banner",
    "missed-benefits": "banner-grid",
    "lg-best-care": "service-card",
    "bestshop-guide": "service-card",
    "marketing-area": "promo-grid",
    banner: "banner",
    filter: "controls",
    sort: "controls",
    productGrid: "product-grid",
    gallery: "gallery",
    summary: "summary",
    sticky: "sticky-buy",
    review: "review",
    qna: "qna",
  };
  return map[normalized] || "section";
}

function inferSectionHierarchy(slotId = "", changeLine = "") {
  const archetype = inferSectionArchetype(slotId);
  if (archetype === "hero") return ["badge", "headline", "support copy", "primary action"];
  if (archetype === "icon-grid") return ["section title", "icon row", "short labels", "support cue"];
  if (archetype === "product-list" || archetype === "product-grid") return ["badge", "title", "support line", "card row", "cta"];
  if (archetype === "banner" || archetype === "banner-list") return ["badge", "title", "summary", "visual", "cta"];
  if (archetype === "service-card") return ["badge", "title", "trust cue", "summary", "action"];
  if (archetype === "controls") return ["label", "current selection", "action cue"];
  if (/cta|action|신청|바로가기/i.test(String(changeLine || ""))) return ["badge", "title", "summary", "action"];
  return ["badge", "title", "summary", "action"];
}

function inferContainerMode(slotId = "", pageContext = {}) {
  const normalizedPageId = String(pageContext?.workspacePageId || "").trim();
  if (normalizedPageId === "home") {
    if (slotId === "hero" || slotId === "quickmenu") return "wide-shell";
    if (slotId === "summary-banner-2") return "full-shell";
    return "content-shell";
  }
  if (isPdpCasePageId(normalizedPageId)) {
    if (slotId === "gallery" || slotId === "summary") return "content-shell";
    return "narrow-shell";
  }
  return "content-shell";
}

function buildSectionBlueprints(requirementPlan = {}, pageContext = {}) {
  const budget = buildPlannerBudgetProfile({ requirementPlan });
  const sectionSpecs = buildProposalSectionSpecs(requirementPlan, pageContext);
  return sectionSpecs.slice(0, budget.blueprintsMax).map((item) => ({
    order: item.order,
    slotId: item.slotId || "",
    label: item.label,
    archetype: inferSectionArchetype(item.slotId),
    containerMode: inferContainerMode(item.slotId, pageContext),
    objective: item.priorityReason || item.why,
    problemStatement: item.why,
    visualDirection: item.visual,
    mustKeep: item.keep,
    mustChange: item.change,
    hierarchy: inferSectionHierarchy(item.slotId, item.change),
    actionCue: /cta|action|신청|문의|바로가기|탐색/i.test(`${item.change} ${item.visual}`) ? "explicit" : "supportive",
  }));
}

function buildDesignSpecMarkdown(requirementPlan = {}, plannerInput = {}, sectionBlueprints = []) {
  const budget = buildPlannerBudgetProfile(plannerInput);
  const pageContext = plannerInput?.pageContext || {};
  const pageIdentity = pageContext?.pageIdentity || {};
  const builderBrief = requirementPlan?.builderBrief && typeof requirementPlan?.builderBrief === "object" ? requirementPlan.builderBrief : {};
  const title = String(requirementPlan?.title || pageContext?.pageLabel || "페이지 기획안").trim();
  const referenceEntries = Array.isArray(plannerInput?.referenceSummary?.designReferenceLibrary?.entries)
    ? plannerInput.referenceSummary.designReferenceLibrary.entries
    : [];
  const styleSignals = uniqueNonEmptyLines(
    referenceEntries.flatMap((entry) => toStringArray(entry?.styleSignals || entry?.recommendedFor || [])).slice(0, 12)
  ).slice(0, 8);
  const guardrails = truncateNarrativeList(requirementPlan?.guardrails, budget.guardrails.maxChars).slice(0, budget.guardrails.max);
  const mustKeep = truncateNarrativeList(builderBrief?.mustKeep, budget.mustKeep.maxChars).slice(0, budget.mustKeep.max);
  const mustChange = truncateNarrativeList(builderBrief?.mustChange, budget.mustChange.maxChars).slice(0, budget.mustChange.max);
  return [
    `# ${title} Execution Spec`,
    "",
    "> Builder execution reference. Treat this as an implementation-facing DESIGN.md layer that translates the approved proposal into actionable section rules.",
    "",
    "## Global Spec",
    `- viewport: ${String(pageContext?.viewportLabel || pageContext?.viewportProfile || "PC").trim()}`,
    `- page-role: ${String(pageIdentity?.role || pageContext?.pageLabel || "페이지").trim()}`,
    `- page-purpose: ${String(pageIdentity?.purpose || "").trim() || "기존 페이지 역할을 유지한 채 변경안을 제안한다."}`,
    `- design-intent: ${String(pageIdentity?.designIntent || "").trim() || "브랜드 정체성을 유지하며 설득력 있는 방향성을 강화한다."}`,
    `- change-level: ${normalizeDesignChangeLevel(requirementPlan?.designChangeLevel, "medium")}`,
    `- intervention-layer: ${normalizeInterventionLayer(requirementPlan?.interventionLayer, plannerInput?.userInput?.interventionLayer || "page")}`,
    `- patch-depth: ${normalizePatchDepth(requirementPlan?.patchDepth, plannerInput?.userInput?.patchDepth || "medium")}`,
    `- target-group: ${String(requirementPlan?.targetGroupLabel || requirementPlan?.targetGroupId || plannerInput?.userInput?.targetGroupLabel || plannerInput?.userInput?.targetGroupId || "none").trim()}`,
    `- builder-objective: ${String(builderBrief?.objective || "").trim() || "기획안에 맞는 실행 가능한 시안을 만든다."}`,
    "",
    "## Must Keep",
    ...toMarkdownBulletLines(mustKeep),
    "",
    "## Must Change",
    ...toMarkdownBulletLines(mustChange),
    "",
    "## Visual Guardrails",
    ...toMarkdownBulletLines(guardrails),
    "",
    "## Reference Style Signals",
    ...(styleSignals.length ? toMarkdownBulletLines(styleSignals) : ["- reference style signals: none"]),
    "",
    "## Section Blueprints",
    ...sectionBlueprints.slice(0, budget.blueprintsMax).flatMap((item) => ([
      `### ${item.order}. ${item.label}${item.slotId ? ` (\`${item.slotId}\`)` : ""}`,
      `- archetype: ${item.archetype}`,
      `- container-mode: ${item.containerMode}`,
      `- objective: ${truncateText(item.objective, budget.priority.reasonChars)}`,
      `- problem: ${truncateText(item.problemStatement, budget.planningDirection.maxChars)}`,
      `- visual-direction: ${truncateText(item.visualDirection, budget.designDirection.maxChars)}`,
      `- must-keep: ${truncateText(item.mustKeep, budget.mustKeep.maxChars)}`,
      `- must-change: ${truncateText(item.mustChange, budget.mustChange.maxChars)}`,
      `- hierarchy: ${item.hierarchy.join(" -> ")}`,
      `- action-cue: ${item.actionCue}`,
      "",
    ])),
  ].join("\n").trim();
}

function buildRequirementPlanMarkdownDocs(requirementPlan = {}, plannerInput = {}) {
  const budget = buildPlannerBudgetProfile(plannerInput);
  const pageContext = plannerInput?.pageContext || {};
  const pageIdentity = pageContext?.pageIdentity || {};
  const pageLabel = String(pageContext?.pageLabel || pageContext?.workspacePageId || "페이지").trim();
  const viewportLabel = String(pageContext?.viewportLabel || pageContext?.viewportProfile || "PC").trim();
  const title = String(requirementPlan?.title || `${pageLabel} 시안 기획안`).trim();
  const builderBrief = requirementPlan?.builderBrief && typeof requirementPlan?.builderBrief === "object" ? requirementPlan.builderBrief : {};
  const focusSlots = uniqueNonEmptyLines([
    ...toStringArray(builderBrief.suggestedFocusSlots),
    ...((Array.isArray(requirementPlan?.priority) ? requirementPlan.priority : []).map((item) => String(item?.target || "").trim())),
  ]).slice(0, budget.focusSlotsMax);
  const proposalSectionSpecs = buildProposalSectionSpecs(requirementPlan, pageContext);
  const sectionBlueprints = buildSectionBlueprints(requirementPlan, pageContext);
  const allChangeLines = uniqueNonEmptyLines([
    ...toStringArray(requirementPlan?.requestSummary),
    ...toStringArray(requirementPlan?.planningDirection),
    ...toStringArray(requirementPlan?.designDirection),
    ...toStringArray(builderBrief?.mustChange),
  ]).slice(0, budget.changeChecklistMax).map((line) => truncateText(line, Math.max(budget.designDirection.maxChars, budget.mustChange.maxChars)));
  const builderMarkdown = [
    `# ${title}`,
    "",
    `> 본 문서는 ${pageLabel} ${viewportLabel} 화면에 대한 고객 제안용 기획서 초안입니다. 변경 배경, 목표, 유지 원칙, 변경 원칙, 예상 화면 구성을 한 번에 읽을 수 있도록 정리합니다.`,
    "",
    "## 1. 프로젝트 배경",
    "### 1-1. 페이지의 현재 역할",
    ...toMarkdownBulletLines([
      pageIdentity?.role ? `원래 역할: ${pageIdentity.role}` : "",
      pageIdentity?.purpose ? `원래 목적: ${pageIdentity.purpose}` : "",
      pageIdentity?.designIntent ? `기본 디자인 의도: ${pageIdentity.designIntent}` : "",
    ]),
    "",
    "### 1-2. 이번 변경 요청의 배경",
    ...toMarkdownBulletLines(truncateNarrativeList(requirementPlan?.requestSummary, budget.requestSummary.maxChars).slice(0, budget.requestSummary.max)),
    "",
    "## 2. 기획 목표",
    ...toMarkdownBulletLines([
      truncateText(String(builderBrief.objective || "").trim(), budget.objectiveMaxChars),
      `변화 강도: ${normalizeDesignChangeLevel(requirementPlan?.designChangeLevel, "medium")} — 이번 제안이 어느 정도 체감 변화를 목표로 하는지 명시합니다.`,
    ]),
    "",
    "## 3. 유지해야 할 기준",
    ...toMarkdownBulletLines(truncateNarrativeList(builderBrief?.mustKeep, budget.mustKeep.maxChars).slice(0, budget.mustKeep.max)),
    "",
    "## 4. 반드시 바뀌어야 할 방향",
    ...toMarkdownBulletLines(truncateNarrativeList(builderBrief?.mustChange, budget.mustChange.maxChars).slice(0, budget.mustChange.max)),
    "",
    "## 5. 상세 기획 방향",
    ...toMarkdownBulletLines(truncateNarrativeList(requirementPlan?.planningDirection, budget.planningDirection.maxChars).slice(0, budget.planningDirection.max)),
    "",
    "## 6. 상세 디자인 방향",
    ...toMarkdownBulletLines(truncateNarrativeList(requirementPlan?.designDirection, budget.designDirection.maxChars).slice(0, budget.designDirection.max)),
    "",
    "## 7. 우선순위 및 적용 순서",
    ...(Array.isArray(requirementPlan?.priority) ? requirementPlan.priority : []).slice(0, budget.priority.max).map((item) => {
      const target = String(item?.target || "").trim();
      const reason = truncateText(String(item?.reason || "").trim(), budget.priority.reasonChars);
      if (!target) return "";
      return `- ${formatSlotLabel(target)} (\`${target}\`): ${reason || "우선 적용 대상"}`;
    }).filter(Boolean),
    "",
    "## 8. 예상 화면 제안",
    ...proposalSectionSpecs.slice(0, budget.proposalSectionsMax).flatMap((item) => ([
      `### ${item.order}. ${item.label}${item.slotId ? ` (\`${item.slotId}\`)` : ""}`,
      `- 이 화면을 우선 다뤄야 하는 이유: ${truncateText(item.priorityReason, budget.priority.reasonChars)}`,
      `- 이번 구간에서 반드시 해결해야 할 문제: ${truncateText(item.why, budget.planningDirection.maxChars)}`,
      `- 제안하는 시각 해법: ${truncateText(item.visual, budget.designDirection.maxChars)}`,
      `- 유지해야 할 기준: ${truncateText(item.keep, budget.mustKeep.maxChars)}`,
      `- 반드시 반영해야 할 변화: ${truncateText(item.change, budget.mustChange.maxChars)}`,
      "",
    ])),
    "## 9. 포커스 섹션 목록",
    ...focusSlots.map((slotId) => `- ${formatSlotLabel(slotId)} (\`${slotId}\`)`),
    "",
    "## 10. 가드레일",
    ...toMarkdownBulletLines(truncateNarrativeList(requirementPlan?.guardrails, budget.guardrails.maxChars).slice(0, budget.guardrails.max)),
  ].join("\n").trim();

  const layoutMockupMarkdown = [
    `# ${title} Mockup`,
    "",
    `> 아래 와이어프레임은 기획안이 제안한 변경 화면을 섹션 단위로 모두 정리한 초안입니다. 각 화면은 왜 바뀌는지와 어떤 형태로 보여야 하는지를 함께 설명합니다.`,
    "",
    "## 1. 전체 화면 흐름",
    "```text",
    ...buildLayoutMockupLines(viewportLabel, proposalSectionSpecs),
    "```",
    "",
    "## 2. 변경 체크리스트",
    ...toMarkdownBulletLines(allChangeLines),
    "",
    "## 3. 화면별 와이어프레임 상세",
    ...proposalSectionSpecs.slice(0, budget.proposalSectionsMax).flatMap((item) => ([
      `### Screen ${item.order}. ${item.label}${item.slotId ? ` (\`${item.slotId}\`)` : ""}`,
      `- 화면 목적: ${truncateText(item.why, budget.planningDirection.maxChars)}`,
      `- 제안 메시지: ${truncateText(item.change, budget.mustChange.maxChars)}`,
      `- 시각적 처리: ${truncateText(item.visual, budget.designDirection.maxChars)}`,
      `- 유지 조건: ${truncateText(item.keep, budget.mustKeep.maxChars)}`,
      "```text",
      ...buildWireframeBlockLines(item.label, viewportLabel, {
        emphasis: item.change,
        visualCue: item.visual,
        keepNote: item.keep,
      }),
      "```",
      "",
    ])),
    "## 4. 공통 적용 메모",
    ...toMarkdownBulletLines(
      uniqueNonEmptyLines([
        ...toStringArray(requirementPlan?.designDirection),
        ...toStringArray(builderBrief?.mustChange),
      ]).slice(0, budget.changeChecklistMax).map((line) => truncateText(line, budget.designDirection.maxChars))
    ),
  ].join("\n").trim();

  const designSpecMarkdown = buildDesignSpecMarkdown(requirementPlan, plannerInput, sectionBlueprints);

  return {
    builderMarkdown,
    layoutMockupMarkdown,
    designSpecMarkdown,
    sectionBlueprints,
  };
}

function normalizePlannerPriority(value, fallbackTargets = []) {
  const allowedTargets = new Set(toStringArray(fallbackTargets));
  const items = Array.isArray(value) ? value : [];
  const normalized = items
    .map((item, index) => ({
      rank: Number(item?.rank || index + 1) || index + 1,
      target: String(item?.target || "").trim(),
      reason: String(item?.reason || "").trim(),
    }))
    .filter((item) => item.target && (!allowedTargets.size || allowedTargets.has(item.target)));
  if (normalized.length) {
    return normalized.sort((a, b) => a.rank - b.rank).slice(0, 6);
  }
  return fallbackTargets.slice(0, 4).map((target, index) => ({
    rank: index + 1,
    target,
    reason: "현재 편집 가능 슬롯 기준 우선순위",
  }));
}

function normalizePlannerReferenceNotes(value, fallback = []) {
  const items = Array.isArray(value) ? value : [];
  const normalized = items
    .map((item) => ({
      url: String(item?.url || "").trim(),
      takeaways: toStringArray(item?.takeaways),
    }))
    .filter((item) => item.url || item.takeaways.length);
  return normalized.length ? normalized.slice(0, 5) : fallback.slice(0, 5);
}

function normalizeDesignChangeLevel(value, fallback = "medium") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return fallback;
}

function normalizeInterventionLayer(value, fallback = "page") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (["page", "section-group", "component", "element"].includes(normalized)) return normalized;
  return fallback;
}

function normalizePatchDepth(value, fallback = "medium") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (["light", "medium", "strong", "full"].includes(normalized)) return normalized;
  if (normalized === "low") return "light";
  if (normalized === "high") return "strong";
  return fallback;
}

function containsBrokenNarrativeText(value = "") {
  return String(value || "").includes("�");
}

function normalizeNarrativeLine(value = "") {
  const text = String(value || "")
    .replace(/�+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (containsBrokenNarrativeText(text)) return "";
  return text;
}

function tokenizeNarrativeLine(value = "") {
  return normalizeNarrativeLine(value)
    .toLowerCase()
    .replace(/[`"'“”‘’.,:;!?()[\]{}<>|/\\_-]+/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function narrativeLineSimilarity(left = "", right = "") {
  const leftTokens = tokenizeNarrativeLine(left);
  const rightTokens = tokenizeNarrativeLine(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let intersection = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) intersection += 1;
  });
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

function uniqueNonEmptyLines(values = []) {
  const lines = Array.isArray(values) ? values : [];
  const next = [];
  for (const item of lines) {
    const normalized = normalizeNarrativeLine(item);
    if (!normalized) continue;
    if (next.some((existing) => existing === normalized || narrativeLineSimilarity(existing, normalized) >= 0.82)) {
      continue;
    }
    next.push(normalized);
  }
  return next;
}

function ensureNarrativeDepth(values = [], fallback = [], minCount = 5) {
  const primary = uniqueNonEmptyLines(Array.isArray(values) ? values : []);
  if (primary.length >= minCount) return primary;
  return uniqueNonEmptyLines([...(Array.isArray(values) ? values : []), ...(Array.isArray(fallback) ? fallback : [])]);
}

function boundedNarrativeDepth(values = [], fallback = [], minCount = 5, maxCount = 8) {
  const maxAllowed = Math.max(minCount, maxCount);
  return ensureNarrativeDepth(values, fallback, minCount).slice(0, maxAllowed);
}

function describeEditableScopeForCustomer(editableSlots = [], pageLabel = "페이지") {
  const slots = Array.isArray(editableSlots) ? editableSlots.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!slots.length) return `${pageLabel}의 핵심 편집 가능 구간`;
  const groups = [];
  if (slots.some((slotId) => ["header-top", "header-bottom", "hero", "quickmenu"].includes(slotId))) {
    groups.push("상단 진입 구간");
  }
  if (slots.some((slotId) => ["timedeal", "md-choice", "best-ranking", "marketing-area", "subscription"].includes(slotId))) {
    groups.push("주요 프로모션 및 커머스 구간");
  }
  if (slots.some((slotId) => ["space-renewal", "brand-showroom", "latest-product-news", "smart-life"].includes(slotId))) {
    groups.push("브랜드 및 라이프스타일 제안 구간");
  }
  if (slots.some((slotId) => ["summary-banner-2", "missed-benefits", "lg-best-care", "bestshop-guide"].includes(slotId))) {
    groups.push("하단 정보 및 전환 보강 구간");
  }
  if (!groups.length) return `${pageLabel}의 주요 편집 가능 구간`;
  return groups.join(", ");
}

function sanitizeCustomerFacingPlanLine(line = "", plannerInput = {}) {
  const text = String(line || "").trim();
  if (!text) return "";
  const pageLabel = String(plannerInput?.pageContext?.pageLabel || plannerInput?.pageContext?.workspacePageId || "페이지").trim();
  const editableSlots = toStringArray(plannerInput?.pageSummary?.editableSlots);
  const customerScope = describeEditableScopeForCustomer(editableSlots, pageLabel);
  const rawSlotMention = /(header-top|header-bottom|hero|quickmenu|md-choice|timedeal|best-ranking|marketing-area|subscription|space-renewal|brand-showroom|latest-product-news|smart-life|summary-banner-2|missed-benefits|lg-best-care|bestshop-guide)/i;
  const rawSchemaMention = /(badge|title|subtitle|description|ctaLabel|visibility|styles|slot|component|patch schema|rootkeys|stylekeys)/i;
  if ((text.includes("허용 범위") || text.includes("편집 가능한")) && (rawSlotMention.test(text) || rawSchemaMention.test(text))) {
    return `이번 제안은 ${customerScope}을 중심으로 진행되며, 고객이 실제로 체감하는 메시지 위계, 설명 밀도, 강조 포인트, 행동 유도 요소를 조정하는 범위 안에서 설계됩니다.`;
  }
  return text;
}

function convertLineToProposalTone(line = "", pageLabel = "페이지") {
  const text = String(line || "").trim();
  if (!text) return "";
  if (/[습니다.]$/.test(text)) return text;
  if (/^이번 /.test(text) || /^현재 /.test(text) || /^기획 /.test(text) || /^디자인 /.test(text)) {
    return `${text} 입니다.`;
  }
  return `${pageLabel} 관점에서 ${text}`;
}

function buildPlannerNarrativeFallbacks(plannerInput = {}) {
  const pageLabel = String(plannerInput?.pageContext?.pageLabel || plannerInput?.pageContext?.workspacePageId || "페이지").trim();
  const requestText = String(plannerInput?.userInput?.requestText || "").trim();
  const keyMessage = String(plannerInput?.userInput?.keyMessage || "").trim();
  const preferredDirection = String(plannerInput?.userInput?.preferredDirection || "").trim();
  const avoidDirection = String(plannerInput?.userInput?.avoidDirection || "").trim();
  const toneAndMood = String(plannerInput?.userInput?.toneAndMood || "").trim();
  const designChangeLevel = normalizeDesignChangeLevel(plannerInput?.userInput?.designChangeLevel, "medium");
  const editableSlots = toStringArray(plannerInput?.pageSummary?.editableSlots);
  const focusSlots = editableSlots.slice(0, 6);
  const customerScope = describeEditableScopeForCustomer(editableSlots, pageLabel);
  const referenceTakeaways = ((plannerInput?.referenceSummary?.analyses || []) || [])
    .flatMap((item) => toStringArray(item?.takeaways))
    .slice(0, 4);
  const changeProfileLabel =
    designChangeLevel === "high"
      ? "시각적 체감 변화가 분명해야 하는 고강도 제안"
      : designChangeLevel === "low"
        ? "현재 구조와 정보 체계를 최대한 유지하는 저강도 제안"
        : "기존 구조는 유지하되 체감 개선이 필요한 중강도 제안";

  return {
    requestSummary: uniqueNonEmptyLines([
      requestText ? `고객이 현재 화면 변경을 요청한 직접 원인은 "${requestText}" 이며, 이번 정리본은 이 요청을 실행 가능한 기획 언어로 재해석해야 한다.` : "",
      keyMessage ? `핵심 메시지는 "${keyMessage}" 이고, 변경 이후 사용자가 가장 먼저 인지해야 하는 포인트도 여기에 맞춰 재정렬되어야 한다.` : "",
      `이번 제안은 ${pageLabel}의 디자인을 왜 바꾸는지부터 설명해야 하며, 단순 취향 변경이 아니라 고객 설득이 가능한 개선 배경을 포함해야 한다.`,
      `이번 제안의 편집 범위는 ${customerScope} 중심이며, 전체 재설계가 아니라 제한된 범위 안에서 변화 체감을 만드는 것이 목적이다.`,
      `변화 강도는 ${changeProfileLabel} 로 해석하고, 고객 기대 수준과 운영 안정성 사이의 균형을 기획 문서 안에서 명확히 설명해야 한다.`,
      referenceTakeaways.length ? `레퍼런스 분석에서 추출된 주요 신호는 ${referenceTakeaways.join(" / ")} 이며, 이를 복제하지 않고 방향성 판단 근거로만 활용해야 한다.` : "",
    ]),
    planningDirection: uniqueNonEmptyLines([
      `기획 방향의 첫 축은 문제 정의다. 현재 ${pageLabel} 에서 무엇이 약하게 느껴지고 왜 지금 이 화면을 바꿔야 하는지 서두에서 분명하게 설명해야 한다.`,
      `기획 방향의 둘째 축은 정보 위계 재정렬이다. 가장 먼저 보여야 할 메시지, 신뢰를 보강할 근거, 다음 행동으로 이어질 요소의 순서를 다시 설계해야 한다.`,
      `기획 방향의 셋째 축은 범위 통제다. ${focusSlots[0] ? `${focusSlots[0]} 를 중심으로` : "핵심 슬롯을 중심으로"} 변화 체감을 만들되, 유지해야 할 구조와 새로 제안할 표현을 구분해서 서술해야 한다.`,
      `이 정리본은 고객이 읽는 기획서 역할을 하므로, 무엇을 바꾸는지보다 왜 그 방향이 적절한지와 어떤 효과를 기대하는지를 더 구체적으로 설명해야 한다.`,
      `빌더가 바로 실행할 수 있도록 유지 요소, 변경 요소, 우선순위, 금지 조건을 모호하지 않게 나눠 적는 것이 중요하다.`,
      preferredDirection ? `선호 방향 "${preferredDirection}" 은 단순 취향 메모가 아니라 화면 전략과 설득 포인트로 확장해 설명해야 한다.` : "",
    ]),
    designDirection: uniqueNonEmptyLines([
      `디자인 방향은 ${pageLabel} 의 현재 구조를 유지하되, 첫 인상에서 느껴지는 브랜드 밀도와 메시지 집중도를 높이는 쪽으로 정리해야 한다.`,
      `비주얼 해법은 카피 톤, 타이포 위계, 여백, 강조 포인트, CTA 존재감처럼 실제 화면에서 확인 가능한 기준으로 설명되어야 한다.`,
      `가장 먼저 보여야 할 정보와 그 다음에 따라오는 보조 정보의 강약을 분명히 나눠, 사용자가 한 번에 핵심을 읽도록 해야 한다.`,
      `과한 프로모션성 표현이나 할인몰 인상 대신, 이유 있는 프리미엄 톤과 정제된 설득 흐름을 만드는 것이 중요하다.`,
      toneAndMood ? `톤앤무드 "${toneAndMood}" 는 추상 키워드로 끝내지 말고 배경 밀도, 텍스트 호흡, 시각적 대비 수준처럼 디자인 언어로 번역해야 한다.` : "",
      avoidDirection ? `특히 "${avoidDirection}" 같은 인상은 피해야 하므로, 과밀한 배치나 과도한 장식, 공격적 가격 강조는 억제하는 방향이 적절하다.` : "",
      preferredDirection ? `원하는 방향 "${preferredDirection}" 은 비주얼 스타일뿐 아니라 섹션 리듬과 카피 인상까지 포함하는 화면 운영 원칙으로 정리해야 한다.` : "",
    ]),
    objectiveNarrative: uniqueNonEmptyLines([
      keyMessage ? `이번 기획의 최종 목표는 고객이 중요하게 본 "${keyMessage}" 를 화면 첫 인상에서 더 분명하게 전달하도록 만드는 것이다.` : "",
      `이번 기획의 목표는 ${pageLabel} 을 단순히 새롭게 보이게 하는 것이 아니라, 왜 이 방향이 더 설득력 있는지 고객이 바로 이해할 수 있는 제안 상태로 끌어올리는 데 있다.`,
      `따라서 목표 문구는 결과 화면이 전달해야 할 사용자 인상, 브랜드 태도, 정보 우선순위를 함께 설명하는 문장이어야 한다.`,
    ]),
    mustKeepNarrative: uniqueNonEmptyLines([
      "지원되는 슬롯 구조는 유지해야 한다. 이번 작업은 전체 재설계가 아니라 제한된 편집 시스템 안에서 설득력 있는 개선안을 제시하는 프리뷰 성격이기 때문이다.",
      "핵심 사용자 흐름은 유지해야 한다. 사용자가 기존에 익숙한 탐색 방식이 깨지면 디자인 개선보다 사용성 저하가 먼저 인지될 수 있기 때문이다.",
      "가격/스펙/상품 사실 정보는 유지해야 한다. 고객 설득 자료에서 사실 정보 왜곡은 바로 신뢰 저하로 이어지기 때문이다.",
    ]),
    mustChangeNarrative: uniqueNonEmptyLines([
      focusSlots[0] ? `${focusSlots[0]} 영역은 반드시 바뀌어야 한다. 고객이 가장 먼저 체감하는 구간이므로 여기서 변화 이유와 브랜드 인상이 동시에 드러나야 하기 때문이다.` : "",
      focusSlots[1] ? `${focusSlots[1]} 영역은 보조적으로라도 바뀌어야 한다. 메인 메시지 변화가 페이지 전체 리듬과 연결되어 보이도록 후속 설득 포인트가 필요하기 때문이다.` : "",
      "카피 톤과 시각 위계는 반드시 재정리해야 한다. 이번 요청의 핵심은 단순 장식 변경이 아니라 화면이 전달하는 의미와 인상을 다시 설계하는 데 있기 때문이다.",
    ]),
  };
}

function formatPromptSection(title, lines = []) {
  const normalizedLines = (Array.isArray(lines) ? lines : [])
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  if (!normalizedLines.length) return "";
  return [`## ${String(title || "").trim()}`, ...normalizedLines].join("\n");
}

function formatPromptNumberedList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item, index) => `${index + 1}. ${item}`);
}

function buildPlannerSystemPrompt(plannerInput = {}) {
  const budget = buildPlannerBudgetProfile(plannerInput);
  return [
    formatPromptSection("Role", formatPromptNumberedList([
      "You are the Planner LLM for an admin preview workbench.",
      "Act as a senior digital strategist who turns a request into a preview-ready plan before any build step starts.",
      "Your job is to interpret the request, organize reference intent, define planning direction, define visual direction, set priorities, and hand a clear builder brief to the next model.",
    ])),
    formatPromptSection("NOT Your Role", formatPromptNumberedList([
      "Do not write patch operations, choose unsupported tools, save versions, or perform implementation commands.",
      "Do not drift into generic maintenance advice or production delivery tasks.",
      "Do not copy reference layouts or text verbatim.",
    ])),
    formatPromptSection("How To Use The Context", formatPromptNumberedList([
      "Treat pageContext.pageIdentity as the first hard brief. The page's original role, purpose, must-preserve qualities, and avoid patterns must appear in the plan before you discuss change ideas.",
      "Treat userInput.interventionLayer as a hard scoping signal and userInput.patchDepth as a separate structural intensity signal.",
      "Treat pageContext.viewportProfile and pageContext.viewportLabel as hard brief context. Do not mix desktop, tablet, and mobile assumptions.",
      "If referenceSummary.designReferenceLibrary is provided, use it as a curated DESIGN.md-style shelf for mood, hierarchy logic, density, and section rhythm without literal copying.",
      "If referenceSummary.designReferenceLibrary.referenceAnchors or referenceVisualAssets are provided, use them as the strongest structured reference contracts for hierarchy, surface tone, and component rhythm.",
      "If referenceSummary.assetPipelineStarter, componentRebuildSchemaCatalog, or pagePromptBlueprints.activeBlueprint are provided, follow them as the preferred asset, schema-family, and page-level planning contracts.",
      "Interpret designChangeLevel as the allowed exploration width for visual change while still prioritizing the brand baseline.",
    ])),
    formatPromptSection("Output Rules", formatPromptNumberedList([
      "Return JSON only.",
      "Required top-level keys: summary, requirementPlan.",
      "Required requirementPlan keys: title, designChangeLevel, interventionLayer, patchDepth, targetGroupId, targetGroupLabel, targetComponents, requestSummary, planningDirection, designDirection, priority, guardrails, referenceNotes, builderBrief, builderMarkdown, layoutMockupMarkdown, designSpecMarkdown, sectionBlueprints.",
      "builderBrief must include objective, mustKeep, mustChange, suggestedFocusSlots.",
      "builderMarkdown must read like customer-facing proposal material with a clear beginning-middle-end structure.",
      "layoutMockupMarkdown must include fenced text blocks and a detailed wireframe section for every proposed screen or section.",
      "designSpecMarkdown must translate the proposal into a builder-facing execution spec with global rules, must-keep / must-change, guardrails, and section blueprints.",
      "sectionBlueprints must be an array of section-level execution specs including order, slotId when known, label, archetype, objective, problemStatement, visualDirection, mustKeep, mustChange, hierarchy, and actionCue.",
      "Preserve facts about products, prices, and specs.",
    ])),
    formatPromptSection("Budget Rules", formatPromptNumberedList([
      `requestSummary must contain ${budget.requestSummary.min} to ${budget.requestSummary.max} detailed bullets, each ideally under ${budget.requestSummary.maxChars} characters.`,
      `planningDirection must contain ${budget.planningDirection.min} to ${budget.planningDirection.max} detailed bullets, each ideally under ${budget.planningDirection.maxChars} characters.`,
      `designDirection must contain ${budget.designDirection.min} to ${budget.designDirection.max} detailed bullets, each ideally under ${budget.designDirection.maxChars} characters.`,
      `suggestedFocusSlots should stay within ${budget.focusSlotsMax} slots.`,
      `priority should stay within ${budget.priority.max} items and each reason should stay under ${budget.priority.reasonChars} characters.`,
      `guardrails should stay within ${budget.guardrails.max} items and each guardrail should stay under ${budget.guardrails.maxChars} characters.`,
      "For priority, every item must explain not only what is prioritized but why that target should come first in customer-impact terms.",
      "For builderBrief.objective, write a sentence-level objective that explains what success should look like and why that outcome matters to the customer.",
      "For builderBrief.mustKeep and builderBrief.mustChange, each bullet must include both the directive and the reason. Do not write bare nouns or short fragments.",
      "Do not output shorthand bullets like 'hero 개선' or '고급감 강화'. Every bullet should read like proposal copy spoken to a customer.",
    ])),
  ].filter(Boolean).join("\n\n");
}

function buildPlannerPromptPayload(plannerInput = {}) {
  const pageContext = plannerInput?.pageContext || {};
  const workspaceContext = plannerInput?.workspaceContext || {};
  const userInput = plannerInput?.userInput || {};
  const pageSummary = plannerInput?.pageSummary || {};
  const referenceSummary = plannerInput?.referenceSummary || {};
  const guardrailBundle = plannerInput?.guardrailBundle || {};
  const designReferenceLibrary = referenceSummary?.designReferenceLibrary || {};
  const referenceAnchors = Array.isArray(designReferenceLibrary?.referenceAnchors)
    ? designReferenceLibrary.referenceAnchors
    : [];
  const assetPipelineStarter = referenceSummary?.assetPipelineStarter || {};
  const styleRuntimeTokenPresets = referenceSummary?.styleRuntimeTokenPresets || {};
  const componentRebuildSchemaCatalog = referenceSummary?.componentRebuildSchemaCatalog || {};
  const pagePromptBlueprints = referenceSummary?.pagePromptBlueprints || {};
  const budget = buildPlannerBudgetProfile(plannerInput);
  const compactScope = budget.interventionLayer !== "page";
  return {
    pageContext: {
      workspacePageId: pageContext?.workspacePageId || null,
      runtimePageId: pageContext?.runtimePageId || null,
      pageLabel: pageContext?.pageLabel || null,
      pageGroup: pageContext?.pageGroup || null,
      viewportProfile: pageContext?.viewportProfile || null,
      viewportLabel: pageContext?.viewportLabel || null,
      pageIdentity: pageContext?.pageIdentity || {},
    },
    workspaceContext: {
      currentWorkingVersionId: compactScope ? null : (workspaceContext?.currentWorkingVersionId || null),
      currentViewVersionId: compactScope ? null : (workspaceContext?.currentViewVersionId || null),
      recentVersionCount: compactScope ? 0 : (workspaceContext?.recentVersionCount || 0),
    },
    userInput: {
      requestText: String(userInput?.requestText || "").trim(),
      keyMessage: String(userInput?.keyMessage || "").trim(),
      preferredDirection: String(userInput?.preferredDirection || "").trim(),
      avoidDirection: String(userInput?.avoidDirection || "").trim(),
      toneAndMood: String(userInput?.toneAndMood || "").trim(),
      referenceUrls: toStringArray(userInput?.referenceUrls).slice(0, 5),
      designChangeLevel: userInput?.designChangeLevel || "medium",
      interventionLayer: userInput?.interventionLayer || "page",
      patchDepth: userInput?.patchDepth || "medium",
      targetScope: userInput?.targetScope || "page",
      targetComponents: toStringArray(userInput?.targetComponents).slice(0, 20),
      targetGroupId: String(userInput?.targetGroupId || "").trim(),
      targetGroupLabel: String(userInput?.targetGroupLabel || "").trim(),
      scopePreset: String(userInput?.scopePreset || "").trim(),
    },
    pageSummary: {
      editableSlots: toStringArray(pageSummary?.editableSlots).slice(0, 20),
      existingComponents: toStringArray(pageSummary?.existingComponents).slice(0, 20),
      currentPatchSummary: safeArray(pageSummary?.currentPatchSummary, compactScope ? 6 : 12).map((item) => ({
        componentId: String(item?.componentId || "").trim(),
        sourceId: item?.sourceId || null,
        patchedKeys: toStringArray(item?.patchedKeys).slice(0, 12),
        updatedAt: item?.updatedAt || null,
      })),
      targeting: pageSummary?.targeting || {},
      groupPresets: safeArray(pageSummary?.groupPresets, 8).map((item) => ({
        id: String(item?.id || "").trim(),
        label: String(item?.label || "").trim(),
        kind: String(item?.kind || "").trim(),
        componentIds: toStringArray(item?.componentIds).slice(0, 12),
      })),
      capabilityProfile: pageSummary?.capabilityProfile || {},
    },
    referenceSummary: {
      analyses: safeArray(referenceSummary?.analyses, 5).map((item) => ({
        requestedUrl: String(item?.requestedUrl || item?.finalUrl || "").trim(),
        title: String(item?.title || "").trim(),
        takeaways: toStringArray(item?.takeaways).slice(0, 5),
        toneSignals: toStringArray(item?.toneSignals).slice(0, 5),
        slotMatches: safeArray(item?.slotMatches, 6).map((match) => ({
          slotId: String(match?.slotId || "").trim(),
          reason: String(match?.reason || "").trim(),
        })),
      })),
      designReferenceLibrary: {
        pageType: designReferenceLibrary?.pageType || null,
        viewportProfile: designReferenceLibrary?.viewportProfile || null,
        identitySignals: toStringArray(designReferenceLibrary?.identitySignals).slice(0, 8),
        count: Number(designReferenceLibrary?.count || 0),
        entries: safeArray(designReferenceLibrary?.entries, compactScope ? 2 : 4).map((entry) => ({
          id: String(entry?.id || "").trim(),
          title: String(entry?.title || "").trim(),
          provider: String(entry?.provider || "").trim(),
          sampleClass: String(entry?.sampleClass || "").trim(),
          tags: toStringArray(entry?.tags).slice(0, 6),
          styleSignals: toStringArray(entry?.styleSignals).slice(0, 6),
          identityOverlap: toStringArray(entry?.identityOverlap).slice(0, 6),
          usageNotes: toStringArray(entry?.usageNotes).slice(0, 4),
        })),
        referenceAnchors: safeArray(referenceAnchors, compactScope ? 2 : 4).map((anchor) => ({
          id: String(anchor?.id || "").trim(),
          label: String(anchor?.label || "").trim(),
          sourceName: String(anchor?.sourceName || "").trim(),
          sourceClass: String(anchor?.sourceClass || "").trim(),
          targetLayer: String(anchor?.targetLayer || "").trim(),
          targetComponents: toStringArray(anchor?.targetComponents).slice(0, 8),
          intentTags: toStringArray(anchor?.intentTags).slice(0, 6),
          why: toStringArray(anchor?.why).slice(0, 3),
          avoid: toStringArray(anchor?.avoid).slice(0, 3),
          captureMode: String(anchor?.captureMode || "url-only").trim(),
          sourceUrl: String(anchor?.sourceUrl || "").trim(),
          screenshotUrls: toStringArray(anchor?.screenshotUrls).slice(0, 2),
        })),
        referenceVisualAssets: readReferenceVisualAssets(plannerInput).map((asset) => ({
          id: asset.id,
          label: asset.label,
          sourceName: asset.sourceName,
          sourceClass: asset.sourceClass,
          targetLayer: asset.targetLayer,
          targetComponents: safeArray(asset.targetComponents, 8),
          why: safeArray(asset.why, 3),
        })),
      },
      assetPipelineStarter: {
        pageId: assetPipelineStarter?.pageId || null,
        pageDefaults: assetPipelineStarter?.pageDefaults || null,
        familyDefaults:
          assetPipelineStarter?.familyDefaults && typeof assetPipelineStarter.familyDefaults === "object"
            ? assetPipelineStarter.familyDefaults
            : {},
        componentDefaults:
          assetPipelineStarter?.componentDefaults && typeof assetPipelineStarter.componentDefaults === "object"
            ? assetPipelineStarter.componentDefaults
            : {},
        iconSets: safeArray(assetPipelineStarter?.iconSets, compactScope ? 4 : 6).map((item) => ({
          id: String(item?.id || "").trim(),
          label: String(item?.label || item?.name || "").trim(),
        })),
        badgePresets: safeArray(assetPipelineStarter?.badgePresets, compactScope ? 4 : 6).map((item) => ({
          id: String(item?.id || "").trim(),
          label: String(item?.label || item?.name || "").trim(),
        })),
        visualSets: safeArray(assetPipelineStarter?.visualSets, compactScope ? 4 : 6).map((item) => ({
          id: String(item?.id || "").trim(),
          label: String(item?.label || item?.name || "").trim(),
        })),
        thumbnailPresets: safeArray(assetPipelineStarter?.thumbnailPresets, compactScope ? 4 : 6).map((item) => ({
          id: String(item?.id || "").trim(),
          label: String(item?.label || item?.name || "").trim(),
        })),
      },
      styleRuntimeTokenPresets: {
        version: Number(styleRuntimeTokenPresets?.version || 0) || 0,
        presets: safeArray(styleRuntimeTokenPresets?.presets, compactScope ? 6 : 10).map((item) => ({
          id: String(item?.id || "").trim(),
          slotGroup: String(item?.slotGroup || "").trim(),
          surfaceTone: String(item?.surfaceTone || "").trim(),
          density: String(item?.density || "").trim(),
          hierarchyEmphasis: String(item?.hierarchyEmphasis || "").trim(),
        })),
      },
      componentRebuildSchemaCatalog: {
        pageId: componentRebuildSchemaCatalog?.pageId || null,
        viewportProfile: componentRebuildSchemaCatalog?.viewportProfile || null,
        families: safeArray(componentRebuildSchemaCatalog?.families, compactScope ? 4 : 8).map((item) => ({
          id: String(item?.id || "").trim(),
          label: String(item?.label || item?.name || "").trim(),
        })),
        assignments: safeArray(componentRebuildSchemaCatalog?.assignments, compactScope ? 6 : 12).map((item) => ({
          componentId: String(item?.componentId || "").trim(),
          familyId: String(item?.familyId || "").trim(),
        })),
      },
      pagePromptBlueprints: {
        version: Number(pagePromptBlueprints?.version || 0) || 0,
        pageCount: Number(pagePromptBlueprints?.pageCount || 0) || 0,
        activeBlueprint: pagePromptBlueprints?.activeBlueprint && typeof pagePromptBlueprints.activeBlueprint === "object"
          ? {
              blueprintId: pagePromptBlueprints.activeBlueprint.blueprintId || "",
              label: pagePromptBlueprints.activeBlueprint.label || "",
              implementationStatus: pagePromptBlueprints.activeBlueprint.implementationStatus || "",
              pagePrompt: pagePromptBlueprints.activeBlueprint.pagePrompt || {},
              clusters: safeArray(pagePromptBlueprints.activeBlueprint.clusters, 4),
              sectionPrompts: safeArray(pagePromptBlueprints.activeBlueprint.sectionPrompts, 8),
              rendererStrategy: pagePromptBlueprints.activeBlueprint.rendererStrategy || {},
            }
          : null,
      },
    },
    guardrailBundle: {
      rules: toStringArray(guardrailBundle?.rules).slice(0, 16),
    },
  };
}

function buildPlannerUserPrompt(plannerInput) {
  const compactPlannerInput = buildPlannerPromptPayload(plannerInput);
  const budget = buildPlannerBudgetProfile(plannerInput);
  return [
    "Use the following structured planner input.",
    "Create a planning-document-level requirement plan that a human can edit before build.",
    "Do not mention slots or components outside the provided editable scope unless you are explicitly warning that they must remain unchanged.",
    "Read userInput.interventionLayer and userInput.patchDepth before writing the plan. Scope and patch depth should change both the breadth of the proposal and the wording of the recommendation.",
    "Do not enumerate internal slot ids, component ids, patch keys, or raw schema names in customer-facing prose. Convert the editable scope into plain business language such as upper entry area, key commerce sections, or lower information sections.",
    "Start from the page's original purpose and identity first. Explain what the page is supposed to do before explaining how the requested change should be applied.",
    "Spend more detail on why the design should change, what customer problem it solves, and what visual direction should be approved before build.",
    "Write in a customer-facing proposal tone. The customer should be able to read each section and understand the rationale behind priority, what must remain, what must change, and what goal the proposal is trying to achieve.",
    "In planningDirection and designDirection, explicitly explain the reasons behind priority, mustKeep, mustChange, and objective. These sections should read like the narrative explanation of the plan, not separate disconnected bullets.",
    "Also create a builder-friendly markdown brief inspired by DESIGN.md-style design docs so the next model can interpret structure, hierarchy, and intent more reliably.",
    "Also create a markdown mockup/wireframe that sketches the page in section order for the current viewport. This mockup should help the builder visualize placement and rhythm without inventing unsupported structure.",
    "Follow this scope-specific output budget.",
    JSON.stringify(budget, null, 2),
    JSON.stringify(compactPlannerInput, null, 2),
  ].join("\n\n");
}

function buildDemoPlannerResult(plannerInput = {}) {
  const budget = buildPlannerBudgetProfile(plannerInput);
  const pageLabel = String(plannerInput?.pageContext?.pageLabel || plannerInput?.pageContext?.workspacePageId || "페이지").trim();
  const requestText = String(plannerInput?.userInput?.requestText || "").trim();
  const keyMessage = String(plannerInput?.userInput?.keyMessage || "").trim();
  const preferredDirection = String(plannerInput?.userInput?.preferredDirection || "").trim();
  const avoidDirection = String(plannerInput?.userInput?.avoidDirection || "").trim();
  const designChangeLevel = normalizeDesignChangeLevel(plannerInput?.userInput?.designChangeLevel, "medium");
  const editableSlots = toStringArray(plannerInput?.pageSummary?.editableSlots);
  const focusSlots = editableSlots.slice(0, 6);
  const fallbackNarrative = buildPlannerNarrativeFallbacks(plannerInput);
  const referenceNotes = ((plannerInput?.referenceSummary?.analyses || []) || [])
    .filter((item) => item?.requestedUrl)
    .map((item) => ({
      url: String(item.requestedUrl || item.finalUrl || "").trim(),
      takeaways: toStringArray(item?.takeaways),
    }))
    .slice(0, 5);
  const requirementPlan = {
    title: `${pageLabel} 시안 기획안`,
    designChangeLevel,
    interventionLayer: normalizeInterventionLayer(plannerInput?.userInput?.interventionLayer, "page"),
    patchDepth: normalizePatchDepth(plannerInput?.userInput?.patchDepth, designChangeLevel === "low" ? "light" : designChangeLevel === "high" ? "strong" : "medium"),
    targetGroupId: String(plannerInput?.userInput?.targetGroupId || "").trim(),
    targetGroupLabel: String(plannerInput?.userInput?.targetGroupLabel || "").trim(),
    targetComponents: toStringArray(plannerInput?.userInput?.targetComponents).slice(0, 50),
    requestSummary: boundedNarrativeDepth(
      [
        requestText || `${pageLabel} 방향 정리`,
        keyMessage ? `핵심 메시지: ${keyMessage}` : "",
      ].filter(Boolean),
      fallbackNarrative.requestSummary,
      budget.requestSummary.min,
      budget.requestSummary.max
    ).map((line) => truncateText(convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel), budget.requestSummary.maxChars)),
    planningDirection: boundedNarrativeDepth(
      [
        focusSlots[0] ? `${focusSlots[0]} 영역을 우선적으로 재정리한다.` : "",
        focusSlots[1] ? `${focusSlots[1]} 영역을 보조 시안 포인트로 사용한다.` : "",
      ].filter(Boolean),
      fallbackNarrative.planningDirection,
      budget.planningDirection.min,
      budget.planningDirection.max
    ).map((line) => truncateText(convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel), budget.planningDirection.maxChars)),
    designDirection: boundedNarrativeDepth(
      [
        preferredDirection ? preferredDirection : "",
        avoidDirection ? `${avoidDirection} 방향은 피한다.` : "",
      ].filter(Boolean),
      fallbackNarrative.designDirection,
      budget.designDirection.min,
      budget.designDirection.max
    ).map((line) => truncateText(convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel), budget.designDirection.maxChars)),
    priority: normalizePlannerPriority([], focusSlots).slice(0, budget.priority.max).map((item) => ({
      ...item,
      reason: truncateText(item.reason, budget.priority.reasonChars),
    })),
    guardrails: toStringArray(
      plannerInput?.guardrailBundle?.rules,
      ["사실 기반 가격/스펙/상품 정보는 임의 변경 금지"]
    ).map((line) => truncateText(line, budget.guardrails.maxChars)).slice(0, budget.guardrails.max),
    referenceNotes,
    builderBrief: {
      objective: truncateText(fallbackNarrative.objectiveNarrative[0] || keyMessage || requestText || `${pageLabel} 방향 정리`, budget.objectiveMaxChars),
      mustKeep: fallbackNarrative.mustKeepNarrative.slice(0, budget.mustKeep.max).map((line) => truncateText(convertLineToProposalTone(line, pageLabel), budget.mustKeep.maxChars)),
      mustChange: fallbackNarrative.mustChangeNarrative.slice(0, budget.mustChange.max).map((line) => truncateText(convertLineToProposalTone(line, pageLabel), budget.mustChange.maxChars)),
      suggestedFocusSlots: focusSlots.slice(0, budget.focusSlotsMax),
    },
  };
  return {
    summary: `${pageLabel} 요구사항 정리 완료`,
    requirementPlan: {
      ...requirementPlan,
      ...buildRequirementPlanMarkdownDocs(requirementPlan, plannerInput),
    },
  };
}

function normalizePlannerResult(result, plannerInput = {}) {
  const budget = buildPlannerBudgetProfile(plannerInput);
  const source = result && typeof result === "object" ? result : {};
  const pageLabel = String(plannerInput?.pageContext?.pageLabel || plannerInput?.pageContext?.workspacePageId || "페이지").trim();
  const editableSlots = toStringArray(plannerInput?.pageSummary?.editableSlots);
  const editableSlotSet = new Set(editableSlots);
  const fallbackNarrative = buildPlannerNarrativeFallbacks(plannerInput);
  const fallbackRefNotes = ((plannerInput?.referenceSummary?.analyses || []) || [])
    .filter((item) => item?.requestedUrl)
    .map((item) => ({
      url: String(item.requestedUrl || item.finalUrl || "").trim(),
      takeaways: toStringArray(item?.takeaways),
    }))
    .slice(0, 5);
  const requirementPlan = source.requirementPlan && typeof source.requirementPlan === "object" ? source.requirementPlan : {};
  const builderBrief = requirementPlan.builderBrief && typeof requirementPlan.builderBrief === "object" ? requirementPlan.builderBrief : {};
  const normalizedTargetComponents = toStringArray(
    requirementPlan.targetComponents,
    toStringArray(plannerInput?.userInput?.targetComponents)
  ).slice(0, 50);
  const normalizedRequirementPlan = {
    title: String(requirementPlan.title || `${pageLabel} 시안 기획안`).trim(),
    designChangeLevel: normalizeDesignChangeLevel(
      requirementPlan.designChangeLevel,
      plannerInput?.userInput?.designChangeLevel || "medium"
    ),
    interventionLayer: normalizeInterventionLayer(
      requirementPlan.interventionLayer,
      plannerInput?.userInput?.interventionLayer || "page"
    ),
    patchDepth: normalizePatchDepth(
      requirementPlan.patchDepth,
      plannerInput?.userInput?.patchDepth || "medium"
    ),
    targetGroupId: String(requirementPlan.targetGroupId || plannerInput?.userInput?.targetGroupId || "").trim(),
    targetGroupLabel: String(requirementPlan.targetGroupLabel || plannerInput?.userInput?.targetGroupLabel || "").trim(),
    targetComponents: normalizedTargetComponents,
    requestSummary: boundedNarrativeDepth(requirementPlan.requestSummary, fallbackNarrative.requestSummary, budget.requestSummary.min, budget.requestSummary.max)
      .map((line) => truncateText(convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel), budget.requestSummary.maxChars)),
    planningDirection: boundedNarrativeDepth(requirementPlan.planningDirection, fallbackNarrative.planningDirection, budget.planningDirection.min, budget.planningDirection.max)
      .map((line) => truncateText(convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel), budget.planningDirection.maxChars)),
    designDirection: boundedNarrativeDepth(requirementPlan.designDirection, fallbackNarrative.designDirection, budget.designDirection.min, budget.designDirection.max)
      .map((line) => truncateText(convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel), budget.designDirection.maxChars)),
    priority: normalizePlannerPriority(requirementPlan.priority, editableSlots).slice(0, budget.priority.max).map((item) => ({
      ...item,
      reason: truncateText(item.reason, budget.priority.reasonChars),
    })),
    guardrails: toStringArray(
      requirementPlan.guardrails,
      toStringArray(plannerInput?.guardrailBundle?.rules, ["사실 기반 가격/스펙/상품 정보는 임의 변경 금지"])
    ).map((line) => truncateText(line, budget.guardrails.maxChars)).slice(0, budget.guardrails.max),
    referenceNotes: normalizePlannerReferenceNotes(requirementPlan.referenceNotes, fallbackRefNotes).slice(0, budget.referenceNotesMax),
    builderBrief: {
      objective: truncateText(String(
        builderBrief.objective ||
        fallbackNarrative.objectiveNarrative[0] ||
        source.summary ||
        `${pageLabel} 방향 정리`
      ).trim(), budget.objectiveMaxChars),
      mustKeep: ensureNarrativeDepth(builderBrief.mustKeep, fallbackNarrative.mustKeepNarrative, budget.mustKeep.min)
        .slice(0, budget.mustKeep.max)
        .map((line) => truncateText(convertLineToProposalTone(line, pageLabel), budget.mustKeep.maxChars)),
      mustChange: ensureNarrativeDepth(builderBrief.mustChange, fallbackNarrative.mustChangeNarrative, budget.mustChange.min)
        .slice(0, budget.mustChange.max)
        .map((line) => truncateText(convertLineToProposalTone(line, pageLabel), budget.mustChange.maxChars)),
      suggestedFocusSlots: toStringArray(builderBrief.suggestedFocusSlots, editableSlots.slice(0, 6))
        .filter((slotId) => !editableSlotSet.size || editableSlotSet.has(slotId))
        .slice(0, budget.focusSlotsMax),
    },
  };
  return {
    summary: String(source.summary || `${pageLabel} 요구사항 정리 완료`).trim(),
    requirementPlan: {
      ...normalizedRequirementPlan,
      ...buildRequirementPlanMarkdownDocs(normalizedRequirementPlan, plannerInput),
    },
  };
}

async function handleLlmPlan(plannerInput) {
  const primaryModel = resolveOpenRouterModel("PLANNER_MODEL", "OPENROUTER_MODEL");
  const configuredFallbackModels = resolveOpenRouterModelCandidates("PLANNER_FALLBACK_MODEL");
  const builderModel = resolveOpenRouterModel("BUILDER_MODEL", "BUILDER_FALLBACK_MODEL", "OPENROUTER_MODEL");
  const fallbackModels = [
    ...configuredFallbackModels,
    ...(builderModel && builderModel !== primaryModel ? [builderModel] : []),
  ].filter((model, index, array) => model && model !== primaryModel && array.indexOf(model) === index);
  const plannerTimeoutMs = Math.max(90_000, Number(process.env.PLANNER_REQUEST_TIMEOUT_MS || process.env.LLM_REQUEST_TIMEOUT_MS || 180_000));
  const plannerMaxTokens = resolveOpenRouterMaxTokens(process.env.PLANNER_MAX_TOKENS, 2048);
  const requestMessages = [
    { role: "system", content: buildPlannerSystemPrompt(plannerInput) },
    {
      role: "user",
      content: buildReferenceVisualUserContent(
        buildPlannerUserPrompt(plannerInput),
        plannerInput,
        "Planner reference screenshots",
        {
          referenceLimit: 0,
          wholePageLimit: 0,
          wholePageMode: "planner-lite",
        }
      ),
    },
  ];
  const plannerPromptChars = measureMessageChars(requestMessages);
  console.log(
    `[planner] model=${primaryModel} fallbackModel=${fallbackModels[0] || "none"} timeoutMs=${plannerTimeoutMs} promptChars=${plannerPromptChars} scope=${String(plannerInput?.userInput?.targetScope || "page")} components=${toStringArray(plannerInput?.userInput?.targetComponents).length}`
  );
  let result;
  try {
    result = await withLlmTimeout(
      callOpenRouterJson({
        model: primaryModel,
        temperature: 0.2,
        demoFallback: () => buildDemoPlannerResult(plannerInput),
        messages: requestMessages,
        timeoutMs: plannerTimeoutMs,
        maxTokens: plannerMaxTokens,
      }),
      "Planner request",
      plannerTimeoutMs
    );
  } catch (error) {
    const shouldRetryWithFallback = fallbackModels.length > 0 && isRetryableOpenRouterFailure(error);
    if (shouldRetryWithFallback) {
      console.warn(`[planner] primary-failed model=${primaryModel} reason=${String(error?.message || error || "").trim()}`);
      let fallbackError = error;
      let recovered = false;
      for (const fallbackModel of fallbackModels) {
        try {
          result = await withLlmTimeout(
            callOpenRouterJson({
              model: fallbackModel,
              temperature: 0.2,
              demoFallback: () => buildDemoPlannerResult(plannerInput),
              messages: requestMessages,
              timeoutMs: plannerTimeoutMs,
              maxTokens: plannerMaxTokens,
            }),
            "Planner fallback request",
            plannerTimeoutMs
          );
          recovered = true;
          break;
        } catch (candidateError) {
          logModelFallbackFailure("planner", fallbackModel, candidateError);
          fallbackError = candidateError;
          if (!isRetryableOpenRouterFailure(candidateError)) throw candidateError;
        }
      }
      if (!recovered) {
        if (!isRetryableOpenRouterFailure(fallbackError)) throw fallbackError;
        console.warn(`[planner] recovery-fallback reason=${String(fallbackError?.message || fallbackError)}`);
        result = buildDemoPlannerResult(plannerInput);
      }
    } else if (isRetryableOpenRouterFailure(error)) {
      console.warn(`[planner] recovery-fallback reason=${String(error?.message || error)}`);
      result = buildDemoPlannerResult(plannerInput);
    } else {
      throw error;
    }
  }
  return normalizePlannerResult(result, plannerInput);
}

function buildBuilderSystemPrompt() {
  return [
    formatPromptSection("Role", formatPromptNumberedList([
      "You are the Builder LLM for an admin preview workbench.",
      "Act as a brand-first preview designer-builder who turns an approved requirement plan into a persuasive page draft inside an existing slot/component system.",
      "Your job is to map the approved plan onto the allowed slot structure, choose the best available editing tool, generate supported operations, and report what changed and why.",
    ])),
    formatPromptSection("NOT Your Role", formatPromptNumberedList([
      "Do not reinterpret the raw customer request from scratch.",
      "Do not invent unsupported slots, unsupported template ids, or unsupported operation formats.",
      "Do not rewrite product facts, prices, or specs.",
      "Do not perform arbitrary full-page generation outside the provided system context.",
    ])),
    formatPromptSection("How To Use The System Context", formatPromptNumberedList([
      "Read designToolContext.visualPrinciples.pageIdentityContext first and use it as the north star. The result must still feel like the same kind of page.",
      "For each target slot, read designToolContext.visualPrinciples.slotGuidanceMap[slotId] before deciding copy, hierarchy, or visual emphasis.",
      "Read approvedPlan.builderBrief.suggestedFocusSlots first and concentrate the strongest visual change there.",
      "Treat generationOptions.interventionLayer, generationOptions.patchDepth, pageContext.viewportProfile, and pageContext.viewportLabel as hard execution constraints.",
      "Treat designToolContext.visualPrinciples.layoutTokens, patchRules, and allowedTokenSets as the preferred generation space when they are provided.",
      "Read approvedPlan.designSpecMarkdown and approvedPlan.sectionBlueprints before choosing operations. Extract layout intent, hierarchy, guardrails, and section-level priorities first.",
      "If compositionResult is provided, treat composition.focusSlots, composition.compositionTree, composition.styleContract, and composition.assetBindings as locked composer intent unless the current patch surface truly blocks them.",
      "If designReferenceLibrary, referenceAnchors, or attached reference screenshots are provided, use them to strengthen hierarchy, surface tone, density, and component rhythm without literal copying.",
      "If assetPipelineStarter, componentRebuildSchemaCatalog, primitiveCompositionCatalog, styleRuntimeTokenPresets, recipeHierarchy, or pagePromptBlueprints.activeBlueprint are provided, treat them as active execution contracts instead of advisory notes.",
      "If sufficiencyGate is provided, use it to decide whether the build should emphasize composition recovery, asset recovery, or stronger visual escalation inside the allowed scope.",
    ])),
    formatPromptSection("Operation Rules", formatPromptNumberedList([
      "Use only allowed slots and supported operation formats.",
      "Respect the provided target scope. If the system context is limited to selected components, do not create operations outside that scope.",
      "Use only replace_component_template, update_component_patch, update_slot_text, update_hero_field, update_slot_image, and update_page_title.",
      "Do not switch slot sources. Never emit toggle_slot_source or slot_source_switch.",
      "Do not activate figma-derived, custom, alternate, experimental, or placeholder sources.",
      "Prefer update_component_patch when you need to change multiple supported root/style fields together on one slot.",
      "Every operation must reference an allowed slotId from editableComponents and may use only patch keys listed in that component's patchSchema.",
      "Treat each component's patchBridge, mediaSpec, layout, and measuredScale as real implementation constraints for width, image treatment, and type scale.",
      "If artifactSectionRegistry, artifactSidecarRegistry, or shareSectionRegistry are provided, align your structure and geometry to those contracts instead of inventing a new structure freely.",
      "If executionStrategy.executionMode ends with -plan, keep executable operations inside the safe patch surface and capture the broader redesign in report.compositionPlan, report.componentComposition, report.assetNeeds, and report.missingCapabilities.",
      "When using update_slot_image, never invent external image URLs. Use only starter asset URLs already available in the provided asset registries.",
      "If a change is described in whatChanged, there should usually be at least one matching operation unless the patch schema truly blocks it.",
      "Preserve facts about products, prices, and specs.",
    ])),
    formatPromptSection("Output Format", formatPromptNumberedList([
      "Return JSON only.",
      "Required top-level keys: summary, buildResult.",
      "Required buildResult keys: proposedVersionLabel, changedTargets, operations, report.",
      "When recipeHierarchy is present, include report.selectedRecipes so later comparisons can see which page, cluster, and section recipes were actually chosen.",
      "Your main job is to produce executable operations, not just a narrative report.",
    ])),
  ].filter(Boolean).join("\n\n");
}

function buildAllowedTokenSets(builderInput = {}) {
  const visualPrinciples = builderInput?.systemContext?.designToolContext?.visualPrinciples || {};
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  const patchRules = visualPrinciples?.patchRules && typeof visualPrinciples.patchRules === "object"
    ? visualPrinciples.patchRules
    : {};
  const bySlotRules = patchRules?.bySlot && typeof patchRules.bySlot === "object" ? patchRules.bySlot : {};
  const globalBackgrounds = toStringArray(patchRules?.global?.backgroundModes);
  const globalTokenSets = {
    backgroundModes: globalBackgrounds,
    sectionPadding: toStringArray(Object.values(visualPrinciples?.layoutTokens?.sectionPadding || {})),
    sectionGap: toStringArray(Object.values(visualPrinciples?.layoutTokens?.sectionGap || {})),
  };
  const byComponent = {};
  for (const item of editableComponents) {
    const componentId = String(item?.componentId || "").trim();
    const slotId = String(item?.slotId || "").trim();
    if (!componentId || !slotId) continue;
    const styleKeys = new Set(Array.isArray(item?.patchSchema?.styleKeys) ? item.patchSchema.styleKeys : []);
    const rule = bySlotRules[slotId] && typeof bySlotRules[slotId] === "object" ? bySlotRules[slotId] : {};
    const componentTokens = {
      rootKeys: Array.isArray(item?.patchSchema?.rootKeys) ? item.patchSchema.rootKeys : [],
      styleKeys: Array.isArray(item?.patchSchema?.styleKeys) ? item.patchSchema.styleKeys : [],
    };
    if (styleKeys.has("titleSize") && rule?.titleSize) {
      const values = [];
      const step = slotId === "hero" ? 4 : 2;
      for (let px = Number(rule.titleSize.min || 0); px <= Number(rule.titleSize.max || 0); px += step) {
        values.push(`${px}px`);
      }
      componentTokens.titleSize = values;
    }
    if (styleKeys.has("subtitleSize") && rule?.subtitleSize) {
      const values = [];
      for (let px = Number(rule.subtitleSize.min || 0); px <= Number(rule.subtitleSize.max || 0); px += 2) {
        values.push(`${px}px`);
      }
      componentTokens.subtitleSize = values;
    }
    if (styleKeys.has("padding")) {
      componentTokens.padding = toStringArray([
        rule?.padding,
        visualPrinciples?.layoutTokens?.sectionPadding?.shell,
        visualPrinciples?.layoutTokens?.sectionPadding?.compact,
      ]);
    }
    if (styleKeys.has("radius")) {
      componentTokens.radius = toStringArray([
        rule?.radius,
        "0px",
        "24px",
        "28px",
      ]);
    }
    if (styleKeys.has("background")) {
      componentTokens.background = toStringArray([
        rule?.defaultBackground,
        "#ffffff",
        "#f8fafc",
      ]);
    }
    if (styleKeys.has("iconSize")) {
      componentTokens.iconSize = ["32px", "36px", "40px", "44px", "48px", "56px"];
    }
    byComponent[componentId] = componentTokens;
  }
  return {
    global: globalTokenSets,
    byComponent,
  };
}

function buildComposerPromptPayload(builderInput = {}) {
  const pageContext = builderInput?.pageContext || {};
  const approvedPlan = builderInput?.approvedPlan || {};
  const generationOptions = builderInput?.generationOptions || {};
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  const designReferenceLibrary = builderInput?.systemContext?.designReferenceLibrary || {};
  const designToolContext = builderInput?.systemContext?.designToolContext || {};
  const sufficiencyGate = builderInput?.systemContext?.sufficiencyGate || {};
  const compareMode = builderInput?.systemContext?.compareMode || {};
  const componentRebuildSchemaCatalog = designToolContext?.componentRebuildSchemaCatalog || {};
  const assetPipelineStarter = designToolContext?.assetPipelineStarter || {};
  const primitiveCompositionCatalog = designToolContext?.primitiveCompositionCatalog || {};
  const styleRuntimeTokenPresets = designToolContext?.styleRuntimeTokenPresets || {};
  const sectionFamilyContracts = designToolContext?.sectionFamilyContracts || {};
  const recipeHierarchy = designToolContext?.recipeHierarchy || {};
  const pagePromptBlueprints = designToolContext?.pagePromptBlueprints || {};
  const compactCompare = String(generationOptions?.builderMode || "standard").trim() === "compare";
  return {
    pageContext: {
      workspacePageId: pageContext.workspacePageId,
      pageLabel: pageContext.pageLabel,
      viewportProfile: pageContext.viewportProfile,
      viewportLabel: pageContext.viewportLabel,
      pageIdentity: pageContext.pageIdentity,
    },
    generationOptions: {
      interventionLayer: generationOptions.interventionLayer,
      targetScope: generationOptions.targetScope,
      targetGroupId: generationOptions.targetGroupId,
      targetComponents: toStringArray(generationOptions.targetComponents),
      designChangeLevel: generationOptions.designChangeLevel,
      patchDepth: generationOptions.patchDepth,
      builderMode: generationOptions.builderMode || "standard",
    },
    compareMode: {
      enabled: Boolean(compareMode?.enabled),
      attempt: Number(compareMode?.attempt || 0) || 0,
      strategy: compareMode?.strategy || "",
      visualRetry: Boolean(compareMode?.visualRetry),
      failedDimensions: safeArray(compareMode?.failedDimensions, compactCompare ? 6 : 8),
      findings: safeArray(compareMode?.findings, compactCompare ? 6 : 8),
      instructions: safeArray(compareMode?.instructions, compactCompare ? 6 : 8),
      visualAssets: {
        beforeLabel: compareMode?.visualAssets?.beforeLabel || null,
        afterLabel: compareMode?.visualAssets?.afterLabel || null,
        referenceLabel: compareMode?.visualAssets?.referenceLabel || null,
        targetSlots: safeArray(compareMode?.visualAssets?.targetSlots, compactCompare ? 6 : 8),
      },
    },
    approvedPlan: {
      summary: approvedPlan.summary,
      requestSummary: safeArray(approvedPlan.requestSummary, 6),
      planningDirection: safeArray(approvedPlan.planningDirection, 6),
      designDirection: safeArray(approvedPlan.designDirection, 6),
      guardrails: safeArray(approvedPlan.guardrails, 8),
      builderBrief: {
        objective: approvedPlan?.builderBrief?.objective || "",
        mustKeep: safeArray(approvedPlan?.builderBrief?.mustKeep, 4),
        mustChange: safeArray(approvedPlan?.builderBrief?.mustChange, 4),
        suggestedFocusSlots: safeArray(approvedPlan?.builderBrief?.suggestedFocusSlots, 6),
      },
    },
    editableComponents: safeArray(editableComponents, compactCompare ? 6 : 8).map((item) => ({
      slotId: item?.slotId,
      componentId: item?.componentId,
      layout: item?.layout || null,
      mediaSpec: item?.mediaSpec || null,
      patchSchema: {
        rootKeys: toStringArray(item?.patchSchema?.rootKeys),
        styleKeys: toStringArray(item?.patchSchema?.styleKeys),
      },
    })),
    designReferenceLibrary: {
      pageType: designReferenceLibrary?.pageType || "",
      viewportProfile: designReferenceLibrary?.viewportProfile || "",
      identitySignals: safeArray(designReferenceLibrary?.identitySignals, compactCompare ? 6 : 8),
      referenceAnchors: safeArray(designReferenceLibrary?.referenceAnchors, compactCompare ? 3 : 4).map((anchor) => ({
        id: anchor?.id,
        label: anchor?.label,
        sourceName: anchor?.sourceName,
        sourceClass: anchor?.sourceClass,
        targetLayer: anchor?.targetLayer,
        targetComponents: safeArray(anchor?.targetComponents, 6),
        intentTags: safeArray(anchor?.intentTags, 6),
        why: safeArray(anchor?.why, 4),
        avoid: safeArray(anchor?.avoid, 4),
      })),
    },
    sufficiencyGate: {
      status: sufficiencyGate?.status || "",
      recoveryMode: sufficiencyGate?.recoveryMode || "",
      missingDimensions: safeArray(sufficiencyGate?.missingDimensions, 8),
      assetNeeds: safeArray(sufficiencyGate?.assetNeeds, 8),
      highImpactVisualTargets: safeArray(sufficiencyGate?.highImpactVisualTargets, compactCompare ? 4 : 6).map((item) => ({
        slotId: item?.slotId || "",
        componentId: item?.componentId || "",
        familyId: item?.familyId || "",
        hasAnyVisualSupport: Boolean(item?.hasAnyVisualSupport),
      })),
    },
    componentRebuildSchemaCatalog: {
      families: safeArray(componentRebuildSchemaCatalog?.families, compactCompare ? 6 : 8).map((family) => ({
        familyId: family?.familyId,
        label: family?.label,
        description: family?.description,
        targetLayers: safeArray(family?.targetLayers, 4),
      })),
      assignments: safeArray(componentRebuildSchemaCatalog?.assignments, compactCompare ? 6 : 10).map((assignment) => ({
        componentId: assignment?.componentId,
        familyId: assignment?.familyId,
      })),
    },
    primitiveCompositionCatalog: {
      primitives: safeArray(primitiveCompositionCatalog?.primitives, compactCompare ? 8 : 12).map((item) => ({
        id: item?.id,
        category: item?.category,
        allowedVariants: safeArray(item?.allowedVariants, 6),
      })),
      pageShell: primitiveCompositionCatalog?.pageShell || null,
      groupShells: primitiveCompositionCatalog?.groupShells && typeof primitiveCompositionCatalog.groupShells === "object"
        ? primitiveCompositionCatalog.groupShells
        : {},
      componentAssignments: safeArray(primitiveCompositionCatalog?.componentAssignments, compactCompare ? 6 : 10).map((item) => ({
        componentId: item?.componentId,
        primitiveIds: safeArray(item?.primitiveIds, 6),
      })),
      templateMappings: primitiveCompositionCatalog?.templateMappings && typeof primitiveCompositionCatalog.templateMappings === "object"
        ? primitiveCompositionCatalog.templateMappings
        : {},
    },
    assetPipelineStarter: {
      pageDefaults: assetPipelineStarter?.pageDefaults && typeof assetPipelineStarter.pageDefaults === "object"
        ? assetPipelineStarter.pageDefaults
        : {},
      familyDefaults:
        assetPipelineStarter?.familyDefaults && typeof assetPipelineStarter.familyDefaults === "object"
          ? assetPipelineStarter.familyDefaults
          : {},
      componentDefaults:
        assetPipelineStarter?.componentDefaults && typeof assetPipelineStarter.componentDefaults === "object"
          ? assetPipelineStarter.componentDefaults
          : {},
    },
    styleRuntimeTokenPresets: {
      version: Number(styleRuntimeTokenPresets?.version || 0) || 0,
      presets: safeArray(styleRuntimeTokenPresets?.presets, compactCompare ? 8 : 12).map((item) => ({
        id: item?.id,
        slotGroup: item?.slotGroup,
        surfaceTone: item?.surfaceTone,
        density: item?.density,
        hierarchyEmphasis: item?.hierarchyEmphasis,
      })),
    },
    sectionFamilyContracts: {
      version: Number(sectionFamilyContracts?.version || 0) || 0,
      global: {
        principles: safeArray(sectionFamilyContracts?.global?.principles, 6),
        successSignals: safeArray(sectionFamilyContracts?.global?.successSignals, 4),
      },
      identityEnvelope: {
        interventionLayer: sectionFamilyContracts?.identityEnvelope?.interventionLayer || null,
        band: sectionFamilyContracts?.identityEnvelope?.band || null,
        label: sectionFamilyContracts?.identityEnvelope?.label || null,
        intent: sectionFamilyContracts?.identityEnvelope?.intent || "",
        preserve: safeArray(sectionFamilyContracts?.identityEnvelope?.preserve, 5),
        allow: safeArray(sectionFamilyContracts?.identityEnvelope?.allow, 5),
        avoid: safeArray(sectionFamilyContracts?.identityEnvelope?.avoid, 5),
        pagePreserve: safeArray(sectionFamilyContracts?.identityEnvelope?.pagePreserve, 4),
        pageAvoid: safeArray(sectionFamilyContracts?.identityEnvelope?.pageAvoid, 4),
      },
      clusters: safeArray(sectionFamilyContracts?.clusters, compactCompare ? 3 : 4).map((item) => ({
        clusterId: item?.clusterId,
        label: item?.label,
        targetSlots: safeArray(item?.targetSlots, 6),
        goal: item?.goal || "",
        rules: safeArray(item?.rules, 5),
        criticRules: safeArray(item?.criticRules, 5),
      })),
      families: safeArray(sectionFamilyContracts?.families, compactCompare ? 4 : 6).map((item) => ({
        familyId: item?.familyId,
        label: item?.label,
        targetSlots: safeArray(item?.targetSlots, 6),
        requiredOutcomes: safeArray(item?.requiredOutcomes, 5),
        visualRules: safeArray(item?.visualRules, 5),
        avoid: safeArray(item?.avoid, 5),
        criticRules: safeArray(item?.criticRules, 5),
      })),
    },
    recipeHierarchy: {
      targetFamilyIds: safeArray(recipeHierarchy?.targetFamilyIds, compactCompare ? 6 : 8),
      authoringRules: safeArray(recipeHierarchy?.authoringRules, 6),
      topStageCluster: recipeHierarchy?.topStageCluster && typeof recipeHierarchy.topStageCluster === "object"
        ? {
            clusterId: recipeHierarchy.topStageCluster.clusterId || "",
            sequence: safeArray(recipeHierarchy.topStageCluster.sequence, 6),
            goal: recipeHierarchy.topStageCluster.goal || "",
            rules: safeArray(recipeHierarchy.topStageCluster.rules, 5),
          }
        : null,
      families: safeArray(recipeHierarchy?.families, compactCompare ? 4 : 8).map((item) => ({
        familyId: item?.familyId || "",
        status: item?.status || "",
        priority: Number(item?.priority || 0) || 0,
        focus: safeArray(item?.focus, 5),
        qualityGateFocus: safeArray(item?.qualityGateFocus, 5),
        topRecipeCandidates: safeArray(item?.topRecipeCandidates, 5),
        selectionRule: item?.selectionRule || "",
        topRecipes: safeArray(item?.topRecipes, compactCompare ? 2 : 3).map((recipe) => ({
          recipeId: recipe?.recipeId || "",
          priority: Number(recipe?.priority || 0) || 0,
          suggestedPrimitive: recipe?.suggestedPrimitive || "",
          qualityObjective: recipe?.qualityObjective || "",
          structureRules: safeArray(recipe?.structureRules, 4),
          qualitySignals: safeArray(recipe?.qualitySignals, 4),
          avoid: safeArray(recipe?.avoid, 4),
        })),
        })),
      },
    pagePromptBlueprints: {
      version: Number(pagePromptBlueprints?.version || 0) || 0,
      pageCount: Number(pagePromptBlueprints?.pageCount || 0) || 0,
      global: {
        promptOrder: safeArray(pagePromptBlueprints?.global?.promptOrder, 4),
        executionModel: safeArray(pagePromptBlueprints?.global?.executionModel, 4),
        rendererPolicy: safeArray(pagePromptBlueprints?.global?.rendererPolicy, 4),
        qualityChecks: safeArray(pagePromptBlueprints?.global?.qualityChecks, 4),
      },
      activeBlueprint: pagePromptBlueprints?.activeBlueprint && typeof pagePromptBlueprints.activeBlueprint === "object"
        ? {
            blueprintId: pagePromptBlueprints.activeBlueprint.blueprintId || "",
            label: pagePromptBlueprints.activeBlueprint.label || "",
            implementationStatus: pagePromptBlueprints.activeBlueprint.implementationStatus || "",
            pagePrompt: pagePromptBlueprints.activeBlueprint.pagePrompt || {},
            clusters: safeArray(pagePromptBlueprints.activeBlueprint.clusters, 4),
            sectionPrompts: safeArray(pagePromptBlueprints.activeBlueprint.sectionPrompts, 8),
            rendererStrategy: pagePromptBlueprints.activeBlueprint.rendererStrategy || {},
          }
        : null,
    },
  };
}

function buildComposerSystemPrompt() {
  return [
    "You are the Composer pass for an admin preview workbench.",
    "Persona: a bold but disciplined visual structure composer who decides what should change, where it should change, and how much structural movement is justified before any executable patch is written.",
    "Your job is not to emit low-level operations. Your job is to define the target composition intent for the selected scope so a later Detailer pass can execute it.",
    "Treat generationOptions.interventionLayer as the hard scope contract. element means only micro composition adjustments inside chosen components, component means one-slot redesign, section-group means multi-slot coordination, and page means the whole selected page surface.",
    "Treat generationOptions.patchDepth as the hard movement contract. light means subtle refinement, medium means clear but controlled movement, strong means visibly different structure, and full means the broadest redesign the current renderer families can still support.",
    "Use approvedPlan, pageContext.pageIdentity, and designReferenceLibrary.referenceAnchors together. Reference anchors are structured inspiration contracts, not copying instructions.",
    "If reference visual screenshots are attached, treat them as stronger evidence than text-only summaries for composition rhythm, hierarchy, and surface treatment.",
    "If systemContext.sufficiencyGate is provided, treat it as the pre-generation readiness contract. recoveryMode and missingDimensions tell you whether stronger asset support, stronger composition movement, or generation-backed recovery is required before the design can reach the requested depth.",
    "If designToolContext.primitiveCompositionCatalog is provided, treat it as the active primitive-kit allowlist. Prefer primitive-first structure using only listed primitive ids and listed variants.",
    "If designToolContext.styleRuntimeTokenPresets is provided, prefer one of its preset ids in styleContract.tokenHints.presetId and align tokenHints with that preset instead of inventing prose-only styling.",
    "If designToolContext.sectionFamilyContracts is provided, treat it as the active generation contract. Use its global principles, cluster rules, and family-specific required outcomes to decide hierarchy, focal dominance, and section rhythm before choosing any layout direction.",
    "If designToolContext.recipeHierarchy is provided, treat it as the page -> cluster -> family recipe ordering. Choose shell rhythm first, then cluster staging, then section recipe detail instead of skipping straight to local decoration.",
    "If compareMode.enabled is true, you are in a fresh-rerun quality compare path. Do not incrementally patch the old idea. Rebuild the composition from scratch using compareMode findings only as critique for what must improve in the next full draft.",
    "If compareMode.visualAssets are attached, inspect the failed after screenshot directly. Use it as primary evidence for what broke in hierarchy, density, and rhythm, and rebuild the next draft from scratch rather than paraphrasing the critic text alone.",
    "If sectionFamilyContracts.identityEnvelope exists, preserve clone identity according to its active band. Narrower scopes must stay more faithful to the surrounding page identity, but still improve hierarchy and clarity inside the allowed target.",
    "When anchors exist, use sourceClass, targetLayer, targetComponents, why, avoid, captureMode, and screenshotUrls to choose the most relevant references for the requested layer.",
    "Prefer decisive structural intent over generic safe language. The output should help the user get a visibly different preview when they requested strong/full change.",
    "Do not rewrite product facts. Do not invent unsupported slots. Do not output executable patch operations in this pass.",
    "Return JSON only.",
    "Required top-level keys: summary, composition.",
    "Required composition keys: focusSlots, referenceUse, compositionTree, styleContract, assetBindings, negativeConstraints.",
  ].join(" ");
}

function buildComposerUserPrompt(builderInput = {}) {
  return [
    "Create the composition intent for the next Detailer pass.",
    "Use the selected scope, approved plan, editable components, reference anchors, schema families, and starter asset ids to decide what the stronger visual structure should be.",
    "The output must prefer a clearly readable composition plan over generic prose.",
    "If sectionFamilyContracts are present, satisfy them explicitly. Hero must establish dominant top-stage hierarchy, and quickmenu must create scanable support rhythm instead of flattening all entries equally.",
    "If recipeHierarchy is present, follow its order explicitly: page shell first, cluster recipe second, family top recipe third. Do not skip the cluster recipe and jump straight to local section styling.",
    "If compareMode.visualAssets are attached, use the failed after screenshot as direct rerun evidence. Replace the weak composition instead of trying to rescue it with small local tweaks.",
    "composition.focusSlots should name the priority slots to change now.",
    "composition.referenceUse should explain which anchors matter for which slots and why.",
    "composition.compositionTree should contain one entry per target slot/component with familyId when available, layoutGoal, hierarchy, visualDirection, preservedElements, changedElements, referenceAnchorIds, assetPlan, and primitiveTree when a supported primitive composition is available.",
    "composition.styleContract should describe slot-level style intent such as surfaceTone, density, hierarchyEmphasis, interactionTone, and tokenHints.",
    "composition.assetBindings should map starter asset ids the Detailer pass should prefer.",
    "composition.negativeConstraints should explicitly name what the Detailer must avoid.",
    JSON.stringify(buildComposerPromptPayload(builderInput), null, 2),
  ].join("\n\n");
}

function buildBuilderPromptPayload(builderInput = {}) {
  const pageContext = builderInput?.pageContext || {};
  const approvedPlan = builderInput?.approvedPlan || {};
  const generationOptions = builderInput?.generationOptions || {};
  const composition = builderInput?.compositionResult?.composition && typeof builderInput.compositionResult.composition === "object"
    ? builderInput.compositionResult.composition
    : {};
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  const designToolContext = builderInput?.systemContext?.designToolContext || {};
  const designReferenceLibrary = builderInput?.systemContext?.designReferenceLibrary || {};
  const sufficiencyGate = builderInput?.systemContext?.sufficiencyGate || {};
  const compareMode = builderInput?.systemContext?.compareMode || {};
  const primitiveCompositionCatalog = designToolContext?.primitiveCompositionCatalog || {};
  const styleRuntimeTokenPresets = designToolContext?.styleRuntimeTokenPresets || {};
  const sectionFamilyContracts = designToolContext?.sectionFamilyContracts || {};
  const recipeHierarchy = designToolContext?.recipeHierarchy || {};
  const pagePromptBlueprints = designToolContext?.pagePromptBlueprints || {};
  const artifactSidecarRegistry = builderInput?.systemContext?.artifactSidecarRegistry || {};
  const compactCompare = String(generationOptions?.builderMode || "standard").trim() === "compare";
  const artifactSections = Array.isArray(artifactSidecarRegistry?.sections) ? artifactSidecarRegistry.sections : [];
  const targetComponentIds = new Set(toStringArray(generationOptions.targetComponents));
  const compactArtifactSections = safeArray(
    artifactSections.filter((section) => {
      if (!targetComponentIds.size) return true;
      const componentId = String(section?.componentId || "").trim();
      const slotId = String(section?.slotId || "").trim();
      return targetComponentIds.has(componentId) || targetComponentIds.has(slotId);
    }),
    targetComponentIds.size ? Math.max(2, targetComponentIds.size) : 4
  );
  const summarizeLayoutTokens = (tokens = {}) => {
    const source = tokens && typeof tokens === "object" ? tokens : {};
    return {
      spacingScale: safeArray(source.spacingScale, 8),
      radiusScale: safeArray(source.radiusScale, 8),
      titleSizeScale: safeArray(source.titleSizeScale || source.typeScale, 8),
      backgroundScale: safeArray(source.backgroundScale || source.surfaceScale, 8),
      contrastPresets: safeArray(source.contrastPresets, 6),
      emphasisModes: safeArray(source.emphasisModes, 6),
    };
  };
  const summarizePatchRules = (rules = {}) => {
    const source = rules && typeof rules === "object" ? rules : {};
    return {
      globalGuardrails: safeArray(source.globalGuardrails || source.guardrails, 8),
      allowedActions: safeArray(source.allowedActions, 8),
      preferredChangeModes: safeArray(source.preferredChangeModes, 6),
      forbiddenPatterns: safeArray(source.forbiddenPatterns, 8),
      componentRules: safeArray(source.componentRules, 4).map((item) => ({
        slotId: item?.slotId || "",
        componentId: item?.componentId || "",
        preferredPatchKeys: safeArray(item?.preferredPatchKeys, 6),
        forbiddenPatchKeys: safeArray(item?.forbiddenPatchKeys, 6),
      })),
    };
  };
  return {
    pageContext: {
      workspacePageId: pageContext.workspacePageId,
      pageLabel: pageContext.pageLabel,
      viewportProfile: pageContext.viewportProfile,
      viewportLabel: pageContext.viewportLabel,
      pageIdentity: pageContext.pageIdentity,
    },
    generationOptions: {
      interventionLayer: generationOptions.interventionLayer,
      targetScope: generationOptions.targetScope,
      targetGroupId: generationOptions.targetGroupId,
      targetComponents: toStringArray(generationOptions.targetComponents),
      designChangeLevel: generationOptions.designChangeLevel,
      patchDepth: generationOptions.patchDepth,
      builderMode: generationOptions.builderMode || "standard",
    },
    compareMode: {
      enabled: Boolean(compareMode?.enabled),
      attempt: Number(compareMode?.attempt || 0) || 0,
      strategy: compareMode?.strategy || "",
      visualRetry: Boolean(compareMode?.visualRetry),
      failedDimensions: safeArray(compareMode?.failedDimensions, compactCompare ? 6 : 8),
      findings: safeArray(compareMode?.findings, compactCompare ? 6 : 8),
      instructions: safeArray(compareMode?.instructions, compactCompare ? 6 : 8),
      visualAssets: {
        beforeLabel: compareMode?.visualAssets?.beforeLabel || null,
        afterLabel: compareMode?.visualAssets?.afterLabel || null,
        referenceLabel: compareMode?.visualAssets?.referenceLabel || null,
        targetSlots: safeArray(compareMode?.visualAssets?.targetSlots, compactCompare ? 6 : 8),
      },
    },
    approvedPlan: {
      title: approvedPlan.title,
      summary: approvedPlan.summary,
      requestSummary: safeArray(approvedPlan.requestSummary, 6),
      planningDirection: safeArray(approvedPlan.planningDirection, 6),
      designDirection: safeArray(approvedPlan.designDirection, 6),
      guardrails: safeArray(approvedPlan.guardrails, 8),
      builderBrief: {
        objective: approvedPlan?.builderBrief?.objective || "",
        mustKeep: safeArray(approvedPlan?.builderBrief?.mustKeep, 4),
        mustChange: safeArray(approvedPlan?.builderBrief?.mustChange, 4),
        suggestedFocusSlots: safeArray(approvedPlan?.builderBrief?.suggestedFocusSlots, 6),
      },
      designSpecMarkdown: truncateText(String(approvedPlan.designSpecMarkdown || "").trim(), compactCompare ? 1400 : 2400),
      layoutMockupMarkdown: truncateText(String(approvedPlan.layoutMockupMarkdown || "").trim(), compactCompare ? 900 : 1600),
      sectionBlueprints: safeArray(approvedPlan.sectionBlueprints, compactCompare ? 4 : 6).map((item) => ({
        slotId: item?.slotId,
        label: item?.label,
        hierarchyRole: item?.hierarchyRole,
        layoutIntent: item?.layoutIntent,
        keyChanges: safeArray(item?.keyChanges, 4),
      })),
    },
    compositionResult: {
      summary: builderInput?.compositionResult?.summary || "",
      focusSlots: safeArray(composition.focusSlots, compactCompare ? 6 : 8),
      referenceUse: safeArray(composition.referenceUse, compactCompare ? 4 : 6),
      compositionTree: safeArray(composition.compositionTree, compactCompare ? 6 : 8).map((item) => ({
        slotId: item?.slotId,
        componentId: item?.componentId,
        familyId: item?.familyId,
        templateId: item?.templateId || "",
        layoutGoal: item?.layoutGoal,
        hierarchy: item?.hierarchy,
        visualDirection: item?.visualDirection,
        preservedElements: safeArray(item?.preservedElements, 4),
        changedElements: safeArray(item?.changedElements, 4),
        referenceAnchorIds: safeArray(item?.referenceAnchorIds, 4),
        assetPlan: item?.assetPlan || {},
      })),
      styleContract: safeArray(composition.styleContract, compactCompare ? 6 : 8),
      assetBindings: composition.assetBindings || {},
      negativeConstraints: safeArray(composition.negativeConstraints, compactCompare ? 6 : 8),
    },
    editableComponents: safeArray(editableComponents, compactCompare ? 8 : 12).map((item) => ({
      slotId: item?.slotId,
      componentId: item?.componentId,
      layout: item?.layout || null,
      mediaSpec: item?.mediaSpec || null,
      patchSchema: {
        rootKeys: toStringArray(item?.patchSchema?.rootKeys),
        styleKeys: toStringArray(item?.patchSchema?.styleKeys),
      },
      patchBridge: item?.patchBridge
        ? {
            rootPatchPriority: safeArray(item?.patchBridge?.rootPatchPriority, compactCompare ? 4 : 8),
            stylePatchPriority: safeArray(item?.patchBridge?.stylePatchPriority, compactCompare ? 4 : 8),
            measuredScale: item?.patchBridge?.measuredScale || null,
          }
        : null,
    })),
    designReferenceLibrary: {
      pageType: designReferenceLibrary?.pageType || "",
      viewportProfile: designReferenceLibrary?.viewportProfile || "",
      identitySignals: safeArray(designReferenceLibrary?.identitySignals, compactCompare ? 6 : 8),
      referenceAnchors: safeArray(designReferenceLibrary?.referenceAnchors, compactCompare ? 3 : 4).map((anchor) => ({
        id: anchor?.id,
        label: anchor?.label,
        sourceName: anchor?.sourceName,
        sourceClass: anchor?.sourceClass,
        targetLayer: anchor?.targetLayer,
        targetComponents: safeArray(anchor?.targetComponents, 6),
        intentTags: safeArray(anchor?.intentTags, 6),
        why: safeArray(anchor?.why, 3),
        avoid: safeArray(anchor?.avoid, 3),
      })),
    },
    sufficiencyGate: {
      status: sufficiencyGate?.status || "",
      recoveryMode: sufficiencyGate?.recoveryMode || "",
      missingDimensions: safeArray(sufficiencyGate?.missingDimensions, compactCompare ? 6 : 8),
      assetNeeds: safeArray(sufficiencyGate?.assetNeeds, compactCompare ? 6 : 8),
      highImpactVisualTargets: safeArray(sufficiencyGate?.highImpactVisualTargets, compactCompare ? 4 : 6).map((item) => ({
        slotId: item?.slotId || "",
        componentId: item?.componentId || "",
        familyId: item?.familyId || "",
        hasAnyVisualSupport: Boolean(item?.hasAnyVisualSupport),
        starterResolvedCount: Number(item?.starterResolvedCount || 0),
        matchingReferenceCount: Number(item?.matchingReferenceCount || 0),
      })),
    },
    designToolContext: {
      visualPrinciples: designToolContext?.visualPrinciples
        ? {
            pageIdentity: designToolContext.visualPrinciples.pageIdentity || pageContext.pageIdentity || {},
            pageIdentityContext:
              designToolContext.visualPrinciples.pageIdentityContext &&
              typeof designToolContext.visualPrinciples.pageIdentityContext === "object"
                ? {
                    character: String(designToolContext.visualPrinciples.pageIdentityContext.character || "").trim(),
                    visualLanguage: String(designToolContext.visualPrinciples.pageIdentityContext.visualLanguage || "").trim(),
                    userGoal: String(designToolContext.visualPrinciples.pageIdentityContext.userGoal || "").trim(),
                    sectionFlow: String(designToolContext.visualPrinciples.pageIdentityContext.sectionFlow || "").trim(),
                  }
                : null,
            slotGuidanceMap: Object.fromEntries(
              safeArray(
                Object.entries(
                  designToolContext.visualPrinciples.slotGuidanceMap &&
                    typeof designToolContext.visualPrinciples.slotGuidanceMap === "object"
                    ? designToolContext.visualPrinciples.slotGuidanceMap
                    : {}
                ),
                compactCompare ? 8 : 16
              )
                .map(([slotId, entry]) => [
                  slotId,
                  {
                    role: String(entry?.role || "").trim(),
                    direction: String(entry?.direction || "").trim(),
                    priority: String(entry?.priority || "").trim(),
                  },
                ])
                .filter(([, entry]) => entry.role || entry.direction || entry.priority)
            ),
            targetSlotIds: safeArray(designToolContext.visualPrinciples.targetSlotIds, compactCompare ? 8 : 12),
            designChangeProfile:
              designToolContext.visualPrinciples.designChangeProfile &&
              typeof designToolContext.visualPrinciples.designChangeProfile === "object"
                ? {
                    label: String(designToolContext.visualPrinciples.designChangeProfile.label || "").trim(),
                    layoutShift: String(designToolContext.visualPrinciples.designChangeProfile.layoutShift || "").trim(),
                    copyShift: String(designToolContext.visualPrinciples.designChangeProfile.copyShift || "").trim(),
                    emphasisLevel: String(designToolContext.visualPrinciples.designChangeProfile.emphasisLevel || "").trim(),
                  }
                : null,
            changeLevelGuidance:
              designToolContext.visualPrinciples.changeLevelGuidance &&
              typeof designToolContext.visualPrinciples.changeLevelGuidance === "object"
                ? Object.fromEntries(
                    Object.entries(designToolContext.visualPrinciples.changeLevelGuidance).map(([level, guidance]) => [
                      level,
                      safeArray(guidance, 4),
                    ])
                  )
                : {},
            layoutTokens: summarizeLayoutTokens(designToolContext.visualPrinciples.layoutTokens),
            patchRules: summarizePatchRules(designToolContext.visualPrinciples.patchRules),
          }
        : {},
      allowedTokenSets: buildAllowedTokenSets(builderInput),
      primitiveCompositionCatalog: {
        primitives: safeArray(primitiveCompositionCatalog?.primitives, compactCompare ? 8 : 12).map((item) => ({
          id: item?.id,
          category: item?.category,
          allowedVariants: safeArray(item?.allowedVariants, 6),
        })),
        pageShell: primitiveCompositionCatalog?.pageShell || null,
        groupShells:
          primitiveCompositionCatalog?.groupShells && typeof primitiveCompositionCatalog.groupShells === "object"
            ? primitiveCompositionCatalog.groupShells
            : {},
        componentAssignments: safeArray(primitiveCompositionCatalog?.componentAssignments, compactCompare ? 6 : 10).map((item) => ({
          componentId: item?.componentId,
          primitiveIds: safeArray(item?.primitiveIds, 6),
        })),
        templateMappings:
          primitiveCompositionCatalog?.templateMappings && typeof primitiveCompositionCatalog.templateMappings === "object"
            ? primitiveCompositionCatalog.templateMappings
            : {},
      },
      styleRuntimeTokenPresets: {
        version: Number(styleRuntimeTokenPresets?.version || 0) || 0,
        presets: safeArray(styleRuntimeTokenPresets?.presets, compactCompare ? 8 : 12).map((item) => ({
          id: item?.id,
          slotGroup: item?.slotGroup,
          surfaceTone: item?.surfaceTone,
          density: item?.density,
          hierarchyEmphasis: item?.hierarchyEmphasis,
        })),
      },
      sectionFamilyContracts: {
        version: Number(sectionFamilyContracts?.version || 0) || 0,
        global: {
          principles: safeArray(sectionFamilyContracts?.global?.principles, 6),
          successSignals: safeArray(sectionFamilyContracts?.global?.successSignals, 4),
        },
        identityEnvelope: {
          interventionLayer: sectionFamilyContracts?.identityEnvelope?.interventionLayer || null,
          band: sectionFamilyContracts?.identityEnvelope?.band || null,
          label: sectionFamilyContracts?.identityEnvelope?.label || null,
          intent: sectionFamilyContracts?.identityEnvelope?.intent || "",
          preserve: safeArray(sectionFamilyContracts?.identityEnvelope?.preserve, 5),
          allow: safeArray(sectionFamilyContracts?.identityEnvelope?.allow, 5),
          avoid: safeArray(sectionFamilyContracts?.identityEnvelope?.avoid, 5),
          pagePreserve: safeArray(sectionFamilyContracts?.identityEnvelope?.pagePreserve, 4),
          pageAvoid: safeArray(sectionFamilyContracts?.identityEnvelope?.pageAvoid, 4),
        },
        clusters: safeArray(sectionFamilyContracts?.clusters, compactCompare ? 3 : 4).map((item) => ({
          clusterId: item?.clusterId,
          label: item?.label,
          targetSlots: safeArray(item?.targetSlots, 6),
          goal: item?.goal || "",
          rules: safeArray(item?.rules, 5),
          criticRules: safeArray(item?.criticRules, 5),
        })),
        families: safeArray(sectionFamilyContracts?.families, compactCompare ? 5 : 8).map((item) => ({
          familyId: item?.familyId,
          label: item?.label,
          targetSlots: safeArray(item?.targetSlots, 6),
          requiredOutcomes: safeArray(item?.requiredOutcomes, 5),
          visualRules: safeArray(item?.visualRules, 5),
          avoid: safeArray(item?.avoid, 5),
          criticRules: safeArray(item?.criticRules, 5),
        })),
      },
      recipeHierarchy: {
        targetFamilyIds: safeArray(recipeHierarchy?.targetFamilyIds, compactCompare ? 6 : 8),
        authoringRules: safeArray(recipeHierarchy?.authoringRules, 6),
        topStageCluster: recipeHierarchy?.topStageCluster && typeof recipeHierarchy.topStageCluster === "object"
          ? {
              clusterId: recipeHierarchy.topStageCluster.clusterId || "",
              sequence: safeArray(recipeHierarchy.topStageCluster.sequence, 6),
              goal: recipeHierarchy.topStageCluster.goal || "",
              rules: safeArray(recipeHierarchy.topStageCluster.rules, 5),
            }
          : null,
        families: safeArray(recipeHierarchy?.families, compactCompare ? 4 : 8).map((item) => ({
          familyId: item?.familyId || "",
          status: item?.status || "",
          priority: Number(item?.priority || 0) || 0,
          focus: safeArray(item?.focus, 5),
          qualityGateFocus: safeArray(item?.qualityGateFocus, 5),
          topRecipeCandidates: safeArray(item?.topRecipeCandidates, 5),
          selectionRule: item?.selectionRule || "",
          topRecipes: safeArray(item?.topRecipes, compactCompare ? 2 : 3).map((recipe) => ({
            recipeId: recipe?.recipeId || "",
            priority: Number(recipe?.priority || 0) || 0,
            suggestedPrimitive: recipe?.suggestedPrimitive || "",
            qualityObjective: recipe?.qualityObjective || "",
            structureRules: safeArray(recipe?.structureRules, 4),
            qualitySignals: safeArray(recipe?.qualitySignals, 4),
            avoid: safeArray(recipe?.avoid, 4),
          })),
        })),
      },
      pagePromptBlueprints: {
        version: Number(pagePromptBlueprints?.version || 0) || 0,
        pageCount: Number(pagePromptBlueprints?.pageCount || 0) || 0,
        global: {
          promptOrder: safeArray(pagePromptBlueprints?.global?.promptOrder, 4),
          executionModel: safeArray(pagePromptBlueprints?.global?.executionModel, 4),
          rendererPolicy: safeArray(pagePromptBlueprints?.global?.rendererPolicy, 4),
          qualityChecks: safeArray(pagePromptBlueprints?.global?.qualityChecks, 4),
        },
        activeBlueprint: pagePromptBlueprints?.activeBlueprint && typeof pagePromptBlueprints.activeBlueprint === "object"
          ? {
              blueprintId: pagePromptBlueprints.activeBlueprint.blueprintId || "",
              label: pagePromptBlueprints.activeBlueprint.label || "",
              implementationStatus: pagePromptBlueprints.activeBlueprint.implementationStatus || "",
              pagePrompt: pagePromptBlueprints.activeBlueprint.pagePrompt || {},
              clusters: safeArray(pagePromptBlueprints.activeBlueprint.clusters, 4),
              sectionPrompts: safeArray(pagePromptBlueprints.activeBlueprint.sectionPrompts, 8),
              rendererStrategy: pagePromptBlueprints.activeBlueprint.rendererStrategy || {},
            }
          : null,
      },
    },
    artifactSidecarRegistry: {
      sections: safeArray(compactArtifactSections, compactCompare ? 3 : 4).map((section) => ({
        slotId: section?.slotId,
        componentId: section?.componentId,
        imageZoneCount: safeArray(section?.imageZones, 4).length,
        regions: safeArray(section?.regions, 6).map((region) => ({
          regionId: region?.regionId,
          role: region?.role,
          replaceMode: region?.replaceMode,
          editableFields: safeArray(region?.editableFields, 6),
        })),
        layoutGovernance: section?.layoutGovernance
          ? {
              repeaterMode: section.layoutGovernance.repeaterMode || null,
              variationRule: section.layoutGovernance.variationRule || null,
              lockedAxes: safeArray(section.layoutGovernance.lockedAxes, 6),
            }
          : null,
      })),
    },
  };
}

function formatPageIdentityPromptLines(pageIdentityContext = {}, fallbackPageIdentity = {}) {
  const identity =
    pageIdentityContext && typeof pageIdentityContext === "object" && Object.keys(pageIdentityContext).length
      ? pageIdentityContext
      : fallbackPageIdentity && typeof fallbackPageIdentity === "object"
        ? fallbackPageIdentity
        : {};
  const lines = [];
  if (String(identity.character || identity.role || "").trim()) {
    lines.push(`Character: ${String(identity.character || identity.role || "").trim()}`);
  }
  if (String(identity.visualLanguage || identity.visualStyle || "").trim()) {
    lines.push(`Visual Language: ${String(identity.visualLanguage || identity.visualStyle || "").trim()}`);
  }
  if (String(identity.userGoal || identity.goal || "").trim()) {
    lines.push(`User Goal: ${String(identity.userGoal || identity.goal || "").trim()}`);
  }
  if (String(identity.sectionFlow || identity.flow || "").trim()) {
    lines.push(`Section Flow: ${String(identity.sectionFlow || identity.flow || "").trim()}`);
  }
  return lines;
}

function formatSlotGuidancePromptLines(slotIds = [], slotGuidanceMap = {}) {
  return Array.from(new Set((Array.isArray(slotIds) ? slotIds : []).map((slotId) => String(slotId || "").trim()).filter(Boolean)))
    .map((slotId) => {
      const guidance = slotGuidanceMap && typeof slotGuidanceMap === "object" ? slotGuidanceMap[slotId] || {} : {};
      const parts = [];
      if (String(guidance.role || "").trim()) parts.push(`[role] ${String(guidance.role).trim()}`);
      if (String(guidance.direction || "").trim()) parts.push(`[direction] ${String(guidance.direction).trim()}`);
      if (String(guidance.priority || "").trim()) parts.push(`[priority] ${String(guidance.priority).trim()}`);
      if (!parts.length) return "";
      return `- ${slotId}: ${parts.join(" ")}`;
    })
    .filter(Boolean);
}

function buildDesignChangeLevelPromptLines(level = "", visualPrinciples = {}) {
  const normalizedLevel = normalizeDesignChangeLevel(level, "medium");
  const defaultLines = {
    low: "Apply light refinements. Preserve the existing structure and focus on restrained copy, tone, and emphasis changes.",
    medium: "Apply controlled but noticeable changes. Keep the core structure, but let hierarchy, density, and composition improve in a felt way.",
    high: "Apply strong, assertive changes to the focus slots while staying inside the page identity and allowed tool surface.",
  };
  const profile = visualPrinciples?.designChangeProfile && typeof visualPrinciples.designChangeProfile === "object"
    ? visualPrinciples.designChangeProfile
    : {};
  const guidanceLines =
    visualPrinciples?.changeLevelGuidance && typeof visualPrinciples.changeLevelGuidance === "object"
      ? safeArray(visualPrinciples.changeLevelGuidance[normalizedLevel], 4)
      : [];
  const lines = [`Level: ${normalizedLevel}`];
  if (defaultLines[normalizedLevel]) lines.push(defaultLines[normalizedLevel]);
  if (profile.layoutShift || profile.copyShift || profile.emphasisLevel) {
    lines.push(
      `Profile: layoutShift=${String(profile.layoutShift || "n/a").trim()}, copyShift=${String(profile.copyShift || "n/a").trim()}, emphasisLevel=${String(profile.emphasisLevel || "n/a").trim()}`
    );
  }
  guidanceLines.forEach((line) => {
    const normalizedLine = String(line || "").trim();
    if (normalizedLine) lines.push(`- ${normalizedLine}`);
  });
  return lines;
}

function resolveBuilderPromptFocusSlotIds(detailerPayload = {}) {
  const editableSlotIds = safeArray(detailerPayload?.editableComponents, 20)
    .map((item) => String(item?.slotId || "").trim())
    .filter(Boolean);
  const focusCandidates = [
    ...toStringArray(detailerPayload?.approvedPlan?.builderBrief?.suggestedFocusSlots),
    ...toStringArray(detailerPayload?.compositionResult?.focusSlots),
    ...toStringArray(detailerPayload?.generationOptions?.targetComponents).map((item) => inferSlotIdFromComponentId(item) || String(item || "").trim()),
  ]
    .map((item) => inferSlotIdFromComponentId(item) || String(item || "").trim())
    .filter(Boolean);
  const allowedSlotIds = new Set([
    ...editableSlotIds,
    ...safeArray(detailerPayload?.designToolContext?.visualPrinciples?.targetSlotIds, 20).map((slotId) => String(slotId || "").trim()).filter(Boolean),
  ]);
  const focusSlotIds = Array.from(new Set(focusCandidates.filter((slotId) => !allowedSlotIds.size || allowedSlotIds.has(slotId))));
  if (focusSlotIds.length) return focusSlotIds;
  return editableSlotIds.slice(0, 4);
}

function buildBuilderUserPrompt(builderInput) {
  const compositionResult = builderInput?.compositionResult && typeof builderInput.compositionResult === "object"
    ? builderInput.compositionResult
    : null;
  const detailerPayload = buildBuilderPromptPayload(builderInput);
  const visualPrinciples =
    detailerPayload?.designToolContext?.visualPrinciples &&
    typeof detailerPayload.designToolContext.visualPrinciples === "object"
      ? detailerPayload.designToolContext.visualPrinciples
      : {};
  const slotGuidanceMap =
    visualPrinciples.slotGuidanceMap && typeof visualPrinciples.slotGuidanceMap === "object"
      ? visualPrinciples.slotGuidanceMap
      : {};
  const focusSlotIds = resolveBuilderPromptFocusSlotIds(detailerPayload);
  const otherEditableSlotIds = safeArray(detailerPayload?.editableComponents, 20)
    .map((item) => String(item?.slotId || "").trim())
    .filter((slotId, index, array) => slotId && array.indexOf(slotId) === index && !focusSlotIds.includes(slotId));
  const pageIdentityLines = formatPageIdentityPromptLines(
    visualPrinciples.pageIdentityContext,
    detailerPayload?.pageContext?.pageIdentity || visualPrinciples.pageIdentity || {}
  );
  const focusSlotLines = formatSlotGuidancePromptLines(focusSlotIds, slotGuidanceMap);
  const otherSlotLines = formatSlotGuidancePromptLines(otherEditableSlotIds, slotGuidanceMap);
  const designChangeLines = buildDesignChangeLevelPromptLines(
    detailerPayload?.generationOptions?.designChangeLevel,
    visualPrinciples
  );
  const executionLines = [
    "Use the provided designToolContext as the only allowed tool surface.",
    "Read page identity and slot guidance before you inspect the full JSON payload.",
    "If builderMode is compare, produce the strongest fresh draft you can inside the allowed scope instead of assuming later patch fixes will rescue weak hierarchy.",
    "Prefer 3 to 8 concrete operations when safe changes are possible.",
  ];
  if (detailerPayload?.compareMode?.enabled) {
    executionLines.push("Compare mode is active. Treat compare findings and attached failed-after visuals as rerun critique for the next fresh draft.");
  }
  executionLines.push("If the approved plan is valid but no safe operation is possible, return an empty operations array and explain the blocker in report.assumptions.");
  return [
    formatPromptSection("Execution Notes", executionLines),
    formatPromptSection("Page Identity", pageIdentityLines),
    formatPromptSection("Focus Slots", focusSlotLines),
    formatPromptSection("Other Editable Slots", otherSlotLines),
    formatPromptSection("Design Change Level", designChangeLines),
    formatPromptSection("Allowed Token Sets", [
      JSON.stringify(detailerPayload.designToolContext.allowedTokenSets, null, 2),
    ]),
    formatPromptSection("Expected Schema", [
      JSON.stringify({
      summary: "짧은 요약",
      buildResult: {
        proposedVersionLabel: "home-premium-v1",
        changedTargets: [{ slotId: "hero", componentId: "home.hero", changeType: "component_patch" }],
        operations: [
          { action: "replace_component_template", pageId: "home", slotId: "hero", componentId: "home.hero", familyId: "hero-carousel-composition", templateId: "hero-editorial-v1", summary: "히어로를 새 구조로 교체", layoutStrategy: "copy-left visual-right hero stage", assetPlan: { visualSetIds: ["home-hero-editorial"] } },
          { action: "update_component_patch", pageId: "home", slotId: "hero", patch: { badge: "브랜드 제안", title: "새 타이틀", styles: { titleSize: "32" } } },
        ],
        report: {
          whatChanged: ["상단 진입 구간의 메시지 집중도를 강화했습니다."],
          whyChanged: ["첫 인상에서 브랜드 인지가 약했기 때문입니다."],
          assumptions: ["가격과 상품 사실 정보는 유지했습니다."],
          compositionPlan: ["상단 진입부를 hero-led 구조로 재편합니다."],
          componentComposition: [
            {
              slotId: "hero",
              componentId: "home.hero",
              familyId: "hero-carousel-composition",
              templateId: "hero-editorial-v1",
              label: "히어로 전면개편안",
              scope: "component",
              summary: "히어로를 브랜드 제안 중심 레이아웃으로 재구성합니다.",
              layoutStrategy: "badge + headline + trust cue + action의 4층 구조로 재정렬",
              preservedElements: ["브랜드 정체성", "핵심 CTA"],
              changedElements: ["카피 위계", "비주얼 주도권", "여백 리듬"],
              assetPlan: {
                iconSetIds: ["commerce-feature-outline"],
                visualSetIds: ["home-hero-editorial"]
              }
            }
          ],
          selectedRecipes: [
            { scope: "cluster", slotId: "hero", familyId: "hero-carousel-composition", recipeId: "hero-premium-spotlight-v1", templateId: "hero-premium-stage-v1", primitiveId: "SplitHero", variant: "premium-stage", selectionReason: "top-stage cluster lead" }
          ],
          assetNeeds: ["hero visual direction", "icon set refresh"],
          assetReferences: {
            iconSetIds: ["commerce-feature-outline"],
            visualSetIds: ["home-hero-editorial"]
          },
          missingCapabilities: ["composition renderer"],
          guardrailCheck: [{ rule: "사실 정보 유지", status: "pass" }],
        },
      },
      }, null, 2),
    ]),
    formatPromptSection("Full Builder Input", [
      JSON.stringify(detailerPayload, null, 2),
    ]),
  ].filter(Boolean).join("\n\n");
}

function normalizeComposerAssetBindings(value) {
  return normalizeBuilderAssetReferences(value);
}

function normalizeComposerReferenceUseEntry(item = {}) {
  const source = item && typeof item === "object" ? item : {};
  const anchorId = String(source.anchorId || source.id || "").trim();
  const slotId = String(source.slotId || inferSlotIdFromComponentId(source.componentId) || "").trim();
  const componentId = String(source.componentId || "").trim();
  const why = String(source.why || source.rationale || "").trim();
  const avoid = toStringArray(source.avoid);
  if (!anchorId && !slotId && !componentId && !why && !avoid.length) return null;
  return {
    anchorId,
    slotId,
    componentId,
    why,
    avoid,
  };
}

const ALLOWED_COMPOSITION_PRIMITIVE_TYPES = new Set([
  "SplitHero",
  "CenteredHero",
  "StackedHero",
  "QuickmenuGrid",
  "QuickmenuPanel",
  "QuickmenuEditorialStrip",
  "RankingList",
  "CommerceGrid",
  "PromoBanner",
  "EditorialStoryGrid",
  "BenefitHub",
  "TopCompositionShell",
  "PageCompositionShell",
  "Eyebrow",
  "Title",
  "Body",
  "CTACluster",
  "Media",
  "CardRail",
  "Card",
]);

function normalizeCompositionPrimitiveValue(value) {
  if (typeof value === "string") return String(value).trim();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return null;
}

function normalizeCompositionPrimitiveProps(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, entryValue]) => {
        if (Array.isArray(entryValue)) {
          const values = entryValue.map((item) => normalizeCompositionPrimitiveValue(item)).filter((item) => item !== null && item !== "");
          return values.length ? [String(key || "").trim(), values] : null;
        }
        const normalized = normalizeCompositionPrimitiveValue(entryValue);
        return normalized !== null && normalized !== "" ? [String(key || "").trim(), normalized] : null;
      })
      .filter(Boolean)
  );
}

function normalizeCompositionPrimitiveNode(node = {}, depth = 0) {
  if (depth > 6 || !node || typeof node !== "object") return null;
  const type = String(node.type || node.primitiveId || "").trim();
  if (!type || !ALLOWED_COMPOSITION_PRIMITIVE_TYPES.has(type)) return null;
  const variant = String(node.variant || "").trim();
  const props = normalizeCompositionPrimitiveProps(node.props || {});
  const children = safeObjectArray(node.children, 12)
    .map((child) => normalizeCompositionPrimitiveNode(child, depth + 1))
    .filter(Boolean);
  return {
    type,
    variant,
    props,
    children,
  };
}

function normalizeCompositionPrimitiveTree(value = null) {
  const normalized = normalizeCompositionPrimitiveNode(value, 0);
  return normalized || null;
}

function synthesizePrimitiveTreeForComponent(slotId = "", templateId = "", styleEntry = null, composerEntry = null) {
  const normalizedSlotId = String(slotId || "").trim();
  const normalizedTemplateId = String(templateId || "").trim();
  const normalizedSlotLower = normalizedSlotId.toLowerCase();
  const surfaceTone = String(styleEntry?.surfaceTone || "").trim() || "neutral";
  const densitySource = String(styleEntry?.density || "").trim();
  const density =
    densitySource === "low" ? "immersive" :
      densitySource === "medium" ? "comfortable" :
        densitySource === "high" ? "compact" :
          "comfortable";
  const hierarchy = String(styleEntry?.hierarchyEmphasis || composerEntry?.hierarchy || "").trim();
  if (normalizedSlotId === "hero") {
    let type = "SplitHero";
    let variant = "carousel";
    if (normalizedTemplateId === "hero-centered-v1") {
      type = "CenteredHero";
      variant = "centered";
    } else if (normalizedTemplateId === "hero-stacked-v1") {
      type = "StackedHero";
      variant = "stacked";
    } else if (normalizedTemplateId === "hero-editorial-v1") {
      type = "SplitHero";
      variant = "editorial";
    } else if (normalizedTemplateId === "hero-premium-stage-v1") {
      type = "SplitHero";
      variant = "premium-stage";
    }
    return {
      type,
      variant,
      props: {
        tone: surfaceTone || (variant === "premium-stage" ? "premium" : variant === "editorial" ? "editorial" : "neutral"),
        density,
        emphasis: hierarchy || "",
      },
      children: [
        { type: "Eyebrow", variant: "badge", props: { source: "badge" } },
        { type: "Title", variant: "headline", props: { source: "headline" } },
        { type: "Body", variant: "description", props: { source: "description" } },
        { type: "CTACluster", variant: "primary", props: { source: "primaryAction" } },
        { type: "Media", variant: "lead", props: { source: "leadVisual" } },
        { type: "CardRail", variant: variant === "stacked" ? "stacked" : "support", props: { source: "supportSlides" } },
      ],
    };
  }
  if (normalizedSlotId === "quickmenu" || normalizedSlotId === "quickMenu" || normalizedSlotId === "tabs") {
    let type = "QuickmenuGrid";
    let variant = "grid";
    if (normalizedTemplateId === "quickmenu-panel-v1") {
      type = "QuickmenuPanel";
      variant = "panel";
    } else if (normalizedTemplateId === "quickmenu-editorial-strip-v1") {
      type = "QuickmenuEditorialStrip";
      variant = "editorial-strip";
    }
    return {
      type,
      variant,
      props: {
        tone: surfaceTone || (variant === "editorial-strip" ? "editorial" : "neutral"),
        density,
        emphasis: hierarchy || "",
      },
      children: [
        { type: "Title", variant: "section-title", props: { source: "title" } },
        { type: "Body", variant: "section-description", props: { source: "subtitle" } },
        { type: "CardRail", variant, props: { source: "quickmenuItems" } },
      ],
    };
  }
  if (normalizedSlotId === "best-ranking" || normalizedSlotLower === "ranking") {
    const rankingVariant =
      /poster/i.test(normalizedTemplateId) || /premium|editorial/i.test(surfaceTone) || /poster|ranking-poster/i.test(hierarchy)
        ? "poster"
        : "compact";
    return {
      type: "RankingList",
      variant: rankingVariant,
      props: {
        tone: surfaceTone || (rankingVariant === "poster" ? "premium" : "neutral"),
        density,
        emphasis: hierarchy || "",
      },
      children: [
        { type: "Title", variant: "section-title", props: { source: "title" } },
        { type: "Body", variant: "section-description", props: { source: "subtitle" } },
        { type: "CardRail", variant: rankingVariant, props: { source: "rankingItems" } },
      ],
    };
  }
  if (["summary-banner-2", "carebanner", "labelbanner"].includes(normalizedSlotLower)) {
    const bannerVariant = /cinematic/i.test(normalizedTemplateId) || /cinematic|premium/i.test(surfaceTone) ? "cinematic" : "clean";
    return {
      type: "PromoBanner",
      variant: bannerVariant,
      props: {
        tone: surfaceTone || bannerVariant,
        density,
        emphasis: hierarchy || "",
      },
      children: [
        { type: "Eyebrow", variant: "kicker", props: { source: "badge" } },
        { type: "Title", variant: "banner-title", props: { source: "title" } },
        { type: "Body", variant: "banner-description", props: { source: "subtitle" } },
        { type: "Media", variant: "banner-visual", props: { source: "leadVisual" } },
      ],
    };
  }
  if (["smart-life", "brandstory"].includes(normalizedSlotLower)) {
    const storyVariant = /portrait/i.test(normalizedTemplateId) || /portrait/i.test(hierarchy) ? "portrait" : "editorial";
    return {
      type: "EditorialStoryGrid",
      variant: storyVariant,
      props: {
        tone: /premium/i.test(surfaceTone) ? "premium" : "editorial",
        density,
        emphasis: hierarchy || "",
      },
      children: [
        { type: "Title", variant: "section-title", props: { source: "title" } },
        { type: "Body", variant: "section-description", props: { source: "subtitle" } },
        { type: "CardRail", variant: storyVariant, props: { source: "storyItems" } },
      ],
    };
  }
  if (["missed-benefits", "lg-best-care", "bestshop-guide", "benefit"].includes(normalizedSlotLower)) {
    const benefitVariant = /service/i.test(normalizedTemplateId) || /service|support/i.test(hierarchy) ? "service" : "benefits";
    return {
      type: "BenefitHub",
      variant: benefitVariant,
      props: {
        tone: surfaceTone || "neutral",
        density,
        emphasis: hierarchy || "",
      },
      children: [
        { type: "Title", variant: "section-title", props: { source: "title" } },
        { type: "Body", variant: "section-description", props: { source: "subtitle" } },
        { type: "CardRail", variant: benefitVariant, props: { source: "benefitItems" } },
      ],
    };
  }
  if ([
    "md-choice",
    "timedeal",
    "subscription",
    "space-renewal",
    "latest-product-news",
    "brand-showroom",
    "marketing-area",
  ].includes(normalizedSlotLower)) {
    const gridVariant =
      normalizedSlotLower === "marketing-area" || /featured/i.test(normalizedTemplateId) || /lead|featured|hero-card/i.test(hierarchy)
        ? "featured"
        : "grid";
    return {
      type: "CommerceGrid",
      variant: gridVariant,
      props: {
        tone: surfaceTone || "neutral",
        density,
        emphasis: hierarchy || "",
      },
      children: [
        { type: "Title", variant: "section-title", props: { source: "title" } },
        { type: "Body", variant: "section-description", props: { source: "subtitle" } },
        { type: "CardRail", variant: gridVariant, props: { source: "commerceItems" } },
      ],
    };
  }
  return null;
}

function normalizeComposerTreeEntry(item = {}, builderInput = {}, index = 0) {
  const source = item && typeof item === "object" ? item : {};
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const slotId = String(source.slotId || inferSlotIdFromComponentId(source.componentId) || "").trim();
  const componentId = String(source.componentId || (pageId && slotId ? `${pageId}.${slotId}` : "")).trim();
  const familyId = String(source.familyId || findComponentCompositionFamilyId(builderInput, componentId)).trim();
  const templateId = String(source.templateId || "").trim();
  const layoutGoal = String(source.layoutGoal || source.summary || source.layoutStrategy || "").trim();
  const hierarchy = String(source.hierarchy || source.hierarchyPlan || "").trim();
  const visualDirection = String(source.visualDirection || source.direction || "").trim();
  const preservedElements = toStringArray(source.preservedElements || source.keep);
  const changedElements = toStringArray(source.changedElements || source.change);
  const referenceAnchorIds = toStringArray(source.referenceAnchorIds || source.anchorIds);
  const assetPlan = normalizeComposerAssetBindings(source.assetPlan || {});
  const interactionTone = String(source.interactionTone || "").trim();
  const tokenHints = source.tokenHints && typeof source.tokenHints === "object" ? source.tokenHints : {};
  if (!slotId && !componentId && !layoutGoal && !hierarchy && !visualDirection && !changedElements.length) return null;
  return {
    slotId,
    componentId,
    familyId,
    templateId,
    label: String(source.label || slotId || componentId || `composition-${index + 1}`).trim(),
    layoutGoal,
    hierarchy,
    visualDirection,
    preservedElements,
    changedElements,
    referenceAnchorIds,
    interactionTone,
    tokenHints,
    assetPlan,
    primitiveTree: normalizeCompositionPrimitiveTree(source.primitiveTree || source.primitive || null),
  };
}

function normalizeComposerStyleContractEntry(item = {}) {
  const source = item && typeof item === "object" ? item : {};
  const slotId = String(source.slotId || inferSlotIdFromComponentId(source.componentId) || "").trim();
  const componentId = String(source.componentId || "").trim();
  const templateId = String(source.templateId || "").trim();
  const surfaceTone = String(source.surfaceTone || "").trim();
  const density = String(source.density || "").trim();
  const hierarchyEmphasis = String(source.hierarchyEmphasis || "").trim();
  const interactionTone = String(source.interactionTone || "").trim();
  const tokenHints = source.tokenHints && typeof source.tokenHints === "object" ? source.tokenHints : {};
  if (!slotId && !componentId && !templateId && !surfaceTone && !density && !hierarchyEmphasis && !interactionTone && !Object.keys(tokenHints).length) {
    return null;
  }
  return {
    slotId,
    componentId,
    templateId,
    surfaceTone,
    density,
    hierarchyEmphasis,
    interactionTone,
    tokenHints,
  };
}

function resolvePreferredTemplateId(builderInput = {}, slotId = "", componentId = "", composerEntry = null, styleEntry = null) {
  const directTemplateId = String(composerEntry?.templateId || styleEntry?.templateId || "").trim();
  if (directTemplateId) return directTemplateId;
  const patchDepth = normalizePatchDepth(builderInput?.generationOptions?.patchDepth, "medium");
  const mergedSignal = [
    String(composerEntry?.visualDirection || "").trim(),
    String(composerEntry?.layoutGoal || "").trim(),
    String(composerEntry?.hierarchy || "").trim(),
    String(styleEntry?.surfaceTone || "").trim(),
    String(styleEntry?.hierarchyEmphasis || "").trim(),
    ...toStringArray(composerEntry?.changedElements),
    ...toStringArray(composerEntry?.preservedElements),
  ]
    .join(" ")
    .toLowerCase();
  if (slotId === "hero") {
    if (/centered|spotlight|statement|minimal|mono-hero/.test(mergedSignal)) return "hero-centered-v1";
    if (/stacked|layered|vertical|campaign|poster/.test(mergedSignal)) return "hero-stacked-v1";
    if (/premium|luxury|stage|contrast|cinematic|bold/.test(mergedSignal) || patchDepth === "full") return "hero-premium-stage-v1";
    if (/editorial|story|magazine|lead/.test(mergedSignal) || patchDepth === "strong") return "hero-editorial-v1";
    return "hero-carousel-composition-v1";
  }
  if (slotId === "quickmenu") {
    if (/editorial|story|curation|magazine/.test(mergedSignal) || patchDepth === "full") return "quickmenu-editorial-strip-v1";
    if (/panel|spotlight|lead-card|feature-grid/.test(mergedSignal) || patchDepth === "strong") return "quickmenu-panel-v1";
    return "icon-link-grid-composition-v1";
  }
  if (slotId === "quickMenu" || slotId === "tabs") {
    if (/editorial|story|curation|magazine/.test(mergedSignal)) return "quickmenu-editorial-strip-v1";
    if (/panel|spotlight|lead-card|feature-grid|service|tabs/.test(mergedSignal) || patchDepth === "full") return "quickmenu-panel-v1";
    return "icon-link-grid-composition-v1";
  }
  if (slotId === "ranking" || slotId === "best-ranking") {
    if (/poster|premium|editorial|rank-dominant|showcase/.test(mergedSignal) || patchDepth === "full") return "ranking-poster-v1";
    return "ranking-compact-v1";
  }
  if (slotId === "benefit" || slotId === "missed-benefits" || slotId === "lg-best-care" || slotId === "bestshop-guide") {
    if (/service|support|trust|benefit/.test(mergedSignal) || patchDepth === "full") return "benefit-hub-service-v1";
    return "benefit-hub-v1";
  }
  if (slotId === "careBanner" || slotId === "labelBanner" || slotId === "summary-banner-2") {
    if (/clean|soft|ribbon|service/.test(mergedSignal)) return "promo-banner-clean-v1";
    return "promo-banner-cinematic-v1";
  }
  if (slotId === "brandStory" || slotId === "smart-life") {
    if (/portrait|magazine|editorial|story/.test(mergedSignal) || patchDepth === "full") return "editorial-story-portrait-v1";
    return "editorial-story-grid-v1";
  }
  if ([
    "md-choice",
    "timedeal",
    "subscription",
    "space-renewal",
    "latest-product-news",
    "brand-showroom",
    "marketing-area",
  ].includes(slotId)) {
    if (/featured|lead|hero-card|showcase/.test(mergedSignal) || patchDepth === "full") return "commerce-grid-featured-v1";
    return "commerce-grid-v1";
  }
  const familyId = findComponentCompositionFamilyId(builderInput, componentId);
  return familyId ? `${familyId}-v1` : "";
}

function buildPreferredStarterAssetBindings(assetPipelineStarter = {}, componentId = "", familyId = "") {
  const pageDefaults =
    assetPipelineStarter?.pageDefaults && typeof assetPipelineStarter.pageDefaults === "object"
      ? assetPipelineStarter.pageDefaults
      : {};
  const familyDefaults =
    assetPipelineStarter?.familyDefaults && typeof assetPipelineStarter.familyDefaults === "object"
      ? assetPipelineStarter.familyDefaults[String(familyId || "").trim()] || {}
      : {};
  const componentDefaults =
    assetPipelineStarter?.componentDefaults && typeof assetPipelineStarter.componentDefaults === "object"
      ? assetPipelineStarter.componentDefaults[String(componentId || "").trim()] || {}
      : {};
  return normalizeComposerAssetBindings({
    iconSetIds: [
      ...toStringArray(pageDefaults?.iconSetIds),
      ...toStringArray(familyDefaults?.iconSetIds),
      ...toStringArray(componentDefaults?.iconSetIds),
    ],
    badgePresetIds: [
      ...toStringArray(pageDefaults?.badgePresetIds),
      ...toStringArray(familyDefaults?.badgePresetIds),
      ...toStringArray(componentDefaults?.badgePresetIds),
    ],
    visualSetIds: [
      ...toStringArray(pageDefaults?.visualSetIds),
      ...toStringArray(familyDefaults?.visualSetIds),
      ...toStringArray(componentDefaults?.visualSetIds),
    ],
    thumbnailPresetIds: [
      ...toStringArray(pageDefaults?.thumbnailPresetIds),
      ...toStringArray(familyDefaults?.thumbnailPresetIds),
      ...toStringArray(componentDefaults?.thumbnailPresetIds),
    ],
  });
}

function buildDemoComposerResult(builderInput = {}) {
  const approvedPlan = builderInput?.approvedPlan || {};
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const designReferenceLibrary = builderInput?.systemContext?.designReferenceLibrary || {};
  const referenceAnchors = Array.isArray(designReferenceLibrary?.referenceAnchors) ? designReferenceLibrary.referenceAnchors : [];
  const assetPipelineStarter = builderInput?.systemContext?.designToolContext?.assetPipelineStarter || {};
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  const patchDepth = normalizePatchDepth(builderInput?.generationOptions?.patchDepth, "medium");
  const pickTemplateId = (slotId, anchor = null) => {
    const intentText = [
      ...safeArray(anchor?.why, 4),
      ...safeArray(anchor?.intentTags, 6),
    ]
      .join(" ")
      .toLowerCase();
    if (slotId === "hero") {
      if (/centered|spotlight|statement|minimal|mono-hero/.test(intentText)) return "hero-centered-v1";
      if (/stacked|layered|vertical|campaign|poster/.test(intentText)) return "hero-stacked-v1";
      if (/premium|luxury|stage|contrast|cinematic|ferrari|bold/.test(intentText) || patchDepth === "full") return "hero-premium-stage-v1";
      if (/editorial|story|magazine|wise|brand-story/.test(intentText) || patchDepth === "strong") return "hero-editorial-v1";
      return "hero-carousel-composition-v1";
    }
    if (slotId === "quickmenu") {
      if (/editorial|story|curation|magazine/.test(intentText) || patchDepth === "full") return "quickmenu-editorial-strip-v1";
      if (/panel|spotlight|lead-card|feature-grid/.test(intentText) || patchDepth === "strong") return "quickmenu-panel-v1";
      return "icon-link-grid-composition-v1";
    }
    return "";
  };
  const focusSlots = Array.from(new Set([
    ...toStringArray(builderInput?.generationOptions?.targetComponents).map((item) => inferSlotIdFromComponentId(item) || String(item || "").trim()),
    ...toStringArray(approvedPlan?.builderBrief?.suggestedFocusSlots),
    ...editableComponents.slice(0, 4).map((item) => String(item?.slotId || "").trim()),
  ].filter(Boolean))).slice(0, 6);
  const tree = focusSlots.map((slotId, index) => {
    const editable = editableComponents.find((item) => String(item?.slotId || "").trim() === slotId) || {};
    const componentId = String(editable?.componentId || (pageId ? `${pageId}.${slotId}` : "")).trim();
    const familyId = findComponentCompositionFamilyId(builderInput, componentId);
    const anchor = referenceAnchors.find((item) => {
      const targets = Array.isArray(item?.targetComponents) ? item.targetComponents.map((value) => String(value || "").trim()) : [];
      return targets.includes(componentId) || targets.includes(slotId);
    }) || referenceAnchors[index] || null;
    const templateId = pickTemplateId(slotId, anchor);
    const premiumHero = templateId === "hero-premium-stage-v1";
    const editorialHero = templateId === "hero-editorial-v1";
    const editorialQuickmenu = templateId === "quickmenu-editorial-strip-v1";
    return {
      slotId,
      componentId,
      familyId,
      templateId,
      label: `${slotId} composition intent`,
      layoutGoal: slotId === "hero"
        ? "상단 대표 비주얼의 위계를 badge / headline / support copy / CTA 중심으로 더 선명하게 재정렬"
        : `${slotId} 섹션의 핵심 메시지와 시각 밀도를 더 분명하게 재구성`,
      hierarchy: slotId === "hero" ? "hero-led lead block" : "title-first entry block",
      visualDirection: anchor?.why?.[0] || toStringArray(approvedPlan?.designDirection)[0] || "브랜드 톤을 유지하면서 더 분명한 리듬으로 정리",
      preservedElements: ["페이지 정체성", "핵심 사실 정보"],
      changedElements: ["카피 위계", "시선 흐름", "강조 요소 밀도"],
      referenceAnchorIds: anchor?.id ? [anchor.id] : [],
      interactionTone: slotId === "quickmenu" ? "hover-emphasis" : "calm-premium",
      tokenHints: slotId === "hero"
        ? {
            titleSize: premiumHero ? "56" : editorialHero ? "50" : "46",
            descriptionSize: premiumHero ? "18" : "17",
            emphasisMode: premiumHero ? "high-contrast-stage" : editorialHero ? "editorial-lead" : "clean-hero",
            cardRadius: premiumHero ? "36" : "30",
          }
        : {
            iconScale: editorialQuickmenu ? "compact-editorial" : "solid-panel",
            titleSize: editorialQuickmenu ? "17" : "16",
            density: editorialQuickmenu ? "low" : "medium",
            cardRadius: editorialQuickmenu ? "24" : "28",
          },
      assetPlan: normalizeComposerAssetBindings(anchor?.assetPlan || buildPreferredStarterAssetBindings(assetPipelineStarter, componentId, familyId)),
    };
  });
  return {
    summary: `${String(builderInput?.pageContext?.pageLabel || pageId || "page").trim()} composition intent ready`,
    composition: {
      focusSlots,
      referenceUse: safeArray(referenceAnchors, 3).map((anchor) => ({
        anchorId: anchor?.id,
        slotId: tree.find((item) => toStringArray(item.referenceAnchorIds).includes(anchor?.id))?.slotId || "",
        componentId: tree.find((item) => toStringArray(item.referenceAnchorIds).includes(anchor?.id))?.componentId || "",
        why: toStringArray(anchor?.why)[0] || "",
        avoid: safeArray(anchor?.avoid, 3),
      })),
      compositionTree: tree,
      styleContract: tree.map((item) => ({
        slotId: item.slotId,
        componentId: item.componentId,
        templateId: item.templateId || "",
        surfaceTone:
          item.templateId === "hero-premium-stage-v1"
            ? "premium-stage"
            : item.templateId === "hero-centered-v1"
              ? "minimal-spotlight"
              : item.templateId === "hero-stacked-v1"
                ? "campaign-layered"
            : item.templateId === "hero-editorial-v1" || item.templateId === "quickmenu-editorial-strip-v1"
              ? "editorial-bright"
              : "clean-card",
        density:
          item.templateId === "quickmenu-editorial-strip-v1"
            ? "low"
            : item.slotId === "quickmenu"
              ? "medium"
              : "low",
        hierarchyEmphasis:
          item.templateId === "hero-premium-stage-v1"
            ? "headline-dominant-stage"
            : item.templateId === "hero-centered-v1"
              ? "headline-centered-spotlight"
              : item.templateId === "hero-stacked-v1"
                ? "headline-dominant-layered"
            : item.slotId === "hero"
              ? "headline-dominant"
              : "entry-card-balanced",
        interactionTone: item.interactionTone,
        tokenHints: item.tokenHints,
      })),
      assetBindings: buildPreferredStarterAssetBindings(assetPipelineStarter, "", ""),
      negativeConstraints: [
        "설명 메타를 실제 시안 본문 텍스트로 출력하지 말 것",
        "브랜드 정체성과 사실 정보는 유지할 것",
      ],
    },
  };
}

function normalizeComposerResult(result = {}, builderInput = {}) {
  const source = result && typeof result === "object" ? result : {};
  const composition = source.composition && typeof source.composition === "object"
    ? source.composition
    : (source.compositionResult && typeof source.compositionResult === "object" ? source.compositionResult : {});
  return {
    summary: String(source.summary || source.message || `${String(builderInput?.pageContext?.pageLabel || "page").trim()} composition ready`).trim(),
    composition: {
      focusSlots: toStringArray(composition.focusSlots).slice(0, 8),
      referenceUse: (Array.isArray(composition.referenceUse) ? composition.referenceUse : [])
        .map((item) => normalizeComposerReferenceUseEntry(item))
        .filter(Boolean)
        .slice(0, 8),
      compositionTree: (Array.isArray(composition.compositionTree) ? composition.compositionTree : [])
        .map((item, index) => normalizeComposerTreeEntry(item, builderInput, index))
        .filter(Boolean)
        .slice(0, 12),
      styleContract: (Array.isArray(composition.styleContract) ? composition.styleContract : [])
        .map((item) => normalizeComposerStyleContractEntry(item))
        .filter(Boolean)
        .slice(0, 12),
      assetBindings: normalizeComposerAssetBindings(composition.assetBindings || {}),
      negativeConstraints: toStringArray(composition.negativeConstraints).slice(0, 10),
    },
  };
}

async function handleLlmCompose(builderInput = {}) {
  const primaryModel = resolveOpenRouterModel("COMPOSER_MODEL", "BUILDER_MODEL", "OPENROUTER_MODEL");
  const fallbackModels = resolveOpenRouterModelCandidates("COMPOSER_FALLBACK_MODEL", "BUILDER_FALLBACK_MODEL", "BUILDER_MODEL")
    .filter((model) => model !== primaryModel);
  const composerTimeoutMs = Math.max(60_000, Number(process.env.COMPOSER_REQUEST_TIMEOUT_MS || process.env.BUILDER_REQUEST_TIMEOUT_MS || process.env.LLM_REQUEST_TIMEOUT_MS || 180_000));
  const composerMaxTokens = resolveOpenRouterMaxTokens(process.env.COMPOSER_MAX_TOKENS, 2048);
  const patchDepth = normalizePatchDepth(builderInput?.generationOptions?.patchDepth, "medium");
  const composerTemperature = patchDepth === "full" ? 0.34 : patchDepth === "strong" ? 0.28 : patchDepth === "light" ? 0.12 : 0.18;
  const requestMessages = [
    { role: "system", content: buildComposerSystemPrompt() },
    { role: "user", content: buildReferenceVisualUserContent(buildComposerUserPrompt(builderInput), builderInput, "Composer reference screenshots") },
  ];
  const composerPromptChars = measureMessageChars(requestMessages);
  console.log(
    `[composer] model=${primaryModel} timeoutMs=${composerTimeoutMs} promptChars=${composerPromptChars} layer=${String(builderInput?.generationOptions?.interventionLayer || "page")} depth=${patchDepth}`
  );
  let result;
  try {
    result = await withLlmTimeout(
      callOpenRouterJson({
        model: primaryModel,
        temperature: composerTemperature,
        demoFallback: () => buildDemoComposerResult(builderInput),
        messages: requestMessages,
        maxTokens: composerMaxTokens,
      }),
      "Composer request",
      composerTimeoutMs
    );
  } catch (error) {
    if (!fallbackModels.length || !isRetryableOpenRouterFailure(error)) throw error;
    console.warn(`[composer] primary-failed model=${primaryModel} reason=${String(error?.message || error || "").trim()}`);
    let recovered = false;
    let lastFallbackError = error;
    for (const fallbackModel of fallbackModels) {
      try {
        result = await withLlmTimeout(
          callOpenRouterJson({
            model: fallbackModel,
            temperature: composerTemperature,
            demoFallback: () => buildDemoComposerResult(builderInput),
            messages: requestMessages,
            maxTokens: composerMaxTokens,
          }),
          "Composer fallback request",
          composerTimeoutMs
        );
        recovered = true;
        break;
      } catch (fallbackError) {
        logModelFallbackFailure("composer", fallbackModel, fallbackError);
        lastFallbackError = fallbackError;
        if (!isRetryableOpenRouterFailure(fallbackError)) throw fallbackError;
      }
    }
    if (!recovered) throw lastFallbackError;
  }
  const normalized = normalizeComposerResult(result, builderInput);
  console.log(
    `[composer] success page=${String(builderInput?.pageContext?.workspacePageId || "")} focusSlots=${toStringArray(normalized?.composition?.focusSlots).length} tree=${safeArray(normalized?.composition?.compositionTree, 20).length} anchors=${safeArray(normalized?.composition?.referenceUse, 20).length}`
  );
  return normalized;
}

function buildFixSystemPrompt() {
  return [
    "You are the Fix pass for an admin preview workbench.",
    "Persona: a precise corrective design operator who only fixes the dimensions the critic flagged, without redoing the whole draft.",
    "Your job is to read the current draft result, the critic retry trigger, the approved plan, and the Composer intent, then emit a narrow set of executable operations that resolve the flagged issues.",
    "Do not restate the whole design. Do not widen the scope. Do not touch unaffected slots unless the critic explicitly requires a coordinated fix.",
    "Use only supported actions: replace_component_template, update_component_patch, update_slot_text, update_hero_field, update_slot_image, update_page_title.",
    "Return JSON only.",
    "Required top-level keys: summary, fixResult.",
    "Required fixResult keys: operations, whatChanged, whyChanged, assumptions.",
  ].join(" ");
}

function buildFixUserPrompt(builderInput = {}, currentBuildResult = {}) {
  const critic = currentBuildResult?.report?.critic && typeof currentBuildResult.report.critic === "object"
    ? currentBuildResult.report.critic
    : {};
  const visualComparison = critic?.visualComparison && typeof critic.visualComparison === "object"
    ? critic.visualComparison
    : {};
  const recoveryRouter = builderInput?.systemContext?.recoveryRouter && typeof builderInput.systemContext.recoveryRouter === "object"
    ? builderInput.systemContext.recoveryRouter
    : {};
  const sectionFamilyContracts = builderInput?.systemContext?.designToolContext?.sectionFamilyContracts || {};
  const payload = {
    generationOptions: builderInput?.generationOptions || {},
    pageContext: builderInput?.pageContext || {},
    approvedPlan: builderInput?.approvedPlan || {},
    compositionResult: builderInput?.compositionResult || null,
    editableComponents: safeArray(builderInput?.systemContext?.editableComponents, 8).map((item) => ({
      slotId: item?.slotId,
      componentId: item?.componentId,
      patchSchema: {
        rootKeys: toStringArray(item?.patchSchema?.rootKeys),
        styleKeys: toStringArray(item?.patchSchema?.styleKeys),
      },
    })),
    currentBuildResult: {
      proposedVersionLabel: currentBuildResult?.proposedVersionLabel || "",
      changedTargets: safeArray(currentBuildResult?.changedTargets, 12),
      operations: safeArray(currentBuildResult?.operations, 20),
      report: {
        whatChanged: safeArray(currentBuildResult?.report?.whatChanged, 8),
        whyChanged: safeArray(currentBuildResult?.report?.whyChanged, 8),
        assumptions: safeArray(currentBuildResult?.report?.assumptions, 8),
        componentComposition: safeArray(currentBuildResult?.report?.componentComposition, 8),
      },
    },
    criticRetryTrigger: critic?.retryTrigger || {},
    criticFindings: safeArray(critic?.findings, 8),
    recoveryRouter: {
      mode: String(recoveryRouter?.mode || "").trim(),
      rationale: String(recoveryRouter?.rationale || "").trim(),
      targetSlots: toStringArray(recoveryRouter?.targetSlots).slice(0, 8),
      instructions: toStringArray(recoveryRouter?.instructions).slice(0, 8),
      attempted: Boolean(recoveryRouter?.attempted),
    },
    visualComparison: {
      scores: visualComparison?.scores || {},
      findings: safeArray(visualComparison?.findings, 8),
      strengths: safeArray(visualComparison?.strengths, 6),
      targetSlots: toStringArray(visualComparison?.targetSlots).slice(0, 8),
      delta: visualComparison?.delta || null,
      referenceSource: visualComparison?.referenceSource || null,
    },
    sectionFamilyContracts: {
      identityEnvelope: {
        interventionLayer: sectionFamilyContracts?.identityEnvelope?.interventionLayer || null,
        band: sectionFamilyContracts?.identityEnvelope?.band || null,
        label: sectionFamilyContracts?.identityEnvelope?.label || null,
        intent: sectionFamilyContracts?.identityEnvelope?.intent || "",
        preserve: safeArray(sectionFamilyContracts?.identityEnvelope?.preserve, 5),
        allow: safeArray(sectionFamilyContracts?.identityEnvelope?.allow, 5),
        avoid: safeArray(sectionFamilyContracts?.identityEnvelope?.avoid, 5),
        pagePreserve: safeArray(sectionFamilyContracts?.identityEnvelope?.pagePreserve, 4),
        pageAvoid: safeArray(sectionFamilyContracts?.identityEnvelope?.pageAvoid, 4),
      },
      clusters: safeArray(sectionFamilyContracts?.clusters, 4).map((item) => ({
        clusterId: item?.clusterId,
        targetSlots: safeArray(item?.targetSlots, 6),
        goal: item?.goal || "",
        rules: safeArray(item?.rules, 5),
      })),
      families: safeArray(sectionFamilyContracts?.families, 6).map((item) => ({
        familyId: item?.familyId,
        targetSlots: safeArray(item?.targetSlots, 6),
        requiredOutcomes: safeArray(item?.requiredOutcomes, 5),
        visualRules: safeArray(item?.visualRules, 5),
        criticRules: safeArray(item?.criticRules, 5),
      })),
    },
  };
  return [
    "Produce only the narrow corrective operations needed for the flagged dimensions.",
    "Prefer fixing missing focus slots, insufficient change depth, and unsupported narrative claims before anything else.",
    "If visualComparison exists, treat it as the highest-priority evidence for what looks wrong in the rendered output.",
    "If sectionFamilyContracts exist, use them to fix hierarchy at the family or top-stage cluster level rather than applying cosmetic micro-adjustments.",
    "Respect sectionFamilyContracts.identityEnvelope while fixing. Narrow scopes should repair hierarchy without drifting away from the surrounding clone identity; broader scopes may restage more as long as the page still feels like the same product and channel.",
    "When visualComparison failedDimensions or findings mention hierarchy, alignment, reference alignment, or weak change strength, prefer structural fixes such as stronger template replacement, clearer lead-card hierarchy, larger headline contrast, and more visible composition movement within the allowed scope.",
    "If recoveryRouter.mode is provided, treat it as the required recovery strategy for this pass. composition-recovery means stronger template/layout change, asset-assisted-recovery means lean harder on available assetPlan/generatedAssets and visual support, generation-backed-recovery means produce a stronger visually led rebuild that assumes high-impact generated visuals are available.",
    "If the critic says change depth is too weak, increase structural movement only inside the allowed slots and patch surface.",
    "If no safe fix is possible, return an empty operations array and explain why.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

function normalizeFixResult(result = {}, pageId = "") {
  const source = result && typeof result === "object" ? result : {};
  const fixResult = source.fixResult && typeof source.fixResult === "object" ? source.fixResult : {};
  return {
    summary: String(source.summary || "targeted fix applied").trim(),
    fixResult: {
      operations: Array.isArray(fixResult.operations)
        ? fixResult.operations.map((item) => normalizeBuilderOperation(item, pageId)).filter(Boolean)
        : [],
      whatChanged: toStringArray(fixResult.whatChanged),
      whyChanged: toStringArray(fixResult.whyChanged),
      assumptions: toStringArray(fixResult.assumptions),
    },
  };
}

async function handleLlmFix(builderInput = {}, currentBuildResult = {}) {
  const primaryModel = resolveOpenRouterModel("FIXER_MODEL", "BUILDER_MODEL", "OPENROUTER_MODEL");
  const fallbackModels = resolveOpenRouterModelCandidates("FIXER_FALLBACK_MODEL", "BUILDER_FALLBACK_MODEL", "BUILDER_MODEL")
    .filter((model) => model !== primaryModel);
  const fixTimeoutMs = Math.max(60_000, Number(process.env.FIXER_REQUEST_TIMEOUT_MS || process.env.BUILDER_REQUEST_TIMEOUT_MS || process.env.LLM_REQUEST_TIMEOUT_MS || 180_000));
  const fixMaxTokens = resolveOpenRouterMaxTokens(process.env.FIXER_MAX_TOKENS, 2048);
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const designChangeLevel = normalizeDesignChangeLevel(builderInput?.generationOptions?.designChangeLevel, "medium");
  const patchDepth = normalizePatchDepth(
    builderInput?.generationOptions?.patchDepth,
    designChangeLevel === "low" ? "light" : designChangeLevel === "high" ? "strong" : "medium"
  );
  const requestMessages = [
    { role: "system", content: buildFixSystemPrompt() },
    { role: "user", content: buildFixUserPrompt(builderInput, currentBuildResult) },
  ];
  const retryTrigger = currentBuildResult?.report?.critic?.retryTrigger || {};
  const failedDimensions = toStringArray(retryTrigger?.failedDimensions).map((item) =>
    String(item || "")
      .trim()
      .replace(/^visual:/i, "")
  );
  const hasVisualFailure = failedDimensions.some((item) =>
    ["hierarchy", "alignment", "referenceAlignment", "brandFit", "changeStrength"].includes(item)
  );
  const hasStructuralFailure = failedDimensions.some((item) =>
    ["planCoverage", "changeDepth", "identityFit", "claimAccuracy", "governance"].includes(item)
  );
  const fixTemperature =
    patchDepth === "full"
      ? (hasVisualFailure ? 0.28 : 0.24)
      : patchDepth === "strong"
        ? (hasVisualFailure ? 0.24 : 0.2)
        : patchDepth === "light"
          ? 0.1
          : hasVisualFailure
            ? 0.2
            : hasStructuralFailure || designChangeLevel === "high"
              ? 0.16
              : 0.12;
  console.log(
    `[fix] request page=${pageId} targetSlots=${toStringArray(retryTrigger?.targetSlots).length} failedDimensions=${toStringArray(retryTrigger?.failedDimensions).join(",") || "none"} temp=${fixTemperature}`
  );
  let result;
  try {
    result = await withLlmTimeout(
      callOpenRouterJson({
        model: primaryModel,
        temperature: fixTemperature,
        demoFallback: () => ({
          summary: "No additional fix required",
          fixResult: { operations: [], whatChanged: [], whyChanged: [], assumptions: [] },
        }),
        messages: requestMessages,
        maxTokens: fixMaxTokens,
      }),
      "Fix request",
      fixTimeoutMs
    );
  } catch (error) {
    if (!fallbackModels.length || !isRetryableOpenRouterFailure(error)) throw error;
    console.warn(`[fix] primary-failed model=${primaryModel} reason=${String(error?.message || error || "").trim()}`);
    let recovered = false;
    let lastFallbackError = error;
    for (const fallbackModel of fallbackModels) {
      try {
        result = await withLlmTimeout(
          callOpenRouterJson({
            model: fallbackModel,
            temperature: fixTemperature,
            demoFallback: () => ({
              summary: "No additional fix required",
              fixResult: { operations: [], whatChanged: [], whyChanged: [], assumptions: [] },
            }),
            messages: requestMessages,
            maxTokens: fixMaxTokens,
          }),
          "Fix fallback request",
          fixTimeoutMs
        );
        recovered = true;
        break;
      } catch (fallbackError) {
        logModelFallbackFailure("fix", fallbackModel, fallbackError);
        lastFallbackError = fallbackError;
        if (!isRetryableOpenRouterFailure(fallbackError)) throw fallbackError;
      }
    }
    if (!recovered) throw lastFallbackError;
  }
  const normalized = normalizeFixResult(result, pageId);
  console.log(
    `[fix] success page=${pageId} operations=${safeArray(normalized?.fixResult?.operations, 50).length} whatChanged=${toStringArray(normalized?.fixResult?.whatChanged).length}`
  );
  return normalized;
}

function normalizeVersionLabel(value, fallback = "draft-v1") {
  const next = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
}

function normalizeBuilderSummaryValue(value, fallback) {
  if (typeof value === "string") return value.trim() || fallback;
  if (value && typeof value === "object") {
    return String(value.summary || value.title || value.message || fallback).trim() || fallback;
  }
  return fallback;
}

function normalizeBuilderAssetReferences(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    iconSetIds: toStringArray(source.iconSetIds),
    badgePresetIds: toStringArray(source.badgePresetIds),
    visualSetIds: toStringArray(source.visualSetIds),
    thumbnailPresetIds: toStringArray(source.thumbnailPresetIds),
    generatedAssets: safeArray(source.generatedAssets, 12)
      .map((item) => normalizeGeneratedAssetReference(item))
      .filter((item) => item.assetUrl),
  };
}

function normalizeStarterAssetCatalogEntry(item = {}) {
  const source = item && typeof item === "object" ? item : {};
  const width = Number.parseInt(source.width, 10);
  const height = Number.parseInt(source.height, 10);
  return {
    id: String(source.id || "").trim(),
    label: String(source.label || "").trim(),
    assetUrl: String(source.assetUrl || "").trim(),
    format: String(source.format || "").trim(),
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    aspectRatio: String(source.aspectRatio || "").trim(),
    role: String(source.role || "").trim(),
    tags: toStringArray(source.tags),
  };
}

function buildStarterAssetPipelineLookup(assetPipelineStarter = {}) {
  const assetCatalog = (Array.isArray(assetPipelineStarter?.assetCatalog) ? assetPipelineStarter.assetCatalog : [])
    .map((item) => normalizeStarterAssetCatalogEntry(item))
    .filter((item) => item.id && item.assetUrl);
  const assetMap = new Map(assetCatalog.map((item) => [item.id, item]));
  const normalizeCollection = (items = []) =>
    (Array.isArray(items) ? items : [])
      .map((item) => {
        const entry = item && typeof item === "object" ? item : {};
        const assetIds = toStringArray(entry.assetIds);
        return {
          ...entry,
          id: String(entry.id || "").trim(),
          assetIds,
          assets: assetIds.map((assetId) => assetMap.get(assetId)).filter(Boolean),
        };
      })
      .filter((item) => item.id);
  return {
    assetCatalog,
    assetMap,
    iconSets: normalizeCollection(assetPipelineStarter?.iconSets),
    badgePresets: normalizeCollection(assetPipelineStarter?.badgePresets),
    visualSets: normalizeCollection(assetPipelineStarter?.visualSets),
    thumbnailPresets: normalizeCollection(assetPipelineStarter?.thumbnailPresets),
    geometrySpecs:
      assetPipelineStarter?.geometrySpecs && typeof assetPipelineStarter.geometrySpecs === "object"
        ? assetPipelineStarter.geometrySpecs
        : {},
  };
}

function parseAspectRatioValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  const parts = raw.split(":").map((item) => Number.parseFloat(item));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1]) || parts[1] === 0) return null;
  return parts[0] / parts[1];
}

function findBuilderEditableComponentId(builderInput = {}, pageId = "", slotId = "") {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedSlotId = String(slotId || "").trim();
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  const direct = editableComponents.find((item) => {
    return (
      String(item?.pageId || normalizedPageId).trim() === normalizedPageId &&
      String(item?.slotId || "").trim() === normalizedSlotId
    );
  });
  if (direct?.componentId) return String(direct.componentId).trim();
  return normalizedPageId && normalizedSlotId ? `${normalizedPageId}.${normalizedSlotId}` : "";
}

function resolveComponentGeometrySpec(builderInput = {}, componentId = "", slotId = "") {
  const assetPipelineStarter = builderInput?.systemContext?.designToolContext?.assetPipelineStarter || {};
  const geometrySpecs =
    assetPipelineStarter?.geometrySpecs && typeof assetPipelineStarter.geometrySpecs === "object"
      ? assetPipelineStarter.geometrySpecs
      : {};
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedSlotId = String(slotId || inferSlotIdFromComponentId(componentId) || "").trim();
  return (
    (normalizedComponentId && geometrySpecs[normalizedComponentId]) ||
    (normalizedSlotId && geometrySpecs[normalizedSlotId]) ||
    null
  );
}

function checkComponentAssetFit(assetEntry = {}, geometrySpec = null) {
  if (!geometrySpec || typeof geometrySpec !== "object") return { ok: true, reasons: [] };
  const reasons = [];
  const assetRole = String(assetEntry?.role || "").trim().toLowerCase();
  const allowedRoles = toStringArray(geometrySpec?.allowedRoles).map((item) => item.toLowerCase());
  if (allowedRoles.length && assetRole && !allowedRoles.includes(assetRole)) {
    reasons.push("asset role not allowed for target geometry");
  }
  const minWidth = Number.parseInt(geometrySpec?.minWidth, 10);
  const minHeight = Number.parseInt(geometrySpec?.minHeight, 10);
  if (Number.isFinite(minWidth) && Number.isFinite(assetEntry?.width) && assetEntry.width < minWidth) {
    reasons.push("asset width below geometry minimum");
  }
  if (Number.isFinite(minHeight) && Number.isFinite(assetEntry?.height) && assetEntry.height < minHeight) {
    reasons.push("asset height below geometry minimum");
  }
  const preferredRatio = parseAspectRatioValue(geometrySpec?.preferredAspectRatio);
  const assetRatio = parseAspectRatioValue(assetEntry?.aspectRatio);
  if (preferredRatio && assetRatio) {
    const drift = Math.abs(assetRatio - preferredRatio) / preferredRatio;
    if (drift > 0.45) reasons.push("asset aspect ratio drifts too far from geometry");
  }
  return {
    ok: reasons.length === 0,
    reasons,
  };
}

function resolveStarterAssetPlan(builderInput = {}, componentId = "", familyId = "", value = {}) {
  const assetPipelineStarter = builderInput?.systemContext?.designToolContext?.assetPipelineStarter || {};
  const registry = buildStarterAssetPipelineLookup(assetPipelineStarter);
  const defaults = buildPreferredStarterAssetBindings(assetPipelineStarter, componentId, familyId);
  const requested = normalizeBuilderAssetReferences(value);
  const iconSetIds = Array.from(new Set([...defaults.iconSetIds, ...requested.iconSetIds]));
  const badgePresetIds = Array.from(new Set([...defaults.badgePresetIds, ...requested.badgePresetIds]));
  const visualSetIds = Array.from(new Set([...defaults.visualSetIds, ...requested.visualSetIds]));
  const thumbnailPresetIds = Array.from(new Set([...defaults.thumbnailPresetIds, ...requested.thumbnailPresetIds]));
  const geometrySpec = resolveComponentGeometrySpec(builderInput, componentId, inferSlotIdFromComponentId(componentId));
  const generatedAssets = safeArray(requested.generatedAssets, 12).filter((item) => checkComponentAssetFit(item, geometrySpec).ok);
  const resolveCollection = (items = [], ids = []) =>
    toStringArray(ids)
      .map((id) => (Array.isArray(items) ? items : []).find((item) => String(item?.id || "").trim() === id))
      .filter(Boolean);
  return {
    iconSetIds,
    badgePresetIds,
    visualSetIds,
    thumbnailPresetIds,
    generatedAssets,
    geometrySpec,
    resolvedAssets: {
      iconSets: resolveCollection(registry.iconSets, iconSetIds),
      badgePresets: resolveCollection(registry.badgePresets, badgePresetIds),
      visualSets: resolveCollection(registry.visualSets, visualSetIds),
      thumbnailPresets: resolveCollection(registry.thumbnailPresets, thumbnailPresetIds),
      generatedAssets,
      icons: [
        ...generatedAssets.filter((item) => String(item.kind || "").trim() === "icon"),
        ...resolveCollection(registry.iconSets, iconSetIds).flatMap((item) => safeArray(item?.assets, 12)),
      ],
      badges: [
        ...generatedAssets.filter((item) => String(item.kind || "").trim() === "badge"),
        ...resolveCollection(registry.badgePresets, badgePresetIds).flatMap((item) => safeArray(item?.assets, 12)),
      ],
      visuals: [
        ...generatedAssets.filter((item) => String(item.kind || "").trim() === "visual"),
        ...resolveCollection(registry.visualSets, visualSetIds).flatMap((item) => safeArray(item?.assets, 12)),
      ],
      thumbnails: [
        ...generatedAssets.filter((item) => String(item.kind || "").trim() === "thumbnail"),
        ...resolveCollection(registry.thumbnailPresets, thumbnailPresetIds).flatMap((item) => safeArray(item?.assets, 12)),
      ],
    },
  };
}

function findStarterAssetByUrl(builderInput = {}, imageSrc = "") {
  const assetPipelineStarter = builderInput?.systemContext?.designToolContext?.assetPipelineStarter || {};
  const registry = buildStarterAssetPipelineLookup(assetPipelineStarter);
  const normalizedSrc = String(imageSrc || "").trim();
  if (!normalizedSrc) return null;
  const direct = registry.assetCatalog.find((item) => item.assetUrl === normalizedSrc);
  if (direct) return direct;
  const normalizedBase = normalizedSrc.split("?")[0].split("#")[0].split("/").pop();
  return registry.assetCatalog.find((item) => {
    const assetBase = String(item?.assetUrl || "").trim().split("?")[0].split("#")[0].split("/").pop();
    return assetBase && normalizedBase && assetBase === normalizedBase;
  }) || null;
}

function normalizeComponentCompositionEntry(item, pageId = "", index = 0) {
  const source = item && typeof item === "object" ? item : {};
  const slotId = String(source.slotId || inferSlotIdFromComponentId(source.componentId) || "").trim();
  const componentId = String(source.componentId || (pageId && slotId ? `${pageId}.${slotId}` : "")).trim();
  const familyId = String(source.familyId || "").trim();
  const templateId = String(source.templateId || "").trim();
  const label = String(source.label || slotId || componentId || `composition-${index + 1}`).trim();
  const summary = String(source.summary || source.description || "").trim();
  const layoutStrategy = String(source.layoutStrategy || source.layout || "").trim();
  const recipeId = String(source.recipeId || source?.primitiveTree?.props?.recipeId || "").trim();
  const scope = String(source.scope || "component").trim() || "component";
  const preservedElements = toStringArray(source.preservedElements || source.keep);
  const changedElements = toStringArray(source.changedElements || source.change);
  const assetPlan = normalizeBuilderAssetReferences(source.assetPlan || {});
  if (!slotId && !componentId && !summary && !layoutStrategy && !changedElements.length && !preservedElements.length) {
    return null;
  }
  return {
    slotId,
    componentId,
    familyId,
    templateId,
    recipeId,
    label,
    scope,
    summary,
    layoutStrategy,
    preservedElements,
    changedElements,
    assetPlan,
    primitiveTree: normalizeCompositionPrimitiveTree(source.primitiveTree || source.primitive || null),
  };
}

function normalizeComponentCompositionList(value, pageId = "") {
  return (Array.isArray(value) ? value : [])
    .map((item, index) => normalizeComponentCompositionEntry(item, pageId, index))
    .filter(Boolean)
    .slice(0, 12);
}

function synthesizeComponentCompositionFromTemplateOperations(operations = [], builderInput = {}) {
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  return safeArray(operations, 20)
    .filter((item) => String(item?.action || "").trim() === "replace_component_template")
    .map((item, index) => normalizeComponentCompositionEntry({
      slotId: String(item?.slotId || "").trim(),
      componentId: String(item?.componentId || "").trim() || (pageId && item?.slotId ? `${pageId}.${item.slotId}` : ""),
      familyId: String(item?.familyId || "").trim(),
      templateId: String(item?.templateId || "").trim(),
      label: `${String(item?.slotId || `component-${index + 1}`).trim()} 전면개편안`,
      summary: String(item?.summary || "기존 컴포넌트를 새 구조로 교체합니다.").trim(),
      layoutStrategy: String(item?.layoutStrategy || "").trim(),
      preservedElements: toStringArray(item?.preservedElements),
      changedElements: toStringArray(item?.changedElements),
      assetPlan: normalizeBuilderAssetReferences(item?.assetPlan || {}),
      primitiveTree:
        normalizeCompositionPrimitiveTree(item?.primitiveTree || null) ||
        synthesizePrimitiveTreeForComponent(String(item?.slotId || "").trim(), String(item?.templateId || "").trim(), null, item),
    }, pageId, index))
    .filter(Boolean)
    .slice(0, 12);
}

function findComponentCompositionFamilyId(builderInput = {}, componentId = "") {
  const normalizedComponentId = String(componentId || "").trim();
  if (!normalizedComponentId) return "";
  const assignments = Array.isArray(builderInput?.systemContext?.designToolContext?.componentRebuildSchemaCatalog?.assignments)
    ? builderInput.systemContext.designToolContext.componentRebuildSchemaCatalog.assignments
    : [];
  const match = assignments.find((item) => String(item?.componentId || "").trim() === normalizedComponentId);
  return String(match?.familyId || "").trim();
}

function inferSlotIdFromComponentId(componentId = "") {
  const normalized = String(componentId || "").trim();
  if (!normalized) return "";
  const parts = normalized.split(".");
  return parts[parts.length - 1] || "";
}

function isBuilderSourceSwitchAllowed(sourceId = "") {
  const normalized = String(sourceId || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("figma-")) return false;
  if (normalized.startsWith("custom-")) return false;
  if (normalized === "custom-renderer") return false;
  if (normalized.includes("draft")) return false;
  if (normalized.includes("experimental")) return false;
  return false;
}

function normalizeBuilderOperation(item, pageId = "") {
  const source = item && typeof item === "object" ? item : {};
  const tool = String(source.tool || source.action || "").trim();
  const slotId = String(source.slotId || inferSlotIdFromComponentId(source.componentId)).trim();
  const resolvedPageId = String(source.pageId || pageId || "").trim();
  if (!tool) return null;

  if (tool === "toggle_slot_source" || tool === "slot_source_switch") {
    const sourceId = String(source.sourceId || "").trim();
    if (!resolvedPageId || !slotId || !sourceId) return null;
    if (!isBuilderSourceSwitchAllowed(sourceId)) return null;
    return {
      action: "toggle_slot_source",
      pageId: resolvedPageId,
      slotId,
      sourceId,
    };
  }

  if (tool === "update_component_patch" || tool === "component_patch") {
    const rawPatch = source.patch && typeof source.patch === "object" ? source.patch : {};
    const normalizedPatch = {
      ...((rawPatch.root && typeof rawPatch.root === "object") ? rawPatch.root : {}),
      ...Object.fromEntries(
        Object.entries(rawPatch).filter(([key]) => key !== "root" && key !== "style" && key !== "styles")
      ),
    };
    const styleSource =
      (rawPatch.styles && typeof rawPatch.styles === "object" ? rawPatch.styles : null) ||
      (rawPatch.style && typeof rawPatch.style === "object" ? rawPatch.style : null);
    if (styleSource && Object.keys(styleSource).length) {
      normalizedPatch.styles = { ...styleSource };
    }
    if (!resolvedPageId || !slotId || !Object.keys(normalizedPatch).length) return null;
    const finalPatch =
      resolvedPageId === "home"
        ? normalizeHomeBuilderPatch(slotId, normalizedPatch)
        : normalizedPatch;
    return {
      action: "update_component_patch",
      pageId: resolvedPageId,
      slotId,
      patch: finalPatch,
    };
  }

  if (tool === "replace_component_template" || tool === "component_template_replace" || tool === "replace_template") {
    const componentId = String(source.componentId || (resolvedPageId && slotId ? `${resolvedPageId}.${slotId}` : "")).trim();
    const familyId = String(source.familyId || source.templateFamilyId || "").trim();
    const templateId = String(source.templateId || source.variant || familyId || "").trim();
    if (!resolvedPageId || !slotId || !componentId || !familyId) return null;
    return {
      action: "replace_component_template",
      pageId: resolvedPageId,
      slotId,
      componentId,
      familyId,
      templateId,
      summary: String(source.summary || "").trim(),
      layoutStrategy: String(source.layoutStrategy || source.layoutGoal || "").trim(),
      preservedElements: toStringArray(source.preservedElements || source.keep),
      changedElements: toStringArray(source.changedElements || source.change),
      assetPlan: normalizeBuilderAssetReferences(source.assetPlan || source.assetReferences || {}),
    };
  }

  if (tool === "update_slot_text" || tool === "update_hero_field" || tool === "update_slot_image" || tool === "update_page_title") {
    return {
      ...source,
      action: tool,
      pageId: resolvedPageId,
      slotId,
    };
  }

  return source.action ? { ...source, pageId: resolvedPageId, slotId: slotId || source.slotId } : null;
}

function buildDemoBuilderResult(builderInput = {}) {
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const pageLabel = String(builderInput?.pageContext?.pageLabel || pageId || "page").trim();
  const approvedPlan = builderInput?.approvedPlan || {};
  const designChangeLevel = normalizeDesignChangeLevel(
    builderInput?.generationOptions?.designChangeLevel || approvedPlan?.designChangeLevel,
    "medium"
  );
  const patchDepth = normalizePatchDepth(
    builderInput?.generationOptions?.patchDepth || approvedPlan?.patchDepth,
    designChangeLevel === "low" ? "light" : designChangeLevel === "high" ? "strong" : "medium"
  );
  const executionStrategy = builderInput?.systemContext?.designToolContext?.executionStrategy || {};
  const assetPipelineStarter = builderInput?.systemContext?.designToolContext?.assetPipelineStarter || {};
  const pageDefaultAssets =
    assetPipelineStarter?.pageDefaults && typeof assetPipelineStarter.pageDefaults === "object"
      ? assetPipelineStarter.pageDefaults
      : {};
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  const preferredSlots = [
    ...toStringArray(approvedPlan?.builderBrief?.suggestedFocusSlots),
    ...((Array.isArray(approvedPlan?.priority) ? approvedPlan.priority : []).map((item) => String(item?.target || "").trim()).filter(Boolean)),
    ...editableComponents.map((item) => String(item?.slotId || "").trim()).filter(Boolean),
  ];
  const normalizedSlots = Array.from(new Set(preferredSlots)).filter(Boolean);
  const operations = [];
  const changedTargets = [];

  const slotPriorityScore = (slotId = "") => {
    if (slotId === "hero") return 100;
    if (slotId === "quickmenu") return 90;
    if (slotId === "timedeal" || slotId === "md-choice" || slotId === "best-ranking") return 85;
    if (slotId === "summary-banner-2" || slotId === "bestshop-guide") return 80;
    if (slotId === "subscription" || slotId === "smart-life" || slotId === "brand-showroom") return 76;
    if (slotId === "space-renewal" || slotId === "latest-product-news" || slotId === "missed-benefits" || slotId === "lg-best-care") return 72;
    if (slotId === "header-bottom") return 40;
    if (slotId === "header-top") return 30;
    return 60;
  };

  const patchableSlots = normalizedSlots
    .map((slotId) => ({
      slotId,
      editable: editableComponents.find((item) => String(item?.slotId || "").trim() === slotId) || null,
    }))
    .filter((item) => item.editable)
    .map((item) => {
      const patchSchema = item.editable.patchSchema || { rootKeys: [], styleKeys: [] };
      return {
        ...item,
        rootKeys: new Set(Array.isArray(patchSchema.rootKeys) ? patchSchema.rootKeys : []),
        styleKeys: new Set(Array.isArray(patchSchema.styleKeys) ? patchSchema.styleKeys : []),
      };
    })
    .filter((item) => item.rootKeys.size || item.styleKeys.size)
    .sort((a, b) => slotPriorityScore(b.slotId) - slotPriorityScore(a.slotId));

  const pushTextOp = (slotId, field, value) => {
    const editable = editableComponents.find((item) => String(item?.slotId || "").trim() === slotId);
    if (!editable || !String(value || "").trim()) return false;
    const patchSchema = editable.patchSchema || { rootKeys: [], styleKeys: [] };
    const normalizedField = field === "headline" ? "title" : field;
    if (!Array.isArray(patchSchema.rootKeys) || !patchSchema.rootKeys.includes(normalizedField)) return false;
    operations.push({
      action: "update_slot_text",
      pageId,
      slotId,
      field: normalizedField,
      value: String(value).trim(),
    });
    changedTargets.push({
      slotId,
      componentId: editable.componentId,
      changeType: "component_patch",
    });
    return true;
  };

  const pushPatchOp = (slotId, patchInput = {}) => {
    const editable = editableComponents.find((item) => String(item?.slotId || "").trim() === slotId);
    if (!editable) return false;
    const patchSchema = editable.patchSchema || { rootKeys: [], styleKeys: [] };
    const rootKeys = new Set(Array.isArray(patchSchema.rootKeys) ? patchSchema.rootKeys : []);
    const styleKeys = new Set(Array.isArray(patchSchema.styleKeys) ? patchSchema.styleKeys : []);
    const sourcePatch = patchInput && typeof patchInput === "object" ? patchInput : {};
    const nextPatch = {};
    for (const [key, value] of Object.entries(sourcePatch)) {
      if (key === "styles" && value && typeof value === "object") {
        const nextStyles = Object.fromEntries(
          Object.entries(value).filter(([styleKey, styleValue]) => styleKeys.has(styleKey) && String(styleValue ?? "").trim() !== "")
        );
        if (Object.keys(nextStyles).length) nextPatch.styles = nextStyles;
        continue;
      }
      if (!rootKeys.has(key)) continue;
      if (typeof value === "undefined" || value === null || String(value).trim() === "") continue;
      nextPatch[key] = value;
    }
    if (!Object.keys(nextPatch).length) return false;
    operations.push({
      action: "update_component_patch",
      pageId,
      slotId,
      patch: nextPatch,
    });
    changedTargets.push({
      slotId,
      componentId: editable.componentId,
      changeType: "component_patch",
    });
    return true;
  };

  const objective = String(approvedPlan?.builderBrief?.objective || "").trim();
  const designLead = toStringArray(approvedPlan?.designDirection)[0] || "";
  const requestLead = toStringArray(approvedPlan?.requestSummary)[0] || "";
  const mustChangeLead = toStringArray(approvedPlan?.builderBrief?.mustChange)[0] || "";
  const heroTitle = objective || "첫 화면에서 제안 의도가 더 분명하게 읽히는 구성";
  const heroDescription = designLead || requestLead || "브랜드 인지와 메시지 집중도가 더 명확하게 전달되도록 조정합니다.";
  const slotLimit =
    patchDepth === "light"
      ? 3
      : patchDepth === "medium"
        ? 4
        : patchDepth === "strong"
          ? 6
          : 8;

  for (const item of patchableSlots.slice(0, slotLimit)) {
    const { slotId, rootKeys, styleKeys } = item;
    const familyId = findComponentCompositionFamilyId(builderInput, item?.editable?.componentId);
    const homeRule = pageId === "home" ? buildHomePatchRule(slotId) : null;
    const stylePatch = {};
    if (styleKeys.has("titleWeight")) stylePatch.titleWeight = designChangeLevel === "high" ? "700" : "600";
    if (styleKeys.has("titleSize")) {
      stylePatch.titleSize = homeRule
        ? String(homeRule.titleSize.max)
        : designChangeLevel === "high"
          ? "30"
          : "26";
    }
    if (styleKeys.has("subtitleSize")) {
      stylePatch.subtitleSize = homeRule
        ? String(homeRule.subtitleSize.max)
        : designChangeLevel === "high"
          ? "17"
          : "15";
    }
    if (styleKeys.has("padding")) stylePatch.padding = homeRule ? homeRule.padding : (designChangeLevel === "high" ? "48px 40px" : "40px 32px");
    if (styleKeys.has("radius")) stylePatch.radius = homeRule ? homeRule.radius : "24px";
    if (styleKeys.has("minHeight") && homeRule) stylePatch.minHeight = String(homeRule.minHeight.min);
    if (styleKeys.has("background")) {
      stylePatch.background = homeRule
        ? homeRule.defaultBackground
        : slotId === "hero"
          ? "linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%)"
          : slotId === "quickmenu" || slotId === "summary-banner-2"
            ? "#f8fafc"
            : "#ffffff";
    }

    const patch = {};
    if (rootKeys.has("badge")) patch.badge = "Design Proposal";
    if (rootKeys.has("title")) patch.title = slotId === "hero" ? heroTitle : "핵심 메시지가 더 또렷하게 읽히는 섹션 구성";
    if (rootKeys.has("headline")) patch.headline = heroTitle;
    if (rootKeys.has("subtitle")) patch.subtitle = designLead || "화면 목적과 행동 유도가 더 분명하게 인지되도록 정리합니다.";
    if (rootKeys.has("description")) patch.description = slotId === "hero" ? heroDescription : (mustChangeLead || requestLead || "정보의 우선순위와 설득 흐름이 자연스럽게 이어지도록 재정리합니다.");
    if (rootKeys.has("ctaLabel")) patch.ctaLabel = slotId === "hero" ? "자세히 보기" : "더 알아보기";
    if (rootKeys.has("moreLabel")) patch.moreLabel = "전체 보기";
    if (rootKeys.has("ctaHref")) patch.ctaHref = "/home";
    if (Object.keys(stylePatch).length) patch.styles = stylePatch;
    if ((patchDepth === "strong" || patchDepth === "full") && familyId) {
      const templateId = resolvePreferredTemplateId(builderInput, slotId, item.editable.componentId);
      operations.push({
        action: "replace_component_template",
        pageId,
        slotId,
        componentId: item.editable.componentId,
        familyId,
        templateId: templateId || `${familyId}-v1`,
        summary: slotId === "hero"
          ? "히어로를 새 구조 중심 시안으로 교체합니다."
          : `${slotId} 컴포넌트를 새 구조 시안으로 교체합니다.`,
        layoutStrategy: slotId === "hero"
          ? "copy-first + visual-stage hero composition"
          : "structure-first component composition",
        preservedElements: ["페이지 정체성", "핵심 사실 정보"],
        changedElements: ["레이아웃 구조", "카피 위계", "시선 흐름"],
        assetPlan: buildPreferredStarterAssetBindings(assetPipelineStarter, item.editable.componentId, familyId),
      });
      changedTargets.push({
        slotId,
        componentId: item.editable.componentId,
        changeType: "template_replace",
      });
    }
    pushPatchOp(slotId, patch);
  }

  const uniqueTargets = [];
  const targetSeen = new Set();
  for (const item of changedTargets) {
    const key = `${item.slotId}:${item.componentId}:${item.changeType}`;
    if (targetSeen.has(key)) continue;
    targetSeen.add(key);
    uniqueTargets.push(item);
  }
  const versionLabelHint = String(builderInput?.generationOptions?.versionLabelHint || "").trim();
  const labelCore = normalizeVersionLabel(versionLabelHint || objective || pageId || "draft-v1");
  const executionMode = String(executionStrategy.executionMode || "").trim();
  const componentComposition =
    executionMode === "component-rebuild-plan"
      ? uniqueTargets.slice(0, 3).map((item, index) => ({
          templateId: resolvePreferredTemplateId(builderInput, item.slotId, item.componentId),
          familyId: findComponentCompositionFamilyId(builderInput, item.componentId),
          slotId: item.slotId,
          componentId: item.componentId,
          label: `${item.slotId || `component-${index + 1}`} 전면개편안`,
          scope: "component",
          summary:
            item.slotId === "hero"
              ? "브랜드 메시지와 행동 유도를 한 화면에서 더 강하게 읽히는 구조로 재구성합니다."
              : `${item.slotId} 컴포넌트를 현재 shell은 유지하되 새 시안 수준으로 재정리합니다.`,
          layoutStrategy:
            item.slotId === "hero"
              ? "badge / headline / support copy / primary action의 4층 구조를 재정렬하고 비주얼 주도권을 강화"
              : "핵심 메시지, 보조 설명, 반복 아이템 밀도, 액션 리듬을 다시 정렬",
          preservedElements: ["페이지 정체성", "핵심 사실 정보"],
          changedElements: ["카피 위계", "레이아웃 리듬", "강조 요소 밀도"],
          assetPlan: normalizeBuilderAssetReferences({
            iconSetIds: Array.isArray(pageDefaultAssets.iconSetIds) ? pageDefaultAssets.iconSetIds.slice(0, 2) : [],
            badgePresetIds: Array.isArray(pageDefaultAssets.badgePresetIds) ? pageDefaultAssets.badgePresetIds.slice(0, 2) : [],
            visualSetIds: Array.isArray(pageDefaultAssets.visualSetIds) ? pageDefaultAssets.visualSetIds.slice(0, 1) : [],
            thumbnailPresetIds: Array.isArray(pageDefaultAssets.thumbnailPresetIds) ? pageDefaultAssets.thumbnailPresetIds.slice(0, 2) : [],
          }),
          primitiveTree: synthesizePrimitiveTreeForComponent(
            item.slotId,
            resolvePreferredTemplateId(builderInput, item.slotId, item.componentId),
            null,
            { slotId: item.slotId }
          ),
        }))
      : [];
  const assetReferences = normalizeBuilderAssetReferences({
    iconSetIds: Array.isArray(pageDefaultAssets.iconSetIds) ? pageDefaultAssets.iconSetIds : [],
    badgePresetIds: Array.isArray(pageDefaultAssets.badgePresetIds) ? pageDefaultAssets.badgePresetIds : [],
    visualSetIds: Array.isArray(pageDefaultAssets.visualSetIds) ? pageDefaultAssets.visualSetIds : [],
    thumbnailPresetIds: Array.isArray(pageDefaultAssets.thumbnailPresetIds) ? pageDefaultAssets.thumbnailPresetIds : [],
  });
  return {
    summary: `${pageLabel} 시안 생성 완료`,
    buildResult: {
      proposedVersionLabel: `${pageId || "page"}_${labelCore}`,
      changedTargets: uniqueTargets.slice(0, 8),
      operations: operations.slice(0, 12),
      report: {
        whatChanged: uniqueTargets.slice(0, 4).map((item) => `${item.slotId} 구간의 메시지 위계와 시각 밀도를 조정해 화면 목적이 더 분명하게 읽히도록 구성했습니다.`),
        whyChanged: [
          `승인된 Planner 정리본과 designChangeLevel=${designChangeLevel} 기준으로 실제 patch 적용이 가능한 구간부터 우선 반영했습니다.`,
        ],
        assumptions: [
          "가격/스펙 같은 사실 데이터는 유지했습니다.",
        ],
        compositionPlan:
          executionMode !== "patch-execution"
            ? [
                `${pageLabel}에 대해 ${String(executionStrategy.requestedMode || "composition proposal")} 방향의 구조 재편안을 별도 제안합니다.`,
                "현재 draft는 patch surface 안에서 실행 가능한 변경만 반영했고, 넓은 레이아웃 재구성은 composition plan으로 정리합니다.",
              ]
            : [],
        componentComposition,
        assetNeeds: toStringArray(executionStrategy.assetNeeds),
        assetReferences,
        missingCapabilities: toStringArray(executionStrategy.missingCapabilities),
        guardrailCheck: toStringArray(approvedPlan?.guardrails).map((rule) => ({
          rule,
          status: "pass",
        })),
      },
    },
  };
}

function normalizeBuilderResult(result, builderInput = {}) {
  const source = result && typeof result === "object" ? result : {};
  const buildResult = source.buildResult && typeof source.buildResult === "object" ? source.buildResult : {};
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const pageLabel = String(builderInput?.pageContext?.pageLabel || pageId || "page").trim();
  const operations = Array.isArray(buildResult.operations)
    ? buildResult.operations.map((item) => normalizeBuilderOperation(item, pageId)).filter(Boolean)
    : [];
  const rawChangedTargets = Array.isArray(buildResult.changedTargets) ? buildResult.changedTargets.filter((item) => item && typeof item === "object") : [];
  const inferredChangedTargets = operations.map((item) => ({
    slotId: String(item.slotId || "").trim(),
    componentId: String(item.componentId || `${pageId}.${item.slotId || ""}`).trim(),
    changeType:
      item.action === "toggle_slot_source"
        ? "source_switch"
        : item.action === "replace_component_template"
          ? "template_replace"
          : "component_patch",
  }));
  const changedTargets = rawChangedTargets.length ? rawChangedTargets : inferredChangedTargets;
  const report = buildResult.report && typeof buildResult.report === "object" ? buildResult.report : {};
  const executionStrategy = builderInput?.systemContext?.designToolContext?.executionStrategy || {};
  const validatedConstraintDefaults = toStringArray(executionStrategy?.missingCapabilities);
  const normalizeSelectedRecipeList = (value = [], fallbackComponentComposition = []) => {
    const explicit = (Array.isArray(value) ? value : [])
      .map((item) => {
        const source = item && typeof item === "object" ? item : {};
        const scope = String(source.scope || "").trim();
        const slotId = String(source.slotId || "").trim();
        const componentId = String(source.componentId || "").trim();
        const familyId = String(source.familyId || "").trim();
        const recipeId = String(source.recipeId || "").trim();
        const templateId = String(source.templateId || "").trim();
        const primitiveId = String(source.primitiveId || "").trim();
        const variant = String(source.variant || "").trim();
        const selectionReason = String(source.selectionReason || source.reason || "").trim();
        if (!scope && !slotId && !componentId && !familyId && !recipeId && !templateId && !primitiveId && !variant) return null;
        return { scope, slotId, componentId, familyId, recipeId, templateId, primitiveId, variant, selectionReason };
      })
      .filter(Boolean)
      .slice(0, 16);
    if (explicit.length) return explicit;
    return safeArray(fallbackComponentComposition, 12)
      .map((item) => {
        const primitive = item?.primitiveTree && typeof item.primitiveTree === "object" ? item.primitiveTree : null;
        const recipeId = String(item?.recipeId || primitive?.props?.recipeId || "").trim();
        const primitiveId = String(primitive?.type || "").trim();
        const variant = String(primitive?.variant || "").trim();
        const slotId = String(item?.slotId || "").trim();
        const componentId = String(item?.componentId || "").trim();
        const familyId = String(item?.familyId || "").trim();
        const templateId = String(item?.templateId || "").trim();
        if (!recipeId && !primitiveId && !templateId) return null;
        return {
          scope: "section",
          slotId,
          componentId,
          familyId,
          recipeId,
          templateId,
          primitiveId,
          variant,
          selectionReason: "componentComposition",
        };
      })
      .filter(Boolean)
      .slice(0, 16);
  };
  let normalized = {
    summary: normalizeBuilderSummaryValue(source.summary, `${pageLabel} 시안 생성 완료`),
    buildResult: {
      proposedVersionLabel: String(buildResult.proposedVersionLabel || `${pageId || "page"}_draft-v1`).trim(),
      changedTargets: changedTargets.map((item) => ({
        slotId: String(item.slotId || "").trim(),
        componentId: String(item.componentId || "").trim(),
        changeType: String(item.changeType || "component_patch").trim(),
      })).filter((item) => item.slotId || item.componentId),
      operations,
      report: {
        whatChanged: toStringArray(report.whatChanged),
        whyChanged: toStringArray(report.whyChanged),
        assumptions: toStringArray(report.assumptions),
        compositionPlan: toStringArray(report.compositionPlan),
        componentComposition: normalizeComponentCompositionList(report.componentComposition, pageId).map((item) => ({
          ...item,
          familyId: item.familyId || findComponentCompositionFamilyId(builderInput, item.componentId),
        })),
        selectedRecipes: [],
        assetNeeds: toStringArray(report.assetNeeds),
        assetReferences: normalizeBuilderAssetReferences(report.assetReferences),
        modelConcerns: toStringArray(report.modelConcerns).length
          ? toStringArray(report.modelConcerns)
          : toStringArray(report.missingCapabilities),
        validatedConstraints: toStringArray(report.validatedConstraints).length
          ? toStringArray(report.validatedConstraints)
          : validatedConstraintDefaults,
        missingCapabilities: toStringArray(report.validatedConstraints).length
          ? toStringArray(report.validatedConstraints)
          : validatedConstraintDefaults,
        guardrailCheck: Array.isArray(report.guardrailCheck) ? report.guardrailCheck : [],
      },
    },
  };
  const synthesizedTemplateComposition = synthesizeComponentCompositionFromTemplateOperations(normalized.buildResult.operations, builderInput);
  if (normalized.buildResult.report.componentComposition.length) {
    const templateMap = new Map(
      synthesizedTemplateComposition.map((item) => [
        `${String(item.componentId || "").trim()}::${String(item.slotId || "").trim()}`,
        item,
      ])
    );
    normalized.buildResult.report.componentComposition = normalized.buildResult.report.componentComposition.map((item) => {
      const key = `${String(item.componentId || "").trim()}::${String(item.slotId || "").trim()}`;
      const templateEntry = templateMap.get(key);
      if (!templateEntry) return item;
      return {
        ...item,
        familyId: item.familyId || templateEntry.familyId,
        templateId: item.templateId || templateEntry.templateId,
        assetPlan: resolveStarterAssetPlan(
          builderInput,
          item.componentId,
          item.familyId || templateEntry.familyId,
          (item.assetPlan && (
            item.assetPlan.iconSetIds?.length ||
            item.assetPlan.badgePresetIds?.length ||
            item.assetPlan.visualSetIds?.length ||
            item.assetPlan.thumbnailPresetIds?.length
          ))
            ? item.assetPlan
            : templateEntry.assetPlan
        ),
      };
    });
  } else {
    normalized.buildResult.report.componentComposition = synthesizedTemplateComposition.map((item) => ({
      ...item,
      assetPlan: resolveStarterAssetPlan(builderInput, item.componentId, item.familyId, item.assetPlan),
    }));
  }
  normalized.buildResult.report.assetReferences = resolveStarterAssetPlan(
    builderInput,
    "",
    "",
    normalized.buildResult.report.assetReferences
  );
  normalized.buildResult.report.selectedRecipes = normalizeSelectedRecipeList(
    report.selectedRecipes,
    normalized.buildResult.report.componentComposition
  );
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  if (!normalized.buildResult.operations.length && editableComponents.length) {
    const synthesized = buildDemoBuilderResult(builderInput);
    const synthesizedOperations = Array.isArray(synthesized?.buildResult?.operations)
      ? synthesized.buildResult.operations.map((item) => normalizeBuilderOperation(item, pageId)).filter(Boolean)
      : [];
    if (synthesizedOperations.length) {
      normalized = {
        summary: normalized.summary,
        buildResult: {
          ...normalized.buildResult,
          changedTargets: synthesized.buildResult.changedTargets || normalized.buildResult.changedTargets,
          operations: synthesizedOperations,
          report: {
            whatChanged: normalized.buildResult.report.whatChanged.length
              ? normalized.buildResult.report.whatChanged
              : toStringArray(synthesized.buildResult.report?.whatChanged),
            whyChanged: normalized.buildResult.report.whyChanged.length
              ? normalized.buildResult.report.whyChanged
              : toStringArray(synthesized.buildResult.report?.whyChanged),
            assumptions: uniqueNonEmptyLines([
              ...normalized.buildResult.report.assumptions,
              "모델이 실행 가능한 operation을 충분히 반환하지 않아, 허용된 patch schema 안에서 안전한 최소 draft operation을 자동 보강했습니다.",
            ]),
            compositionPlan: normalized.buildResult.report.compositionPlan.length
              ? normalized.buildResult.report.compositionPlan
              : toStringArray(synthesized.buildResult.report?.compositionPlan),
            componentComposition: normalized.buildResult.report.componentComposition.length
              ? normalized.buildResult.report.componentComposition
              : normalizeComponentCompositionList(synthesized.buildResult.report?.componentComposition, pageId).map((item) => {
                  const familyId = item.familyId || findComponentCompositionFamilyId(builderInput, item.componentId);
                  return {
                    ...item,
                    familyId,
                    assetPlan: resolveStarterAssetPlan(builderInput, item.componentId, familyId, item.assetPlan),
                  };
                }),
            selectedRecipes: normalized.buildResult.report.selectedRecipes.length
              ? normalized.buildResult.report.selectedRecipes
              : normalizeSelectedRecipeList(
                  synthesized.buildResult.report?.selectedRecipes,
                  normalized.buildResult.report.componentComposition.length
                    ? normalized.buildResult.report.componentComposition
                    : normalizeComponentCompositionList(synthesized.buildResult.report?.componentComposition, pageId)
                ),
            assetNeeds: normalized.buildResult.report.assetNeeds.length
              ? normalized.buildResult.report.assetNeeds
              : toStringArray(synthesized.buildResult.report?.assetNeeds),
            assetReferences:
              normalized.buildResult.report.assetReferences.iconSetIds.length ||
              normalized.buildResult.report.assetReferences.badgePresetIds.length ||
              normalized.buildResult.report.assetReferences.visualSetIds.length ||
              normalized.buildResult.report.assetReferences.thumbnailPresetIds.length
                ? normalized.buildResult.report.assetReferences
                : normalizeBuilderAssetReferences(synthesized.buildResult.report?.assetReferences),
            modelConcerns: normalized.buildResult.report.modelConcerns.length
              ? normalized.buildResult.report.modelConcerns
              : (toStringArray(synthesized.buildResult.report?.modelConcerns).length
                ? toStringArray(synthesized.buildResult.report?.modelConcerns)
                : toStringArray(synthesized.buildResult.report?.missingCapabilities)),
            validatedConstraints: normalized.buildResult.report.validatedConstraints.length
              ? normalized.buildResult.report.validatedConstraints
              : (toStringArray(synthesized.buildResult.report?.validatedConstraints).length
                ? toStringArray(synthesized.buildResult.report?.validatedConstraints)
                : validatedConstraintDefaults),
            missingCapabilities: normalized.buildResult.report.validatedConstraints.length
              ? normalized.buildResult.report.validatedConstraints
              : (toStringArray(synthesized.buildResult.report?.validatedConstraints).length
                ? toStringArray(synthesized.buildResult.report?.validatedConstraints)
                : validatedConstraintDefaults),
            guardrailCheck: normalized.buildResult.report.guardrailCheck.length
              ? normalized.buildResult.report.guardrailCheck
              : (Array.isArray(synthesized.buildResult.report?.guardrailCheck) ? synthesized.buildResult.report.guardrailCheck : []),
          },
        },
      };
    }
  }
  normalized.buildResult.report.assetReferences = resolveStarterAssetPlan(
    builderInput,
    "",
    "",
    normalized.buildResult.report.assetReferences
  );
  return normalized;
}

function getBuilderSidecarSection(builderInput = {}, pageId = "", slotId = "") {
  const sections = Array.isArray(builderInput?.systemContext?.artifactSidecarRegistry?.sections)
    ? builderInput.systemContext.artifactSidecarRegistry.sections
    : [];
  return sections.find(
    (item) =>
      String(item?.pageId || builderInput?.pageContext?.workspacePageId || "").trim() === String(pageId || "").trim() &&
      String(item?.slotId || "").trim() === String(slotId || "").trim()
  ) || null;
}

function enforceBuilderOperations(operations = [], builderInput = {}) {
  const pageIdFallback = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const kept = [];
  const violations = [];
  for (const rawOp of operations || []) {
    const op = rawOp && typeof rawOp === "object" ? { ...rawOp } : null;
    if (!op) continue;
    if (op.action === "replace_component_template") {
      const pageId = String(op.pageId || pageIdFallback).trim();
      const slotId = String(op.slotId || "").trim();
      const componentId = String(op.componentId || (pageId && slotId ? `${pageId}.${slotId}` : "")).trim();
      const familyId = String(op.familyId || "").trim();
      if (!pageId || !slotId || !componentId || !familyId) {
        violations.push({
          pageId,
          slotId,
          action: "operation_removed",
          rule: "replace_component_template requires pageId, slotId, componentId, and familyId",
        });
        continue;
      }
      const allowedFamilyId = findComponentCompositionFamilyId(builderInput, componentId);
      if (!allowedFamilyId || allowedFamilyId !== familyId) {
        violations.push({
          pageId,
          slotId,
          componentId,
          action: "operation_removed",
          rule: "replace_component_template familyId is not allowed for this component",
        });
        continue;
      }
      kept.push({
        ...op,
        pageId,
        slotId,
        componentId,
        familyId,
        templateId: String(op.templateId || familyId).trim(),
        assetPlan: resolveStarterAssetPlan(builderInput, componentId, familyId, op.assetPlan || {}),
      });
      continue;
    }
    if (op.action === "update_slot_image") {
      const pageId = String(op.pageId || pageIdFallback).trim();
      const slotId = String(op.slotId || "").trim();
      const componentId = findBuilderEditableComponentId(builderInput, pageId, slotId);
      const familyId = findComponentCompositionFamilyId(builderInput, componentId);
      const selectedAsset = findStarterAssetByUrl(builderInput, op.imageSrc);
      if (!pageId || !slotId || !componentId || !selectedAsset) {
        violations.push({
          pageId,
          slotId,
          componentId,
          action: "operation_removed",
          rule: "update_slot_image requires a starter asset URL from assetPipelineStarter.assetCatalog",
        });
        continue;
      }
      const resolvedAssetPlan = resolveStarterAssetPlan(builderInput, componentId, familyId, {});
      const geometryFit = checkComponentAssetFit(selectedAsset, resolvedAssetPlan.geometrySpec);
      if (!geometryFit.ok) {
        violations.push({
          pageId,
          slotId,
          componentId,
          action: "operation_removed",
          rule: `update_slot_image asset does not fit component geometry: ${geometryFit.reasons.join("; ")}`,
        });
        continue;
      }
      kept.push({
        ...op,
        pageId,
        slotId,
        imageSrc: selectedAsset.assetUrl,
        assetId: selectedAsset.id,
      });
      continue;
    }
    if (op.action !== "update_component_patch") {
      kept.push(op);
      continue;
    }
    const pageId = String(op.pageId || pageIdFallback).trim();
    const slotId = String(op.slotId || "").trim();
    const sidecarSection = getBuilderSidecarSection(builderInput, pageId, slotId);
    const governed = sanitizeGovernedPatch(slotId, pageId, op.patch || {});
    const patch = governed.patch && typeof governed.patch === "object" ? governed.patch : {};
    if (!Object.keys(patch).length || (Object.keys(patch).length === 1 && patch.styles && !Object.keys(patch.styles || {}).length)) {
      if (governed.violations.length) {
        violations.push(...governed.violations.map((item) => ({
          ...item,
          pageId,
          slotId,
          action: "operation_removed",
          sectionId: sidecarSection?.sectionId || null,
        })));
      }
      continue;
    }
    if (governed.violations.length) {
      violations.push(...governed.violations.map((item) => ({
        ...item,
        pageId,
        slotId,
        action: "patch_sanitized",
        sectionId: sidecarSection?.sectionId || null,
      })));
    }
    kept.push({
      ...op,
      patch,
    });
  }
  return { operations: kept, violations };
}

function inferMentionedSlotIds(lines = [], knownSlotIds = []) {
  const slotIds = Array.isArray(knownSlotIds) ? knownSlotIds.filter(Boolean) : [];
  const mentions = new Set();
  for (const line of lines || []) {
    const text = String(line || "").trim().toLowerCase();
    if (!text) continue;
    for (const slotId of slotIds) {
      if (text.includes(String(slotId || "").trim().toLowerCase())) mentions.add(slotId);
    }
  }
  return Array.from(mentions);
}

function extractPageScopedSnapshotLite(editableData, pageId, viewportProfile = "") {
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return null;
  const normalizedViewportProfile =
    normalizedPageId === "home" ? normalizeHomeViewportProfile(viewportProfile, "pc") : normalizeViewportProfile(viewportProfile || "pc", "pc");
  const source = normalizeEditableData(editableData || {});
  const page = (source.pages || []).find((item) => String(item?.id || "").trim() === normalizedPageId) || null;
  const slotRegistry = (source.slotRegistries || []).find((item) => String(item?.pageId || "").trim() === normalizedPageId) || null;
  const componentPatches = (source.componentPatches || []).filter((item) => {
    if (String(item?.pageId || "").trim() !== normalizedPageId) return false;
    if (normalizedPageId !== "home") return true;
    return normalizeHomeViewportProfile(item?.viewportProfile, "pc") === normalizedViewportProfile;
  });
  const runtimeComponentTemplates = (source.runtimeComponentTemplates || []).filter((item) => {
    if (String(item?.pageId || "").trim() !== normalizedPageId) return false;
    if (normalizedPageId !== "home") return true;
    return normalizeHomeViewportProfile(item?.viewportProfile, "pc") === normalizedViewportProfile;
  });
  return {
    pageId: normalizedPageId,
    viewportProfile: normalizedViewportProfile || null,
    page: page ? JSON.parse(JSON.stringify(page)) : null,
    slotRegistry: slotRegistry ? JSON.parse(JSON.stringify(slotRegistry)) : null,
    componentPatches: JSON.parse(JSON.stringify(componentPatches || [])),
    runtimeComponentTemplates: JSON.parse(JSON.stringify(runtimeComponentTemplates || [])),
  };
}

function summarizeSnapshotDelta(beforeSnapshot = null, afterSnapshot = null) {
  if (!beforeSnapshot || !afterSnapshot) {
    return {
      available: false,
      changedSlotIds: [],
      changedPatchSlotIds: [],
      changedSourceSlotIds: [],
      pageTitleChanged: false,
      patchDeltaCount: 0,
      sourceDeltaCount: 0,
      summary: "snapshot_unavailable",
    };
  }
  const mapPatchSignature = (snapshot) => {
    const grouped = new Map();
    for (const item of Array.isArray(snapshot?.componentPatches) ? snapshot.componentPatches : []) {
      const componentId = String(item?.componentId || "").trim();
      const slotId = inferSlotIdFromComponentId(componentId);
      if (!slotId) continue;
      const signature = JSON.stringify(item?.patch && typeof item.patch === "object" ? item.patch : {});
      grouped.set(slotId, signature);
    }
    return grouped;
  };
  const mapSourceSignature = (snapshot) => {
    const grouped = new Map();
    const slots = Array.isArray(snapshot?.slotRegistry?.slots) ? snapshot.slotRegistry.slots : [];
    for (const item of slots) {
      const slotId = String(item?.slotId || "").trim();
      if (!slotId) continue;
      grouped.set(slotId, String(item?.activeSourceId || "").trim());
    }
    return grouped;
  };
  const mapTemplateSignature = (snapshot) => {
    const grouped = new Map();
    for (const item of Array.isArray(snapshot?.runtimeComponentTemplates) ? snapshot.runtimeComponentTemplates : []) {
      const slotId = String(item?.slotId || "").trim();
      if (!slotId) continue;
      grouped.set(
        slotId,
        JSON.stringify({
          familyId: String(item?.familyId || "").trim(),
          templateId: String(item?.templateId || "").trim(),
          layoutStrategy: String(item?.layoutStrategy || "").trim(),
        })
      );
    }
    return grouped;
  };
  const beforePatchMap = mapPatchSignature(beforeSnapshot);
  const afterPatchMap = mapPatchSignature(afterSnapshot);
  const beforeSourceMap = mapSourceSignature(beforeSnapshot);
  const afterSourceMap = mapSourceSignature(afterSnapshot);
  const beforeTemplateMap = mapTemplateSignature(beforeSnapshot);
  const afterTemplateMap = mapTemplateSignature(afterSnapshot);
  const slotIds = new Set([
    ...beforePatchMap.keys(),
    ...afterPatchMap.keys(),
    ...beforeSourceMap.keys(),
    ...afterSourceMap.keys(),
    ...beforeTemplateMap.keys(),
    ...afterTemplateMap.keys(),
  ]);
  const changedPatchSlotIds = [];
  const changedSourceSlotIds = [];
  const changedTemplateSlotIds = [];
  for (const slotId of slotIds) {
    if (String(beforePatchMap.get(slotId) || "") !== String(afterPatchMap.get(slotId) || "")) {
      changedPatchSlotIds.push(slotId);
    }
    if (String(beforeSourceMap.get(slotId) || "") !== String(afterSourceMap.get(slotId) || "")) {
      changedSourceSlotIds.push(slotId);
    }
    if (String(beforeTemplateMap.get(slotId) || "") !== String(afterTemplateMap.get(slotId) || "")) {
      changedTemplateSlotIds.push(slotId);
    }
  }
  const changedSlotIds = Array.from(new Set([...changedPatchSlotIds, ...changedSourceSlotIds, ...changedTemplateSlotIds]));
  const pageTitleChanged = String(beforeSnapshot?.page?.title || "").trim() !== String(afterSnapshot?.page?.title || "").trim();
  return {
    available: true,
    changedSlotIds,
    changedPatchSlotIds,
    changedSourceSlotIds,
    changedTemplateSlotIds,
    pageTitleChanged,
    patchDeltaCount: changedPatchSlotIds.length,
    sourceDeltaCount: changedSourceSlotIds.length,
    templateDeltaCount: changedTemplateSlotIds.length,
    summary: `patch:${changedPatchSlotIds.length} source:${changedSourceSlotIds.length} template:${changedTemplateSlotIds.length} title:${pageTitleChanged ? "changed" : "same"}`,
  };
}

function buildCriticKeywordSet(lines = [], limit = 60) {
  const tokens = new Set();
  for (const line of lines || []) {
    const matches = String(line || "")
      .toLowerCase()
      .match(/[a-z]{3,}|[가-힣]{2,}/g);
    for (const token of matches || []) {
      if (token.length < 2) continue;
      if (["그리고", "하지만", "그러나", "고객", "화면", "영역", "section", "slot", "page", "design"].includes(token)) continue;
      tokens.add(token);
      if (tokens.size >= limit) return Array.from(tokens);
    }
  }
  return Array.from(tokens);
}

function estimateIdentityAlignmentScore(builderInput = {}, normalizedResult = {}, options = {}) {
  const approvedPlan = builderInput?.approvedPlan || {};
  const desiredKeywords = buildCriticKeywordSet([
    ...toStringArray(approvedPlan?.designDirection),
    ...toStringArray(approvedPlan?.planningDirection),
    ...toStringArray(approvedPlan?.builderBrief?.mustKeep),
    ...toStringArray(approvedPlan?.builderBrief?.mustChange),
    ...toStringArray(builderInput?.pageContext?.pageIdentity?.mustPreserve),
    ...toStringArray(builderInput?.pageContext?.pageIdentity?.shouldAvoid),
  ]);
  const operationKeywords = buildCriticKeywordSet([
    ...toStringArray(normalizedResult?.buildResult?.report?.whatChanged),
    ...toStringArray(normalizedResult?.buildResult?.report?.whyChanged),
    ...safeArray(normalizedResult?.buildResult?.operations || [], 50).map((item) => JSON.stringify(item)),
  ]);
  const overlap = desiredKeywords.filter((token) => operationKeywords.includes(token));
  const governancePenalty = Array.isArray(options?.governanceViolations) ? options.governanceViolations.length * 8 : 0;
  const unsupportedPenalty = Array.isArray(options?.unsupportedClaims) ? options.unsupportedClaims.length * 12 : 0;
  const hasExecutionNarrative =
    toStringArray(normalizedResult?.buildResult?.report?.whatChanged).length > 0 &&
    toStringArray(normalizedResult?.buildResult?.report?.whyChanged).length > 0 &&
    safeArray(normalizedResult?.buildResult?.operations || [], 50).length > 0;
  const base = hasExecutionNarrative ? 72 : 60;
  const score = Math.max(
    0,
    Math.min(
      100,
      base + overlap.length * 6 - governancePenalty - unsupportedPenalty
    )
  );
  return {
    score,
    desiredKeywords: desiredKeywords.slice(0, 20),
    matchedKeywords: overlap.slice(0, 20),
  };
}

function estimateChangeDepthScore(executionStrategy = {}, requestedFocusSlots = [], changedSlotIds = [], snapshotDelta = {}) {
  const patchDepth = normalizePatchDepth(executionStrategy?.patchDepth, "medium");
  const changedCount = Array.isArray(snapshotDelta?.changedSlotIds) && snapshotDelta.changedSlotIds.length
    ? snapshotDelta.changedSlotIds.length
    : changedSlotIds.length;
  const focusCount = requestedFocusSlots.length || changedCount || 1;
  const expectedMinimum =
    patchDepth === "light"
      ? 1
      : patchDepth === "medium"
        ? Math.min(2, focusCount)
        : patchDepth === "strong"
          ? Math.min(3, focusCount)
          : Math.min(4, focusCount);
  const ratio = expectedMinimum > 0 ? Math.min(1, changedCount / expectedMinimum) : 1;
  return {
    score: Math.round(40 + ratio * 60),
    changedCount,
    expectedMinimum,
    patchDepth,
  };
}

function buildBuilderCriticReport(normalizedResult = {}, builderInput = {}, enforcement = {}, criticContext = {}) {
  const approvedPlan = builderInput?.approvedPlan || {};
  const composition = builderInput?.compositionResult?.composition && typeof builderInput.compositionResult.composition === "object"
    ? builderInput.compositionResult.composition
    : {};
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  const knownSlotIds = Array.from(new Set(editableComponents.map((item) => String(item?.slotId || "").trim()).filter(Boolean)));
  const changedSlotIds = Array.from(
    new Set(
      safeArray(normalizedResult?.buildResult?.operations || [], 100)
        .map((item) => String(item?.slotId || "").trim())
        .filter(Boolean)
    )
  );
  const requestedFocusSlots = Array.from(
    new Set([
      ...toStringArray(approvedPlan?.builderBrief?.suggestedFocusSlots),
      ...toStringArray(composition?.focusSlots),
      ...(Array.isArray(approvedPlan?.priority) ? approvedPlan.priority.map((item) => String(item?.target || "").trim()) : []),
    ].filter(Boolean))
  );
  const coveredFocusSlots = requestedFocusSlots.filter((slotId) => changedSlotIds.includes(slotId));
  const missingFocusSlots = requestedFocusSlots.filter((slotId) => !changedSlotIds.includes(slotId));
  const mentionedSlotIds = inferMentionedSlotIds(normalizedResult?.buildResult?.report?.whatChanged || [], knownSlotIds);
  const unsupportedClaims = mentionedSlotIds.filter((slotId) => !changedSlotIds.includes(slotId));
  const identitySignals = Array.isArray(builderInput?.systemContext?.designReferenceLibrary?.identitySignals)
    ? builderInput.systemContext.designReferenceLibrary.identitySignals
    : [];
  const topReference = Array.isArray(builderInput?.systemContext?.designReferenceLibrary?.entries)
    ? builderInput.systemContext.designReferenceLibrary.entries[0] || null
    : null;
  const governanceViolations = Array.isArray(enforcement?.violations) ? enforcement.violations : [];
  const executionStrategy = builderInput?.systemContext?.designToolContext?.executionStrategy || {};
  const snapshotDelta = summarizeSnapshotDelta(criticContext?.beforeSnapshot, criticContext?.afterSnapshot);
  const identityAlignment = estimateIdentityAlignmentScore(builderInput, normalizedResult, {
    governanceViolations,
    unsupportedClaims,
  });
  const changeDepth = estimateChangeDepthScore(executionStrategy, requestedFocusSlots, changedSlotIds, snapshotDelta);
  const scores = {
    planCoverage: requestedFocusSlots.length ? Math.round((coveredFocusSlots.length / requestedFocusSlots.length) * 100) : (changedSlotIds.length ? 100 : 0),
    governance: governanceViolations.length ? Math.max(0, 100 - governanceViolations.length * 20) : 100,
    identityFit: identityAlignment.score,
    claimAccuracy: unsupportedClaims.length ? Math.max(0, 100 - unsupportedClaims.length * 35) : 100,
    changeDepth: changeDepth.score,
  };
  const findings = [];
  if (missingFocusSlots.length) findings.push(`기획 우선 대상 중 아직 operation에 반영되지 않은 슬롯: ${missingFocusSlots.join(", ")}`);
  if (governanceViolations.length) findings.push(`layout governance 위반 시도가 ${governanceViolations.length}건 감지되어 저장 전 제거 또는 축소했습니다.`);
  if (unsupportedClaims.length) findings.push(`report.whatChanged 에 실제 operation 없는 슬롯 언급이 있습니다: ${unsupportedClaims.join(", ")}`);
  if (snapshotDelta.available && changeDepth.changedCount < changeDepth.expectedMinimum) {
    findings.push(`요청된 변화 깊이(${changeDepth.patchDepth}) 대비 실제 snapshot 변화 슬롯 수가 부족합니다: ${changeDepth.changedCount}/${changeDepth.expectedMinimum}`);
  }
  const failedDimensions = [];
  if (missingFocusSlots.length || scores.planCoverage < 80) failedDimensions.push("planCoverage");
  if (scores.governance < 85) failedDimensions.push("governance");
  if (scores.identityFit < 75) failedDimensions.push("identityFit");
  if (unsupportedClaims.length || scores.claimAccuracy < 90) failedDimensions.push("claimAccuracy");
  if (scores.changeDepth < 70) failedDimensions.push("changeDepth");
  const retryInstructions = [];
  if (missingFocusSlots.length) {
    retryInstructions.push(`다음 pass에서 누락된 focus slot을 우선 반영하세요: ${missingFocusSlots.join(", ")}`);
  }
  if (scores.changeDepth < 70) {
    retryInstructions.push(`요청된 patchDepth=${changeDepth.patchDepth}에 맞춰 구조 변화 강도를 높이세요. 최소 변화 슬롯 수 기준은 ${changeDepth.expectedMinimum}입니다.`);
  }
  if (scores.identityFit < 75) {
    retryInstructions.push("approvedPlan.designDirection, builderBrief.mustKeep, pageIdentity.mustPreserve를 다시 읽고 브랜드 정체성과 화면 역할을 더 강하게 맞추세요.");
  }
  if (scores.governance < 85) {
    retryInstructions.push("artifactSidecar/layout governance를 위반한 개별 child 강조나 비균일 리사이징을 제거하고 container 수준으로 다시 조정하세요.");
  }
  if (unsupportedClaims.length) {
    retryInstructions.push(`실제 operation 없는 설명을 제거하거나, 해당 슬롯(${unsupportedClaims.join(", ")})에 맞는 executable operation을 추가하세요.`);
  }
  const average = Math.round((scores.planCoverage + scores.governance + scores.identityFit + scores.claimAccuracy + scores.changeDepth) / 5);
  return {
    status: average >= 85 && !missingFocusSlots.length && !unsupportedClaims.length && scores.changeDepth >= 70 ? "pass" : average >= 65 ? "warning" : "fail",
    averageScore: average,
    scores,
    focusSlotCoverage: {
      requested: requestedFocusSlots,
      changed: changedSlotIds,
      covered: coveredFocusSlots,
      missing: missingFocusSlots,
    },
    identitySignals,
    topReferenceId: topReference?.id || null,
    identityAlignment,
    executionStrategy,
    snapshotDelta,
    governanceViolations,
    unsupportedClaims,
    retryTrigger: {
      shouldRetry: average < 85 || Boolean(missingFocusSlots.length) || Boolean(unsupportedClaims.length) || scores.changeDepth < 70,
      failedDimensions,
      targetSlots: missingFocusSlots.length ? missingFocusSlots : requestedFocusSlots.length ? requestedFocusSlots : changedSlotIds,
      instructions: retryInstructions,
    },
    findings,
  };
}

function synthesizeComponentCompositionFromComposer(compositionResult = {}, builderInput = {}) {
  const composition = compositionResult?.composition && typeof compositionResult.composition === "object"
    ? compositionResult.composition
    : {};
  const tree = Array.isArray(composition?.compositionTree) ? composition.compositionTree : [];
  const styleContract = Array.isArray(composition?.styleContract) ? composition.styleContract : [];
  return tree.map((item) => {
    const styleEntry = styleContract.find((entry) => String(entry?.slotId || "").trim() === String(item?.slotId || "").trim()) || null;
    const slotId = String(item?.slotId || "").trim();
    const componentId = String(item?.componentId || "").trim();
    const resolvedTemplateId = resolvePreferredTemplateId(builderInput, slotId, componentId, item, styleEntry);
    return {
      slotId,
      componentId,
      familyId: String(item?.familyId || findComponentCompositionFamilyId(builderInput, item?.componentId)).trim(),
      templateId: resolvedTemplateId,
      label: String(item?.label || item?.slotId || item?.componentId || "composition").trim(),
      scope: "component",
      summary: String(item?.layoutGoal || item?.visualDirection || "").trim(),
      layoutStrategy: uniqueNonEmptyLines([
        String(item?.hierarchy || "").trim(),
        String(item?.visualDirection || "").trim(),
        styleEntry?.surfaceTone ? `surfaceTone=${styleEntry.surfaceTone}` : "",
        styleEntry?.density ? `density=${styleEntry.density}` : "",
        styleEntry?.hierarchyEmphasis ? `hierarchy=${styleEntry.hierarchyEmphasis}` : "",
        styleEntry?.interactionTone ? `interaction=${styleEntry.interactionTone}` : "",
      ]).join(" | "),
      preservedElements: toStringArray(item?.preservedElements),
      changedElements: toStringArray(item?.changedElements),
      styleContract: styleEntry
        ? {
            surfaceTone: String(styleEntry?.surfaceTone || "").trim(),
            density: String(styleEntry?.density || "").trim(),
            hierarchyEmphasis: String(styleEntry?.hierarchyEmphasis || "").trim(),
            interactionTone: String(styleEntry?.interactionTone || "").trim(),
            tokenHints: styleEntry?.tokenHints && typeof styleEntry.tokenHints === "object" ? styleEntry.tokenHints : {},
          }
        : {},
      assetPlan: normalizeComposerAssetBindings(item?.assetPlan || composition?.assetBindings || {}),
      primitiveTree:
        normalizeCompositionPrimitiveTree(item?.primitiveTree || item?.primitive || null) ||
        synthesizePrimitiveTreeForComponent(slotId, resolvedTemplateId, styleEntry, item),
    };
  }).filter((item) => item.slotId || item.componentId).slice(0, 12);
}

function synthesizeTemplateOperationsFromComposer(compositionResult = {}, builderInput = {}, existingOperations = []) {
  const compositionItems = synthesizeComponentCompositionFromComposer(compositionResult, builderInput);
  const existingTemplateKeys = new Set(
    safeArray(existingOperations, 50)
      .filter((item) => String(item?.action || "").trim() === "replace_component_template")
      .map((item) => `${String(item?.componentId || "").trim()}::${String(item?.slotId || "").trim()}`)
  );
  return compositionItems
    .filter((item) => item.familyId && item.templateId)
    .filter((item) => !existingTemplateKeys.has(`${String(item.componentId || "").trim()}::${String(item.slotId || "").trim()}`))
    .map((item) => ({
      action: "replace_component_template",
      pageId: String(builderInput?.pageContext?.workspacePageId || "").trim(),
      slotId: item.slotId,
      componentId: item.componentId,
      familyId: item.familyId,
      templateId: item.templateId,
      summary: item.summary || `${item.slotId} 전면개편 템플릿 적용`,
      layoutStrategy: item.layoutStrategy || "",
      preservedElements: toStringArray(item.preservedElements),
      changedElements: toStringArray(item.changedElements),
      assetPlan: normalizeBuilderAssetReferences(item.assetPlan || {}),
      primitiveTree:
        normalizeCompositionPrimitiveTree(item.primitiveTree || null) ||
        synthesizePrimitiveTreeForComponent(item.slotId, item.templateId, item.styleContract || {}, item),
    }))
    .slice(0, 6);
}

function isReplacementFirstExecution(builderInput = {}) {
  const patchDepth = normalizePatchDepth(builderInput?.generationOptions?.patchDepth, "medium");
  const interventionLayer = String(builderInput?.generationOptions?.interventionLayer || "page").trim();
  if (interventionLayer === "element") return false;
  return patchDepth === "medium" || patchDepth === "strong" || patchDepth === "full" || interventionLayer === "component";
}

function buildComposerStyleContractMap(compositionResult = {}) {
  const composition = compositionResult?.composition && typeof compositionResult.composition === "object"
    ? compositionResult.composition
    : {};
  const entries = Array.isArray(composition?.styleContract) ? composition.styleContract : [];
  const map = new Map();
  entries.forEach((entry) => {
    const slotId = String(entry?.slotId || inferSlotIdFromComponentId(entry?.componentId) || "").trim();
    const componentId = String(entry?.componentId || "").trim();
    const key = `${componentId}::${slotId}`;
    map.set(key, {
      surfaceTone: String(entry?.surfaceTone || "").trim(),
      density: String(entry?.density || "").trim(),
      hierarchyEmphasis: String(entry?.hierarchyEmphasis || "").trim(),
      interactionTone: String(entry?.interactionTone || "").trim(),
      tokenHints: entry?.tokenHints && typeof entry.tokenHints === "object" ? entry.tokenHints : {},
    });
  });
  return map;
}

async function runBuilderEngineV2(builderInput, currentData) {
  const compositionResult = await handleLlmCompose(builderInput);
  const detailerInput = {
    ...builderInput,
    compositionResult,
  };
  const primaryModel = resolveOpenRouterModel("BUILDER_MODEL", "OPENROUTER_MODEL");
  const fallbackModels = resolveOpenRouterModelCandidates("BUILDER_FALLBACK_MODEL")
    .filter((model) => model !== primaryModel);
  const builderTimeoutMs = Math.max(90_000, Number(process.env.BUILDER_REQUEST_TIMEOUT_MS || process.env.LLM_REQUEST_TIMEOUT_MS || 180_000));
  const builderMaxTokens = resolveOpenRouterMaxTokens(process.env.BUILDER_MAX_TOKENS, 2048);
  const designChangeLevel = normalizeDesignChangeLevel(detailerInput?.generationOptions?.designChangeLevel, "medium");
  const patchDepth = normalizePatchDepth(detailerInput?.generationOptions?.patchDepth, designChangeLevel === "low" ? "light" : designChangeLevel === "high" ? "strong" : "medium");
  const builderTemperature =
    patchDepth === "full"
      ? 0.32
      : patchDepth === "strong"
        ? (designChangeLevel === "low" ? 0.22 : 0.28)
        : patchDepth === "light"
          ? 0.1
          : designChangeLevel === "high"
            ? 0.22
            : 0.15;
  const requestMessages = [
    { role: "system", content: buildBuilderSystemPrompt() },
    { role: "user", content: buildReferenceVisualUserContent(buildBuilderUserPrompt(detailerInput), detailerInput, "Detailer reference screenshots") },
  ];
  const builderPromptChars = measureMessageChars(requestMessages);
  console.log(
    `[detailer] model=${primaryModel} timeoutMs=${builderTimeoutMs} promptChars=${builderPromptChars} page=${String(detailerInput?.pageContext?.workspacePageId || "")} layer=${String(detailerInput?.generationOptions?.interventionLayer || "page")} depth=${String(detailerInput?.generationOptions?.patchDepth || "medium")} composerTree=${safeArray(compositionResult?.composition?.compositionTree, 20).length}`
  );
  let result;
  try {
    result = await withLlmTimeout(
      callOpenRouterJson({
        model: primaryModel,
        temperature: builderTemperature,
        demoFallback: () => buildDemoBuilderResult(detailerInput),
        messages: requestMessages,
        maxTokens: builderMaxTokens,
      }),
      "Builder request",
      builderTimeoutMs
    );
  } catch (error) {
    if (!fallbackModels.length || !isRetryableOpenRouterFailure(error)) throw error;
    console.warn(`[detailer] primary-failed model=${primaryModel} reason=${String(error?.message || error || "").trim()}`);
    let recovered = false;
    let lastFallbackError = error;
    for (const fallbackModel of fallbackModels) {
      try {
        result = await withLlmTimeout(
          callOpenRouterJson({
            model: fallbackModel,
            temperature: builderTemperature,
            demoFallback: () => buildDemoBuilderResult(detailerInput),
            messages: requestMessages,
            maxTokens: builderMaxTokens,
          }),
          "Builder fallback request",
          builderTimeoutMs
        );
        recovered = true;
        break;
      } catch (fallbackError) {
        logModelFallbackFailure("detailer", fallbackModel, fallbackError);
        lastFallbackError = fallbackError;
        if (!isRetryableOpenRouterFailure(fallbackError)) throw fallbackError;
      }
    }
    if (!recovered) throw lastFallbackError;
  }
  const normalizedResult = normalizeBuilderResult(result, detailerInput);
  if (!normalizedResult.buildResult.report.componentComposition.length && compositionResult?.composition?.compositionTree?.length) {
    normalizedResult.buildResult.report.componentComposition = synthesizeComponentCompositionFromComposer(compositionResult, detailerInput);
  }
  const composerStyleContractMap = buildComposerStyleContractMap(compositionResult);
  if (normalizedResult.buildResult.report.componentComposition.length) {
    normalizedResult.buildResult.report.componentComposition = normalizedResult.buildResult.report.componentComposition.map((item) => {
      const key = `${String(item?.componentId || "").trim()}::${String(item?.slotId || "").trim()}`;
      const styleContract = composerStyleContractMap.get(key);
      return styleContract
        ? {
            ...item,
            styleContract: item?.styleContract && typeof item.styleContract === "object" && Object.keys(item.styleContract).length
              ? item.styleContract
              : styleContract,
            primitiveTree:
              normalizeCompositionPrimitiveTree(item?.primitiveTree || null) ||
              synthesizePrimitiveTreeForComponent(String(item?.slotId || "").trim(), String(item?.templateId || "").trim(), styleContract, item),
          }
        : {
            ...item,
            primitiveTree:
              normalizeCompositionPrimitiveTree(item?.primitiveTree || null) ||
              synthesizePrimitiveTreeForComponent(String(item?.slotId || "").trim(), String(item?.templateId || "").trim(), item?.styleContract || null, item),
          };
    });
  }
  if (compositionResult?.composition?.compositionTree?.length && isReplacementFirstExecution(detailerInput)) {
    const synthesizedTemplateOperations = synthesizeTemplateOperationsFromComposer(
      compositionResult,
      detailerInput,
      normalizedResult.buildResult.operations || []
    );
    if (synthesizedTemplateOperations.length) {
      normalizedResult.buildResult.operations = [
        ...synthesizedTemplateOperations,
        ...safeArray(normalizedResult.buildResult.operations, 100),
      ];
      normalizedResult.buildResult.report.assumptions = uniqueNonEmptyLines([
        ...normalizedResult.buildResult.report.assumptions,
        `Composer-first template synthesis applied: ${synthesizedTemplateOperations.map((item) => `${item.slotId}:${item.templateId}`).join(", ")}`,
      ]);
    }
  }
  if (
    !normalizedResult.buildResult.report.assetReferences.iconSetIds.length &&
    !normalizedResult.buildResult.report.assetReferences.badgePresetIds.length &&
    !normalizedResult.buildResult.report.assetReferences.visualSetIds.length &&
    !normalizedResult.buildResult.report.assetReferences.thumbnailPresetIds.length
  ) {
    normalizedResult.buildResult.report.assetReferences = normalizeComposerAssetBindings(compositionResult?.composition?.assetBindings || {});
  }
  if (compositionResult?.summary) {
    normalizedResult.buildResult.report.assumptions = uniqueNonEmptyLines([
      ...normalizedResult.buildResult.report.assumptions,
      `Composer intent: ${String(compositionResult.summary || "").trim()}`,
    ]);
  }
  console.log(
    `[detailer] normalized page=${String(detailerInput?.pageContext?.workspacePageId || "")} operations=${safeArray(normalizedResult?.buildResult?.operations, 50).length} componentComposition=${safeArray(normalizedResult?.buildResult?.report?.componentComposition, 20).length}`
  );
  const enforcement = enforceBuilderOperations(normalizedResult.buildResult.operations || [], detailerInput);
  if (Array.isArray(enforcement?.violations) && enforcement.violations.length) {
    console.log(
      `[detailer] enforcement page=${String(detailerInput?.pageContext?.workspacePageId || "")} kept=${safeArray(enforcement?.operations, 100).length} violations=${enforcement.violations.length}`
    );
  }
  normalizedResult.buildResult.operations = enforcement.operations;
  normalizedResult.buildResult.changedTargets = Array.from(
    new Set(
      enforcement.operations.map((item) => `${String(item?.slotId || "").trim()}:${String(item?.action || "").trim()}`)
    )
  )
    .map((key) => {
      const [slotId, action] = key.split(":");
      return {
        slotId,
        componentId: `${String(detailerInput?.pageContext?.workspacePageId || "").trim()}.${slotId}`,
        changeType: action === "toggle_slot_source" ? "source_switch" : action === "replace_component_template" ? "template_replace" : "component_patch",
      };
    })
    .filter((item) => item.slotId);
  const current = normalizeEditableData(currentData || {});
  const beforeSnapshot = extractPageScopedSnapshotLite(
    current,
    detailerInput?.pageContext?.workspacePageId || "",
    detailerInput?.pageContext?.viewportProfile || "pc"
  );
  const next = applyOperations(current, normalizedResult.buildResult.operations || [], {
    viewportProfile: detailerInput?.pageContext?.viewportProfile || "pc",
  });
  const afterSnapshot = extractPageScopedSnapshotLite(
    next,
    detailerInput?.pageContext?.workspacePageId || "",
    detailerInput?.pageContext?.viewportProfile || "pc"
  );
  normalizedResult.buildResult.report.critic = buildBuilderCriticReport(normalizedResult, detailerInput, enforcement, {
    beforeSnapshot,
    afterSnapshot,
  });
  const retryTrigger = normalizedResult?.buildResult?.report?.critic?.retryTrigger || {};
  console.log(
    `[critic] structural page=${String(detailerInput?.pageContext?.workspacePageId || "")} status=${String(normalizedResult?.buildResult?.report?.critic?.status || "")} average=${Number(normalizedResult?.buildResult?.report?.critic?.averageScore || 0)} retry=${retryTrigger?.shouldRetry ? "yes" : "no"} failed=${toStringArray(retryTrigger?.failedDimensions).join(",") || "none"}`
  );
  if (retryTrigger?.shouldRetry) {
    const fixResult = await handleLlmFix(detailerInput, normalizedResult.buildResult);
    const fixOperations = Array.isArray(fixResult?.fixResult?.operations) ? fixResult.fixResult.operations : [];
    if (fixOperations.length) {
      const mergedOperations = [
        ...(normalizedResult.buildResult.operations || []),
        ...fixOperations,
      ];
      const mergedEnforcement = enforceBuilderOperations(mergedOperations, detailerInput);
      normalizedResult.buildResult.operations = mergedEnforcement.operations;
      normalizedResult.buildResult.changedTargets = Array.from(
        new Set(
          mergedEnforcement.operations.map((item) => `${String(item?.slotId || "").trim()}:${String(item?.action || "").trim()}`)
        )
      )
        .map((key) => {
          const [slotId, action] = key.split(":");
          return {
            slotId,
            componentId: `${String(detailerInput?.pageContext?.workspacePageId || "").trim()}.${slotId}`,
            changeType: action === "toggle_slot_source" ? "source_switch" : action === "replace_component_template" ? "template_replace" : "component_patch",
          };
        })
        .filter((item) => item.slotId);
      normalizedResult.buildResult.report.whatChanged = uniqueNonEmptyLines([
        ...normalizedResult.buildResult.report.whatChanged,
        ...toStringArray(fixResult?.fixResult?.whatChanged),
      ]);
      normalizedResult.buildResult.report.whyChanged = uniqueNonEmptyLines([
        ...normalizedResult.buildResult.report.whyChanged,
        ...toStringArray(fixResult?.fixResult?.whyChanged),
      ]);
      normalizedResult.buildResult.report.assumptions = uniqueNonEmptyLines([
        ...normalizedResult.buildResult.report.assumptions,
        ...toStringArray(fixResult?.fixResult?.assumptions),
        `Fix pass: ${String(fixResult?.summary || "").trim() || "targeted retry applied"}`,
      ]);
      const finalData = applyOperations(current, normalizedResult.buildResult.operations || [], {
        viewportProfile: detailerInput?.pageContext?.viewportProfile || "pc",
      });
      const finalSnapshot = extractPageScopedSnapshotLite(
        finalData,
        detailerInput?.pageContext?.workspacePageId || "",
        detailerInput?.pageContext?.viewportProfile || "pc"
      );
      normalizedResult.buildResult.report.critic = buildBuilderCriticReport(normalizedResult, detailerInput, mergedEnforcement, {
        beforeSnapshot,
        afterSnapshot: finalSnapshot,
      });
      console.log(
        `[critic] after-fix page=${String(detailerInput?.pageContext?.workspacePageId || "")} status=${String(normalizedResult?.buildResult?.report?.critic?.status || "")} average=${Number(normalizedResult?.buildResult?.report?.critic?.averageScore || 0)} retry=${normalizedResult?.buildResult?.report?.critic?.retryTrigger?.shouldRetry ? "yes" : "no"}`
      );
      return {
        summary: normalizedResult.summary,
        buildResult: normalizedResult.buildResult,
        operations: normalizedResult.buildResult.operations || [],
        data: finalData,
      };
    }
  }
  return {
    summary: normalizedResult.summary,
    buildResult: normalizedResult.buildResult,
    operations: normalizedResult.buildResult.operations || [],
    data: next,
  };
}

async function handleLlmBuildOnData(builderInput, currentData) {
  return runBuilderEngineV2(builderInput, currentData);
}

function buildVisualCriticSystemPrompt() {
  return [
    "You are the Multimodal Comparison Critic for an admin preview workbench.",
    "Persona: a strict visual reviewer who compares before, after, and reference screenshots and decides whether the new draft is visibly stronger, better aligned, and worth another corrective pass.",
    "Use the screenshots as the primary evidence. Use the approved plan and composition intent only as supporting context.",
    "Focus on hierarchy clarity, alignment and rhythm, reference alignment, brand fit, and change strength.",
    "When a focus cluster is provided, also score that focus cluster explicitly.",
    "Do not ask for impossible renderer changes unless the current output clearly cannot satisfy the request without them.",
    "Return JSON only.",
    "Required top-level keys: summary, visualCritic.",
    "Required visualCritic keys: scores, strengths, findings, targetSlots, retryTrigger.",
    "If visualAssets.focusTargetSlots has two or more slots, also return visualCritic.clusterCheck with keys: scores, findings, targetSlots.",
    "All score fields must be numeric 0-100 values.",
    "All list fields must be arrays of plain strings only. Do not return objects inside strengths, findings, targetSlots, or retryTrigger lists.",
  ].join(" ");
}

function buildVisualCriticUserPrompt(input = {}) {
  const payload = {
    pageContext: input.pageContext || {},
    generationOptions: input.generationOptions || {},
    approvedPlan: {
      summary: input?.approvedPlan?.summary || "",
      planningDirection: safeArray(input?.approvedPlan?.planningDirection, 6),
      designDirection: safeArray(input?.approvedPlan?.designDirection, 6),
      guardrails: safeArray(input?.approvedPlan?.guardrails, 8),
      builderBrief: input?.approvedPlan?.builderBrief || {},
    },
    compositionResult: input.compositionResult || null,
    buildResult: {
      changedTargets: safeArray(input?.buildResult?.changedTargets, 12),
      operations: safeArray(input?.buildResult?.operations, 20),
      report: {
        whatChanged: safeArray(input?.buildResult?.report?.whatChanged, 8),
        whyChanged: safeArray(input?.buildResult?.report?.whyChanged, 8),
        componentComposition: safeArray(input?.buildResult?.report?.componentComposition, 8),
        selectedRecipes: safeArray(input?.buildResult?.report?.selectedRecipes, 12),
      },
    },
    visualAssets: {
      beforeLabel: input?.visualAssets?.beforeLabel || "before",
      afterLabel: input?.visualAssets?.afterLabel || "after",
      referenceLabel: input?.visualAssets?.referenceLabel || "reference",
      referenceSource: input?.visualAssets?.referenceSource || null,
      targetSlots: safeArray(input?.visualAssets?.targetSlots, 8),
      focusLabel: input?.visualAssets?.focusLabel || "",
      focusTargetSlots: safeArray(input?.visualAssets?.focusTargetSlots, 8),
    },
    sectionFamilyContracts: {
      identityEnvelope: {
        interventionLayer: input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.interventionLayer || null,
        band: input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.band || null,
        label: input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.label || null,
        intent: input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.intent || "",
        preserve: safeArray(input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.preserve, 5),
        allow: safeArray(input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.allow, 5),
        avoid: safeArray(input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.avoid, 5),
        pagePreserve: safeArray(input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.pagePreserve, 4),
        pageAvoid: safeArray(input?.designToolContext?.sectionFamilyContracts?.identityEnvelope?.pageAvoid, 4),
      },
      clusters: safeArray(input?.designToolContext?.sectionFamilyContracts?.clusters, 4).map((item) => ({
        clusterId: item?.clusterId,
        targetSlots: safeArray(item?.targetSlots, 6),
        goal: item?.goal || "",
        rules: safeArray(item?.rules, 5),
        criticRules: safeArray(item?.criticRules, 5),
      })),
      families: safeArray(input?.designToolContext?.sectionFamilyContracts?.families, 6).map((item) => ({
        familyId: item?.familyId,
        targetSlots: safeArray(item?.targetSlots, 6),
        requiredOutcomes: safeArray(item?.requiredOutcomes, 5),
        criticRules: safeArray(item?.criticRules, 5),
      })),
    },
  };
  return [
    "Compare the screenshots in this order: before full-page, after full-page, focus before, focus after, reference.",
    "Judge whether after is visibly stronger than before and whether it moves toward the reference in the right way without losing brand fit.",
    "If sectionFamilyContracts exist, use them as the hierarchy and cluster-quality rubric for scoring.",
    "If visualAssets.focusTargetSlots exist, judge them as the explicit cluster or focus-area check in addition to the full-page check.",
    "If visualAssets.focusTargetSlots has two or more slots, return visualCritic.clusterCheck.scores with clusterHierarchy, clusterRhythm, clusterReadability on a 0-100 scale, plus cluster-specific findings.",
    "Use sectionFamilyContracts.identityEnvelope as the active brand-fit and clone-identity guardrail. Narrower scopes should be penalized more strongly for drifting away from surrounding page identity, but broader scopes may allow more re-staging if the page still feels like the same product and channel.",
    "If the output still looks too close to before, call that out explicitly in changeStrength.",
    "If the result copies the reference too literally or violates the approved plan, call that out explicitly.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

function normalizeVisualCriticResult(result = {}) {
  const source = result && typeof result === "object" ? result : {};
  const visualCritic = source.visualCritic && typeof source.visualCritic === "object" ? source.visualCritic : {};
  const scores = visualCritic.scores && typeof visualCritic.scores === "object" ? visualCritic.scores : {};
  const normalizeSummary = (value) => {
    if (typeof value === "string") return value.trim();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return String(value || "").trim();
    }
    const parts = [];
    const verdict = String(value.verdict || value.summary || value.overview || "").trim();
    if (verdict) parts.push(verdict);
    if (value.isStronger != null) parts.push(`isStronger=${value.isStronger ? "yes" : "no"}`);
    const referenceAlignment = String(value.referenceAlignment || value.referenceFit || "").trim();
    if (referenceAlignment) parts.push(`referenceAlignment=${referenceAlignment}`);
    const brandFitRisk = String(value.brandFitRisk || value.brandRisk || "").trim();
    if (brandFitRisk) parts.push(`brandFitRisk=${brandFitRisk}`);
    const assessment = String(value.changeStrengthAssessment || value.changeAssessment || "").trim();
    if (assessment) parts.push(assessment);
    if (parts.length) return parts.join(" | ");
    return toStringArray(Object.values(value)).join(" | ").trim();
  };
  const resolveScore = (obj = {}, aliases = [], fallback = Number.NaN) => {
    for (const key of aliases) {
      const candidate = coerceNumericScore(obj?.[key], Number.NaN);
      if (Number.isFinite(candidate)) return candidate;
    }
    return fallback;
  };
  const validationReasons = [];
  const normalizedSummary = normalizeSummary(source.summary);
  if (!(source.summary == null || typeof source.summary === "string" || normalizedSummary)) {
    validationReasons.push("summary must be a string");
  }
  if (!visualCritic || typeof visualCritic !== "object" || Array.isArray(visualCritic)) {
    validationReasons.push("visualCritic object missing");
  }
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    validationReasons.push("visualCritic.scores object missing");
  }
  const resolvedScoreCandidates = {
    hierarchy: resolveScore(scores, ["hierarchy", "hierarchyClarity", "clarity"], Number.NaN),
    alignment: resolveScore(scores, ["alignment", "alignmentAndRhythm", "rhythm", "spacing"], Number.NaN),
    referenceAlignment: resolveScore(scores, ["referenceAlignment", "referenceFit", "referenceCloseness"], Number.NaN),
    brandFit: resolveScore(scores, ["brandFit", "brandAlignment", "identityFit"], Number.NaN),
    changeStrength: resolveScore(scores, ["changeStrength", "change", "deltaStrength"], Number.NaN),
  };
  Object.entries(resolvedScoreCandidates).forEach(([key, value]) => {
    if (!Number.isFinite(value)) {
      validationReasons.push(`visualCritic.scores.${key} must be numeric`);
    }
  });
  if (hasNonPrimitiveArrayEntries(visualCritic.strengths)) validationReasons.push("visualCritic.strengths must be string array");
  if (hasNonPrimitiveArrayEntries(visualCritic.findings)) validationReasons.push("visualCritic.findings must be string array");
  if (hasNonPrimitiveArrayEntries(visualCritic.targetSlots)) validationReasons.push("visualCritic.targetSlots must be string array");
  const focusTargetSlots = toStringArray(visualCritic.focusTargetSlots).length
    ? toStringArray(visualCritic.focusTargetSlots)
    : toStringArray(visualCritic.targetSlots);
  const clusterCheck = visualCritic.clusterCheck && typeof visualCritic.clusterCheck === "object" ? visualCritic.clusterCheck : {};
  const clusterScores = clusterCheck.scores && typeof clusterCheck.scores === "object" ? clusterCheck.scores : {};
  const retryTrigger =
    Array.isArray(visualCritic.retryTrigger)
      ? { instructions: toStringArray(visualCritic.retryTrigger) }
      : (visualCritic.retryTrigger && typeof visualCritic.retryTrigger === "object" ? visualCritic.retryTrigger : {});
  if (visualCritic.retryTrigger && typeof visualCritic.retryTrigger !== "object" && !Array.isArray(visualCritic.retryTrigger)) {
    validationReasons.push("visualCritic.retryTrigger must be object or string array");
  }
  if (hasNonPrimitiveArrayEntries(retryTrigger.instructions)) validationReasons.push("visualCritic.retryTrigger.instructions must be string array");
  if (hasNonPrimitiveArrayEntries(retryTrigger.failedDimensions)) validationReasons.push("visualCritic.retryTrigger.failedDimensions must be string array");
  if (hasNonPrimitiveArrayEntries(retryTrigger.targetSlots)) validationReasons.push("visualCritic.retryTrigger.targetSlots must be string array");
  const normalizedScores = {
    hierarchy: Math.max(0, Math.min(100, resolvedScoreCandidates.hierarchy || 0)),
    alignment: Math.max(0, Math.min(100, resolvedScoreCandidates.alignment || 0)),
    referenceAlignment: Math.max(0, Math.min(100, resolvedScoreCandidates.referenceAlignment || 0)),
    brandFit: Math.max(0, Math.min(100, resolvedScoreCandidates.brandFit || 0)),
    changeStrength: Math.max(0, Math.min(100, resolvedScoreCandidates.changeStrength || 0)),
  };
  const normalizedClusterScores = {
    clusterHierarchy: Math.max(
      0,
      Math.min(
        100,
        coerceNumericScore(
          clusterScores.clusterHierarchy ?? clusterScores.hierarchy ?? normalizedScores.hierarchy,
          0
        ) || 0
      )
    ),
    clusterRhythm: Math.max(
      0,
      Math.min(
        100,
        coerceNumericScore(
          clusterScores.clusterRhythm ?? clusterScores.rhythm ?? normalizedScores.alignment,
          0
        ) || 0
      )
    ),
    clusterReadability: Math.max(
      0,
      Math.min(
        100,
        coerceNumericScore(
          clusterScores.clusterReadability ?? clusterScores.readability ?? normalizedScores.hierarchy,
          0
        ) || 0
      )
    ),
  };
  if (focusTargetSlots.length > 1) {
    if (!clusterCheck || typeof clusterCheck !== "object" || Array.isArray(clusterCheck)) {
      validationReasons.push("visualCritic.clusterCheck object missing for multi-slot focus");
    }
    ["clusterHierarchy", "clusterRhythm", "clusterReadability"].forEach((key) => {
      const value = clusterScores?.[key] ?? (
        key === "clusterHierarchy"
          ? (clusterScores?.hierarchy ?? clusterScores?.hierarchyClarity ?? clusterScores?.clarity)
          : key === "clusterRhythm"
            ? (clusterScores?.rhythm ?? clusterScores?.alignmentAndRhythm ?? clusterScores?.alignment)
            : (clusterScores?.readability ?? clusterScores?.scanability)
      );
      if (!Number.isFinite(coerceNumericScore(value, Number.NaN))) {
        validationReasons.push(`visualCritic.clusterCheck.scores.${key} must be numeric`);
      }
    });
    if (hasNonPrimitiveArrayEntries(clusterCheck.findings)) validationReasons.push("visualCritic.clusterCheck.findings must be string array");
    if (hasNonPrimitiveArrayEntries(clusterCheck.targetSlots)) validationReasons.push("visualCritic.clusterCheck.targetSlots must be string array");
  }
  const failedDimensions = [];
  if (normalizedScores.hierarchy < 75) failedDimensions.push("hierarchy");
  if (normalizedScores.alignment < 75) failedDimensions.push("alignment");
  if (normalizedScores.referenceAlignment < 70) failedDimensions.push("referenceAlignment");
  if (normalizedScores.brandFit < 75) failedDimensions.push("brandFit");
  if (normalizedScores.changeStrength < 70) failedDimensions.push("changeStrength");
  if (focusTargetSlots.length > 1) {
    if (normalizedClusterScores.clusterHierarchy < 75) failedDimensions.push("clusterHierarchy");
    if (normalizedClusterScores.clusterRhythm < 75) failedDimensions.push("clusterRhythm");
    if (normalizedClusterScores.clusterReadability < 75) failedDimensions.push("clusterReadability");
  }
  const isValid = validationReasons.length === 0;
  return {
    summary: normalizedSummary || "visual critic completed",
    visualCritic: {
      validation: {
        isValid,
        reasons: validationReasons,
      },
      scores: normalizedScores,
      clusterCheck: focusTargetSlots.length > 1
        ? {
            scores: normalizedClusterScores,
            findings: toStringArray(clusterCheck.findings),
            targetSlots: toStringArray(clusterCheck.targetSlots).length
              ? toStringArray(clusterCheck.targetSlots)
              : focusTargetSlots,
          }
        : null,
      strengths: toStringArray(visualCritic.strengths),
      findings: toStringArray(visualCritic.findings),
      targetSlots: toStringArray(visualCritic.targetSlots),
      focusTargetSlots,
      retryTrigger: {
        shouldRetry:
          !isValid
            ? true
            : typeof retryTrigger.shouldRetry === "boolean"
              ? retryTrigger.shouldRetry
              : failedDimensions.length > 0,
        failedDimensions: toStringArray(retryTrigger.failedDimensions).length
          ? toStringArray(retryTrigger.failedDimensions)
          : (isValid ? failedDimensions : ["criticInvalid"]),
        instructions: toStringArray(retryTrigger.instructions),
        targetSlots: toStringArray(retryTrigger.targetSlots).length
          ? toStringArray(retryTrigger.targetSlots)
          : toStringArray(visualCritic.targetSlots),
      },
    },
  };
}

function buildVisualCriticUnavailableFallback(reason = "") {
  const detail = String(reason || "visual critic unavailable").trim() || "visual critic unavailable";
  return {
    summary: "visual critic unavailable",
    visualCritic: {
      scores: { hierarchy: 0, alignment: 0, referenceAlignment: 0, brandFit: 0, changeStrength: 0 },
      clusterCheck: {
        scores: { clusterHierarchy: 0, clusterRhythm: 0, clusterReadability: 0 },
        findings: [detail],
        targetSlots: [],
      },
      strengths: [],
      findings: [detail],
      targetSlots: [],
      focusTargetSlots: [],
      retryTrigger: {
        shouldRetry: true,
        failedDimensions: ["criticUnavailable"],
        instructions: ["Visual critic was unavailable. Retry with stronger hierarchy, clearer spacing contrast, and more visible structural change."],
        targetSlots: [],
      },
    },
  };
}

async function handleLlmVisualCritic(input = {}) {
  const primaryModel = resolveOpenRouterModel("CRITIC_MODEL", "BUILDER_MODEL", "OPENROUTER_MODEL");
  const fallbackModels = resolveOpenRouterModelCandidates("CRITIC_FALLBACK_MODEL", "BUILDER_FALLBACK_MODEL", "BUILDER_MODEL")
    .filter((model) => model !== primaryModel);
  const criticTimeoutMs = Math.max(60_000, Number(process.env.CRITIC_REQUEST_TIMEOUT_MS || process.env.BUILDER_REQUEST_TIMEOUT_MS || process.env.LLM_REQUEST_TIMEOUT_MS || 180_000));
  const criticMaxTokens = resolveOpenRouterMaxTokens(process.env.CRITIC_MAX_TOKENS, 2048);
  const userContent = [{ type: "text", text: buildVisualCriticUserPrompt(input) }];
  if (input?.visualAssets?.beforeImageDataUrl) {
    userContent.push({ type: "text", text: "Before screenshot" });
    userContent.push({ type: "image_url", image_url: { url: input.visualAssets.beforeImageDataUrl } });
  }
  if (input?.visualAssets?.afterImageDataUrl) {
    userContent.push({ type: "text", text: "After screenshot" });
    userContent.push({ type: "image_url", image_url: { url: input.visualAssets.afterImageDataUrl } });
  }
  if (input?.visualAssets?.focusBeforeImageDataUrl) {
    userContent.push({ type: "text", text: `${input?.visualAssets?.focusLabel || "Focus area"} before screenshot` });
    userContent.push({ type: "image_url", image_url: { url: input.visualAssets.focusBeforeImageDataUrl } });
  }
  if (input?.visualAssets?.focusAfterImageDataUrl) {
    userContent.push({ type: "text", text: `${input?.visualAssets?.focusLabel || "Focus area"} after screenshot` });
    userContent.push({ type: "image_url", image_url: { url: input.visualAssets.focusAfterImageDataUrl } });
  }
  if (input?.visualAssets?.referenceImageDataUrl) {
    userContent.push({ type: "text", text: "Reference screenshot" });
    userContent.push({ type: "image_url", image_url: { url: input.visualAssets.referenceImageDataUrl } });
  }
  const requestMessages = [
    { role: "system", content: buildVisualCriticSystemPrompt() },
    { role: "user", content: userContent },
  ];
  const runVisualCriticAttempt = async (model, label, fallbackMessage) =>
    withLlmTimeout(
      callOpenRouterJson({
        model,
        temperature: 0.1,
        demoFallback: () => buildVisualCriticUnavailableFallback(fallbackMessage),
        messages: requestMessages,
        timeoutMs: criticTimeoutMs,
        maxTokens: criticMaxTokens,
      }),
      label,
      criticTimeoutMs
    );
  let result;
  try {
    result = await runVisualCriticAttempt(
      primaryModel,
      "Visual critic request",
      "Primary visual critic fallback was used."
    );
  } catch (error) {
    const message = String(error?.message || error || "").toLowerCase();
    const shouldRetryPrimary =
      message.includes("empty content") ||
      message.includes("non-json");
    const shouldRetryWithFallback =
      fallbackModels.length > 0 &&
      (
        isRetryableOpenRouterFailure(message) ||
        message.includes("non-json")
      );
    if (shouldRetryPrimary) {
      console.warn(`[visual-critic] primary-failed model=${primaryModel} reason=${String(error?.message || error || "").trim()}`);
      try {
        result = await runVisualCriticAttempt(
          primaryModel,
          "Visual critic retry request",
          "Primary visual critic retry fallback was used."
        );
      } catch (retryError) {
        const retryMessage = String(retryError?.message || retryError || "").toLowerCase();
        const canFallback =
          fallbackModels.length > 0 &&
          (
            retryMessage.includes("timed out") ||
            retryMessage.includes("terminated") ||
            retryMessage.includes("fetch failed") ||
            retryMessage.includes("empty content") ||
            retryMessage.includes("non-json")
          );
        if (!canFallback) throw retryError;
        let recovered = false;
        let lastFallbackError = retryError;
        for (const fallbackModel of fallbackModels) {
          try {
            result = await runVisualCriticAttempt(
              fallbackModel,
              "Visual critic fallback request",
              "Fallback visual critic was used after the primary critic failed."
            );
            recovered = true;
            break;
          } catch (fallbackError) {
            logModelFallbackFailure("visual-critic", fallbackModel, fallbackError);
            lastFallbackError = fallbackError;
            if (!isRetryableOpenRouterFailure(fallbackError)) throw fallbackError;
          }
        }
        if (!recovered) throw lastFallbackError;
      }
    } else {
      if (!shouldRetryWithFallback) throw error;
      console.warn(`[visual-critic] primary-failed model=${primaryModel} reason=${String(error?.message || error || "").trim()}`);
      let recovered = false;
      let lastFallbackError = error;
      for (const fallbackModel of fallbackModels) {
        try {
          result = await runVisualCriticAttempt(
            fallbackModel,
            "Visual critic fallback request",
            "Fallback visual critic was used after the primary critic failed."
          );
          recovered = true;
          break;
        } catch (fallbackError) {
          logModelFallbackFailure("visual-critic", fallbackModel, fallbackError);
          lastFallbackError = fallbackError;
          if (!isRetryableOpenRouterFailure(fallbackError)) throw fallbackError;
        }
      }
      if (!recovered) throw lastFallbackError;
    }
  }
  const normalized = normalizeVisualCriticResult(result);
  return {
    ...normalized,
    rawResult: toJsonSafeValue(result),
  };
}

function applyOperations(data, operations, options = {}) {
  let next = JSON.parse(JSON.stringify(data));
  const viewportProfile = normalizeViewportProfile(options.viewportProfile || "pc", "pc");

  for (const op of operations || []) {
    if (op.action === "toggle_slot_source") {
      const slot = findSlotConfig(next, op.pageId, op.slotId);
      const sources = Array.isArray(slot?.sources) ? slot.sources : [];
      const requestedSource =
        sources.find((source) => String(source.sourceId || "").trim() === String(op.sourceId || "").trim()) ||
        sources.find((source) => String(source.sourceType || "").trim() === String(op.sourceType || "").trim()) ||
        null;
      if (!slot || !requestedSource) continue;
      slot.activeSourceId = requestedSource.sourceId;
      slot.sources = sources.map((source) => ({
        ...source,
        status:
          source.sourceId === requestedSource.sourceId
            ? "active"
            : source.sourceType === "captured"
              ? "validated"
              : "draft",
      }));
      continue;
    }

    if (op.action === "update_hero_field") {
      const slotId = String(op.slotId || "hero").trim() || "hero";
      const slot = findSlotConfig(next, op.pageId, slotId);
      if (!slot) continue;
      const field = String(op.field || "").trim();
      if (!["badge", "headline", "description", "ctaHref", "imageSrc", "imageAlt", "visibility"].includes(field)) continue;
      const sourceId = String(slot.activeSourceId || "").trim();
      const patchValue = field === "visibility" ? Boolean(op.visible ?? op.value) : op.value;
      if (typeof patchValue === "undefined") continue;
      next = setSlotComponentPatch(next, op.pageId, slotId, sourceId, { [field]: patchValue }, viewportProfile);
      continue;
    }

    if (op.action === "update_slot_text") {
      const slot = findSlotConfig(next, op.pageId, op.slotId);
      if (!slot || typeof op.value !== "string") continue;
      const field = String(op.field || "title").trim();
      const sourceId = String(slot.activeSourceId || "").trim();
      if (slot.slotId === "hero" && ["badge", "headline", "description", "ctaHref"].includes(field)) {
        next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, { [field]: op.value }, viewportProfile);
        continue;
      }
      const patchField =
        field === "headline"
          ? "title"
          : field === "description"
            ? "subtitle"
            : field === "title" || field === "subtitle"
              ? field
              : null;
      if (!patchField) continue;
      next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, { [patchField]: op.value }, viewportProfile);
      continue;
    }

    if (op.action === "update_component_patch") {
      const slot = findSlotConfig(next, op.pageId, op.slotId);
      if (!slot || !op.patch || typeof op.patch !== "object") continue;
      const sourceId = String(slot.activeSourceId || "").trim();
      next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, op.patch, viewportProfile);
      continue;
    }

    if (op.action === "replace_component_template") {
      const pageId = String(op.pageId || "").trim();
      const slotId = String(op.slotId || "").trim();
      const familyId = String(op.familyId || "").trim();
      if (!pageId || !slotId || !familyId) continue;
      const existing = Array.isArray(next.runtimeComponentTemplates) ? next.runtimeComponentTemplates : [];
      const signature = {
        pageId,
        viewportProfile,
        slotId,
        componentId: String(op.componentId || `${pageId}.${slotId}`).trim(),
        familyId,
        templateId: String(op.templateId || "").trim(),
        summary: String(op.summary || "").trim(),
        layoutStrategy: String(op.layoutStrategy || "").trim(),
      };
      const filtered = existing.filter((item) => {
        return !(
          String(item?.pageId || "").trim() === pageId &&
          normalizeViewportProfile(item?.viewportProfile || "pc", "pc") === viewportProfile &&
          String(item?.slotId || "").trim() === slotId
        );
      });
      next.runtimeComponentTemplates = [...filtered, signature];
      continue;
    }

    if (op.action === "update_slot_image") {
      const slot = findSlotConfig(next, op.pageId, op.slotId);
      if (!slot) continue;
      const sourceId = String(slot.activeSourceId || "").trim();
      const imagePatch = {};
      if (typeof op.imageSrc === "string" && op.imageSrc.trim()) imagePatch.imageSrc = op.imageSrc.trim();
      if (typeof op.imageAlt === "string") imagePatch.imageAlt = op.imageAlt;
      if (!Object.keys(imagePatch).length) continue;
      next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, imagePatch, viewportProfile);
      continue;
    }

    const page = (next.pages || []).find((item) => item.id === op.pageId);
    if (!page) continue;

    if (op.action === "update_page_title" && typeof op.value === "string") {
      page.title = op.value;
      continue;
    }

    const section = (page.sections || []).find((item) => item.id === op.sectionId);
    if (!section) continue;

    if (op.action === "rename_section" && typeof op.value === "string") {
      section.name = op.value;
    }

    if (op.action === "toggle_section" && typeof op.visible === "boolean") {
      section.visible = op.visible;
    }

    if (op.action === "reorder_section" && Number.isFinite(op.order)) {
      section.order = Number(op.order);
      page.sections.sort((a, b) => a.order - b.order);
    }
  }

  return next;
}

async function handleLlmChange(requestText) {
  const current = readEditableData();
  const llmResult = await callOpenRouter(requestText, current);
  const next = applyOperations(current, llmResult.operations || []);
  writeEditableData(next);
  return {
    summary: llmResult.summary || "Applied changes",
    operations: llmResult.operations || [],
    data: next,
  };
}

async function handleLlmChangeOnData(requestText, currentData) {
  const current = normalizeEditableData(currentData || {});
  const llmResult = await callOpenRouter(requestText, current);
  const next = applyOperations(current, llmResult.operations || []);
  return {
    summary: llmResult.summary || "Applied changes",
    operations: llmResult.operations || [],
    data: next,
  };
}

module.exports = {
  buildDemoPlannerResult,
  resolveOpenRouterModel,
  resolveOpenRouterModelCandidates,
  logModelFallbackFailure,
  isRetryableOpenRouterFailure,
  buildReferenceVisualUserContent,
  measureMessageChars,
  resolveOpenRouterMaxTokens,
  callOpenRouterJson,
  callOpenRouterText,
  withLlmTimeout,
  toStringArray,
  normalizeDesignChangeLevel,
  normalizePatchDepth,
  uniqueNonEmptyLines,
  buildBuilderSystemPrompt,
  buildBuilderUserPrompt,
  normalizeCompositionPrimitiveTree,
  synthesizePrimitiveTreeForComponent,
  buildDemoBuilderResult,
  extractPageScopedSnapshotLite,
  buildBuilderCriticReport,
  isReplacementFirstExecution,
  normalizeComposerAssetBindings,
  handleLlmCompose,
  normalizeBuilderResult,
  synthesizeComponentCompositionFromComposer,
  synthesizeTemplateOperationsFromComposer,
  buildComposerStyleContractMap,
  handleLlmChange,
  handleLlmChangeOnData,
  handleLlmPlan,
  handleLlmBuildOnData,
  runBuilderEngineV2,
  handleLlmFix,
  handleLlmVisualCritic,
  callOpenRouterImageGeneration,
  applyOperations,
  enforceBuilderOperations,
  normalizeEditableData,
  readEditableData,
  writeEditableData,
};
