"use strict";

const { resolveAvailableAssetFamilies } = require("./asset-family");
const { resolveAssetFallbackPolicy } = require("./asset-fallback-policy");
const { resolveAssetRegistryCardsForSection } = require("./asset-registry");
const { resolveAssetUsagePolicy } = require("./asset-role-policy");
const { resolveDesignDiversityProfiles } = require("./design-diversity");

function toStringArray(value, limit = 12) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }
  return [];
}

function uniqueList(values = [], limit = 12) {
  return Array.from(new Set(toStringArray(values, limit * 2))).slice(0, limit);
}

function normalizeViewportAuthoringMeta(viewportProfile = "pc") {
  const normalized = String(viewportProfile || "pc").trim().toLowerCase() || "pc";
  if (normalized === "mo" || normalized === "mobile") {
    return {
      viewportProfile: "mo",
      viewportMode: "mobile",
      viewportLabel: "Mobile",
      assetVariantPolicy: "use-mo-variants-only",
      viewportGuidance: [
        "Author for mobile. Do not promote PC layout or PC-only asset approval as final output.",
        "Prioritize one-column flow, touch targets, vertical rhythm, and mobile safe areas.",
        "Use mo asset variants for final choices when registry variants are available.",
      ],
    };
  }
  if (normalized === "ta" || normalized === "tablet") {
    return {
      viewportProfile: "ta",
      viewportMode: "tablet",
      viewportLabel: "Tablet",
      assetVariantPolicy: "use-tablet-variants-or-pc-fallback",
      viewportGuidance: [
        "Author for tablet. Adapt PC hierarchy to narrower viewport behavior.",
        "Use tablet variants first; use approved pc fallback only when tablet variants are absent.",
      ],
    };
  }
  return {
    viewportProfile: "pc",
    viewportMode: "desktop",
    viewportLabel: "PC",
    assetVariantPolicy: "use-pc-variants-only",
    viewportGuidance: [
      "Author for PC. Do not use mobile-only layout or mobile-only asset approval as final output.",
      "Use wide viewport hierarchy, multi-column opportunities, and large hero safe areas.",
      "Use pc asset variants for final choices when registry variants are available.",
    ],
  };
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value = "", maxLength = 1200) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!Number.isFinite(maxLength) || maxLength <= 0) return text;
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function compactHtmlForModel(html = "", maxLength = 3500) {
  return truncateText(
    String(html || "")
      .replace(/\s+/g, " ")
      .trim(),
    maxLength
  );
}

function buildTextOutlineFromHtml(html = "", limit = 24) {
  return uniqueList(
    Array.from(
      String(html || "").matchAll(/<(h1|h2|h3|p|span|a|button|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)
    )
      .map((match) => stripHtml(match?.[2] || ""))
      .filter((text) => text && text.length <= 140),
    limit
  );
}

function normalizeCurrentSectionHtmlMap(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([slotId, html]) => [String(slotId || "").trim(), String(html || "").trim()])
      .filter(([slotId, html]) => slotId && html)
  );
}

function buildCurrentSectionTextMap(currentSectionHtmlMap = {}) {
  return Object.fromEntries(
    Object.entries(normalizeCurrentSectionHtmlMap(currentSectionHtmlMap)).map(([slotId, html]) => [
      slotId,
      buildTextOutlineFromHtml(html, 12),
    ])
  );
}

function decodeAssetSource(assetUrl = "") {
  const value = String(assetUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value, "http://localhost");
    const embedded = String(parsed.searchParams.get("url") || "").trim();
    if (embedded) return decodeURIComponent(embedded);
  } catch {}
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function classifyAssetRole(assetSlotId = "", assetUrl = "", altText = "") {
  const slotId = String(assetSlotId || "").trim().toLowerCase();
  const decoded = decodeAssetSource(assetUrl).toLowerCase();
  const normalizedAltText = String(altText || "").trim().toLowerCase();
  const iconKeywords = ["icon", "glyph", "symbol", "line", ".svg"];
  const promoKeywords = [
    "혜택", "이벤트", "할인", "라이브", "카드혜택", "구독", "sale", "days",
    "event", "coupon", "promotion", "banner", "hero", "타이틀", "타이포"
  ].map((item) => String(item).toLowerCase());
  const objectKeywords = [
    "소파", "가전", "공기청정기", "거실", "공간", "배치", "제품", "오브젝트", "배경"
  ].map((item) => String(item).toLowerCase());
  const badgeKeywords = ["홈스타일", "기획전", "가전 구독", "브랜드", "label", "badge"].map((item) =>
    String(item).toLowerCase()
  );
  const hasIconKeyword = iconKeywords.some((keyword) => decoded.includes(keyword));
  const hasPromoKeyword =
    promoKeywords.some((keyword) => decoded.includes(keyword)) ||
    promoKeywords.some((keyword) => normalizedAltText.includes(keyword));
  const hasObjectKeyword =
    objectKeywords.some((keyword) => decoded.includes(keyword)) ||
    objectKeywords.some((keyword) => normalizedAltText.includes(keyword));
  const hasBadgeKeyword =
    badgeKeywords.some((keyword) => decoded.includes(keyword)) ||
    badgeKeywords.some((keyword) => normalizedAltText.includes(keyword));
  const shortAltLabel =
    normalizedAltText &&
    normalizedAltText.length <= 12 &&
    !/\s{2,}/.test(normalizedAltText) &&
    !hasObjectKeyword &&
    !hasPromoKeyword;

  if (hasIconKeyword) {
    return {
      role: "icon-only",
      restricted: false,
      rationale: "아이콘 계열 자산으로 추정됨",
    };
  }
  if (slotId.startsWith("quickmenu-")) {
    if (hasPromoKeyword || decoded.endsWith(".gif") || decoded.endsWith(".png")) {
      return {
        role: "promo-complete",
        restricted: true,
        rationale: "quickmenu에서 프로모션 완성 자산으로 추정됨",
      };
    }
  }
  if (slotId.startsWith("hero-")) {
    if (hasPromoKeyword) {
      return {
        role: "promo-complete",
        restricted: true,
        rationale: "hero에서 텍스트 포함 프로모션 자산으로 추정됨",
      };
    }
    if (hasBadgeKeyword || shortAltLabel) {
      return {
        role: "object-only",
        restricted: false,
        rationale: "hero에서 라벨/오브젝트성 자산으로 추정됨",
      };
    }
    return {
      role: hasObjectKeyword ? "background-only" : "object-only",
      restricted: false,
      rationale: hasObjectKeyword ? "hero 배경 후보" : "hero 오브젝트 후보",
    };
  }
  return {
    role: hasPromoKeyword ? "promo-complete" : "reference-only",
    restricted: hasPromoKeyword,
    rationale: hasPromoKeyword ? "프로모션 완성 자산으로 추정됨" : "참고용 자산",
  };
}

function buildCurrentSectionAssetMap(currentPageAssetMap = {}, slotIds = []) {
  const source = currentPageAssetMap && typeof currentPageAssetMap === "object" ? currentPageAssetMap : {};
  const normalizedSlotIds = Array.isArray(slotIds) ? slotIds.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const result = {};
  normalizedSlotIds.forEach((slotId) => {
    const items = Object.entries(source)
      .filter(([assetSlotId]) => String(assetSlotId || "").startsWith(`${slotId}-`))
      .map(([assetSlotId, assetUrl]) => ({
        assetSlotId: String(assetSlotId || "").trim(),
        source: String(assetUrl || "").trim(),
        assetRole: classifyAssetRole(assetSlotId, assetUrl),
      }))
      .filter((item) => item.assetSlotId && item.source)
      .slice(0, 12);
    if (items.length) {
      result[slotId] = items;
    }
  });
  return result;
}

function normalizeCurrentSectionAssetMap(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([slotId, items]) => {
        const normalizedSlotId = String(slotId || "").trim();
        const normalizedItems = Array.isArray(items)
          ? items
              .map((item) => {
                const assetSlotId = String(item?.assetSlotId || "").trim();
                const source = String(item?.source || item?.sourceUrl || item?.assetUrl || "").trim();
                if (!assetSlotId || !source) return null;
                return {
                  assetSlotId,
                  source,
                  altText: String(item?.altText || "").trim(),
                  assetRole:
                    item?.assetRole && typeof item.assetRole === "object"
                      ? { ...item.assetRole }
                      : classifyAssetRole(assetSlotId, source, item?.altText || ""),
                };
              })
              .filter(Boolean)
              .slice(0, 12)
          : [];
        return [normalizedSlotId, normalizedItems];
      })
      .filter(([slotId, items]) => slotId && items.length)
  );
}

function buildSectionAssetFamilies(pageId = "", slotId = "") {
  return resolveAvailableAssetFamilies(pageId, slotId)
    .map((item) => ({
      assetFamilyId: String(item.assetFamilyId || "").trim(),
      familyId: String(item.familyId || "").trim(),
      role: String(item.role || "").trim(),
      status: String(item.status || "").trim(),
      memberCount: Number(item.memberCount || 0),
      memberLabels: toStringArray(item.memberLabels, 16),
      styleSummary: truncateText(item.styleSummary || "", 220),
      styleSpec: item.styleSpec && typeof item.styleSpec === "object" ? { ...item.styleSpec } : {},
      generationMode: String(item.generationMode || "").trim(),
      restrictedUse: toStringArray(item.restrictedUse, 12),
      generatedFamilyPackage:
        item.generatedFamilyPackage && typeof item.generatedFamilyPackage === "object"
          ? {
              assetFamilyId: String(item.generatedFamilyPackage.assetFamilyId || "").trim(),
              familyId: String(item.generatedFamilyPackage.familyId || "").trim(),
              status: String(item.generatedFamilyPackage.status || "").trim(),
              generatedAt: String(item.generatedFamilyPackage.generatedAt || "").trim(),
              styleSummary: truncateText(item.generatedFamilyPackage.styleSummary || "", 220),
              styleSpec:
                item.generatedFamilyPackage.styleSpec && typeof item.generatedFamilyPackage.styleSpec === "object"
                  ? { ...item.generatedFamilyPackage.styleSpec }
                  : {},
              members: Array.isArray(item.generatedFamilyPackage.members)
                ? item.generatedFamilyPackage.members.slice(0, 24)
                : [],
            }
          : null,
    }))
    .filter((item) => item.assetFamilyId && item.familyId);
}

function filterReusableAssetsForSlot(slotId = "", items = []) {
  const normalizedSlotId = String(slotId || "").trim().toLowerCase();
  const source = Array.isArray(items) ? items : [];
  if (normalizedSlotId === "quickmenu") {
    return source.filter((item) => String(item?.assetRole?.role || "").trim() === "icon-only");
  }
  if (normalizedSlotId === "hero") {
    return source.filter((item) => !Boolean(item?.assetRole?.restricted));
  }
  return source;
}

function inferAuthoringMode(source = {}) {
  const explicit = String(source.authoringMode || "").trim();
  if (explicit) return explicit;
  const targetScope = String(source.targetScope || source.scopeUnit || "").trim().toLowerCase();
  const patchDepth = String(source.patchDepth || "").trim().toLowerCase();
  if (patchDepth === "element") return "element";
  if (patchDepth === "copy" || patchDepth === "copy-only") return "copy-only";
  if (targetScope === "page" || patchDepth === "full") return "full";
  if (patchDepth === "layout-only") return "layout-only";
  return "layout-only";
}

function buildConceptPackageFromRequirementPlan(requirementPlan = {}, options = {}) {
  const plan = requirementPlan && typeof requirementPlan === "object" ? requirementPlan : {};
  const source = options && typeof options === "object" ? options : {};
  const planningPackage = plan.planningPackage && typeof plan.planningPackage === "object" ? plan.planningPackage : {};
  const planningViewport = planningPackage.viewport && typeof planningPackage.viewport === "object" ? planningPackage.viewport : {};
  const viewportMeta = normalizeViewportAuthoringMeta(
    source.viewportProfile ||
    plan.viewportProfile ||
    planningViewport.viewportProfile ||
    plan.builderBrief?.viewportProfile ||
    "pc"
  );
  const pageIdentity = planningPackage.pageIdentity && typeof planningPackage.pageIdentity === "object"
    ? planningPackage.pageIdentity
    : (source.pageIdentity && typeof source.pageIdentity === "object" ? source.pageIdentity : {});
  const designPolicy = planningPackage.designPolicy && typeof planningPackage.designPolicy === "object"
    ? planningPackage.designPolicy
    : {};
  const selectedConcept = plan.selectedConcept && typeof plan.selectedConcept === "object" ? plan.selectedConcept : {};
  const conceptOptions = Array.isArray(plan.conceptPlans) ? plan.conceptPlans.slice(0, 6) : [];
  const journeyFlow = plan.journeyFlow && typeof plan.journeyFlow === "object"
    ? JSON.parse(JSON.stringify(plan.journeyFlow))
    : null;
  const targetComponents = Array.isArray(plan.targetComponents) ? plan.targetComponents.slice(0, 24) : [];
  const slotIds = Array.isArray(plan.sectionBlueprints)
    ? plan.sectionBlueprints.map((item) => String(item?.slotId || "").trim()).filter(Boolean)
    : [];
  const targetGroupId = String(plan.targetGroupId || source.targetGroupId || "group").trim() || "group";
  const targetGroupLabel = String(plan.targetGroupLabel || source.targetGroupLabel || "Target Group").trim() || "Target Group";
  const authoringMode = inferAuthoringMode({
    authoringMode: source.authoringMode || plan.authoringMode,
    targetScope: source.targetScope || plan.targetScope || source.scopeUnit,
    patchDepth: source.patchDepth || plan.patchDepth,
  });
  return {
    viewport: {
      viewportProfile: viewportMeta.viewportProfile,
      viewportMode: viewportMeta.viewportMode,
      viewportLabel: viewportMeta.viewportLabel,
      assetVariantPolicy: source.assetVariantPolicy || plan.assetVariantPolicy || planningViewport.assetVariantPolicy || viewportMeta.assetVariantPolicy,
      viewportGuidance: uniqueList([
        ...(Array.isArray(source.viewportGuidance) ? source.viewportGuidance : []),
        ...(Array.isArray(plan.viewportGuidance) ? plan.viewportGuidance : []),
        ...(Array.isArray(planningViewport.viewportGuidance) ? planningViewport.viewportGuidance : []),
        ...viewportMeta.viewportGuidance,
      ], 8),
    },
    pageIdentity: {
      character: String(pageIdentity.character || "").trim(),
      visualLanguage: String(pageIdentity.visualLanguage || "").trim(),
      userGoal: String(pageIdentity.userGoal || "").trim(),
      sectionFlow: String(pageIdentity.sectionFlow || "").trim(),
    },
    designPolicy: {
      problemStatement: toStringArray(designPolicy.problemStatement),
      hierarchyGoals: toStringArray(designPolicy.hierarchyGoals),
      mustKeep: toStringArray(designPolicy.mustKeep),
      mustChange: toStringArray(designPolicy.mustChange),
      guardrails: toStringArray(designPolicy.guardrails, 16),
      exclusions: Array.isArray(designPolicy.exclusions) ? designPolicy.exclusions.slice(0, 12) : [],
      layoutDirections: toStringArray(designPolicy.layoutDirections),
    },
    conceptOptions,
    selectedConceptId: String(selectedConcept.conceptId || conceptOptions[0]?.conceptId || "").trim(),
    selectedConcept,
    executionBrief: {
      title: String(plan.title || "").trim(),
      viewportProfile: viewportMeta.viewportProfile,
      viewportMode: viewportMeta.viewportMode,
      viewportLabel: viewportMeta.viewportLabel,
      assetVariantPolicy: source.assetVariantPolicy || plan.assetVariantPolicy || planningViewport.assetVariantPolicy || viewportMeta.assetVariantPolicy,
      viewportGuidance: uniqueList([
        ...(Array.isArray(source.viewportGuidance) ? source.viewportGuidance : []),
        ...(Array.isArray(plan.viewportGuidance) ? plan.viewportGuidance : []),
        ...(Array.isArray(planningViewport.viewportGuidance) ? planningViewport.viewportGuidance : []),
        ...viewportMeta.viewportGuidance,
      ], 8),
      summary: toStringArray(plan.requestSummary, 8),
      authoringMode,
      requestedChangeLevel: String(plan.designChangeLevel || source.designChangeLevel || "medium").trim() || "medium",
      targetGroup: {
        groupId: targetGroupId,
        groupLabel: targetGroupLabel,
        componentIds: targetComponents,
        slotIds,
        boundaryIntent: targetGroupId === "page"
          ? "현재 페이지의 메인 콘텐츠 범위 안에서 전체 authored sections로 재구성한다."
          : "선택된 target group 범위 안에서만 authored sections를 교체한다.",
      },
      sectionBlueprints: Array.isArray(plan.sectionBlueprints) ? plan.sectionBlueprints.slice(0, 24) : [],
      userFixedContent: toStringArray(source.userFixedContent || plan.userFixedContent, 12),
      userDirectEdits: Array.isArray(source.userDirectEdits || plan.userDirectEdits)
        ? (source.userDirectEdits || plan.userDirectEdits).slice(0, 24)
        : [],
      journeyFlow,
      authoringConstraints: uniqueList([
        `Asset variant policy: ${source.assetVariantPolicy || plan.assetVariantPolicy || planningViewport.assetVariantPolicy || viewportMeta.assetVariantPolicy}`,
        ...viewportMeta.viewportGuidance,
        ...toStringArray(plan.guardrails, 12),
        ...toStringArray(source.authoringConstraints, 12),
      ], 16),
    },
    advisory: uniqueList([
      ...toStringArray(plan.referenceNotes, 8),
      ...toStringArray(source.advisory, 8),
    ], 16),
  };
}

function buildDesignAuthorInput(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const conceptPackage = source.conceptPackage && typeof source.conceptPackage === "object" ? source.conceptPackage : {};
  const referenceContext = source.referenceContext && typeof source.referenceContext === "object" ? source.referenceContext : {};
  const currentSectionHtmlMap = normalizeCurrentSectionHtmlMap(
    source.currentSectionContext?.currentSectionHtmlMap || referenceContext.currentSectionHtmlMap
  );
  const targetGroup = conceptPackage.executionBrief?.targetGroup && typeof conceptPackage.executionBrief.targetGroup === "object"
    ? conceptPackage.executionBrief.targetGroup
    : (source.authoringRequest?.targetGroup && typeof source.authoringRequest.targetGroup === "object"
      ? source.authoringRequest.targetGroup
      : {});
  const viewportMeta = normalizeViewportAuthoringMeta(
    source.viewportProfile ||
    conceptPackage.viewport?.viewportProfile ||
    conceptPackage.executionBrief?.viewportProfile ||
    "pc"
  );
  const assetVariantPolicy = String(
    source.assetVariantPolicy ||
    conceptPackage.viewport?.assetVariantPolicy ||
    conceptPackage.executionBrief?.assetVariantPolicy ||
    viewportMeta.assetVariantPolicy
  ).trim() || viewportMeta.assetVariantPolicy;
  const viewportGuidance = uniqueList([
    ...(Array.isArray(source.viewportGuidance) ? source.viewportGuidance : []),
    ...(Array.isArray(conceptPackage.viewport?.viewportGuidance) ? conceptPackage.viewport.viewportGuidance : []),
    ...(Array.isArray(conceptPackage.executionBrief?.viewportGuidance) ? conceptPackage.executionBrief.viewportGuidance : []),
    ...viewportMeta.viewportGuidance,
  ], 8);
  const slotIds = Array.isArray(targetGroup.slotIds) ? targetGroup.slotIds.slice(0, 24) : [];
  const currentPageAssetMap =
    referenceContext.currentPageAssetMap && typeof referenceContext.currentPageAssetMap === "object"
      ? referenceContext.currentPageAssetMap
      : {};
  const selectedConcept = conceptPackage.selectedConcept && typeof conceptPackage.selectedConcept === "object"
    ? conceptPackage.selectedConcept
    : {};
  const sectionBlueprints = Array.isArray(conceptPackage.executionBrief?.sectionBlueprints)
    ? conceptPackage.executionBrief.sectionBlueprints
    : [];
  const journeyFlow = conceptPackage.executionBrief?.journeyFlow && typeof conceptPackage.executionBrief.journeyFlow === "object"
    ? JSON.parse(JSON.stringify(conceptPackage.executionBrief.journeyFlow))
    : null;
  const currentJourneyStep = Array.isArray(journeyFlow?.pages)
    ? journeyFlow.pages.find((item) => String(item?.pageId || "").trim() === String(source.pageId || "").trim()) || null
    : null;
  const currentSectionTextMap =
    source.currentSectionContext?.currentSectionTextMap && typeof source.currentSectionContext.currentSectionTextMap === "object"
      ? source.currentSectionContext.currentSectionTextMap
      : buildCurrentSectionTextMap(currentSectionHtmlMap);
  const currentSectionAssetMap =
    source.currentSectionContext?.currentSectionAssetMap && typeof source.currentSectionContext.currentSectionAssetMap === "object"
      ? normalizeCurrentSectionAssetMap(source.currentSectionContext.currentSectionAssetMap)
      : buildCurrentSectionAssetMap(currentPageAssetMap, slotIds);
  const sectionPackets = slotIds.map((slotId, index) => {
    const blueprint = sectionBlueprints.find((item) => String(item?.slotId || "").trim() === String(slotId || "").trim()) || {};
    const currentHtml = String(currentSectionHtmlMap[slotId] || "").trim();
    const availableAssetFamilies = buildSectionAssetFamilies(source.pageId, slotId);
    const assetUsagePolicy = resolveAssetUsagePolicy(source.pageId, slotId);
    const componentId = String(targetGroup.componentIds?.[index] || "").trim();
    const assetRegistry = resolveAssetRegistryCardsForSection({
      pageId: source.pageId,
      slotId,
      componentId,
      viewportProfile: viewportMeta.viewportProfile,
    });
    const assetFallbackPolicy = resolveAssetFallbackPolicy({
      pageId: source.pageId,
      slotId,
      componentId,
      viewportProfile: viewportMeta.viewportProfile,
      assetUsagePolicy,
      assetRegistry,
    });
    const designDiversityProfiles = resolveDesignDiversityProfiles({
      pageId: source.pageId,
      slotId,
      componentId,
      viewportProfile: viewportMeta.viewportProfile,
    });
    const currentAssets = Array.isArray(currentSectionAssetMap[slotId])
      ? currentSectionAssetMap[slotId].slice(0, 8)
      : [];
    const reusableAssets = filterReusableAssetsForSlot(
      slotId,
      currentAssets
    );
    return {
      slotId: String(slotId || "").trim(),
      componentId,
      label: String(blueprint.label || slotId || "").trim(),
      objective: truncateText(blueprint.objective || blueprint.role || "", 220),
      visualDirection: truncateText(blueprint.visualDirection || blueprint.visual || blueprint.direction || "", 320),
      hierarchy: truncateText(blueprint.hierarchy || "", 220),
      mustKeep: uniqueList([blueprint.mustKeep || blueprint.keep], 6),
      mustChange: uniqueList([blueprint.mustChange || blueprint.change], 6),
      currentSectionHtml: compactHtmlForModel(currentHtml, 2800),
      currentTextOutline: Array.isArray(currentSectionTextMap[slotId]) ? currentSectionTextMap[slotId].slice(0, 8) : [],
      currentAssets,
      reusableAssets,
      availableAssetFamilies,
      assetUsagePolicy,
      assetFallbackPolicy,
      assetRegistry,
      designDiversityProfiles,
      changeProfile: (() => {
        const level = String(
          source.authoringRequest?.requestedChangeLevel ||
          conceptPackage.executionBrief?.requestedChangeLevel ||
          "medium"
        ).trim() || "medium";
        if (level === "low") {
          return { profileId: "conservative" };
        }
        if (level === "high") {
          return { profileId: "bold" };
        }
        return { profileId: "stable" };
      })(),
    };
  }).filter((item) => item.slotId);
  const designAuthorPacket = {
    page: {
      pageId: String(source.pageId || targetGroup.pageId || "").trim(),
      viewportProfile: viewportMeta.viewportProfile,
      viewportMode: viewportMeta.viewportMode,
      viewportLabel: viewportMeta.viewportLabel,
      character: truncateText(conceptPackage.pageIdentity?.character || "", 180),
      visualLanguage: truncateText(conceptPackage.pageIdentity?.visualLanguage || "", 280),
      userGoal: truncateText(conceptPackage.pageIdentity?.userGoal || "", 220),
    },
    concept: {
      conceptId: String(selectedConcept.conceptId || conceptPackage.selectedConceptId || "").trim(),
      conceptLabel: truncateText(selectedConcept.conceptLabel || "", 120),
      layoutSystem: truncateText(selectedConcept.layoutSystem || "", 180),
      typography: truncateText(selectedConcept.typography?.headline || "", 120),
      colorSystem: truncateText(selectedConcept.colorSystem?.baseSurface || "", 120),
      promotionTonePolicy: truncateText(selectedConcept.promotionTonePolicy || "", 180),
    },
    execution: {
      authoringMode: String(
        source.authoringRequest?.authoringMode ||
        conceptPackage.executionBrief?.authoringMode ||
        "layout-only"
      ).trim() || "layout-only",
      requestedChangeLevel: String(
        source.authoringRequest?.requestedChangeLevel ||
        conceptPackage.executionBrief?.requestedChangeLevel ||
        "medium"
      ).trim() || "medium",
      assetVariantPolicy,
      viewportGuidance,
      changeProfile: (() => {
        const level = String(
          source.authoringRequest?.requestedChangeLevel ||
          conceptPackage.executionBrief?.requestedChangeLevel ||
          "medium"
        ).trim() || "medium";
        if (level === "low") {
          return {
            profileId: "conservative",
            summary: "기존 구조와 시각 언어를 최대한 유지하며, 읽기 흐름과 정렬만 보수적으로 개선한다.",
            layoutFreedom: "low",
            contrastFreedom: "low",
            densityFreedom: "low",
            assetFreedom: "low",
          };
        }
        if (level === "high") {
          return {
            profileId: "bold",
            summary: "타겟 섹션 안에서는 위계, 레이아웃, 색 대비, 시각 리듬을 과감하게 재설계할 수 있다.",
            layoutFreedom: "high",
            contrastFreedom: "high",
            densityFreedom: "medium",
            assetFreedom: "medium",
          };
        }
        return {
          profileId: "stable",
          summary: "현재 구조와 브랜드 맥락을 유지하되, 섹션 내부 위계와 배열을 안정적으로 재설계한다.",
          layoutFreedom: "medium",
          contrastFreedom: "medium",
          densityFreedom: "medium",
          assetFreedom: "medium",
        };
      })(),
      targetGroup: {
        groupId: String(targetGroup.groupId || "").trim(),
        groupLabel: String(targetGroup.groupLabel || "").trim(),
        boundaryIntent: truncateText(targetGroup.boundaryIntent || "", 220),
      },
      guardrails: uniqueList([
        `현재 viewportProfile=${viewportMeta.viewportProfile}, mode=${viewportMeta.viewportMode} 기준으로 작성한다.`,
        `자산 variant 정책은 ${assetVariantPolicy} 이다.`,
        ...viewportGuidance,
        ...(Array.isArray(conceptPackage.designPolicy?.guardrails) ? conceptPackage.designPolicy.guardrails : []),
        ...(Array.isArray(conceptPackage.executionBrief?.authoringConstraints) ? conceptPackage.executionBrief.authoringConstraints : []),
        currentJourneyStep?.nextPageId
          ? `고객여정 CTA를 노출한다: "${currentJourneyStep.ctaLabel || "다음 단계 보기"}" 버튼/링크가 다음 단계 ${currentJourneyStep.nextPageId}로 이어지는 행동으로 보이게 작성한다.`
          : "",
        "참고 자산은 분위기 참고용이며 구조를 고정하는 정답이 아니다.",
        "promo-complete 자산 위에 새로운 headline, support copy, CTA를 다시 얹지 않는다.",
        "quickmenu는 icon-only 자산만 직접 아이콘으로 사용한다.",
      ], 8),
      mustKeep: uniqueList(conceptPackage.designPolicy?.mustKeep, 8),
      mustChange: uniqueList(conceptPackage.designPolicy?.mustChange, 8),
      userFixedContent: toStringArray(
        source.authoringRequest?.userFixedContent || conceptPackage.executionBrief?.userFixedContent,
        8
      ),
      userDirectEdits: Array.isArray(
        source.authoringRequest?.userDirectEdits || conceptPackage.executionBrief?.userDirectEdits
      )
        ? (source.authoringRequest?.userDirectEdits || conceptPackage.executionBrief?.userDirectEdits).slice(0, 12)
        : [],
      journeyFlow,
    },
    sections: sectionPackets,
    reference: {
      beforeAfterReference: source.referenceContext?.beforeAfterReference || null,
      currentPageTextOutline: Array.isArray(referenceContext.currentPageTextOutline)
        ? referenceContext.currentPageTextOutline.slice(0, 16)
        : buildTextOutlineFromHtml(referenceContext.currentPageHtmlExcerpt || referenceContext.rawShellHtml || "", 16),
    },
  };
  const packetStats = {
    sectionCount: sectionPackets.length,
    htmlChars: sectionPackets.reduce((sum, item) => sum + String(item.currentSectionHtml || "").length, 0),
    currentPageOutlineCount: Array.isArray(designAuthorPacket.reference.currentPageTextOutline)
      ? designAuthorPacket.reference.currentPageTextOutline.length
      : 0,
  };
  return {
    conceptPackage,
    designAuthorPacket,
    packetStats,
    referenceContext: {
      currentPageScreenshot: source.referenceContext?.currentPageScreenshot || null,
      currentPageHtmlExcerpt: String(referenceContext.currentPageHtmlExcerpt || referenceContext.rawShellHtml || "").trim(),
      currentPageTextOutline: Array.isArray(referenceContext.currentPageTextOutline)
        ? referenceContext.currentPageTextOutline.slice(0, 48)
        : buildTextOutlineFromHtml(referenceContext.currentPageHtmlExcerpt || referenceContext.rawShellHtml || "", 48),
      brandReferenceAssets: Array.isArray(referenceContext.brandReferenceAssets)
        ? referenceContext.brandReferenceAssets.slice(0, 24)
        : Object.entries(currentPageAssetMap).slice(0, 24).map(([assetSlotId, sourceUrl]) => ({
            assetSlotId,
            source: sourceUrl,
            assetRole: classifyAssetRole(assetSlotId, sourceUrl),
          })),
      beforeAfterReference: source.referenceContext?.beforeAfterReference || null,
    },
    currentSectionContext: {
      currentSectionHtmlMap,
      currentSectionTextMap,
      currentSectionAssetMap,
    },
    authoringRequest: {
      authoringMode: String(
        source.authoringRequest?.authoringMode ||
        conceptPackage.executionBrief?.authoringMode ||
        "layout-only"
      ).trim() || "layout-only",
      targetGroup,
      requestedChangeLevel: String(
        source.authoringRequest?.requestedChangeLevel ||
        conceptPackage.executionBrief?.requestedChangeLevel ||
        "medium"
      ).trim() || "medium",
      userFixedContent: toStringArray(
        source.authoringRequest?.userFixedContent || conceptPackage.executionBrief?.userFixedContent,
        16
      ),
      userDirectEdits: Array.isArray(
        source.authoringRequest?.userDirectEdits || conceptPackage.executionBrief?.userDirectEdits
      )
        ? (source.authoringRequest?.userDirectEdits || conceptPackage.executionBrief?.userDirectEdits).slice(0, 24)
        : [],
    },
    advisory: uniqueList([
      ...toStringArray(source.advisory, 12),
      ...toStringArray(conceptPackage.advisory, 12),
    ], 16),
  };
}

function buildDesignAuthorInputSnapshot(authorInput = {}) {
  const source = authorInput && typeof authorInput === "object" ? authorInput : {};
  return {
    targetGroup: source.authoringRequest?.targetGroup && typeof source.authoringRequest.targetGroup === "object"
      ? { ...source.authoringRequest.targetGroup }
      : {},
    currentSectionContext: source.currentSectionContext && typeof source.currentSectionContext === "object"
      ? {
          currentSectionHtmlMap: normalizeCurrentSectionHtmlMap(source.currentSectionContext.currentSectionHtmlMap),
          currentSectionTextMap: source.currentSectionContext.currentSectionTextMap && typeof source.currentSectionContext.currentSectionTextMap === "object"
            ? { ...source.currentSectionContext.currentSectionTextMap }
            : {},
          currentSectionAssetMap: source.currentSectionContext.currentSectionAssetMap && typeof source.currentSectionContext.currentSectionAssetMap === "object"
            ? normalizeCurrentSectionAssetMap(source.currentSectionContext.currentSectionAssetMap)
            : {},
        }
      : {},
    userDirectEdits: Array.isArray(source.authoringRequest?.userDirectEdits) ? source.authoringRequest.userDirectEdits.slice(0, 24) : [],
    designAuthorPacket: source.designAuthorPacket && typeof source.designAuthorPacket === "object"
      ? JSON.parse(JSON.stringify(source.designAuthorPacket))
      : null,
    packetStats: source.packetStats && typeof source.packetStats === "object"
      ? { ...source.packetStats }
      : null,
  };
}

module.exports = {
  buildConceptPackageFromRequirementPlan,
  buildDesignAuthorInput,
  buildDesignAuthorInputSnapshot,
};
