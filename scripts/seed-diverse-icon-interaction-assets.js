"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STARTER_PATH = path.join(ROOT, "data", "normalized", "asset-pipeline-starter.json");
const GENERATED_FAMILIES_PATH = path.join(ROOT, "data", "normalized", "generated-asset-families.json");
const ICON_REGISTRY_PATH = path.join(ROOT, "data", "normalized", "icon-family-registry.json");
const INTERACTION_REGISTRY_PATH = path.join(ROOT, "data", "normalized", "interaction-component-registry.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function svgDataUrl(paths, options = {}) {
  const stroke = options.stroke || "#111111";
  const strokeWidth = options.strokeWidth || "1.9";
  const body = paths.join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const iconShapes = [
  ['<rect x="6" y="7" width="16" height="14" rx="3"/>', '<path d="M10 12h8M10 16h5"/>'],
  ['<circle cx="14" cy="14" r="8"/>', '<path d="M14 8v6l4 3"/>'],
  ['<path d="M7 20V9l7-4 7 4v11"/>', '<path d="M10 20v-6h8v6"/>'],
  ['<rect x="5" y="9" width="18" height="11" rx="3"/>', '<path d="M9 9V7h10v2M9 14h10"/>'],
  ['<path d="M7 18l4-8 4 6 3-4 3 6"/>', '<path d="M6 21h16"/>'],
  ['<path d="M6 9h16M8 14h12M11 19h6"/>', '<circle cx="7" cy="9" r="1"/>', '<circle cx="21" cy="9" r="1"/>'],
  ['<rect x="6" y="6" width="16" height="16" rx="5"/>', '<path d="M10 14h8M14 10v8"/>'],
  ['<path d="M8 8h12v12H8z"/>', '<path d="M11 8V5h6v3M11 20v3h6v-3"/>'],
  ['<path d="M6 14h16"/>', '<path d="M14 6v16"/>', '<path d="M9 9l10 10M19 9L9 19"/>'],
  ['<path d="M8 10h12l-2 10H10z"/>', '<path d="M11 10a3 3 0 0 1 6 0"/>'],
  ['<path d="M8 7h12v14H8z"/>', '<path d="M11 11h6M11 15h6"/>'],
  ['<path d="M5 14h18"/>', '<path d="M14 5v18"/>', '<path d="M9 9l10 10"/>'],
];

const familySpecs = [
  {
    assetFamilyId: "home.quickmenu.premium.arc.icon.family.v1",
    familyId: "home-quickmenu-premium-arc-line-v1",
    pageFamilies: ["home"],
    slotFamilies: ["quickmenu", "shortcut"],
    componentIds: ["home.quickmenu"],
    usage: ["home.quickmenu", "home.shortcut"],
    labels: ["구독 Days", "혜택/이벤트", "웨딩&이사", "다품목 할인", "라이브", "카드혜택", "가전 구독", "소모품", "SALE 홈스타일"],
    styleSummary: "premium rounded arc icon family for home quickmenu redesigns",
    semanticRole: "home quickmenu premium navigation icon family",
    selectionHints: ["home quickmenu icons", "premium shortcut set", "rounded arc navigation"],
    shapeStart: 2,
    styleSpec: {
      viewport: "28x28",
      stroke: "2.1",
      corner: "soft-rounded",
      tone: "warm-ink",
      fillMode: "outline-only",
      backgroundUsage: "none",
    },
    svgOptions: { stroke: "#2a211d", strokeWidth: "2.1" },
  },
  {
    assetFamilyId: "home.story.micro.cue.icon.family.v1",
    familyId: "home-story-micro-cue-line-v1",
    pageFamilies: ["home"],
    slotFamilies: ["hero", "banner", "marketing-area", "story"],
    componentIds: ["home.hero", "home.marketing-area"],
    usage: ["home.hero", "home.banner", "home.marketing-area", "home.story"],
    labels: ["신제품", "프리미엄", "라이프", "케어", "혜택", "설치", "상담", "공유"],
    styleSummary: "small editorial cue icon family for home hero and story support chips",
    semanticRole: "home editorial support cue icon family",
    selectionHints: ["hero support chips", "editorial cue icons", "story metadata icons"],
    shapeStart: 4,
    styleSpec: {
      viewport: "28x28",
      stroke: "1.55",
      corner: "editorial-rounded",
      tone: "muted-ink",
      fillMode: "outline-only",
      backgroundUsage: "none",
    },
    svgOptions: { stroke: "#45413d", strokeWidth: "1.55" },
  },
  {
    assetFamilyId: "support.service.icon.family.v1",
    familyId: "support-service-line-v1",
    pageFamilies: ["support"],
    slotFamilies: ["service-intro", "support-tab", "tabs", "shortcut", "mainService", "bestcare", "tipsBanner", "notice"],
    componentIds: ["support.service-intro", "support.support-tab", "support.mainService", "support.bestcare", "support.tipsBanner", "support.notice"],
    usage: ["support.service-intro", "support.support-tab", "support.tabs", "support.mainService", "support.bestcare", "support.tipsBanner", "support.notice"],
    labels: ["제품 등록", "AS 신청", "매장 찾기", "소모품 구매", "설치/철거", "상담 예약", "사용설명서", "보증/케어"],
    styleSummary: "rounded service utility line icon family for support entry points",
    semanticRole: "support service shortcut icon family",
    selectionHints: ["support tab icons", "service shortcut icons", "support quick access"],
  },
  {
    assetFamilyId: "support.status.badge.icon.family.v1",
    familyId: "support-status-badge-line-v1",
    pageFamilies: ["support"],
    slotFamilies: ["mainService", "bestcare", "notice", "tabs", "support-tab"],
    componentIds: ["support.mainService", "support.bestcare", "support.notice"],
    usage: ["support.mainService", "support.bestcare", "support.notice", "support.support-tab"],
    labels: ["접수", "진행", "완료", "예약", "긴급", "문의", "보증", "알림"],
    styleSummary: "compact status badge icon family for support service states",
    semanticRole: "support status and service state icon family",
    selectionHints: ["support status icons", "service state badges", "notice cue icons"],
    shapeStart: 5,
    styleSpec: {
      viewport: "28x28",
      stroke: "1.8",
      corner: "compact-rounded",
      tone: "cool-utility",
      fillMode: "outline-only",
      backgroundUsage: "none",
    },
    svgOptions: { stroke: "#263544", strokeWidth: "1.8" },
  },
  {
    assetFamilyId: "plp.filter.utility.icon.family.v1",
    familyId: "plp-filter-utility-line-v1",
    pageFamilies: ["category-refrigerators", "category-tvs", "plp"],
    slotFamilies: ["filter", "sort", "tabs", "product-grid", "drawer"],
    componentIds: ["category-refrigerators.filter", "category-tvs.filter"],
    usage: ["category-refrigerators.filter", "category-refrigerators.sort", "category-refrigerators.tabs", "category-tvs.filter", "category-tvs.sort", "category-tvs.tabs"],
    labels: ["필터", "정렬", "비교", "배송", "에너지", "색상", "크기", "할인"],
    styleSummary: "compact utility icon family for PLP filter, sort, and compare controls",
    semanticRole: "PLP browse utility icon family",
    selectionHints: ["PLP filter icons", "sort utility", "compare chip icons"],
  },
  {
    assetFamilyId: "plp.product.signal.icon.family.v1",
    familyId: "plp-product-signal-line-v1",
    pageFamilies: ["category-refrigerators", "category-tvs", "plp"],
    slotFamilies: ["product-grid", "bestProduct", "ranking", "filter", "sort"],
    componentIds: ["category-refrigerators.product-grid", "category-tvs.product-grid"],
    usage: ["category-refrigerators.product-grid", "category-refrigerators.ranking", "category-tvs.product-grid", "category-tvs.ranking"],
    labels: ["인기", "신제품", "에너지", "배송", "할인", "비교", "리뷰", "색상"],
    styleSummary: "sharp product signal icon family for PLP cards, rankings, and feature chips",
    semanticRole: "PLP product feature signal icon family",
    selectionHints: ["PLP card chips", "ranking badges", "product feature cues"],
    shapeStart: 7,
    styleSpec: {
      viewport: "28x28",
      stroke: "1.7",
      corner: "technical",
      tone: "graphite",
      fillMode: "outline-only",
      backgroundUsage: "none",
    },
    svgOptions: { stroke: "#111827", strokeWidth: "1.7" },
  },
  {
    assetFamilyId: "pdp.commerce.utility.icon.family.v1",
    familyId: "pdp-commerce-utility-line-v1",
    pageFamilies: ["pdp", "pdp-tv-general", "pdp-tv-premium", "pdp-refrigerator-general", "pdp-refrigerator-glass", "pdp-refrigerator-knockon"],
    slotFamilies: ["summary", "sticky", "buybox", "qna", "gallery", "review"],
    componentIds: ["pdp-tv-general.sticky", "pdp-refrigerator-general.sticky"],
    usage: ["pdp-tv-general.sticky", "pdp-tv-general.buybox", "pdp-tv-general.summary", "pdp-tv-premium.sticky", "pdp-refrigerator-general.sticky", "pdp-refrigerator-general.buybox", "pdp-refrigerator-glass.sticky", "pdp-refrigerator-knockon.sticky"],
    labels: ["장바구니", "바로구매", "공유", "찜", "배송", "설치", "리뷰", "문의", "비교"],
    styleSummary: "commerce action icon family for PDP purchase and utility surfaces",
    semanticRole: "PDP commerce action icon family",
    selectionHints: ["PDP sticky CTA icons", "buybox utility icons", "review and inquiry icons"],
  },
  {
    assetFamilyId: "pdp.benefit.chip.icon.family.v1",
    familyId: "pdp-benefit-chip-line-v1",
    pageFamilies: ["pdp", "pdp-tv-general", "pdp-tv-premium", "pdp-refrigerator-general", "pdp-refrigerator-glass", "pdp-refrigerator-knockon"],
    slotFamilies: ["summary", "sticky", "buybox", "review", "qna"],
    componentIds: ["pdp-tv-general.summary", "pdp-refrigerator-general.summary"],
    usage: ["pdp-tv-general.summary", "pdp-tv-general.sticky", "pdp-refrigerator-general.summary", "pdp-refrigerator-general.sticky"],
    labels: ["무이자", "배송", "설치", "케어", "리뷰", "공유", "혜택", "상담"],
    styleSummary: "commerce benefit chip icon family for PDP reassurance and purchase rails",
    semanticRole: "PDP benefit and purchase reassurance icon family",
    selectionHints: ["PDP benefit chips", "sticky buybox icons", "purchase reassurance cues"],
    shapeStart: 9,
    styleSpec: {
      viewport: "28x28",
      stroke: "2.0",
      corner: "confident-rounded",
      tone: "commerce-ink",
      fillMode: "outline-only",
      backgroundUsage: "none",
    },
    svgOptions: { stroke: "#3b0a18", strokeWidth: "2.0" },
  },
  {
    assetFamilyId: "care.solution.service.icon.family.v1",
    familyId: "care-solution-service-line-v1",
    pageFamilies: ["care-solutions", "care-solutions-pdp"],
    slotFamilies: ["careBanner", "hero", "ranking", "category", "shortcut"],
    componentIds: ["care-solutions.careBanner", "care-solutions.ranking"],
    usage: ["care-solutions.careBanner", "care-solutions.ranking", "care-solutions.category", "care-solutions-pdp.summary"],
    labels: ["정수기", "공기청정", "청소", "안마의자", "식기세척", "제습", "렌탈", "상담"],
    styleSummary: "soft appliance-care icon family for rental and care solution categories",
    semanticRole: "care solution category icon family",
    selectionHints: ["care solution category icons", "rental service icons", "care ranking icons"],
  },
  {
    assetFamilyId: "care.wellness.rounded.icon.family.v1",
    familyId: "care-wellness-rounded-line-v1",
    pageFamilies: ["care-solutions", "care-solutions-pdp"],
    slotFamilies: ["careBanner", "hero", "ranking", "category", "shortcut", "bestcare"],
    componentIds: ["care-solutions.careBanner", "care-solutions.ranking", "care-solutions-pdp.summary"],
    usage: ["care-solutions.careBanner", "care-solutions.ranking", "care-solutions.category", "care-solutions-pdp.summary"],
    labels: ["정수", "공기", "청소", "수면", "안심", "상담", "렌탈", "관리"],
    styleSummary: "warm rounded wellness icon family for care solution categories and reassurance cards",
    semanticRole: "care solution wellness category icon family",
    selectionHints: ["care wellness icons", "rental reassurance icons", "service category icons"],
    shapeStart: 1,
    styleSpec: {
      viewport: "28x28",
      stroke: "1.85",
      corner: "soft-organic",
      tone: "warm-service",
      fillMode: "outline-only",
      backgroundUsage: "none",
    },
    svgOptions: { stroke: "#3f342c", strokeWidth: "1.85" },
  },
  {
    assetFamilyId: "mobile.nav.action.icon.family.v1",
    familyId: "mobile-nav-action-line-v1",
    pageFamilies: ["home", "support", "care-solutions", "category-refrigerators", "category-tvs", "pdp"],
    slotFamilies: ["quickmenu", "shortcut", "tabs", "filter", "drawer", "sticky", "gnb"],
    componentIds: [],
    usage: ["home.quickmenu", "support.support-tab", "category-refrigerators.filter", "category-tvs.filter", "care-solutions.careBanner", "pdp-tv-general.sticky"],
    labels: ["홈", "검색", "카테고리", "최근본", "알림", "메뉴", "닫기", "뒤로"],
    styleSummary: "mobile navigation action icon family for touch-first utility controls",
    semanticRole: "mobile navigation and action icon family",
    selectionHints: ["mobile GNB icons", "drawer controls", "touch action icons"],
  },
  {
    assetFamilyId: "mobile.gesture.utility.icon.family.v1",
    familyId: "mobile-gesture-utility-line-v1",
    pageFamilies: ["home", "support", "care-solutions", "category-refrigerators", "category-tvs", "pdp"],
    slotFamilies: ["quickmenu", "shortcut", "tabs", "filter", "drawer", "sticky", "gnb", "ranking"],
    componentIds: [],
    usage: ["home.quickmenu", "support.support-tab", "category-refrigerators.filter", "category-tvs.filter", "care-solutions.careBanner", "pdp-tv-general.sticky"],
    labels: ["열기", "닫기", "필터", "정렬", "탭", "스와이프", "고정", "선택"],
    styleSummary: "mobile gesture utility icon family for touch-first states and controls",
    semanticRole: "mobile gesture and control state icon family",
    selectionHints: ["mobile control icons", "drawer state icons", "touch gesture cues"],
    shapeStart: 6,
    styleSpec: {
      viewport: "28x28",
      stroke: "2.05",
      corner: "touch-rounded",
      tone: "mobile-ink",
      fillMode: "outline-only",
      backgroundUsage: "none",
    },
    svgOptions: { stroke: "#151515", strokeWidth: "2.05" },
  },
];

const interactionSeeds = [
  {
    interactionId: "modal.dialog.basic-v1",
    componentType: "modal",
    runtimeModule: "web/interaction-components/modal.dialog.basic-v1.js",
    status: "approved",
    sourceType: "internal-adapter",
    pageFamilies: ["support", "pdp", "home"],
    slotFamilies: ["modal", "popup", "qna", "review", "notice"],
    semanticRole: "scoped dialog modal with open, close, escape, and backdrop behavior",
    llmDescription: "Reusable modal dialog behavior for review, inquiry, and notice surfaces. Uses scoped open, close, escape, and backdrop controls.",
    stateSchema: { open: "boolean" },
    controlSchema: { closeOnBackdrop: "boolean", closeOnEscape: "boolean" },
    verificationSchema: ["openStateVisible", "closePathWorks", "focusReturn", "destroyCleanup"],
    selectionHints: ["review modal", "inquiry modal", "notice popup"],
  },
  {
    interactionId: "tooltip.popover.basic-v1",
    componentType: "tooltip",
    runtimeModule: "web/interaction-components/tooltip.popover.basic-v1.js",
    status: "approved",
    sourceType: "internal-adapter",
    pageFamilies: ["pdp", "support", "plp"],
    slotFamilies: ["tooltip", "info", "summary", "filter"],
    semanticRole: "small contextual popover with hover, focus, and click disclosure",
    llmDescription: "Reusable tooltip/popover behavior for helper copy and product spec explanations. Supports click, focus, and hover disclosure.",
    stateSchema: { open: "boolean", activeIndex: "number" },
    controlSchema: { triggerMode: "hover|click|focus", closeOnEscape: "boolean" },
    verificationSchema: ["popoverVisible", "ariaExpandedSync", "destroyCleanup"],
    selectionHints: ["spec info tooltip", "filter helper popover", "price benefit hint"],
  },
  {
    interactionId: "compare.slider.basic-v1",
    componentType: "compare-slider",
    runtimeModule: "web/interaction-components/compare.slider.basic-v1.js",
    status: "approved",
    sourceType: "internal-adapter",
    pageFamilies: ["home", "pdp", "care-solutions"],
    slotFamilies: ["compare", "before-after", "story", "hero"],
    semanticRole: "before-after comparison slider with inspectable position state",
    llmDescription: "Reusable before/after visual comparison slider with CSS variable position sync and keyboard controls.",
    stateSchema: { position: "number" },
    controlSchema: { defaultPosition: "number", keyboardStep: "number" },
    verificationSchema: ["positionSync", "keyboardWorks", "destroyCleanup"],
    selectionHints: ["before after story", "product comparison visual", "care effect comparison"],
  },
  {
    interactionId: "segmented.control.basic-v1",
    componentType: "segmented-control",
    runtimeModule: "web/interaction-components/segmented.control.basic-v1.js",
    status: "approved",
    sourceType: "internal-adapter",
    pageFamilies: ["plp", "support", "home"],
    slotFamilies: ["tabs", "sort", "filter", "ranking"],
    semanticRole: "single selected segmented control for sort, ranking, and option choices",
    llmDescription: "Reusable segmented control behavior for sort, ranking, and option choices with one selected state.",
    stateSchema: { selectedIndex: "number", itemCount: "number" },
    controlSchema: { defaultIndex: "number" },
    verificationSchema: ["selectedStateSync", "keyboardWorks", "destroyCleanup"],
    selectionHints: ["ranking segment", "sort segment", "category chip selection"],
  },
];

const interactionScopePatches = [
  {
    interactionId: "tabs.switch.basic-v1",
    pageFamilies: ["home", "support", "plp", "care-solutions", "category-refrigerators", "category-tvs"],
    slotFamilies: ["tabs", "ranking", "support-tab", "category-tabs", "sort"],
  },
  {
    interactionId: "drawer.filter.basic-v1",
    pageFamilies: ["plp", "category-refrigerators", "category-tvs"],
    slotFamilies: ["filter", "drawer", "sort"],
  },
  {
    interactionId: "sticky.buybox.basic-v1",
    pageFamilies: ["pdp", "pdp-tv-general", "pdp-tv-premium", "pdp-refrigerator-general", "pdp-refrigerator-glass", "pdp-refrigerator-knockon"],
    slotFamilies: ["sticky", "buybox", "summary"],
  },
  {
    interactionId: "accordion.disclosure.basic-v1",
    pageFamilies: ["support", "pdp", "care-solutions", "care-solutions-pdp", "pdp-tv-general", "pdp-tv-premium", "pdp-refrigerator-general", "pdp-refrigerator-glass", "pdp-refrigerator-knockon"],
    slotFamilies: ["accordion", "faq", "notice", "qna", "bestcare"],
  },
  {
    interactionId: "carousel.snap.basic-v1",
    pageFamilies: ["home", "pdp", "care-solutions", "category-refrigerators", "category-tvs", "pdp-tv-general", "pdp-tv-premium", "pdp-refrigerator-general", "pdp-refrigerator-glass", "pdp-refrigerator-knockon"],
    slotFamilies: ["hero", "banner", "gallery", "quickmenu", "careBanner", "product-grid"],
  },
];

function buildGeneratedFamily(spec, nowIso) {
  const styleSpec = {
    viewport: "28x28",
    stroke: "1.9",
    corner: "rounded",
    tone: "mono-ink",
    fillMode: "outline-only",
    backgroundUsage: "none",
    ...(spec.styleSpec || {}),
  };
  const shapeStart = Number(spec.shapeStart || 0) || 0;
  return {
    assetFamilyId: spec.assetFamilyId,
    familyId: spec.familyId,
    generatedAt: nowIso,
    status: "ready",
    styleSummary: spec.styleSummary,
    styleSpec,
    members: spec.labels.map((label, index) => ({
      label,
      assetId: `${spec.assetFamilyId.replace(/\.family\.v1$/, "")}.icon.${index + 1}`,
      assetUrl: svgDataUrl(iconShapes[(shapeStart + index) % iconShapes.length], spec.svgOptions || {}),
      format: "image/svg+xml",
    })),
  };
}

function upsertBy(items, keyName, nextItem) {
  const key = String(nextItem?.[keyName] || "").trim();
  const index = items.findIndex((item) => String(item?.[keyName] || "").trim() === key);
  if (index >= 0) {
    items[index] = { ...items[index], ...nextItem };
    return "updated";
  }
  items.push(nextItem);
  return "inserted";
}

function mergeList(existing = [], next = []) {
  return Array.from(new Set([...(Array.isArray(existing) ? existing : []), ...(Array.isArray(next) ? next : [])].map((item) => String(item || "").trim()).filter(Boolean)));
}

function main() {
  const nowIso = new Date().toISOString();
  const starter = readJson(STARTER_PATH, { assetFamilies: [] });
  const generated = readJson(GENERATED_FAMILIES_PATH, { families: {} });
  const iconRegistry = readJson(ICON_REGISTRY_PATH, { families: [] });
  const interactionRegistry = readJson(INTERACTION_REGISTRY_PATH, { components: [] });
  starter.assetFamilies = Array.isArray(starter.assetFamilies) ? starter.assetFamilies : [];
  generated.families = generated.families && typeof generated.families === "object" ? generated.families : {};
  iconRegistry.families = Array.isArray(iconRegistry.families) ? iconRegistry.families : [];
  interactionRegistry.components = Array.isArray(interactionRegistry.components) ? interactionRegistry.components : [];

  const summary = {
    iconFamiliesInserted: 0,
    iconFamiliesUpdated: 0,
    interactionComponentsInserted: 0,
    interactionComponentsUpdated: 0,
    interactionApproved: 0,
    interactionCandidate: 0,
  };

  for (const spec of familySpecs) {
    const generatedFamily = buildGeneratedFamily(spec, nowIso);
    generated.families[spec.assetFamilyId] = generatedFamily;
    const starterResult = upsertBy(starter.assetFamilies, "id", {
      id: spec.assetFamilyId,
      familyId: spec.familyId,
      role: "icon-only",
      usage: spec.usage,
      status: "ready",
      memberCount: spec.labels.length,
      memberLabels: spec.labels,
      styleSummary: spec.styleSummary,
      styleSpec: generatedFamily.styleSpec,
      generationMode: "batch-consistent",
      restrictedUse: [
        "do not replace with promo-complete thumbnails",
        "do not mix unrelated svg sources in one family",
        "do not embed text or badge background in icon members",
      ],
    });
    const registryResult = upsertBy(iconRegistry.families, "familyId", {
      familyId: spec.assetFamilyId,
      assetKind: "icon-family",
      status: "approved",
      role: "icon-only",
      sourceType: "generated",
      sourceRef: `data/normalized/generated-asset-families.json#/families/${spec.assetFamilyId}`,
      pageFamilies: spec.pageFamilies,
      slotFamilies: spec.slotFamilies,
      componentIds: spec.componentIds,
      viewportProfiles: ["pc", "mo"],
      memberCount: spec.labels.length,
      styleSummary: spec.styleSummary,
      styleSpec: generatedFamily.styleSpec,
      semanticRole: spec.semanticRole,
      llmDescription: `${spec.styleSummary}. Use this as a consistent icon-only package, not as independent mixed thumbnails.`,
      llmDo: ["use members together as one family", "preserve stroke, corner, and density consistency", "map members by label"],
      llmDont: ["mix with promo thumbnails", "use members as hero art", "invent missing member ids", "embed text inside icons"],
      selectionHints: spec.selectionHints,
      conflictHints: ["conflicts with promo-complete thumbnails", "conflicts with full-bleed background slots"],
      validationTags: ["icon-only", "family-consistent", "no-text", "same-stroke-language", "diversity-seed"],
      members: generatedFamily.members.map((member) => ({ label: member.label, assetId: member.assetId })),
      provenanceNotes: "Seeded as internal generated SVG icon family to expand reusable icon diversity without external licensing risk.",
      reviewedAt: nowIso,
      reviewNotes: "Internal generated mono-line SVG package. Approved for icon-only usage.",
    });
    if (starterResult === "inserted" || registryResult === "inserted") summary.iconFamiliesInserted += 1;
    else summary.iconFamiliesUpdated += 1;
  }

  for (const seed of interactionSeeds) {
    const nextStatus = String(seed.status || "candidate").trim() || "candidate";
    const result = upsertBy(interactionRegistry.components, "interactionId", {
      ...seed,
      assetKind: "interaction-component",
      status: nextStatus,
      sourceType: seed.sourceType || (nextStatus === "approved" ? "internal-adapter" : "internal-adapter-required"),
      viewportProfiles: ["pc", "mo"],
      llmDo: ["use scoped data attributes", "keep state inspectable", "use only within the provided root"],
      llmDont: ["write inline JavaScript", "attach unscoped document listeners", "replace unrelated DOM outside the slot"],
      conflictHints: nextStatus === "approved" ? ["requires matching data attributes in authored HTML"] : ["candidate until runtime adapter is implemented and verified"],
      provenanceNotes: nextStatus === "approved"
        ? "Seeded as approved internal interaction adapter after runtime module implementation."
        : "Seeded as interaction diversity candidate. Approval requires adapter implementation and browser verification.",
      reviewedAt: nextStatus === "approved" ? nowIso : undefined,
      reviewNotes: nextStatus === "approved"
        ? `Runtime adapter file added at ${seed.runtimeModule}. Uses scoped selectors and exposes mount/update/getState/verify/destroy.`
        : undefined,
    });
    if (result === "inserted") summary.interactionComponentsInserted += 1;
    else summary.interactionComponentsUpdated += 1;
    if (nextStatus === "approved") summary.interactionApproved += 1;
    else summary.interactionCandidate += 1;
  }

  for (const patch of interactionScopePatches) {
    const component = interactionRegistry.components.find((item) => String(item?.interactionId || "").trim() === patch.interactionId);
    if (!component) continue;
    component.pageFamilies = mergeList(component.pageFamilies, patch.pageFamilies);
    component.slotFamilies = mergeList(component.slotFamilies, patch.slotFamilies);
  }

  starter.updatedAt = nowIso;
  generated.updatedAt = nowIso;
  iconRegistry.updatedAt = nowIso;
  interactionRegistry.updatedAt = nowIso;
  iconRegistry.auditLog = [
    ...(Array.isArray(iconRegistry.auditLog) ? iconRegistry.auditLog : []),
    { type: "diverse-icon-family-seed", count: familySpecs.length, updatedAt: nowIso },
  ].slice(-120);
  interactionRegistry.auditLog = [
    ...(Array.isArray(interactionRegistry.auditLog) ? interactionRegistry.auditLog : []),
    { type: "interaction-diversity-seed", count: interactionSeeds.length, approved: summary.interactionApproved, candidate: summary.interactionCandidate, updatedAt: nowIso },
  ].slice(-120);

  writeJson(STARTER_PATH, starter);
  writeJson(GENERATED_FAMILIES_PATH, generated);
  writeJson(ICON_REGISTRY_PATH, iconRegistry);
  writeJson(INTERACTION_REGISTRY_PATH, interactionRegistry);
  console.log(JSON.stringify(summary, null, 2));
}

main();
