const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data", "normalized", "editable-prototype.json");

const WORKSPACE_DEFAULT_PAGE_IDS = [
  "home",
  "support",
  "bestshop",
  "care-solutions",
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
  if (normalized === "https://www.lge.co.kr/home") return "home";
  if (normalized === "https://www.lge.co.kr/support") return "support";
  if (normalized === "https://www.lge.co.kr/bestshop") return "bestshop";
  if (normalized === "https://www.lge.co.kr/care-solutions") return "care-solutions";
  if (normalized === "https://www.lge.co.kr/category/tvs") return "category-tvs";
  if (normalized === "https://www.lge.co.kr/category/refrigerators") return "category-refrigerators";
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
  if (["support", "bestshop", "care-solutions"].includes(pageId)) {
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

function listComponentPatches(data, pageId = "") {
  const patches = Array.isArray(data?.componentPatches) ? data.componentPatches : [];
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return patches;
  return patches.filter((entry) => String(entry.pageId || "").trim() === normalizedPageId);
}

function findComponentPatch(data, pageId, componentId, sourceId = "") {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  const patches = listComponentPatches(data, normalizedPageId);
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

function upsertComponentPatch(data, pageId, componentId, sourceId, patch) {
  const nextData = JSON.parse(JSON.stringify(data || {}));
  nextData.componentPatches = Array.isArray(nextData.componentPatches) ? nextData.componentPatches : [];
  const normalizedPageId = String(pageId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  const nextPatch = patch && typeof patch === "object" ? JSON.parse(JSON.stringify(patch)) : {};
  const existingIndex = nextData.componentPatches.findIndex(
    (entry) =>
      String(entry.pageId || "").trim() === normalizedPageId &&
      String(entry.componentId || "").trim() === normalizedComponentId &&
      String(entry.sourceId || "").trim() === normalizedSourceId
  );
  const record = {
    pageId: normalizedPageId,
    componentId: normalizedComponentId,
    sourceId: normalizedSourceId,
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

function setSlotComponentPatch(data, pageId, slotId, sourceId, partialPatch) {
  const componentId = resolveComponentId(pageId, slotId);
  const existing = findComponentPatch(data, pageId, componentId, sourceId)?.patch || {};
  const merged = mergeComponentPatch(existing, partialPatch);
  return upsertComponentPatch(data, pageId, componentId, sourceId, merged);
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

async function callOpenRouterJson({ model, messages, temperature = 0.1, demoFallback = null }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    if (typeof demoFallback === "function") return demoFallback();
    throw new Error("OPENROUTER_API_KEY is not set");
  }

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
      model: model || resolveOpenRouterModel("OPENROUTER_MODEL"),
      temperature,
      response_format: { type: "json_object" },
      messages,
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

function toStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
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

function buildPlannerSystemPrompt() {
  return [
    "You are the Planner LLM for an admin preview workbench.",
    "Persona: a senior digital strategist who organizes client requirements into a preview-ready plan before any build step starts.",
    "This product is for customer-facing preview proposals, not for full production delivery or generic site maintenance.",
    "Your responsibilities are: interpret the request, read reference intent, define planning direction, define visual direction, set priorities, and hand a clear builder brief to the next model.",
    "Your non-responsibilities are: writing patch operations, choosing unsupported tools, saving versions, or performing implementation commands.",
    "Respect the provided target scope. If the planner input is limited to selected components, concentrate only on those slots/components and do not expand the plan to unrelated areas.",
    "Treat reference URLs as inspiration and signal extraction only. Never ask to copy layouts or text verbatim.",
    "The user input includes designChangeLevel. Interpret it as the desired exploration width for visual change while still prioritizing the brand design baseline.",
    "Preserve facts about products, prices, and specs.",
    "Return JSON only.",
    "Required top-level keys: summary, requirementPlan.",
    "Required requirementPlan keys: title, designChangeLevel, requestSummary, planningDirection, designDirection, priority, guardrails, referenceNotes, builderBrief.",
    "builderBrief must include objective, mustKeep, mustChange, suggestedFocusSlots.",
    "Make the plan concise but explicit enough that a human can edit it and the Builder can execute it safely.",
  ].join(" ");
}

function buildPlannerUserPrompt(plannerInput) {
  return [
    "Use the following structured planner input.",
    "Create a concise but detailed requirement plan that a human can edit before build.",
    "Do not mention slots or components outside the provided editable scope unless you are explicitly warning that they must remain unchanged.",
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
  const focusSlots = editableSlots.slice(0, 4);
  const referenceNotes = ((plannerInput?.referenceSummary?.analyses || []) || [])
    .filter((item) => item?.requestedUrl)
    .map((item) => ({
      url: String(item.requestedUrl || item.finalUrl || "").trim(),
      takeaways: toStringArray(item?.takeaways),
    }))
    .slice(0, 5);
  return {
    summary: `${pageLabel} 요구사항 정리 완료`,
    requirementPlan: {
      title: `${pageLabel} 시안 기획안`,
      designChangeLevel,
      requestSummary: toStringArray(
        [
          requestText || `${pageLabel} 방향 정리`,
          keyMessage ? `핵심 메시지: ${keyMessage}` : "",
        ].filter(Boolean),
        [`${pageLabel} 요구사항을 정리한다.`]
      ),
      planningDirection: toStringArray(
        [
          focusSlots[0] ? `${focusSlots[0]} 영역을 우선적으로 재정리한다.` : "",
          focusSlots[1] ? `${focusSlots[1]} 영역을 보조 시안 포인트로 사용한다.` : "",
        ].filter(Boolean),
        ["현재 편집 가능한 슬롯 중심으로 시안 범위를 제한한다."]
      ),
      designDirection: toStringArray(
        [
          preferredDirection ? preferredDirection : "",
          avoidDirection ? `${avoidDirection} 방향은 피한다.` : "",
        ].filter(Boolean),
        ["과도한 구현보다 고객 프리뷰용 방향 제시에 집중한다."]
      ),
      priority: normalizePlannerPriority([], focusSlots),
      guardrails: toStringArray(
        plannerInput?.guardrailBundle?.rules,
        ["사실 기반 가격/스펙/상품 정보는 임의 변경 금지"]
      ),
      referenceNotes,
      builderBrief: {
        objective: keyMessage || requestText || `${pageLabel} 방향 정리`,
        mustKeep: ["지원되는 슬롯 구조", "핵심 사용자 흐름"],
        mustChange: focusSlots.length ? focusSlots.map((slotId) => `${slotId} 영역 톤 조정`) : ["핵심 카피 톤 재정리"],
        suggestedFocusSlots: focusSlots,
      },
    },
  };
}

function normalizePlannerResult(result, plannerInput = {}) {
  const source = result && typeof result === "object" ? result : {};
  const pageLabel = String(plannerInput?.pageContext?.pageLabel || plannerInput?.pageContext?.workspacePageId || "페이지").trim();
  const editableSlots = toStringArray(plannerInput?.pageSummary?.editableSlots);
  const editableSlotSet = new Set(editableSlots);
  const fallbackRefNotes = ((plannerInput?.referenceSummary?.analyses || []) || [])
    .filter((item) => item?.requestedUrl)
    .map((item) => ({
      url: String(item.requestedUrl || item.finalUrl || "").trim(),
      takeaways: toStringArray(item?.takeaways),
    }))
    .slice(0, 5);
  const requirementPlan = source.requirementPlan && typeof source.requirementPlan === "object" ? source.requirementPlan : {};
  const builderBrief = requirementPlan.builderBrief && typeof requirementPlan.builderBrief === "object" ? requirementPlan.builderBrief : {};
  return {
    summary: String(source.summary || `${pageLabel} 요구사항 정리 완료`).trim(),
    requirementPlan: {
      title: String(requirementPlan.title || `${pageLabel} 시안 기획안`).trim(),
      designChangeLevel: normalizeDesignChangeLevel(
        requirementPlan.designChangeLevel,
        plannerInput?.userInput?.designChangeLevel || "medium"
      ),
      requestSummary: toStringArray(requirementPlan.requestSummary, [`${pageLabel} 요구사항 정리`]),
      planningDirection: toStringArray(requirementPlan.planningDirection, ["편집 가능한 슬롯 범위 안에서 방향을 정리한다."]),
      designDirection: toStringArray(requirementPlan.designDirection, ["고객 프리뷰용 비주얼 방향을 제안한다."]),
      priority: normalizePlannerPriority(requirementPlan.priority, editableSlots),
      guardrails: toStringArray(
        requirementPlan.guardrails,
        toStringArray(plannerInput?.guardrailBundle?.rules, ["사실 기반 가격/스펙/상품 정보는 임의 변경 금지"])
      ),
      referenceNotes: normalizePlannerReferenceNotes(requirementPlan.referenceNotes, fallbackRefNotes),
      builderBrief: {
        objective: String(builderBrief.objective || source.summary || `${pageLabel} 방향 정리`).trim(),
        mustKeep: toStringArray(builderBrief.mustKeep, ["지원되는 슬롯 구조", "핵심 사용자 흐름"]),
        mustChange: toStringArray(builderBrief.mustChange, editableSlots.slice(0, 3).map((slotId) => `${slotId} 영역 조정`)),
        suggestedFocusSlots: toStringArray(builderBrief.suggestedFocusSlots, editableSlots.slice(0, 4))
          .filter((slotId) => !editableSlotSet.size || editableSlotSet.has(slotId))
          .slice(0, 4),
      },
    },
  };
}

async function handleLlmPlan(plannerInput) {
  const result = await callOpenRouterJson({
    model: resolveOpenRouterModel("PLANNER_MODEL", "OPENROUTER_MODEL"),
    temperature: 0.2,
    demoFallback: () => buildDemoPlannerResult(plannerInput),
    messages: [
      { role: "system", content: buildPlannerSystemPrompt() },
      { role: "user", content: buildPlannerUserPrompt(plannerInput) },
    ],
  });
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
    "Prioritize brand design first. Do not flatten the result into overly conservative output if the approved designChangeLevel calls for stronger visual exploration.",
    "Respect the approved designChangeLevel and its profile. Low means light refinement, medium means controlled but noticeable improvement, high means strong visual exploration inside the brand/system baseline.",
    "Prefer high-signal supported changes over arbitrary generation. Source switching and component patches may be used assertively when they fit the approved change profile.",
    "Prefer update_component_patch when you need to change multiple supported root/style fields together on one slot.",
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
  ];
  const normalizedSlots = Array.from(new Set(preferredSlots)).filter(Boolean);
  const operations = [];
  const changedTargets = [];

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
  const slotLimit = designChangeLevel === "low" ? 1 : designChangeLevel === "high" ? 4 : 2;

  for (const slotId of normalizedSlots.slice(0, slotLimit)) {
    if (slotId === "summary" || slotId === "hero" || slotId === "banner") {
      pushTextOp(slotId, "title", objective || requestLead || `${pageLabel} 방향 강화`);
      pushTextOp(slotId, "subtitle", designLead || "고객 프리뷰용 방향 제안");
      continue;
    }
    if (slotId === "price" || slotId === "sticky") {
      pushTextOp(slotId, "title", objective || "핵심 메시지 정리");
      continue;
    }
    if (slotId === "review" || slotId === "qna") {
      pushTextOp(slotId, "title", requestLead || `${slotId} 섹션 톤 정리`);
      continue;
    }
    const stylePatch = {};
    if (designChangeLevel === "high") {
      stylePatch.titleWeight = "700";
      stylePatch.titleSize = "28";
      stylePatch.subtitleSize = "16";
    } else if (designChangeLevel === "medium") {
      stylePatch.titleWeight = "600";
      stylePatch.titleSize = "24";
      stylePatch.subtitleSize = "15";
    }
    pushPatchOp(slotId, {
      title: objective || requestLead || `${slotId} 방향 정리`,
      subtitle: designLead || "",
      description: requestLead || "",
      badge: approvedPlan?.requestSummary?.[0] || "",
      ctaLabel: "자세히 보기",
      moreLabel: "더보기",
      styles: stylePatch,
    });
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
        whatChanged: uniqueTargets.slice(0, 4).map((item) => `${item.slotId} 영역 시안 조정`),
        whyChanged: [
          `승인된 Planner 정리본과 designChangeLevel=${designChangeLevel} 기준으로 집중 slot만 반영`,
        ],
        assumptions: [
          "가격/스펙 같은 사실 데이터는 유지",
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
  const operations = Array.isArray(buildResult.operations) ? buildResult.operations.filter((item) => item && typeof item === "object") : [];
  const changedTargets = Array.isArray(buildResult.changedTargets) ? buildResult.changedTargets.filter((item) => item && typeof item === "object") : [];
  const report = buildResult.report && typeof buildResult.report === "object" ? buildResult.report : {};
  return {
    summary: String(source.summary || `${pageLabel} 시안 생성 완료`).trim(),
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
}

async function handleLlmBuildOnData(builderInput, currentData) {
  const result = await callOpenRouterJson({
    model: resolveOpenRouterModel("BUILDER_MODEL", "OPENROUTER_MODEL"),
    temperature: 0.15,
    demoFallback: () => buildDemoBuilderResult(builderInput),
    messages: [
      { role: "system", content: buildBuilderSystemPrompt() },
      { role: "user", content: buildBuilderUserPrompt(builderInput) },
    ],
  });
  const normalizedResult = normalizeBuilderResult(result, builderInput);
  const current = normalizeEditableData(currentData || {});
  const next = applyOperations(current, normalizedResult.buildResult.operations || []);
  return {
    summary: normalizedResult.summary,
    buildResult: normalizedResult.buildResult,
    operations: normalizedResult.buildResult.operations || [],
    data: next,
  };
}

function applyOperations(data, operations) {
  let next = JSON.parse(JSON.stringify(data));

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
      next = setSlotComponentPatch(next, op.pageId, slotId, sourceId, { [field]: patchValue });
      continue;
    }

    if (op.action === "update_slot_text") {
      const slot = findSlotConfig(next, op.pageId, op.slotId);
      if (!slot || typeof op.value !== "string") continue;
      const field = String(op.field || "title").trim();
      const sourceId = String(slot.activeSourceId || "").trim();
      if (slot.slotId === "hero" && ["badge", "headline", "description", "ctaHref"].includes(field)) {
        next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, { [field]: op.value });
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
      next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, { [patchField]: op.value });
      continue;
    }

    if (op.action === "update_component_patch") {
      const slot = findSlotConfig(next, op.pageId, op.slotId);
      if (!slot || !op.patch || typeof op.patch !== "object") continue;
      const sourceId = String(slot.activeSourceId || "").trim();
      next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, op.patch);
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
      next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, imagePatch);
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
