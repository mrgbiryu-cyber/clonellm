"use strict";

const fs = require("fs");
const path = require("path");

function loadRecipeLibrary() {
  const recipePath = path.join(__dirname, "../data/normalized/home-recipe-library.json");
  try {
    return JSON.parse(fs.readFileSync(recipePath, "utf8"));
  } catch (error) {
    console.warn(`[builder-local] recipe-library-load-failed path=${recipePath} reason=${String(error?.message || error || "")}`);
    return {};
  }
}

const recipeLibrary = loadRecipeLibrary();

function toStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeTone(value, fallback = "neutral") {
  const normalized = String(value || "").trim().toLowerCase();
  if (["premium", "editorial", "cinematic", "neutral", "service-trust"].includes(normalized)) return normalized;
  return fallback;
}

function pickRecipe(collection = [], predicate, context = "") {
  const normalizedCollection = Array.isArray(collection) ? collection.filter(Boolean) : [];
  if (!normalizedCollection.length) {
    if (context) {
      console.warn(`[builder-local] recipe-missing context=${context}`);
    }
    return null;
  }
  const matched = normalizedCollection.find(predicate);
  if (matched) return matched;
  const fallback = normalizedCollection[0] || null;
  if (fallback && context) {
    console.warn(
      `[builder-local] recipe-fallback context=${context} fallback=${String(fallback?.recipeId || fallback?.primitiveId || "unknown").trim()}`
    );
  }
  return fallback;
}

function inferRequestedTone(builderInput = {}) {
  const approvedPlan = builderInput?.approvedPlan || {};
  const lines = [
    ...toStringArray(approvedPlan?.designDirection),
    ...toStringArray(approvedPlan?.planningDirection),
    ...toStringArray(approvedPlan?.requestSummary),
    ...toStringArray(approvedPlan?.builderBrief?.mustChange),
    ...toStringArray(approvedPlan?.builderBrief?.mustKeep),
    String(builderInput?.pageContext?.pageIdentity?.designIntent || "").trim(),
  ]
    .join(" ")
    .toLowerCase();
  if (/cinematic|campaign|launch|premium|flagship|showcase/.test(lines)) return "premium";
  if (/editorial|story|curation|큐레이션|에디토리얼|스토리/.test(lines)) return "editorial";
  if (/service|support|guide|안심|도움|서비스/.test(lines)) return "service-trust";
  return "neutral";
}

function findEditableComponent(editableComponents = [], slotId = "") {
  return (Array.isArray(editableComponents) ? editableComponents : []).find(
    (item) => String(item?.slotId || "").trim() === slotId
  ) || null;
}

function isServiceLikePageId(pageId = "") {
  return [
    "support",
    "bestshop",
    "care-solutions",
    "care-solutions-pdp",
    "homestyle-home",
    "homestyle-pdp",
  ].includes(String(pageId || "").trim());
}

function isCategoryPageId(pageId = "") {
  return String(pageId || "").trim().startsWith("category-");
}

function isPdpCasePageId(pageId = "") {
  return [
    "pdp-tv-general",
    "pdp-tv-premium",
    "pdp-refrigerator-general",
    "pdp-refrigerator-knockon",
    "pdp-refrigerator-glass",
  ].includes(String(pageId || "").trim());
}

function findEditableByComponentId(editableComponents = [], componentId = "") {
  return (Array.isArray(editableComponents) ? editableComponents : []).find(
    (item) => String(item?.componentId || "").trim() === String(componentId || "").trim()
  ) || null;
}

function resolveEffectiveEditableTargets(builderInput = {}) {
  const editableComponents = Array.isArray(builderInput?.systemContext?.editableComponents)
    ? builderInput.systemContext.editableComponents
    : [];
  const requestedTargets = Array.isArray(builderInput?.generationOptions?.targetComponents)
    ? builderInput.generationOptions.targetComponents.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const requestedFocusSlots = toStringArray(builderInput?.approvedPlan?.builderBrief?.suggestedFocusSlots);
  const matchedRequestedTargets = requestedTargets.length
    ? editableComponents.filter((item) => {
        const componentId = String(item?.componentId || "").trim();
        const slotId = String(item?.slotId || "").trim();
        return requestedTargets.includes(componentId) || requestedTargets.includes(slotId);
      })
    : [];
  const unmatchedRequestedTargets = requestedTargets.filter((target) =>
    !matchedRequestedTargets.some((item) => {
      const componentId = String(item?.componentId || "").trim();
      const slotId = String(item?.slotId || "").trim();
      return target === componentId || target === slotId;
    })
  );
  if (unmatchedRequestedTargets.length) {
    console.warn(`[builder-local] unmatched-targets page=${String(builderInput?.pageContext?.workspacePageId || "").trim()} targets=${unmatchedRequestedTargets.join(",")}`);
  }
  const focusTargets =
    !requestedTargets.length && requestedFocusSlots.length
      ? editableComponents.filter((item) => requestedFocusSlots.includes(String(item?.slotId || "").trim()))
      : [];
  const effectiveTargets = requestedTargets.length
    ? matchedRequestedTargets
    : (focusTargets.length ? focusTargets : editableComponents);
  return {
    editableComponents,
    effectiveTargets,
    effectiveComponentIds: new Set(effectiveTargets.map((item) => String(item?.componentId || "").trim()).filter(Boolean)),
    effectiveSlotIds: new Set(effectiveTargets.map((item) => String(item?.slotId || "").trim()).filter(Boolean)),
    unmatchedRequestedTargets,
  };
}

function resolveTemplateForRecipe(recipe = null, fallback = "") {
  const recipeId = String(recipe?.recipeId || "").trim();
  if (recipeId.startsWith("hero-premium")) return "hero-premium-stage-v1";
  if (recipeId.startsWith("hero-editorial")) return "hero-editorial-v1";
  if (recipeId.startsWith("hero-centered") || recipeId.includes("centered")) return "hero-centered-v1";
  if (recipeId.startsWith("hero-story") || recipeId.startsWith("hero-featured") || recipeId.startsWith("hero-category")) return "hero-stacked-v1";
  if (recipeId.startsWith("hero-guided")) return "hero-carousel-composition-v1";
  if (recipeId.startsWith("quickmenu-lead")) return "quickmenu-panel-v1";
  if (recipeId.startsWith("quickmenu-editorial")) return "quickmenu-editorial-strip-v1";
  if (recipeId.startsWith("quickmenu-utility")) return "icon-link-grid-composition-v1";
  return fallback;
}

function resolveFamilyId(component = null, fallback = "") {
  return String(component?.patchBridge?.familyId || component?.familyId || fallback || "").trim();
}

function normalizeAssetPlan(assetPipelineStarter = {}, componentId = "", familyId = "") {
  const pageDefaults = assetPipelineStarter?.pageDefaults && typeof assetPipelineStarter.pageDefaults === "object"
    ? assetPipelineStarter.pageDefaults
    : {};
  const familyDefaults = assetPipelineStarter?.familyDefaults && typeof assetPipelineStarter.familyDefaults === "object"
    ? assetPipelineStarter.familyDefaults[familyId] || {}
    : {};
  const componentDefaults = assetPipelineStarter?.componentDefaults && typeof assetPipelineStarter.componentDefaults === "object"
    ? assetPipelineStarter.componentDefaults[componentId] || {}
    : {};
  return {
    iconSetIds: Array.from(new Set([...(pageDefaults.iconSetIds || []), ...(familyDefaults.iconSetIds || []), ...(componentDefaults.iconSetIds || [])])).slice(0, 4),
    badgePresetIds: Array.from(new Set([...(pageDefaults.badgePresetIds || []), ...(familyDefaults.badgePresetIds || []), ...(componentDefaults.badgePresetIds || [])])).slice(0, 4),
    visualSetIds: Array.from(new Set([...(pageDefaults.visualSetIds || []), ...(familyDefaults.visualSetIds || []), ...(componentDefaults.visualSetIds || [])])).slice(0, 4),
    thumbnailPresetIds: Array.from(new Set([...(pageDefaults.thumbnailPresetIds || []), ...(familyDefaults.thumbnailPresetIds || []), ...(componentDefaults.thumbnailPresetIds || [])])).slice(0, 4),
  };
}

function buildPatch(editable = null, patch = {}) {
  const rootKeys = new Set(Array.isArray(editable?.patchSchema?.rootKeys) ? editable.patchSchema.rootKeys : []);
  const styleKeys = new Set(Array.isArray(editable?.patchSchema?.styleKeys) ? editable.patchSchema.styleKeys : []);
  const next = {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (key === "styles" && value && typeof value === "object") {
      const nextStyles = {};
      for (const [styleKey, styleValue] of Object.entries(value)) {
        if (!styleKeys.has(styleKey)) continue;
        if (styleValue === null || typeof styleValue === "undefined" || String(styleValue).trim() === "") continue;
        nextStyles[styleKey] = styleValue;
      }
      if (Object.keys(nextStyles).length) next.styles = nextStyles;
      continue;
    }
    if (!rootKeys.has(key)) continue;
    if (value === null || typeof value === "undefined" || String(value).trim() === "") continue;
    next[key] = value;
  }
  return next;
}

function resolveServiceTemplateId(familyId = "") {
  const normalized = String(familyId || "").trim();
  if (normalized === "hero-carousel-composition") return "hero-editorial-v1";
  if (normalized === "icon-link-grid-composition") return "icon-link-grid-composition-v1";
  if (normalized === "image-banner-strip-composition") return "editorial-banner-wide-v1";
  if (normalized === "ranking-list-composition") return "ranking-card-poster-v1";
  if (normalized === "service-benefit-hub-composition") return "commerce-card-clean-v1";
  if (normalized === "editorial-visual-story-composition") return "story-card-portrait-v1";
  if (normalized === "commerce-card-grid-composition") return "commerce-card-clean-v1";
  if (normalized === "pdp-summary-stack-composition") return "pdp-summary-stack-composition-v1";
  if (normalized === "pdp-sticky-buybox-composition") return "pdp-sticky-buybox-composition-v1";
  return "";
}

function inferSectionTitle(componentId = "", slotId = "") {
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedSlotId = String(slotId || "").trim();
  const overrides = {
    "support.mainService": "서비스 이용 가이드",
    "support.bestcare": "안심 케어 서비스",
    "support.tipsBanner": "자주 찾는 지원 혜택",
    "bestshop.hero": "가까운 베스트샵 상담",
    "bestshop.shortcut": "매장 바로가기",
    "bestshop.brandBanner": "오프라인 체험 혜택",
    "care-solutions.hero": "케어 솔루션 대표 제안",
    "care-solutions.ranking": "지금 많이 보는 솔루션",
    "care-solutions.benefit": "이용 혜택 모음",
    "care-solutions.tabs": "카테고리 빠른 진입",
    "care-solutions.careBanner": "상담 연결 배너",
    "care-solutions-pdp.visual": "상세 소개 스토리",
    "homestyle-home.quickMenu": "스타일 카테고리 탐색",
    "homestyle-home.labelBanner": "추천 배너",
    "homestyle-home.brandStory": "브랜드 스토리",
    "homestyle-pdp.bestProduct": "추천 제품",
    "category-tvs.banner": "TV 카테고리 하이라이트",
    "category-refrigerators.banner": "냉장고 카테고리 하이라이트",
    "pdp-tv-general.summary": "TV 제품 요약",
    "pdp-tv-general.sticky": "TV 구매 박스",
    "pdp-tv-premium.summary": "프리미엄 TV 제품 요약",
    "pdp-tv-premium.sticky": "프리미엄 TV 구매 박스",
    "pdp-refrigerator-general.summary": "냉장고 제품 요약",
    "pdp-refrigerator-general.sticky": "냉장고 구매 박스",
    "pdp-refrigerator-knockon.summary": "노크온 냉장고 요약",
    "pdp-refrigerator-knockon.sticky": "노크온 냉장고 구매 박스",
    "pdp-refrigerator-glass.summary": "글라스 냉장고 요약",
    "pdp-refrigerator-glass.sticky": "글라스 냉장고 구매 박스",
  };
  return overrides[normalizedComponentId] || normalizedSlotId || "구성 제안";
}

function buildServiceLikeComponentComposition(editable = null, requestedTone = "service-trust", assetPipelineStarter = {}) {
  const componentId = String(editable?.componentId || "").trim();
  const slotId = String(editable?.slotId || "").trim();
  const familyId = resolveFamilyId(editable, "");
  if (!componentId || !slotId || !familyId) return null;
  const title = inferSectionTitle(componentId, slotId);
  return {
    slotId,
    componentId,
    familyId,
    templateId: resolveServiceTemplateId(familyId),
    recipeId: "",
    label: `${componentId} tailwind replacement proposal`,
    scope: "component",
    summary: `${title} 영역을 Tailwind replacement block으로 정리합니다.`,
    layoutStrategy: "replacement-only / family-driven section block",
    preservedElements: ["원문 페이지 정보 구조", "기존 섹션 역할", "브랜드 톤"],
    changedElements: ["spacing", "hierarchy", "scan rhythm"],
    styleContract: {
      surfaceTone: normalizeTone(requestedTone, "service-trust"),
      density: familyId === "image-banner-strip-composition" ? "compact" : "balanced",
      hierarchyEmphasis: familyId === "hero-carousel-composition" ? "headline-first" : "scan-first",
      interactionTone: "brand-confident",
      tokenHints: {
        familyId,
        replacementMode: "tailwind-service-block",
      },
    },
    assetPlan: normalizeAssetPlan(assetPipelineStarter, componentId, familyId),
    primitiveTree: {
      type: familyId,
      variant: "",
      props: {
        tone: normalizeTone(requestedTone, "service-trust"),
        replacementMode: "tailwind-service-block",
      },
      children: [],
    },
  };
}

function buildServiceLikePatch(editable = null) {
  const componentId = String(editable?.componentId || "").trim();
  const familyId = resolveFamilyId(editable, "");
  const title = inferSectionTitle(componentId, editable?.slotId || "");
  if (familyId === "hero-carousel-composition") {
    return buildPatch(editable, {
      badge: "LG 서비스 제안",
      title,
      headline: title,
      description: "원문 정보 구조를 유지하면서 첫 진입 메시지와 행동 유도를 더 또렷하게 정리합니다.",
      ctaLabel: "자세히 보기",
      styles: {
        background: "linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%)",
        textAlign: "left",
      },
    });
  }
  if (familyId === "image-banner-strip-composition") {
    return buildPatch(editable, {
      title,
      subtitle: "핵심 안내를 더 짧고 읽기 쉽게 정리한 배너 제안입니다.",
    });
  }
  return buildPatch(editable, {
    title,
    subtitle: "",
  });
}

function buildCatalogLikeComponentComposition(editable = null, requestedTone = "neutral", assetPipelineStarter = {}) {
  const componentId = String(editable?.componentId || "").trim();
  const slotId = String(editable?.slotId || "").trim();
  const familyId = resolveFamilyId(editable, "");
  if (!componentId || !slotId || !familyId) return null;
  const title = inferSectionTitle(componentId, slotId);
  return {
    slotId,
    componentId,
    familyId,
    templateId: resolveServiceTemplateId(familyId),
    recipeId: "",
    label: `${componentId} tailwind replacement proposal`,
    scope: "component",
    summary: `${title} 영역을 Tailwind replacement block으로 정리합니다.`,
    layoutStrategy: "replacement-only / category-pdp block",
    preservedElements: ["원문 페이지 구조", "기존 CTA 역할", "상품/배너 정보 위계"],
    changedElements: ["visual hierarchy", "spacing", "CTA grouping"],
    styleContract: {
      surfaceTone: normalizeTone(requestedTone, isPdpCasePageId(componentId.split(".")[0]) ? "neutral" : "editorial"),
      density: familyId === "pdp-sticky-buybox-composition" ? "compact" : "balanced",
      hierarchyEmphasis: familyId === "pdp-sticky-buybox-composition" ? "action-first" : "headline-first",
      interactionTone: "brand-confident",
      tokenHints: {
        familyId,
        replacementMode: "tailwind-catalog-block",
      },
    },
    assetPlan: normalizeAssetPlan(assetPipelineStarter, componentId, familyId),
    primitiveTree: {
      type: familyId,
      variant: "",
      props: {
        tone: normalizeTone(requestedTone, "neutral"),
        replacementMode: "tailwind-catalog-block",
      },
      children: [],
    },
  };
}

function buildCatalogLikePatch(editable = null) {
  const componentId = String(editable?.componentId || "").trim();
  const familyId = resolveFamilyId(editable, "");
  const title = inferSectionTitle(componentId, editable?.slotId || "");
  if (familyId === "image-banner-strip-composition") {
    return buildPatch(editable, {
      title,
      subtitle: "원문 카테고리 맥락을 유지하면서 대표 배너만 더 선명하게 재구성합니다.",
      ctaLabel: "자세히 보기",
    });
  }
  if (familyId === "pdp-summary-stack-composition") {
    return buildPatch(editable, {
      title,
      subtitle: "핵심 정보와 행동 유도를 한 영역에서 읽기 쉽게 정리합니다.",
      ctaLabel: "구매하기",
    });
  }
  if (familyId === "pdp-sticky-buybox-composition") {
    return buildPatch(editable, {
      title,
      subtitle: "가격과 구매 행동을 더 짧고 명확한 sticky block으로 정리합니다.",
      ctaLabel: "구매하기",
    });
  }
  return buildPatch(editable, { title });
}

function buildHeroComponentComposition(heroEditable, heroRecipe, requestedTone, approvedPlan, assetPipelineStarter) {
  const componentId = String(heroEditable?.componentId || "home.hero").trim();
  const slotId = "hero";
  const familyId = resolveFamilyId(heroEditable, "hero-carousel-composition");
  const templateId = resolveTemplateForRecipe(heroRecipe, "hero-editorial-v1");
  const objective = String(approvedPlan?.builderBrief?.objective || "").trim() || "첫 화면 메시지 위계를 더 명확하게 재구성합니다.";
  const summary = String(toStringArray(approvedPlan?.planningDirection)[0] || "").trim() || "텍스트 스테이지와 비주얼 초점을 분리해 첫 화면 지배력을 분명히 만듭니다.";
  return {
    slotId,
    componentId,
    familyId,
    templateId,
    recipeId: String(heroRecipe?.recipeId || "").trim(),
    label: "home.hero top-stage proposal",
    scope: "component",
    summary,
    layoutStrategy: "top-stage lead hero / text-left stage / visual-right stage",
    preservedElements: [
      "LG전자 브랜드 정체성",
      "hero 기본 카피 흐름",
      "상단 진입부의 신뢰 톤",
    ],
    changedElements: [
      "headline hierarchy",
      "hero stage spacing",
      "visual dominance",
    ],
    styleContract: {
      surfaceTone: normalizeTone(heroRecipe?.tone || requestedTone, requestedTone),
      density: String(heroRecipe?.density || "balanced").trim(),
      hierarchyEmphasis: String(heroRecipe?.emphasis || "headline-first").trim(),
      interactionTone: "brand-confident",
      tokenHints: {
        recipeId: String(heroRecipe?.recipeId || "").trim(),
      },
    },
    assetPlan: normalizeAssetPlan(assetPipelineStarter, componentId, familyId),
    primitiveTree: {
      type: String(heroRecipe?.primitiveId || "SplitHero").trim(),
      variant: String(heroRecipe?.variant || "editorial").trim(),
      props: {
        tone: normalizeTone(heroRecipe?.tone || requestedTone, requestedTone),
        recipeId: String(heroRecipe?.recipeId || "").trim(),
        objective,
      },
      children: [],
    },
  };
}

function buildQuickmenuComponentComposition(quickmenuEditable, quickmenuRecipe, requestedTone, assetPipelineStarter) {
  const componentId = String(quickmenuEditable?.componentId || "home.quickmenu").trim();
  const slotId = "quickmenu";
  const familyId = resolveFamilyId(quickmenuEditable, "quickmenu-panel");
  const templateId = resolveTemplateForRecipe(quickmenuRecipe, "quickmenu-panel-v1");
  return {
    slotId,
    componentId,
    familyId,
    templateId,
    recipeId: String(quickmenuRecipe?.recipeId || "").trim(),
    label: "home.quickmenu top-stage companion proposal",
    scope: "component",
    summary: "hero 아래에서 빠른 진입 동선을 읽기 쉬운 lead/support 리듬으로 재정리합니다.",
    layoutStrategy: "top-stage companion band / primary lead entry / secondary utility cards",
    preservedElements: [
      "quick access 목적",
      "LG전자 홈 탐색 진입 역할",
    ],
    changedElements: [
      "lead/support rhythm",
      "card density",
      "scanability",
    ],
    styleContract: {
      surfaceTone: normalizeTone(quickmenuRecipe?.tone || requestedTone, "neutral"),
      density: String(quickmenuRecipe?.density || "balanced").trim(),
      hierarchyEmphasis: String(quickmenuRecipe?.emphasis || "utility-first").trim(),
      interactionTone: "confident-utility",
      tokenHints: {
        recipeId: String(quickmenuRecipe?.recipeId || "").trim(),
        clusterRole: "top-stage-companion-band",
        densityTarget: "compact-support",
        groupingMode: "lead-support",
        heroBridge: "continue-primary-journey",
        visualWeight: "supporting-band",
      },
    },
    assetPlan: normalizeAssetPlan(assetPipelineStarter, componentId, familyId),
    primitiveTree: {
      type: String(quickmenuRecipe?.primitiveId || "QuickmenuPanel").trim(),
      variant: String(quickmenuRecipe?.variant || "panel").trim(),
      props: {
        tone: normalizeTone(quickmenuRecipe?.tone || requestedTone, "neutral"),
        recipeId: String(quickmenuRecipe?.recipeId || "").trim(),
        clusterRole: "top-stage-companion-band",
        priorityTiers: ["lead", "support"],
        groupingMode: "lead-support",
        heroBridge: "continue-primary-journey",
        densityTarget: "compact-support",
      },
      children: [],
    },
  };
}

function buildLocalTopStageResult(builderInput = {}) {
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const rendererSurface = String(builderInput?.generationOptions?.rendererSurface || "custom").trim() || "custom";
  const { editableComponents, effectiveComponentIds } = resolveEffectiveEditableTargets(builderInput);
  const heroEditable = findEditableComponent(editableComponents, "hero");
  const quickmenuEditable = findEditableComponent(editableComponents, "quickmenu");

  if (
    pageId !== "home" ||
    rendererSurface !== "tailwind" ||
    !heroEditable ||
    !quickmenuEditable ||
    !effectiveComponentIds.size ||
    !effectiveComponentIds.has(String(heroEditable.componentId || "").trim()) ||
    !effectiveComponentIds.has(String(quickmenuEditable.componentId || "").trim())
  ) {
    return null;
  }

  const requestedTone = inferRequestedTone(builderInput);
  const heroRecipes = Array.isArray(recipeLibrary?.heroRecipes) ? recipeLibrary.heroRecipes : [];
  const quickmenuRecipes = Array.isArray(recipeLibrary?.quickmenuRecipes) ? recipeLibrary.quickmenuRecipes : [];
  const heroRecipe = requestedTone === "premium"
    ? pickRecipe(heroRecipes, (item) => String(item?.recipeId || "").trim() === "hero-premium-spotlight-v1", "home.hero:premium")
    : requestedTone === "service-trust"
      ? pickRecipe(heroRecipes, (item) => String(item?.recipeId || "").trim() === "hero-guided-discovery-v1", "home.hero:service-trust")
      : pickRecipe(heroRecipes, (item) => String(item?.recipeId || "").trim() === "hero-editorial-briefing-v1", `home.hero:${requestedTone || "default"}`);
  const quickmenuRecipe = requestedTone === "editorial"
    ? pickRecipe(quickmenuRecipes, (item) => String(item?.recipeId || "").trim() === "quickmenu-editorial-strip-v1", "home.quickmenu:editorial")
    : pickRecipe(quickmenuRecipes, (item) => String(item?.recipeId || "").trim() === "quickmenu-lead-panel-v1", `home.quickmenu:${requestedTone || "default"}`);
  if (!heroRecipe || !quickmenuRecipe) return null;
  const approvedPlan = builderInput?.approvedPlan || {};
  const assetPipelineStarter = builderInput?.systemContext?.designToolContext?.assetPipelineStarter || {};

  const heroComposition = buildHeroComponentComposition(heroEditable, heroRecipe, requestedTone, approvedPlan, assetPipelineStarter);
  const quickmenuComposition = buildQuickmenuComponentComposition(quickmenuEditable, quickmenuRecipe, requestedTone, assetPipelineStarter);

  const heroPatch = buildPatch(heroEditable, {
    badge: "LG전자 공식 스토어",
    ctaLabel: "자세히 보기",
    styles: {
      background: "linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%)",
      titleSize: "56",
      titleWeight: "700",
      subtitleSize: "20",
      padding: "56px 40px",
      textAlign: "left",
    },
  });

  const quickmenuPatch = buildPatch(quickmenuEditable, {
    title: "지금 많이 찾는 바로가기",
    styles: {
      background: "#f8fafc",
      padding: "18px 20px",
      radius: "24px",
    },
  });

  const operations = [
    {
      action: "replace_component_template",
      pageId: "home",
      slotId: "hero",
      componentId: heroComposition.componentId,
      familyId: heroComposition.familyId,
      templateId: heroComposition.templateId,
      summary: "hero를 tailwind top-stage lead recipe로 재구성합니다.",
      layoutStrategy: heroComposition.layoutStrategy,
      preservedElements: heroComposition.preservedElements,
      changedElements: heroComposition.changedElements,
      assetPlan: heroComposition.assetPlan,
      primitiveTree: heroComposition.primitiveTree,
    },
  ];
  if (Object.keys(heroPatch).length) {
    operations.push({
      action: "update_component_patch",
      pageId: "home",
      slotId: "hero",
      componentId: heroComposition.componentId,
      patch: heroPatch,
    });
  }
  if (Object.keys(quickmenuPatch).length) {
    operations.push({
      action: "update_component_patch",
      pageId: "home",
      slotId: "quickmenu",
      componentId: quickmenuComposition.componentId,
      patch: quickmenuPatch,
    });
  }

  return {
    compositionResult: {
      summary: "Local provider selected a deterministic top-stage tailwind recipe set.",
      composition: {
        focusSlots: ["hero", "quickmenu"],
        referenceUse: {
          mode: "local-provider",
          requestedTone,
        },
        compositionTree: [
          {
            slotId: "hero",
            componentId: heroComposition.componentId,
            familyId: heroComposition.familyId,
            label: heroComposition.label,
            layoutGoal: heroComposition.summary,
            visualDirection: "left text stage + right visual lead",
            hierarchy: "hero-led",
            primitiveTree: heroComposition.primitiveTree,
          },
          {
            slotId: "quickmenu",
            componentId: quickmenuComposition.componentId,
            familyId: quickmenuComposition.familyId,
            label: quickmenuComposition.label,
            layoutGoal: quickmenuComposition.summary,
            visualDirection: "band below hero with lead/support cards",
            hierarchy: "companion-band",
            primitiveTree: quickmenuComposition.primitiveTree,
          },
        ],
        styleContract: [
          {
            slotId: "hero",
            componentId: heroComposition.componentId,
            ...heroComposition.styleContract,
          },
          {
            slotId: "quickmenu",
            componentId: quickmenuComposition.componentId,
            ...quickmenuComposition.styleContract,
          },
        ],
        assetBindings: normalizeAssetPlan(assetPipelineStarter, "", ""),
      },
    },
    rawResult: {
      summary: "Local builder provider generated a deterministic top-stage tailwind proposal.",
      buildResult: {
        proposedVersionLabel: "home_local-top-stage-tailwind",
        changedTargets: [
          { slotId: "hero", componentId: heroComposition.componentId, changeType: "template_replace" },
          { slotId: "quickmenu", componentId: quickmenuComposition.componentId, changeType: "composition_patch" },
        ],
        operations,
        report: {
          whatChanged: [
            "home.hero를 lead stage 중심 구조로 재구성해 첫 화면 위계를 강화했습니다.",
            "home.quickmenu를 hero 아래 top-stage companion band로 재배치해 탐색 리듬을 정리했습니다.",
          ],
          whyChanged: [
            "외부 모델 대신 동일 builder 루트에서 local provider가 deterministic top-stage proposal을 생성했습니다.",
            "hero와 quickmenu를 각각 독립 프로모션 카드가 아니라 하나의 top-stage cluster로 읽히게 하려는 목적입니다.",
          ],
          assumptions: [
            "Local provider는 현재 home.hero + home.quickmenu + tailwind 범위만 정식 지원합니다.",
            "실행 경로 검증이 목적이므로 출력은 deterministic recipe set으로 고정합니다.",
          ],
          componentComposition: [heroComposition, quickmenuComposition],
          selectedRecipes: [
            {
              scope: "cluster",
              slotId: "",
              componentId: "",
              familyId: "top-stage",
              recipeId: "top-stage-vertical-stack-v1",
              templateId: "",
              primitiveId: "TopCompositionShell",
              variant: "hero-led-stack-top",
              selectionReason: "local-provider-cluster",
            },
            {
              scope: "section",
              slotId: "hero",
              componentId: heroComposition.componentId,
              familyId: heroComposition.familyId,
              recipeId: heroComposition.recipeId,
              templateId: heroComposition.templateId,
              primitiveId: heroComposition.primitiveTree.type,
              variant: heroComposition.primitiveTree.variant,
              selectionReason: "local-provider-hero",
            },
            {
              scope: "section",
              slotId: "quickmenu",
              componentId: quickmenuComposition.componentId,
              familyId: quickmenuComposition.familyId,
              recipeId: quickmenuComposition.recipeId,
              templateId: quickmenuComposition.templateId,
              primitiveId: quickmenuComposition.primitiveTree.type,
              variant: quickmenuComposition.primitiveTree.variant,
              selectionReason: "local-provider-quickmenu",
            },
          ],
          assetNeeds: [],
          assetReferences: normalizeAssetPlan(assetPipelineStarter, "", ""),
          modelConcerns: [],
          validatedConstraints: [],
          guardrailCheck: [],
        },
      },
    },
  };
}

async function runLocalBuilderProvider(builderInput = {}) {
  const topStageResult = buildLocalTopStageResult(builderInput);
  if (topStageResult) return topStageResult;
  const serviceLikeResult = buildServiceLikeLocalResult(builderInput);
  if (serviceLikeResult) return serviceLikeResult;
  const catalogLikeResult = buildCatalogLikeLocalResult(builderInput);
  if (catalogLikeResult) return catalogLikeResult;
  return null;
}

function buildServiceLikeLocalResult(builderInput = {}) {
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const rendererSurface = String(builderInput?.generationOptions?.rendererSurface || "custom").trim() || "custom";
  if (!isServiceLikePageId(pageId) || rendererSurface !== "tailwind") return null;
  const { editableComponents, effectiveTargets } = resolveEffectiveEditableTargets(builderInput);
  if (!effectiveTargets.length) return null;
  const requestedTone = inferRequestedTone(builderInput);
  const assetPipelineStarter = builderInput?.systemContext?.designToolContext?.assetPipelineStarter || {};
  const editableTargets = effectiveTargets;
  if (!editableTargets.length) return null;

  const componentComposition = editableTargets
    .map((editable) => buildServiceLikeComponentComposition(editable, requestedTone, assetPipelineStarter))
    .filter(Boolean);
  if (!componentComposition.length) return null;

  const operations = componentComposition
    .flatMap((composition) => {
      const editable = findEditableByComponentId(editableTargets, composition.componentId) || findEditableByComponentId(editableComponents, composition.componentId);
      const patch = buildServiceLikePatch(editable);
      const ops = [];
      if (composition.templateId) {
        ops.push({
          action: "replace_component_template",
          pageId,
          slotId: composition.slotId,
          componentId: composition.componentId,
          familyId: composition.familyId,
          templateId: composition.templateId,
          summary: composition.summary,
          layoutStrategy: composition.layoutStrategy,
          preservedElements: composition.preservedElements,
          changedElements: composition.changedElements,
          assetPlan: composition.assetPlan,
          primitiveTree: composition.primitiveTree,
        });
      }
      if (Object.keys(patch).length) {
        ops.push({
          action: "update_component_patch",
          pageId,
          slotId: composition.slotId,
          componentId: composition.componentId,
          patch,
        });
      }
      return ops;
    })
    .filter(Boolean);

  return {
    compositionResult: {
      summary: `Local provider selected deterministic service-like tailwind replacements for ${pageId}.`,
      composition: {
        focusSlots: componentComposition.map((item) => item.slotId),
        referenceUse: {
          mode: "local-provider",
          requestedTone,
        },
        compositionTree: componentComposition.map((item) => ({
          slotId: item.slotId,
          componentId: item.componentId,
          familyId: item.familyId,
          label: item.label,
          layoutGoal: item.summary,
          visualDirection: "family-driven replacement block",
          hierarchy: item.familyId === "hero-carousel-composition" ? "lead" : "support",
          primitiveTree: item.primitiveTree,
        })),
        styleContract: componentComposition.map((item) => ({
          slotId: item.slotId,
          componentId: item.componentId,
          ...item.styleContract,
        })),
        assetBindings: normalizeAssetPlan(assetPipelineStarter, "", ""),
      },
    },
    rawResult: {
      summary: `Local builder provider generated deterministic service-like tailwind replacements for ${pageId}.`,
      buildResult: {
        proposedVersionLabel: `${pageId}_local-tailwind-replacement`,
        changedTargets: componentComposition.map((item) => ({
          slotId: item.slotId,
          componentId: item.componentId,
          changeType: item.templateId ? "template_replace" : "composition_patch",
        })),
        operations,
        report: {
          whatChanged: componentComposition.map((item) => `${item.componentId} 영역을 tailwind replacement block으로 정리했습니다.`),
          whyChanged: [
            "service/home-style 계열도 동일 V2 루트에서 replacement-only 검증이 가능하도록 deterministic local provider 경로를 열었습니다.",
            "레거시 shell 재조립 없이 family-driven section block만 갈아끼우는 것이 목적입니다.",
          ],
          assumptions: [
            "Local provider의 service-like 지원은 replacement 경로 검증용 deterministic 출력입니다.",
            "지원된 family는 replace_component_template + patch 조합으로 tailwind renderer 경로를 강제합니다.",
          ],
          componentComposition,
          selectedRecipes: componentComposition.map((item) => ({
            scope: "section",
            slotId: item.slotId,
            componentId: item.componentId,
            familyId: item.familyId,
            recipeId: "",
            templateId: item.templateId,
            primitiveId: item.primitiveTree.type,
            variant: item.primitiveTree.variant,
            selectionReason: "local-provider-service-like",
          })),
          assetNeeds: [],
          assetReferences: normalizeAssetPlan(assetPipelineStarter, "", ""),
          modelConcerns: [],
          validatedConstraints: [],
          guardrailCheck: [],
        },
      },
    },
  };
}

function buildCatalogLikeLocalResult(builderInput = {}) {
  const pageId = String(builderInput?.pageContext?.workspacePageId || "").trim();
  const rendererSurface = String(builderInput?.generationOptions?.rendererSurface || "custom").trim() || "custom";
  if ((!isCategoryPageId(pageId) && !isPdpCasePageId(pageId)) || rendererSurface !== "tailwind") return null;
  const { editableComponents, effectiveTargets } = resolveEffectiveEditableTargets(builderInput);
  if (!effectiveTargets.length) return null;
  const requestedTone = inferRequestedTone(builderInput);
  const assetPipelineStarter = builderInput?.systemContext?.designToolContext?.assetPipelineStarter || {};
  const editableTargets = effectiveTargets;
  if (!editableTargets.length) return null;

  const componentComposition = editableTargets
    .map((editable) => buildCatalogLikeComponentComposition(editable, requestedTone, assetPipelineStarter))
    .filter(Boolean);
  if (!componentComposition.length) return null;

  const operations = componentComposition
    .flatMap((composition) => {
      const editable = findEditableByComponentId(editableTargets, composition.componentId) || findEditableByComponentId(editableComponents, composition.componentId);
      const patch = buildCatalogLikePatch(editable);
      const ops = [];
      if (composition.templateId) {
        ops.push({
          action: "replace_component_template",
          pageId,
          slotId: composition.slotId,
          componentId: composition.componentId,
          familyId: composition.familyId,
          templateId: composition.templateId,
          summary: composition.summary,
          layoutStrategy: composition.layoutStrategy,
          preservedElements: composition.preservedElements,
          changedElements: composition.changedElements,
          assetPlan: composition.assetPlan,
          primitiveTree: composition.primitiveTree,
        });
      }
      if (Object.keys(patch).length) {
        ops.push({
          action: "update_component_patch",
          pageId,
          slotId: composition.slotId,
          componentId: composition.componentId,
          patch,
        });
      }
      return ops;
    })
    .filter(Boolean);

  return {
    compositionResult: {
      summary: `Local provider selected deterministic catalog-like tailwind replacements for ${pageId}.`,
      composition: {
        focusSlots: componentComposition.map((item) => item.slotId),
        referenceUse: {
          mode: "local-provider",
          requestedTone,
        },
        compositionTree: componentComposition.map((item) => ({
          slotId: item.slotId,
          componentId: item.componentId,
          familyId: item.familyId,
          label: item.label,
          layoutGoal: item.summary,
          visualDirection: "replacement-only catalog block",
          hierarchy: item.familyId === "pdp-sticky-buybox-composition" ? "action-block" : "content-block",
          primitiveTree: item.primitiveTree,
        })),
        styleContract: componentComposition.map((item) => ({
          slotId: item.slotId,
          componentId: item.componentId,
          ...item.styleContract,
        })),
        assetBindings: normalizeAssetPlan(assetPipelineStarter, "", ""),
      },
    },
    rawResult: {
      summary: `Local builder provider generated deterministic catalog-like tailwind replacements for ${pageId}.`,
      buildResult: {
        proposedVersionLabel: `${pageId}_local-tailwind-replacement`,
        changedTargets: componentComposition.map((item) => ({
          slotId: item.slotId,
          componentId: item.componentId,
          changeType: item.templateId ? "template_replace" : "composition_patch",
        })),
        operations,
        report: {
          whatChanged: componentComposition.map((item) => `${item.componentId} 영역을 tailwind replacement block으로 정리했습니다.`),
          whyChanged: [
            "category/pdp 계열도 동일 V2 루트에서 replacement-only 검증이 가능하도록 deterministic local provider 경로를 열었습니다.",
            "banner/summary/sticky 핵심 블록만 교체해 구조와 품질을 먼저 확인하려는 목적입니다.",
          ],
          assumptions: [
            "Local provider의 category/pdp 지원은 replacement 경로 검증용 deterministic 출력입니다.",
            "현재는 banner, summary, sticky family 중심으로 먼저 replacement를 엽니다.",
            "지원된 family는 replace_component_template + patch 조합으로 tailwind renderer 경로를 강제합니다.",
          ],
          componentComposition,
          selectedRecipes: componentComposition.map((item) => ({
            scope: "section",
            slotId: item.slotId,
            componentId: item.componentId,
            familyId: item.familyId,
            recipeId: "",
            templateId: item.templateId,
            primitiveId: item.primitiveTree.type,
            variant: item.primitiveTree.variant,
            selectionReason: "local-provider-catalog-like",
          })),
          assetNeeds: [],
          assetReferences: normalizeAssetPlan(assetPipelineStarter, "", ""),
          modelConcerns: [],
          validatedConstraints: [],
          guardrailCheck: [],
        },
      },
    },
  };
}

module.exports = {
  runLocalBuilderProvider,
};
