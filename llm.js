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
];

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
    ["option", "controls"],
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
  if (String(pageId || "").startsWith("category-")) {
    return buildDefaultCategorySlotRegistry(pageId);
  }
  return null;
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
  next.slotRegistries = Array.isArray(next.slotRegistries) ? next.slotRegistries : [];
  next.componentPatches = Array.isArray(next.componentPatches) ? next.componentPatches : [];
  next.acceptanceResults = Array.isArray(next.acceptanceResults) ? next.acceptanceResults : [];
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
  normalizeEditableData,
  readEditableData,
  writeEditableData,
};
