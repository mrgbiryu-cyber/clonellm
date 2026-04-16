const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data", "normalized", "editable-prototype.json");

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
  return (data.slotRegistries || []).find((item) => item.pageId === pageId) || null;
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

function setSlotComponentPatch(data, pageId, slotId, sourceId, partialPatch, viewportProfile = "") {
  const componentId = resolveComponentId(pageId, slotId);
  const existing = findComponentPatch(data, pageId, componentId, sourceId, viewportProfile)?.patch || {};
  const normalizedPartial =
    String(pageId || "").trim() === "home"
      ? normalizeHomeBuilderPatch(slotId, partialPatch)
      : partialPatch;
  const merged = mergeComponentPatch(existing, normalizedPartial);
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

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
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
  return process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
}

function parseJsonResponseContent(content) {
  const raw = String(content || "").trim();
  if (!raw) {
    throw new Error("OpenRouter returned empty content");
  }
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    }
    throw new Error(`OpenRouter returned non-JSON content: ${raw.slice(0, 160)}`);
  }
}

async function callOpenRouterJson({ model, messages, temperature = 0.1, demoFallback = null }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    if (typeof demoFallback === "function") return demoFallback();
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const siteUrl = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
  const siteName = process.env.OPENROUTER_SITE_NAME || "lge-site-analysis";
  const resolvedModel = model || resolveOpenRouterModel("OPENROUTER_MODEL");
  const timeoutMs = Math.max(15_000, Number(process.env.OPENROUTER_TIMEOUT_MS || 45_000));
  const maxAttempts = Math.max(1, Number(process.env.OPENROUTER_MAX_ATTEMPTS || 1));
  let lastError = null;

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
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter request failed: ${response.status} ${text}`);
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
        message.includes("terminated") ||
        message.includes("fetch failed") ||
        message.includes("socket") ||
        message.includes("econnreset") ||
        message.includes("network");
      if (attempt >= maxAttempts || !isTransient) {
        if (isTimeout) {
          lastError = new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
        }
        break;
      }
    }
  }

  throw lastError || new Error("OpenRouter request failed");
}

function withLlmTimeout(promise, label = "LLM request", timeoutMs = Math.max(20_000, Number(process.env.LLM_REQUEST_TIMEOUT_MS || 60_000))) {
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
  return value.map((item) => String(item || "").trim()).filter(Boolean);
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
  const builderBrief = requirementPlan?.builderBrief && typeof requirementPlan.builderBrief === "object" ? requirementPlan.builderBrief : {};
  const orderedSlotIds = uniqueNonEmptyLines([
    ...toStringArray(builderBrief?.suggestedFocusSlots),
    ...((Array.isArray(requirementPlan?.priority) ? requirementPlan.priority : []).map((item) => String(item?.target || "").trim())),
  ]).slice(0, 8);
  const requestSummary = toStringArray(requirementPlan?.requestSummary);
  const planningDirection = toStringArray(requirementPlan?.planningDirection);
  const designDirection = toStringArray(requirementPlan?.designDirection);
  const mustKeep = toStringArray(builderBrief?.mustKeep);
  const mustChange = toStringArray(builderBrief?.mustChange);
  const pageLabel = String(pageContext?.pageLabel || pageContext?.workspacePageId || "페이지").trim();
  const fallbackLabels = ["상단 진입 영역", "주요 탐색 영역", "핵심 설득 영역", "보강 정보 영역"];
  const targetSlots = orderedSlotIds.length ? orderedSlotIds : fallbackLabels.map((item, index) => `fallback-${index + 1}:${item}`);
  return targetSlots.map((slotId, index) => {
    const isFallback = slotId.startsWith("fallback-");
    const fallbackLabel = isFallback ? slotId.split(":").slice(1).join(":").trim() : "";
    const label = isFallback ? fallbackLabel : formatSlotLabel(slotId);
    const why = planningDirection[index] || planningDirection[index % Math.max(planningDirection.length, 1)] || requestSummary[0] || `${pageLabel}의 변화 이유를 더 분명하게 설명해야 합니다.`;
    const visual = designDirection[index] || designDirection[index % Math.max(designDirection.length, 1)] || designDirection[0] || "타이포, 여백, 강조 포인트, CTA 밀도를 재정리합니다.";
    const keep = mustKeep[index] || mustKeep[index % Math.max(mustKeep.length, 1)] || "현재 페이지의 역할과 핵심 사용자 흐름은 유지합니다.";
    const change = mustChange[index] || mustChange[index % Math.max(mustChange.length, 1)] || "이 구간의 메시지와 시각 위계를 명확하게 다시 설계합니다.";
    const priorityReason = (Array.isArray(requirementPlan?.priority) ? requirementPlan.priority : [])[index]?.reason || why;
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

function buildRequirementPlanMarkdownDocs(requirementPlan = {}, plannerInput = {}) {
  const pageContext = plannerInput?.pageContext || {};
  const pageIdentity = pageContext?.pageIdentity || {};
  const pageLabel = String(pageContext?.pageLabel || pageContext?.workspacePageId || "페이지").trim();
  const viewportLabel = String(pageContext?.viewportLabel || pageContext?.viewportProfile || "PC").trim();
  const title = String(requirementPlan?.title || `${pageLabel} 시안 기획안`).trim();
  const builderBrief = requirementPlan?.builderBrief && typeof requirementPlan?.builderBrief === "object" ? requirementPlan.builderBrief : {};
  const focusSlots = uniqueNonEmptyLines([
    ...toStringArray(builderBrief.suggestedFocusSlots),
    ...((Array.isArray(requirementPlan?.priority) ? requirementPlan.priority : []).map((item) => String(item?.target || "").trim())),
  ]).slice(0, 6);
  const proposalSectionSpecs = buildProposalSectionSpecs(requirementPlan, pageContext);
  const allChangeLines = uniqueNonEmptyLines([
    ...toStringArray(requirementPlan?.requestSummary),
    ...toStringArray(requirementPlan?.planningDirection),
    ...toStringArray(requirementPlan?.designDirection),
    ...toStringArray(builderBrief?.mustChange),
  ]).slice(0, 8);
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
    ...toMarkdownBulletLines(requirementPlan?.requestSummary),
    "",
    "## 2. 기획 목표",
    ...toMarkdownBulletLines([
      String(builderBrief.objective || "").trim(),
      `변화 강도: ${normalizeDesignChangeLevel(requirementPlan?.designChangeLevel, "medium")} — 이번 제안이 어느 정도 체감 변화를 목표로 하는지 명시합니다.`,
    ]),
    "",
    "## 3. 유지해야 할 기준",
    ...toMarkdownBulletLines(builderBrief?.mustKeep),
    "",
    "## 4. 반드시 바뀌어야 할 방향",
    ...toMarkdownBulletLines(builderBrief?.mustChange),
    "",
    "## 5. 상세 기획 방향",
    ...toMarkdownBulletLines(requirementPlan?.planningDirection),
    "",
    "## 6. 상세 디자인 방향",
    ...toMarkdownBulletLines(requirementPlan?.designDirection),
    "",
    "## 7. 우선순위 및 적용 순서",
    ...(Array.isArray(requirementPlan?.priority) ? requirementPlan.priority : []).map((item) => {
      const target = String(item?.target || "").trim();
      const reason = String(item?.reason || "").trim();
      if (!target) return "";
      return `- ${formatSlotLabel(target)} (\`${target}\`): ${reason || "우선 적용 대상"}`;
    }).filter(Boolean),
    "",
    "## 8. 예상 화면 제안",
    ...proposalSectionSpecs.slice(0, 6).flatMap((item) => ([
      `### ${item.order}. ${item.label}${item.slotId ? ` (\`${item.slotId}\`)` : ""}`,
      `- 이 화면을 우선 다뤄야 하는 이유: ${item.priorityReason}`,
      `- 이번 구간에서 반드시 해결해야 할 문제: ${item.why}`,
      `- 제안하는 시각 해법: ${item.visual}`,
      `- 유지해야 할 기준: ${item.keep}`,
      `- 반드시 반영해야 할 변화: ${item.change}`,
      "",
    ])),
    "## 9. 포커스 섹션 목록",
    ...focusSlots.map((slotId) => `- ${formatSlotLabel(slotId)} (\`${slotId}\`)`),
    "",
    "## 10. 가드레일",
    ...toMarkdownBulletLines(requirementPlan?.guardrails),
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
    ...proposalSectionSpecs.slice(0, 6).flatMap((item) => ([
      `### Screen ${item.order}. ${item.label}${item.slotId ? ` (\`${item.slotId}\`)` : ""}`,
      `- 화면 목적: ${item.why}`,
      `- 제안 메시지: ${item.change}`,
      `- 시각적 처리: ${item.visual}`,
      `- 유지 조건: ${item.keep}`,
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
      ]).slice(0, 6)
    ),
  ].join("\n").trim();

  return {
    builderMarkdown,
    layoutMockupMarkdown,
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
  return uniqueNonEmptyLines([...(Array.isArray(values) ? values : []), ...(Array.isArray(fallback) ? fallback : [])]).slice(0, Math.max(minCount, 12));
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

function buildPlannerSystemPrompt() {
  return [
    "You are the Planner LLM for an admin preview workbench.",
    "Persona: a senior digital strategist who organizes client requirements into a preview-ready plan before any build step starts.",
    "This product is for customer-facing preview proposals, not for full production delivery or generic site maintenance.",
    "Your responsibilities are: interpret the request, read reference intent, define planning direction, define visual direction, set priorities, and hand a clear builder brief to the next model.",
    "Your non-responsibilities are: writing patch operations, choosing unsupported tools, saving versions, or performing implementation commands.",
    "Respect the provided target scope. If the planner input is limited to selected components, concentrate only on those slots/components and do not expand the plan to unrelated areas.",
    "Treat pageContext.pageIdentity as a hard brief. The page's original role, purpose, must-preserve qualities, and should-avoid patterns must be reflected in the plan before you discuss change ideas.",
    "Treat pageContext.viewportProfile and pageContext.viewportLabel as hard brief context. The plan must speak only to the target viewport and must not mix mobile, tablet, and desktop assumptions.",
    "Treat reference URLs as inspiration and signal extraction only. Never ask to copy layouts or text verbatim.",
    "If referenceSummary.designReferenceLibrary is provided, treat it as a curated indexed DESIGN.md-style reference library. Use it to borrow mood, hierarchy logic, component density, and section rhythm language, but never copy a source literally.",
    "The user input includes designChangeLevel. Interpret it as the desired exploration width for visual change while still prioritizing the brand design baseline.",
    "Preserve facts about products, prices, and specs.",
    "Return JSON only.",
    "Required top-level keys: summary, requirementPlan.",
    "Required requirementPlan keys: title, designChangeLevel, requestSummary, planningDirection, designDirection, priority, guardrails, referenceNotes, builderBrief, builderMarkdown, layoutMockupMarkdown.",
    "builderBrief must include objective, mustKeep, mustChange, suggestedFocusSlots.",
    "builderMarkdown must read like a customer-facing proposal document with a clear beginning-middle-end structure: background, objective, must-keep rules, must-change rules, planning direction, design direction, priority, and expected screens.",
    "layoutMockupMarkdown must contain a markdown wireframe/mockup representation. Use fenced text blocks and create a detailed wireframe section for every proposed screen/section, not just a short overall sketch.",
    "This output should read like customer-facing planning material, not a short internal memo.",
    "requestSummary must contain 4 to 7 detailed bullets covering background, reason for change, objective, allowed scope, and expected change profile.",
    "planningDirection must contain 5 to 8 detailed bullets covering problem definition, strategic direction, hierarchy changes, scope control, customer persuasion logic, and the rationale behind each major recommendation.",
    "designDirection must contain 5 to 8 detailed bullets covering concrete visual direction such as hierarchy, tone, density, contrast, CTA presence, visual anti-patterns to avoid, and the rationale behind each design move.",
    "suggestedFocusSlots should include every section that the proposal expects to change materially, usually 4 to 8 slots when the page supports that many.",
    "For priority, every item must explain not only what is prioritized but why that target should come first in customer impact terms.",
    "For builderBrief.objective, write a sentence-level objective that explains what success should look like and why that outcome matters to the customer.",
    "For builderBrief.mustKeep and builderBrief.mustChange, each bullet must include both the directive and the reason. Do not write bare nouns or short fragments.",
    "Do not output shorthand bullets like 'hero 개선' or '고급감 강화'. Every bullet should read like proposal copy spoken to a customer.",
  ].join(" ");
}

function buildPlannerUserPrompt(plannerInput) {
  return [
    "Use the following structured planner input.",
    "Create a planning-document-level requirement plan that a human can edit before build.",
    "Do not mention slots or components outside the provided editable scope unless you are explicitly warning that they must remain unchanged.",
    "Do not enumerate internal slot ids, component ids, patch keys, or raw schema names in customer-facing prose. Convert the editable scope into plain business language such as upper entry area, key commerce sections, or lower information sections.",
    "Start from the page's original purpose and identity first. Explain what the page is supposed to do before explaining how the requested change should be applied.",
    "Spend more detail on why the design should change, what customer problem it solves, and what visual direction should be approved before build.",
    "Write in a customer-facing proposal tone. The customer should be able to read each section and understand the rationale behind priority, what must remain, what must change, and what goal the proposal is trying to achieve.",
    "In planningDirection and designDirection, explicitly explain the reasons behind priority, mustKeep, mustChange, and objective. These sections should read like the narrative explanation of the plan, not separate disconnected bullets.",
    "Also create a builder-friendly markdown brief inspired by DESIGN.md-style design docs so the next model can interpret structure, hierarchy, and intent more reliably.",
    "Also create a markdown mockup/wireframe that sketches the page in section order for the current viewport. This mockup should help the builder visualize placement and rhythm without inventing unsupported structure.",
    JSON.stringify(plannerInput, null, 2),
  ].join("\n\n");
}

function buildDemoPlannerResult(plannerInput = {}) {
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
    requestSummary: ensureNarrativeDepth(
      [
        requestText || `${pageLabel} 방향 정리`,
        keyMessage ? `핵심 메시지: ${keyMessage}` : "",
      ].filter(Boolean),
      fallbackNarrative.requestSummary,
      5
    ).map((line) => convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel)),
    planningDirection: ensureNarrativeDepth(
      [
        focusSlots[0] ? `${focusSlots[0]} 영역을 우선적으로 재정리한다.` : "",
        focusSlots[1] ? `${focusSlots[1]} 영역을 보조 시안 포인트로 사용한다.` : "",
      ].filter(Boolean),
      fallbackNarrative.planningDirection,
      6
    ).map((line) => convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel)),
    designDirection: ensureNarrativeDepth(
      [
        preferredDirection ? preferredDirection : "",
        avoidDirection ? `${avoidDirection} 방향은 피한다.` : "",
      ].filter(Boolean),
      fallbackNarrative.designDirection,
      6
    ).map((line) => convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel)),
    priority: normalizePlannerPriority([], focusSlots),
    guardrails: toStringArray(
      plannerInput?.guardrailBundle?.rules,
      ["사실 기반 가격/스펙/상품 정보는 임의 변경 금지"]
    ),
    referenceNotes,
    builderBrief: {
      objective: fallbackNarrative.objectiveNarrative[0] || keyMessage || requestText || `${pageLabel} 방향 정리`,
      mustKeep: fallbackNarrative.mustKeepNarrative.slice(0, 4).map((line) => convertLineToProposalTone(line, pageLabel)),
      mustChange: fallbackNarrative.mustChangeNarrative.slice(0, 4).map((line) => convertLineToProposalTone(line, pageLabel)),
      suggestedFocusSlots: focusSlots.slice(0, 8),
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
  const normalizedRequirementPlan = {
    title: String(requirementPlan.title || `${pageLabel} 시안 기획안`).trim(),
    designChangeLevel: normalizeDesignChangeLevel(
      requirementPlan.designChangeLevel,
      plannerInput?.userInput?.designChangeLevel || "medium"
    ),
    requestSummary: ensureNarrativeDepth(requirementPlan.requestSummary, fallbackNarrative.requestSummary, 5)
      .map((line) => convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel)),
    planningDirection: ensureNarrativeDepth(requirementPlan.planningDirection, fallbackNarrative.planningDirection, 6)
      .map((line) => convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel)),
    designDirection: ensureNarrativeDepth(requirementPlan.designDirection, fallbackNarrative.designDirection, 6)
      .map((line) => convertLineToProposalTone(sanitizeCustomerFacingPlanLine(line, plannerInput), pageLabel)),
    priority: normalizePlannerPriority(requirementPlan.priority, editableSlots),
    guardrails: toStringArray(
      requirementPlan.guardrails,
      toStringArray(plannerInput?.guardrailBundle?.rules, ["사실 기반 가격/스펙/상품 정보는 임의 변경 금지"])
    ),
    referenceNotes: normalizePlannerReferenceNotes(requirementPlan.referenceNotes, fallbackRefNotes),
    builderBrief: {
      objective: String(
        builderBrief.objective ||
        fallbackNarrative.objectiveNarrative[0] ||
        source.summary ||
        `${pageLabel} 방향 정리`
      ).trim(),
      mustKeep: ensureNarrativeDepth(builderBrief.mustKeep, fallbackNarrative.mustKeepNarrative, 3)
        .map((line) => convertLineToProposalTone(line, pageLabel)),
      mustChange: ensureNarrativeDepth(builderBrief.mustChange, fallbackNarrative.mustChangeNarrative, 3)
        .map((line) => convertLineToProposalTone(line, pageLabel)),
      suggestedFocusSlots: toStringArray(builderBrief.suggestedFocusSlots, editableSlots.slice(0, 6))
        .filter((slotId) => !editableSlotSet.size || editableSlotSet.has(slotId))
        .slice(0, 8),
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
  const fallbackModel = resolveOpenRouterModel("PLANNER_FALLBACK_MODEL", "OPENROUTER_MODEL");
  const requestMessages = [
    { role: "system", content: buildPlannerSystemPrompt() },
    { role: "user", content: buildPlannerUserPrompt(plannerInput) },
  ];
  let result;
  try {
    result = await withLlmTimeout(
      callOpenRouterJson({
        model: primaryModel,
        temperature: 0.2,
        demoFallback: () => buildDemoPlannerResult(plannerInput),
        messages: requestMessages,
      }),
      "Planner request"
    );
  } catch (error) {
    const message = String(error?.message || error || "").toLowerCase();
    const shouldRetryWithFallback =
      fallbackModel &&
      fallbackModel !== primaryModel &&
      (message.includes("timed out") || message.includes("terminated") || message.includes("fetch failed"));
    if (!shouldRetryWithFallback) throw error;
    result = await withLlmTimeout(
      callOpenRouterJson({
        model: fallbackModel,
        temperature: 0.2,
        demoFallback: () => buildDemoPlannerResult(plannerInput),
        messages: requestMessages,
      }),
      "Planner fallback request"
    );
  }
  return normalizePlannerResult(result, plannerInput);
}

function buildBuilderSystemPrompt() {
  return [
    "You are the Builder LLM for an admin preview workbench.",
    "Persona: a brand-first preview designer-builder who turns an approved requirement plan into a persuasive page draft inside an existing slot/component system.",
    "This product is for customer-facing preview proposals, not full production redesigns.",
    "Your responsibilities are: map the approved plan onto the allowed slot structure, choose the best available editing tool for the intended visual change, generate supported operations, and report what changed and why.",
    "Your non-responsibilities are: reinterpreting the raw customer request, inventing unsupported slots, rewriting product facts, or performing arbitrary full-page generation outside the system context.",
    "Use only allowed slots and supported operation formats.",
    "Respect the provided target scope. If the system context is limited to selected components, do not create operations for anything outside that scope.",
    "Treat pageContext.pageIdentity and designToolContext.visualPrinciples.pageIdentity as hard constraints. The result must still feel like the same type of page with the same brand role, not a random campaign landing page.",
    "Treat pageContext.viewportProfile and pageContext.viewportLabel as hard constraints. Operations must be appropriate for the target viewport only.",
    "Treat designToolContext.visualPrinciples.layoutTokens and patchRules as hard constraints when they are provided.",
    "Treat approvedPlan.builderMarkdown as the primary machine-readable DESIGN.md-style brief and approvedPlan.layoutMockupMarkdown as the primary section-level mockup/wireframe whenever they are present.",
    "If systemContext.designReferenceLibrary or designToolContext.designReferenceLibrary is provided, treat it as a curated indexed design reference shelf. Use it to amplify design character, component rhythm, contrast strategy, and section mood with stronger intent than generic safe output.",
    "Prioritize brand design first. Do not flatten the result into overly conservative output if the approved designChangeLevel calls for stronger visual exploration.",
    "Respect the approved designChangeLevel and its profile. Low means light refinement, medium means controlled but noticeable improvement, high means strong visual exploration inside the brand/system baseline.",
    "Prefer high-signal supported changes over arbitrary generation. Use update_component_patch and targeted text/image updates for visual changes.",
    "Do not switch slot sources. Never emit toggle_slot_source or slot_source_switch in builder output.",
    "Do not activate figma-derived, custom, alternate, experimental, or placeholder sources from the builder. Builder output must stay on the currently active source and modify it safely with patches only.",
    "Prefer update_component_patch when you need to change multiple supported root/style fields together on one slot.",
    "Your main job is to produce executable operations, not just a narrative report.",
    "If a change is described in whatChanged, there should usually be at least one matching operation unless the patch schema truly blocks it.",
    "Use only update_component_patch, update_slot_text, update_hero_field, update_slot_image, and update_page_title.",
    "Every operation must reference an allowed slotId from editableComponents and must use only patch keys listed in that component's patchSchema.",
    "Treat each component's patchBridge as implementation guidance for which root fields and style fields should be touched first.",
    "Respect each component's mediaSpec and layout. Do not propose image treatment that would make visuals look shrunken, over-cropped, or mismatched to the slot's intended fit.",
    "When mediaSpec.measuredScale or patchBridge.measuredScale is provided, keep the slot's usable width, image presence, and text scale close to that measured baseline unless the approved plan explicitly requires a stronger deviation.",
    "If artifactSectionRegistry is provided, treat it as the primary evidence for which sections come directly from lge.co.kr reference structure and which sections still need custom blocks.",
    "If shareSectionRegistry is provided, use it as section-level evidence for section width, content width, image zones, and replacement feasibility. Do not contradict that geometry in your build logic.",
    "Preserve facts about products, prices, and specs.",
    "Return JSON only.",
    "Required top-level keys: summary, buildResult.",
    "Required buildResult keys: proposedVersionLabel, changedTargets, operations, report.",
  ].join(" ");
}

function buildBuilderUserPrompt(builderInput) {
  return [
    "Use the following approved plan and system context to produce a preview build draft.",
    "Use the brand baseline as the design anchor, and use the approved change profile to decide how far the visual direction should move.",
    "Use the provided designToolContext as the only allowed tool surface and follow its workflow order, patch strategy, and change profile.",
    "Before making any change, align to the page's original identity and avoid visual ideas that would make this page feel like a different product, campaign, or channel.",
    "Avoid isolated dark-theme blocks or isolated dramatic tone shifts unless the page identity explicitly supports that direction across the whole page.",
    "On home, keep section rhythm, background cadence, padding, and title scale aligned to the provided layout tokens. Do not create one-off dark blocks on narrow sections like quickmenu, product lists, banner lists, or service cards.",
    "Prefer 3 to 8 concrete operations when safe changes are possible.",
    "If you claim sections were refined, strengthened, restructured, or clarified, you must express that through executable operations.",
    "When using update_component_patch, keep the patch minimal and only use keys allowed by each component's patchSchema.",
    "Use patchBridge.rootPatchPriority and patchBridge.stylePatchPriority to decide which patch fields fit each slot archetype.",
    "Use mediaSpec, containerMode, and layout as real constraints. Quickmenu icons should still feel icon-sized, product/gallery images should usually remain contain-oriented, and banner/hero visuals should not become visibly undersized inside their frames.",
    "Use measuredScale as a visual baseline for shell width, image frame size, and title scale before exploring stylistic variation.",
    "Read the approved markdown brief as if it were a DESIGN.md file: extract layout intent, hierarchy, component emphasis, and guardrails before deciding operations.",
    "Read the indexed design reference library before deciding visual tone. Use those references to strengthen color attitude, surface treatment, card density, hero drama, and information hierarchy without copying exact layouts.",
    "If artifactSectionRegistry exists, prefer sections where referenceSection.available=true and avoid inventing a new structure when the lge.co.kr reference section already exists.",
    "If shareSectionRegistry exists, align your visual decisions to each section's sectionRect, contentRect, imageZones, and replacementMode before writing operations.",
    "If no operation is possible, explain the exact blocked slot and exact missing patch capability in report.assumptions.",
    "Expected schema example:",
    JSON.stringify({
      summary: "짧은 요약",
      buildResult: {
        proposedVersionLabel: "home-premium-v1",
        changedTargets: [{ slotId: "hero", componentId: "home.hero", changeType: "component_patch" }],
        operations: [
          { action: "update_component_patch", pageId: "home", slotId: "hero", patch: { badge: "브랜드 제안", title: "새 타이틀", styles: { titleSize: "32" } } },
        ],
        report: {
          whatChanged: ["상단 진입 구간의 메시지 집중도를 강화했습니다."],
          whyChanged: ["첫 인상에서 브랜드 인지가 약했기 때문입니다."],
          assumptions: ["가격과 상품 사실 정보는 유지했습니다."],
          guardrailCheck: [{ rule: "사실 정보 유지", status: "pass" }],
        },
      },
    }, null, 2),
    "If the approved plan is valid but no safe operation is possible, return an empty operations array and explain why in the report.",
    JSON.stringify(builderInput, null, 2),
  ].join("\n\n");
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
  const slotLimit = designChangeLevel === "low" ? 3 : designChangeLevel === "high" ? 6 : 4;

  for (const item of patchableSlots.slice(0, slotLimit)) {
    const { slotId, rootKeys, styleKeys } = item;
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
    changeType: item.action === "toggle_slot_source" ? "source_switch" : "component_patch",
  }));
  const changedTargets = rawChangedTargets.length ? rawChangedTargets : inferredChangedTargets;
  const report = buildResult.report && typeof buildResult.report === "object" ? buildResult.report : {};
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
        guardrailCheck: Array.isArray(report.guardrailCheck) ? report.guardrailCheck : [],
      },
    },
  };
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
            guardrailCheck: normalized.buildResult.report.guardrailCheck.length
              ? normalized.buildResult.report.guardrailCheck
              : (Array.isArray(synthesized.buildResult.report?.guardrailCheck) ? synthesized.buildResult.report.guardrailCheck : []),
          },
        },
      };
    }
  }
  return normalized;
}

async function handleLlmBuildOnData(builderInput, currentData) {
  const result = await withLlmTimeout(
    callOpenRouterJson({
      model: resolveOpenRouterModel("BUILDER_MODEL", "OPENROUTER_MODEL"),
      temperature: 0.15,
      demoFallback: () => buildDemoBuilderResult(builderInput),
      messages: [
        { role: "system", content: buildBuilderSystemPrompt() },
        { role: "user", content: buildBuilderUserPrompt(builderInput) },
      ],
    }),
    "Builder request"
  );
  const normalizedResult = normalizeBuilderResult(result, builderInput);
  const current = normalizeEditableData(currentData || {});
  const next = applyOperations(current, normalizedResult.buildResult.operations || [], {
    viewportProfile: builderInput?.pageContext?.viewportProfile || "pc",
  });
  return {
    summary: normalizedResult.summary,
    buildResult: normalizedResult.buildResult,
    operations: normalizedResult.buildResult.operations || [],
    data: next,
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
  handleLlmChange,
  handleLlmChangeOnData,
  handleLlmPlan,
  handleLlmBuildOnData,
  normalizeEditableData,
  readEditableData,
  writeEditableData,
};
