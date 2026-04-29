"use strict";

const {
  normalizeBuildRequest,
  validateBuildRequest,
  toStringArray,
} = require("./contracts");
const { buildConceptPlans, buildExecutionBrief } = require("./policy");
const { buildCloneRenderModel } = require("./clone-model");
const { buildCanonicalCloneRequest } = require("./clone-renderer");

function compactText(values = [], fallback = "") {
  const list = toStringArray(values);
  return list[0] || fallback;
}

function uniqueList(values = []) {
  return Array.from(new Set(toStringArray(values)));
}

function looksInternalAuthoringText(value = "") {
  const text = String(value || "").trim();
  if (!text) return false;
  return [
    /운영 카피 확인용/,
    /재구성한다/,
    /정리합니다/,
    /보존하면서/,
    /현재 원본 구조/,
    /명확한 디자인 시안/,
    /섹션을 현재/,
    /자산 없이/,
    /fallback/i,
    /coverage validation/i,
    /concept/i,
    /layout system/i,
    /target group/i,
    /visual direction/i,
    /must keep/i,
    /must change/i,
  ].some((pattern) => pattern.test(text));
}

function operationalText(value = "", fallback = "") {
  const text = String(value || "").trim();
  if (!text || looksInternalAuthoringText(text)) return String(fallback || "").trim();
  return text;
}

function operationalList(values = [], limit = 4) {
  return uniqueList(values)
    .map((item) => operationalText(item, ""))
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeConceptForOutput(concept = null) {
  if (!concept || typeof concept !== "object") return null;
  return {
    ...concept,
    conceptLabel: operationalText(concept.conceptLabel, ""),
    narrative: operationalList(concept.narrative, 4),
    layoutSystem: operationalText(concept.layoutSystem, "clean-core"),
  };
}

function sanitizeExecutionBriefForOutput(executionBrief = null) {
  if (!executionBrief || typeof executionBrief !== "object") return null;
  return {
    ...executionBrief,
    selectedConcept: sanitizeConceptForOutput(executionBrief.selectedConcept),
    northStar: operationalList(executionBrief.northStar, 6),
    guardrails: operationalList(executionBrief.guardrails, 6),
  };
}

function sanitizeSectionBlueprintForOutput(blueprint = {}, slotId = "", componentId = "") {
  const label = operationalText(blueprint?.label, humanizeSlotLabel(slotId, componentId));
  return {
    slotId: String(blueprint?.slotId || slotId || "").trim(),
    label,
  };
}

function humanizeSlotLabel(slotId = "", componentId = "") {
  const normalizedSlotId = String(slotId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const slotLabelMap = {
    hero: "히어로",
    quickmenu: "퀵메뉴",
    mainService: "주요 서비스",
    bestcare: "안심 케어",
    summary: "요약",
    sticky: "구매 박스",
  };
  return slotLabelMap[normalizedSlotId] || normalizedSlotId || normalizedComponentId.split(".").pop() || "섹션";
}

function resolveSelectedConcept(request = {}, input = {}, options = {}) {
  const conceptPlans = buildConceptPlans(request);
  const explicitSelectedConcept = input?.selectedConcept && typeof input.selectedConcept === "object"
    ? input.selectedConcept
    : null;
  if (explicitSelectedConcept) {
    return {
      conceptPlans,
      selectedConcept: {
        conceptId: String(explicitSelectedConcept.conceptId || conceptPlans[0]?.conceptId || "concept-1").trim(),
        conceptLabel: String(explicitSelectedConcept.conceptLabel || conceptPlans[0]?.conceptLabel || "Concept").trim(),
        narrative: Array.isArray(explicitSelectedConcept.narrative) ? explicitSelectedConcept.narrative.slice(0, 4) : [],
        layoutSystem: String(explicitSelectedConcept.layoutSystem || conceptPlans[0]?.layoutSystem || "").trim(),
        typography: explicitSelectedConcept.typography && typeof explicitSelectedConcept.typography === "object"
          ? { ...explicitSelectedConcept.typography }
          : { ...(conceptPlans[0]?.typography || {}) },
        colorSystem: explicitSelectedConcept.colorSystem && typeof explicitSelectedConcept.colorSystem === "object"
          ? { ...explicitSelectedConcept.colorSystem }
          : { ...(conceptPlans[0]?.colorSystem || {}) },
        ctaPolicy: explicitSelectedConcept.ctaPolicy && typeof explicitSelectedConcept.ctaPolicy === "object"
          ? { ...explicitSelectedConcept.ctaPolicy }
          : { ...(conceptPlans[0]?.ctaPolicy || {}) },
        promotionTonePolicy: String(
          explicitSelectedConcept.promotionTonePolicy ||
          conceptPlans[0]?.promotionTonePolicy ||
          ""
        ).trim(),
      },
    };
  }
  const source = options && typeof options === "object" ? options : {};
  const selectedConceptId = String(source.selectedConceptId || input?.selectedConceptId || "").trim();
  const selectedConceptLabel = String(source.selectedConceptLabel || input?.selectedConceptLabel || "").trim().toLowerCase();
  const selectedConcept =
    conceptPlans.find((plan) => String(plan?.conceptId || "").trim() === selectedConceptId) ||
    conceptPlans.find((plan) => String(plan?.conceptLabel || "").trim().toLowerCase() === selectedConceptLabel) ||
    conceptPlans[0] ||
    null;
  return {
    conceptPlans,
    selectedConcept,
  };
}

function resolveExecutionBrief(request = {}, input = {}, selectedConcept = null) {
  const explicitExecutionBrief = input?.executionBrief && typeof input.executionBrief === "object"
    ? input.executionBrief
    : null;
  if (explicitExecutionBrief) {
    return {
      ...explicitExecutionBrief,
    };
  }
  return buildExecutionBrief(request, { selectedConcept });
}

function resolveSectionBlueprintMap(input = {}, request = {}) {
  const sectionBlueprints = Array.isArray(input?.sectionBlueprints)
    ? input.sectionBlueprints.filter(Boolean)
    : [];
  const map = new Map();
  sectionBlueprints.forEach((item) => {
    const slotId = String(item?.slotId || "").trim();
    if (!slotId) return;
    map.set(slotId, item);
  });
  if (map.size) return map;
  const fallbackMap = new Map();
  const targetComponents = Array.isArray(request?.targetGroup?.componentIds) ? request.targetGroup.componentIds : [];
  const slotIds = Array.isArray(request?.targetGroup?.slotIds) ? request.targetGroup.slotIds : [];
  targetComponents.forEach((componentId, index) => {
    const slotId = String(slotIds[index] || componentId.split(".").pop() || `slot-${index + 1}`).trim();
    fallbackMap.set(slotId, {
      slotId,
      label: humanizeSlotLabel(slotId, componentId),
      objective: compactText(request?.designPolicy?.hierarchyGoals, request?.pageIdentity?.userGoal || ""),
      visualDirection: compactText(request?.designPolicy?.layoutDirections, ""),
      mustKeep: compactText(request?.designPolicy?.mustKeep, ""),
      mustChange: compactText(request?.designPolicy?.mustChange, ""),
    });
  });
  return fallbackMap;
}

function resolveSectionProfile(slotId = "", selectedConcept = {}) {
  const conceptText = [
    selectedConcept?.conceptLabel,
    selectedConcept?.layoutSystem,
  ].filter(Boolean).join(" ");
  const editorial = /editorial|에디토리얼|좌텍스트 우이미지/i.test(conceptText);
  if (slotId === "hero") {
    return {
      familyId: "hero-carousel-composition",
      templateId: editorial ? "local-hero-editorial-split" : "local-hero-premium-center",
      variant: editorial ? "editorial-split" : "premium-center",
      assetPlan: {
        visualSetIds: [editorial ? "hero-editorial-light" : "hero-premium-light"],
        badgePresetIds: ["editorial-label"],
      },
    };
  }
  if (slotId === "quickmenu") {
    return {
      familyId: "icon-link-grid-composition",
      templateId: "local-quickmenu-brand-grid",
      variant: "brand-grid",
      assetPlan: {
        assetFamilyIds: ["home.quickmenu.icon.family.v1"],
      },
    };
  }
  if (slotId === "mainService" || slotId === "bestcare") {
    return {
      familyId: "service-benefit-hub-composition",
      templateId: slotId === "bestcare" ? "local-service-care-hub" : "local-service-entry-hub",
      variant: "service-trust-hub",
      assetPlan: {
        iconSetIds: ["service-trust-line"],
        badgePresetIds: ["service-trust-soft"],
      },
    };
  }
  if (slotId === "summary") {
    return {
      familyId: "pdp-summary-stack-composition",
      templateId: "local-pdp-summary-compact",
      variant: "summary-compact",
      assetPlan: {
        badgePresetIds: ["pdp-summary-badges"],
        thumbnailPresetIds: ["pdp-summary-thumbs"],
      },
    };
  }
  if (slotId === "sticky") {
    return {
      familyId: "pdp-sticky-buybox-composition",
      templateId: "local-pdp-sticky-buybox",
      variant: "buybox-focused",
      assetPlan: {
        badgePresetIds: ["pdp-sticky-benefits"],
      },
    };
  }
  return {
    familyId: "editorial-visual-story-composition",
    templateId: "local-editorial-cluster",
    variant: editorial ? "editorial-split" : "clean-stack",
    assetPlan: {
      visualSetIds: ["editorial-clean"],
    },
  };
}

function buildSectionLayout(slotId = "", blueprint = {}, request = {}, selectedConcept = {}) {
  const targetGroup = request?.targetGroup && typeof request.targetGroup === "object" ? request.targetGroup : {};
  const conceptText = [
    selectedConcept?.conceptLabel,
    selectedConcept?.layoutSystem,
  ].filter(Boolean).join(" ");
  const editorial = /editorial|에디토리얼|좌텍스트 우이미지/i.test(conceptText);
  if (slotId === "hero") {
    return {
      sectionRole: "primary-stage",
      layoutMode: editorial ? "editorial-split" : "centered-stage",
      containerMode: "full-bleed-shell",
      hierarchy: operationalList([
        blueprint?.hierarchy,
        ...toStringArray(targetGroup.layoutIntent),
      ], 4),
      density: "airy",
      alignment: editorial ? "split" : "center",
      rhythm: "hero-first",
    };
  }
  if (slotId === "quickmenu") {
    return {
      sectionRole: "supporting-navigation",
      layoutMode: "icon-grid",
      containerMode: "contained-grid",
      hierarchy: operationalList([
        blueprint?.hierarchy,
        "hero 아래 보조 탐색 입구",
      ], 4),
      density: "compact",
      alignment: "grid",
      rhythm: "follow-hero",
    };
  }
  if (slotId === "summary" || slotId === "sticky") {
    return {
      sectionRole: slotId === "summary" ? "purchase-summary" : "purchase-action",
      layoutMode: slotId === "summary" ? "stacked-summary" : "sticky-buybox",
      containerMode: "contained-stack",
      hierarchy: operationalList([blueprint?.hierarchy, "가치 -> 혜택 -> 행동"], 4),
      density: "focused",
      alignment: "left",
      rhythm: "purchase-stack",
    };
  }
  return {
    sectionRole: "cluster-section",
    layoutMode: operationalText(selectedConcept?.layoutSystem, "clean-stack"),
    containerMode: "contained-section",
    hierarchy: operationalList([blueprint?.hierarchy], 4),
    density: "balanced",
    alignment: "left",
    rhythm: "grouped-flow",
  };
}

function buildSectionTone(slotId = "", selectedConcept = {}, request = {}) {
  const pageIdentity = request?.pageIdentity && typeof request.pageIdentity === "object" ? request.pageIdentity : {};
  const visualLanguage = String(pageIdentity.visualLanguage || "").trim();
  const conceptText = [
    selectedConcept?.conceptLabel,
    selectedConcept?.layoutSystem,
    visualLanguage,
  ].filter(Boolean).join(" ");
  const editorial = /editorial|에디토리얼|좌텍스트 우이미지/i.test(conceptText);
  const service = /service|support|신뢰/i.test(conceptText);
  return {
    surfaceTone: service ? "service-trust" : "light-neutral",
    emphasisTone: slotId === "hero" ? (editorial ? "editorial-clean" : "brand-accent") : "subtle-emphasis",
    contrastMode: "soft-contrast",
    accentTone: "brand-accent",
    badgeTone: editorial ? "editorial-label" : "soft-pill",
  };
}

function buildSectionTypography(slotId = "", selectedConcept = {}) {
  const conceptText = [
    selectedConcept?.conceptLabel,
    selectedConcept?.layoutSystem,
  ].filter(Boolean).join(" ");
  const editorial = /editorial|에디토리얼|좌텍스트 우이미지/i.test(conceptText);
  return {
    headlinePreset: editorial ? "editorial-display" : "brand-headline-strong",
    bodyPreset: "brand-body",
    eyebrowPreset: slotId === "hero" || slotId === "summary" ? "brand-eyebrow" : "section-label",
    ctaPreset: "brand-cta-strong",
  };
}

function buildSectionPatch(slotId = "", blueprint = {}, request = {}, selectedConcept = {}) {
  const pageId = String(request?.pageId || "").trim();
  const label = String(blueprint?.label || humanizeSlotLabel(slotId)).trim();
  const operationalCopy = resolveOperationalCopy(pageId, slotId, label);
  if (slotId === "hero") {
    return {
      badge: operationalCopy.badge || "Brand Focus",
      headline: operationalCopy.headline,
      subtitle: operationalCopy.subtitle,
      support: operationalCopy.support,
      primaryCtaLabel: operationalCopy.primaryCtaLabel || "자세히 보기",
      secondaryCtaLabel: operationalCopy.secondaryCtaLabel || "혜택 보기",
      surfaceTone: "light-neutral",
    };
  }
  if (slotId === "quickmenu" || slotId === "quickMenu" || slotId === "shortcut") {
    return {
      title: operationalCopy.headline,
      subtitle: operationalCopy.subtitle,
      support: operationalCopy.support,
      primaryCtaLabel: operationalCopy.primaryCtaLabel || "자세히 보기",
      surfaceTone: "light-neutral",
    };
  }
  if (slotId === "summary") {
    return {
      badge: operationalCopy.badge || "핵심 요약",
      headline: operationalCopy.headline,
      subtitle: operationalCopy.subtitle,
      support: operationalCopy.support,
      primaryCtaLabel: operationalCopy.primaryCtaLabel || "핵심 혜택 보기",
      surfaceTone: "light-neutral",
    };
  }
  if (slotId === "sticky") {
    return {
      title: operationalCopy.headline,
      subtitle: operationalCopy.subtitle,
      support: operationalCopy.support,
      primaryCtaLabel: operationalCopy.primaryCtaLabel || "바로 구매",
      surfaceTone: "light-neutral",
    };
  }
  return {
    title: operationalCopy.headline,
    subtitle: operationalCopy.subtitle,
    support: operationalCopy.support,
    primaryCtaLabel: operationalCopy.primaryCtaLabel || "자세히 보기",
    surfaceTone: "light-neutral",
  };
}

function resolveOperationalCopy(pageId = "", slotId = "", label = "") {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedSlotId = String(slotId || "").trim();
  if (normalizedPageId === "bestshop") {
    const copyBySlot = {
      hero: {
        badge: "BEST SHOP CONSULTING",
        headline: "가까운 매장에서 만나는 맞춤 가전 상담",
        subtitle: "제품 선택부터 설치 환경까지 전문 매니저가 우리 집에 맞는 답을 함께 찾아드립니다.",
        support: "방문 전 상담 예약으로 기다림은 줄이고, 혜택과 체험은 더 빠르게 확인하세요.",
        primaryCtaLabel: "상담 예약하기",
        secondaryCtaLabel: "매장 찾기",
      },
      shortcut: {
        headline: "필요한 서비스를 바로 시작하세요",
        subtitle: "매장 상담, 오픈 매장, 라이브 혜택, 구독 상담까지 자주 찾는 메뉴를 모았습니다.",
        support: "모바일에서도 한 번에 이동할 수 있도록 주요 행동을 간결하게 정리했습니다.",
        primaryCtaLabel: "전체 서비스 보기",
      },
      review: {
        headline: "상담 후기로 확인하는 베스트샵 경험",
        subtitle: "실제 방문 고객이 남긴 상담 만족도와 구매 결정 포인트를 확인해보세요.",
        support: "전문 매니저의 제품 비교, 설치 상담, 혜택 안내가 구매 전 고민을 줄여줍니다.",
        primaryCtaLabel: "후기 더 보기",
      },
      brandBanner: {
        badge: "STORE EXPERIENCE",
        headline: "직접 보고 비교하는 프리미엄 체험",
        subtitle: "온라인에서 고르기 어려운 가전은 가까운 베스트샵에서 직접 경험해보세요.",
        support: "전시 제품 체험부터 구매 혜택 상담까지 한 자리에서 이어집니다.",
        primaryCtaLabel: "체험 매장 찾기",
      },
    };
    return copyBySlot[normalizedSlotId] || {};
  }
  const fallbackLabel = String(label || humanizeSlotLabel(slotId)).trim() || "섹션";
  const copyBySlot = {
    hero: {
      badge: "NEW EXPERIENCE",
      headline: "지금 필요한 제품 경험을 한눈에 확인하세요",
      subtitle: "핵심 혜택과 추천 정보를 보기 쉽게 정리했습니다.",
      support: "관심 있는 제품과 서비스로 빠르게 이동해보세요.",
      primaryCtaLabel: "자세히 보기",
      secondaryCtaLabel: "혜택 보기",
    },
    quickmenu: {
      headline: "자주 찾는 메뉴를 빠르게 확인하세요",
      subtitle: "필요한 서비스와 혜택으로 바로 이동할 수 있습니다.",
      support: "모바일에서도 주요 행동을 쉽게 선택할 수 있도록 정리했습니다.",
      primaryCtaLabel: "전체 보기",
    },
    quickMenu: {
      headline: "자주 찾는 메뉴를 빠르게 확인하세요",
      subtitle: "필요한 서비스와 혜택으로 바로 이동할 수 있습니다.",
      support: "모바일에서도 주요 행동을 쉽게 선택할 수 있도록 정리했습니다.",
      primaryCtaLabel: "전체 보기",
    },
    shortcut: {
      headline: "필요한 메뉴를 바로 시작하세요",
      subtitle: "상담, 혜택, 이벤트, 고객 지원을 빠르게 찾을 수 있습니다.",
      support: "주요 이동 경로를 간결한 카드로 정리했습니다.",
      primaryCtaLabel: "전체 보기",
    },
    summary: {
      badge: "핵심 요약",
      headline: "중요한 정보를 먼저 확인하세요",
      subtitle: "제품 선택에 필요한 핵심 조건과 혜택을 간결하게 정리했습니다.",
      support: "가격, 구성, 구매 행동으로 이어지는 흐름을 쉽게 따라갈 수 있습니다.",
      primaryCtaLabel: "핵심 혜택 보기",
    },
    sticky: {
      headline: "선택한 조건으로 구매를 이어가세요",
      subtitle: "혜택과 구매 조건을 확인한 뒤 다음 단계로 이동할 수 있습니다.",
      support: "필요한 행동을 놓치지 않도록 CTA를 명확하게 배치했습니다.",
      primaryCtaLabel: "바로 구매",
    },
    price: {
      headline: "구매 조건을 한눈에 비교하세요",
      subtitle: "가격, 혜택, 결제 조건을 보기 쉽게 정리했습니다.",
      support: "선택 전 꼭 확인해야 할 정보를 카드형으로 제공합니다.",
      primaryCtaLabel: "혜택 확인",
    },
    option: {
      headline: "나에게 맞는 옵션을 선택하세요",
      subtitle: "색상, 구성, 서비스 조건을 차례대로 확인할 수 있습니다.",
      support: "복잡한 선택지를 단계별로 나누어 보여줍니다.",
      primaryCtaLabel: "옵션 선택",
    },
    review: {
      headline: "사용자 경험을 확인해보세요",
      subtitle: "구매 전 참고할 수 있는 후기와 평가 포인트를 정리했습니다.",
      support: "실제 사용 맥락을 중심으로 신뢰 정보를 제공합니다.",
      primaryCtaLabel: "후기 보기",
    },
    qna: {
      headline: "궁금한 내용을 미리 확인하세요",
      subtitle: "자주 묻는 질문과 답변을 보기 쉽게 정리했습니다.",
      support: "구매 전 확인해야 할 정보를 빠르게 찾을 수 있습니다.",
      primaryCtaLabel: "문의하기",
    },
    guides: {
      headline: "사용과 관리 방법을 확인하세요",
      subtitle: "설치, 사용, 관리에 필요한 안내를 모았습니다.",
      support: "제품을 더 오래 편하게 사용할 수 있도록 돕습니다.",
      primaryCtaLabel: "가이드 보기",
    },
    seller: {
      headline: "판매자와 서비스 정보를 확인하세요",
      subtitle: "구매 전 확인해야 할 판매 조건과 고객 지원 정보를 제공합니다.",
      support: "안심하고 구매할 수 있도록 필요한 정보를 정리했습니다.",
      primaryCtaLabel: "정보 확인",
    },
    benefit: {
      headline: "놓치기 쉬운 혜택을 확인하세요",
      subtitle: "구독, 제휴, 이벤트 혜택을 한눈에 비교할 수 있습니다.",
      support: "나에게 적용되는 혜택을 빠르게 확인해보세요.",
      primaryCtaLabel: "혜택 보기",
    },
    detailInfo: {
      headline: "제품 정보를 자세히 살펴보세요",
      subtitle: "핵심 기능과 사용 장점을 이해하기 쉽게 정리했습니다.",
      support: "필요한 정보를 순서대로 확인할 수 있습니다.",
      primaryCtaLabel: "상세 보기",
    },
    noticeBanner: {
      headline: "확인해야 할 안내를 알려드립니다",
      subtitle: "구매와 이용에 필요한 중요 안내를 정리했습니다.",
      support: "조건과 유의사항을 놓치지 않도록 확인해보세요.",
      primaryCtaLabel: "안내 보기",
    },
    brandBanner: {
      badge: "BRAND STORY",
      headline: "브랜드가 제안하는 경험을 만나보세요",
      subtitle: "제품과 서비스가 연결되는 새로운 사용 경험을 소개합니다.",
      support: "지금 필요한 정보와 다음 행동을 자연스럽게 이어줍니다.",
      primaryCtaLabel: "자세히 보기",
    },
    labelBanner: {
      badge: "CURATION",
      headline: "추천 콘텐츠를 확인해보세요",
      subtitle: "관심 있는 제품과 혜택을 보기 쉽게 모았습니다.",
      support: "탐색 흐름에 맞춰 다음 정보를 이어서 확인할 수 있습니다.",
      primaryCtaLabel: "추천 보기",
    },
    brandStory: {
      badge: "STORY",
      headline: "공간과 제품이 만드는 이야기를 살펴보세요",
      subtitle: "라이프스타일에 맞춘 제품 경험을 제안합니다.",
      support: "사용 장면을 중심으로 제품의 가치를 이해할 수 있습니다.",
      primaryCtaLabel: "스토리 보기",
    },
  };
  if (copyBySlot[normalizedSlotId]) return copyBySlot[normalizedSlotId];
  return {
    headline: `${fallbackLabel}을 더 쉽게 확인하세요`,
    subtitle: "필요한 정보를 보기 쉬운 구조로 정리했습니다.",
    support: "중요한 내용과 다음 행동을 한 화면에서 확인할 수 있습니다.",
    primaryCtaLabel: "자세히 보기",
  };
}

function buildSectionContent(slotId = "", blueprint = {}, request = {}, selectedConcept = {}, patch = {}) {
  const designPolicy = request?.designPolicy && typeof request.designPolicy === "object" ? request.designPolicy : {};
  return {
    objective: compactText([patch.headline, patch.title, patch.subtitle], ""),
    primaryMessage: compactText([
      patch.headline,
      patch.title,
    ], ""),
    supportMessage: compactText([patch.subtitle, patch.support], ""),
    keep: operationalList([blueprint?.keep, blueprint?.mustKeep, ...toStringArray(designPolicy.mustKeep)], 4),
    change: operationalList([blueprint?.change, blueprint?.mustChange, ...toStringArray(designPolicy.mustChange)], 4),
    ctaLabels: uniqueList([patch.primaryCtaLabel, patch.secondaryCtaLabel]).slice(0, 3),
  };
}

function buildSectionConstraints(blueprint = {}, request = {}) {
  const designPolicy = request?.designPolicy && typeof request.designPolicy === "object" ? request.designPolicy : {};
  return {
    preserve: operationalList([blueprint?.keep, blueprint?.mustKeep, ...toStringArray(designPolicy.mustKeep)], 4),
    avoid: operationalList(blueprint?.avoid || [], 4),
    guardrails: operationalList(designPolicy.guardrails, 6),
  };
}

function buildPrimitiveTree(slotId = "", profile = {}, patch = {}) {
  const normalizedSlotId = String(slotId || "").trim();
  const normalizedVariant = String(profile.variant || "default").trim();
  let primitiveType = normalizedSlotId || "section";
  let primitiveVariant = normalizedVariant;
  if (normalizedSlotId === "hero") {
    if (normalizedVariant === "editorial-split") {
      primitiveType = "SplitHero";
      primitiveVariant = "editorial";
    } else if (normalizedVariant === "premium-center") {
      primitiveType = "CenteredHero";
      primitiveVariant = "premium-center";
    } else {
      primitiveType = "SplitHero";
      primitiveVariant = "carousel";
    }
  } else if (normalizedSlotId === "quickmenu") {
    primitiveType = "QuickmenuGrid";
    primitiveVariant = normalizedVariant === "editorial-strip" ? "editorial-strip" : "grid";
  } else if (normalizedSlotId === "summary") {
    primitiveType = "StackedHero";
    primitiveVariant = "summary-compact";
  } else if (normalizedSlotId === "sticky") {
    primitiveType = "QuickmenuPanel";
    primitiveVariant = "buybox-focused";
  } else if (String(profile.familyId || "").trim() === "service-benefit-hub-composition") {
    primitiveType = "BenefitHub";
    primitiveVariant = normalizedVariant || "service-trust-hub";
  }
  return {
    type: primitiveType,
    variant: primitiveVariant,
    props: {
      ...patch,
      familyId: profile.familyId || "",
      templateId: profile.templateId || "",
    },
    children: [],
  };
}

function buildRenderIntent(request = {}, selectedConcept = {}, executionBrief = {}) {
  const designPolicy = request?.designPolicy && typeof request.designPolicy === "object" ? request.designPolicy : {};
  return {
    modelVersion: "canonical-render-model.v1",
    designChangeLevel: "medium",
    compositionMode: "target-group-recompose",
    selectedConceptId: String(selectedConcept?.conceptId || "").trim(),
    selectedConceptLabel: operationalText(selectedConcept?.conceptLabel, ""),
    layoutDirection: operationalText(
      selectedConcept?.layoutSystem || compactText(designPolicy.layoutDirections, ""),
      "clean-core"
    ),
    themeTone: String(selectedConcept?.colorSystem?.baseSurface || "light-neutral").trim(),
    northStar: operationalList([
      ...toStringArray(executionBrief?.northStar),
      ...toStringArray(designPolicy.problemStatement),
    ], 6),
    guardrails: operationalList(designPolicy.guardrails, 8),
  };
}

function buildSectionCompositionItem(section = {}, blueprint = {}, request = {}, selectedConcept = {}, executionBrief = {}) {
  const designPolicy = request?.designPolicy && typeof request.designPolicy === "object" ? request.designPolicy : {};
  return {
    componentId: section.componentId,
    slotId: section.slotId,
    familyId: section.familyId,
    label: String(blueprint?.label || humanizeSlotLabel(section.slotId, section.componentId)).trim(),
    summary: compactText(
      [section.patch?.subtitle, section.patch?.support, section.patch?.headline, section.patch?.title],
      "섹션 정보를 보기 쉽게 제공합니다."
    ),
    layoutStrategy: operationalText(selectedConcept?.layoutSystem || compactText(designPolicy.layoutDirections, ""), "clean-core"),
    preservedElements: operationalList([blueprint?.keep, blueprint?.mustKeep, ...toStringArray(designPolicy.mustKeep)], 3),
    changedElements: operationalList([blueprint?.change, blueprint?.mustChange, ...toStringArray(designPolicy.mustChange)], 4),
    assetPlan: section.assetPlan || {},
    modelConcerns: operationalList([
      ...toStringArray(executionBrief?.guardrails),
      ...toStringArray(designPolicy.guardrails),
    ], 3),
    validatedConstraints: [],
  };
}

function buildOperationsFromSections(sections = []) {
  return sections.flatMap((section) => {
    const base = {
      slotId: section.slotId,
      componentId: section.componentId,
      familyId: section.familyId,
      templateId: section.templateId,
      patch: section.patch,
    };
    return [
      {
        action: "replace_component_template",
        ...base,
      },
      {
        action: "update_component_patch",
        ...base,
      },
    ];
  });
}

function buildLocalBuildFoundation(input = {}, options = {}) {
  const request = normalizeBuildRequest(input);
  const validation = validateBuildRequest(request);
  const { conceptPlans, selectedConcept } = resolveSelectedConcept(request, input, options);
  const executionBrief = resolveExecutionBrief(request, input, selectedConcept);
  const sectionBlueprintMap = resolveSectionBlueprintMap(input, request);
  const componentIds = Array.isArray(request?.targetGroup?.componentIds) ? request.targetGroup.componentIds : [];
  const slotIds = Array.isArray(request?.targetGroup?.slotIds) ? request.targetGroup.slotIds : [];
  const sections = componentIds.map((componentId, index) => {
    const slotId = String(slotIds[index] || componentId.split(".").pop() || `slot-${index + 1}`).trim();
    const blueprint = sectionBlueprintMap.get(slotId) || {};
    const profile = resolveSectionProfile(slotId, selectedConcept || {});
    const patch = buildSectionPatch(slotId, blueprint, request, selectedConcept || {});
    const layout = buildSectionLayout(slotId, blueprint, request, selectedConcept || {});
    const tone = buildSectionTone(slotId, selectedConcept || {}, request);
    const typography = buildSectionTypography(slotId, selectedConcept || {});
    const content = buildSectionContent(slotId, blueprint, request, selectedConcept || {}, patch);
    const constraints = buildSectionConstraints(blueprint, request);
    return {
      slotId,
      componentId: String(componentId || "").trim(),
      familyId: profile.familyId,
      templateId: profile.templateId,
      primitiveTree: buildPrimitiveTree(slotId, profile, patch),
      patch,
      priority: index === 0 ? "primary" : "secondary",
      layout,
      tone,
      typography,
      assets: {
        visualRole: slotId === "hero" ? "dominant-visual" : slotId === "quickmenu" ? "icon-navigation" : "supporting-visual",
        visualPolicy: slotId === "hero" ? "single-strong-visual" : "balanced-supporting-assets",
        iconPolicy: slotId === "quickmenu" ? "line-icon-grid" : "",
        assetPlan: profile.assetPlan || {},
      },
      content,
      constraints,
      assetPlan: profile.assetPlan || {},
      blueprint: sanitizeSectionBlueprintForOutput(blueprint, slotId, componentId),
    };
  });
  const outputSelectedConcept = sanitizeConceptForOutput(selectedConcept);
  const outputExecutionBrief = sanitizeExecutionBriefForOutput(executionBrief);
  const reportComponentComposition = sections.map((section) =>
    buildSectionCompositionItem(section, section.blueprint, request, outputSelectedConcept || {}, outputExecutionBrief || {})
  );
  const cloneRenderModel = buildCloneRenderModel({
    pageId: request.pageId,
    viewportProfile: request.viewportProfile,
    rendererSurface: request.rendererSurface,
    renderIntent: buildRenderIntent(request, selectedConcept || {}, executionBrief || {}),
    targetGroup: {
      ...(request.targetGroup || {}),
      boundary: {
        mode: "replace-inside-group",
        preserveOutsideGroup: true,
        entrySlotId: slotIds[0] || "",
        exitSlotId: slotIds[slotIds.length - 1] || "",
      },
    },
    sections,
  });
  const draft = {
    summary: compactText(
      [
        request?.targetGroup?.groupLabel
          ? `${operationalText(request.targetGroup.groupLabel, "선택 영역")} 로컬 빌드 preview`
          : "",
      ],
      "로컬 빌드 preview가 준비되었습니다."
    ),
    conceptPlan: outputSelectedConcept,
    executionBrief: outputExecutionBrief,
    operations: buildOperationsFromSections(sections),
    componentComposition: reportComponentComposition,
    cloneRenderModel,
    advisory: {
      notes: operationalList(request?.designPolicy?.guardrails, 4),
    },
    report: {
      whatChanged: reportComponentComposition.map((item) => item.summary).filter(Boolean),
      componentComposition: reportComponentComposition,
      modelConcerns: operationalList(request?.designPolicy?.guardrails, 4),
      validatedConstraints: [],
    },
  };
  const cloneRequest = buildCanonicalCloneRequest({
    snapshotState: "after",
    cloneRenderModel,
  });
  return {
    request,
    validation,
    providerMeta: {
      provider: "local-build",
      deterministic: true,
    },
    plannerBrief: {
      pageId: request.pageId,
      viewportProfile: request.viewportProfile,
      rendererSurface: request.rendererSurface,
      targetGroup: request.targetGroup,
      pageIdentity: request.pageIdentity,
      designPolicy: request.designPolicy,
      conceptPlans,
      selectedConcept: outputSelectedConcept,
      executionBrief: outputExecutionBrief,
    },
    draft,
    cloneRequest,
  };
}

function buildLocalBuildPreviewItem(foundation = {}, options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const draft = foundation?.draft && typeof foundation.draft === "object" ? foundation.draft : {};
  const request = foundation?.request && typeof foundation.request === "object" ? foundation.request : {};
  const report = draft?.report && typeof draft.report === "object" ? draft.report : {};
  const nowIso = new Date().toISOString();
  const changedComponentIds = Array.isArray(request?.targetGroup?.componentIds) ? request.targetGroup.componentIds.slice(0, 12) : [];
  return {
    id: `local-build-preview-${Date.now()}`,
    pageId: String(source.pageId || request.pageId || "").trim(),
    viewportProfile: String(source.viewportProfile || request.viewportProfile || "pc").trim() || "pc",
    planId: String(source.planId || "").trim(),
    status: "preview",
    summary: draft.summary || "로컬 빌드 preview",
    createdAt: nowIso,
    updatedAt: nowIso,
    previewOnly: true,
    builderVersion: "design-pipeline-local",
    builderProvider: "local",
    rendererSurface: String(request.rendererSurface || source.rendererSurface || "tailwind").trim() || "tailwind",
    targetGroupId: String(request?.targetGroup?.groupId || source.targetGroupId || "").trim(),
    executionStrategy: {
      builderProvider: "local",
      rendererSurface: String(request.rendererSurface || source.rendererSurface || "tailwind").trim() || "tailwind",
      targetGroupId: String(request?.targetGroup?.groupId || source.targetGroupId || "").trim(),
    },
    operations: Array.isArray(draft.operations) ? draft.operations : [],
    report,
    snapshotData: {
      source: "design-pipeline-local-build-preview",
      changedComponentIds,
      patchDepth: String(source.patchDepth || "medium").trim() || "medium",
      interventionLayer: String(source.interventionLayer || "section-group").trim() || "section-group",
      rendererSurface: String(request.rendererSurface || source.rendererSurface || "tailwind").trim() || "tailwind",
      targetGroupId: String(request?.targetGroup?.groupId || source.targetGroupId || "").trim(),
      cloneRequest: foundation?.cloneRequest || null,
    },
    providerMeta: foundation?.providerMeta || null,
  };
}

function buildLocalBuildDraftItem(foundation = {}, options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const previewItem = buildLocalBuildPreviewItem(foundation, options);
  const targetGroupId = String(previewItem.targetGroupId || "").trim();
  const pageId = String(source.pageId || previewItem.pageId || "").trim() || "page";
  const versionSuffix = targetGroupId || "draft";
  return {
    ...previewItem,
    id: String(source.id || "").trim() || previewItem.id.replace("preview", "draft"),
    status: "draft",
    previewOnly: false,
    proposedVersionLabel: `${pageId}-${versionSuffix}-v1`,
    snapshotData: {
      ...(previewItem.snapshotData && typeof previewItem.snapshotData === "object" ? previewItem.snapshotData : {}),
      source: "design-pipeline-local-build-draft",
      pageId: pageId,
      workspacePageId: pageId,
      builderProvider: "local",
      executionMode: targetGroupId ? "target-group-recompose" : "section-composition-plan",
      cloneRenderModel: foundation?.cloneRequest?.sections ? foundation.cloneRequest : (foundation?.draft?.cloneRenderModel || null),
    },
  };
}

module.exports = {
  buildLocalBuildFoundation,
  buildLocalBuildDraftItem,
  buildLocalBuildPreviewItem,
};
