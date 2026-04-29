"use strict";

const { toStringArray } = require("./contracts");
const { buildPlannerBrief } = require("./brief");
const { buildDesignDraftSkeleton } = require("./builder");
const { buildCanonicalCloneRequest } = require("./clone-renderer");

const LOCAL_PLANNING_SCENARIOS = {
  "home-top-stage": {
    scenarioId: "home-top-stage",
    scenarioLabel: "Home Top Stage",
    description: "LG 홈의 hero + quickmenu를 브랜드형 상단 진입 경험으로 재정리하는 기본 시나리오.",
    input: {
      pageId: "home",
      viewportProfile: "pc",
      rendererSurface: "tailwind",
      targetGroup: {
        groupId: "top-stage",
        groupLabel: "Top Stage Cluster",
        componentIds: ["home.hero", "home.quickmenu"],
        slotIds: ["hero", "quickmenu"],
        layoutIntent: [
          "상단 진입 경험을 하나의 흐름으로 보이게 한다.",
          "hero는 주 메시지, quickmenu는 보조 탐색 포인트로 쓴다.",
        ],
      },
      pageIdentity: {
        character: "LG전자 공식 메인으로서의 신뢰감과 프리미엄 톤이 공존하는 브랜드 첫 접점",
        visualLanguage: "라이트 배경, 큰 시각 요소, 정돈된 여백, 과장 없는 프로모션",
        userGoal: "브랜드 메시지를 빠르게 이해하고 주요 카테고리로 자연스럽게 진입",
        sectionFlow: "헤더 -> 히어로 -> 퀵메뉴 -> 하위 큐레이션 섹션",
      },
      designPolicy: {
        problemStatement: [
          "슬라이드별 다크 슬롯 대비로 홈 상단의 브랜드 일관성이 약하다.",
          "혜택 강조가 과도해 할인몰처럼 보이는 인상이 남아 있다.",
        ],
        hierarchyGoals: [
          "브랜드 메시지 -> 신뢰 근거 -> 행동 유도 순으로 위계를 재정렬한다.",
          "quickmenu는 숨은 링크 묶음이 아니라 hero와 연결된 탐색 입구처럼 보여야 한다.",
        ],
        mustKeep: [
          "LG전자 공식 메인다운 신뢰감",
          "브랜드 홈다운 정돈된 톤",
          "혜택과 탐색의 균형",
        ],
        mustChange: [
          "일부 슬롯만 다크 테마로 분리되는 과한 대비 제거",
          "과잉 프로모션 톤 제거",
          "상단과 하단이 다른 사이트처럼 보이는 파편화 완화",
        ],
        guardrails: [
          "다크 테마를 단일 슬롯에만 적용하지 않는다.",
          "할인율 중심 뱃지를 메인 메시지보다 앞세우지 않는다.",
          "quickmenu를 독립 프로모션 카드처럼 과장하지 않는다.",
        ],
        exclusions: [
          {
            label: "하위 큐레이션 섹션 전면 개편",
            reason: "이번 범위는 top-stage 변화 체감 확보가 우선이다.",
          },
        ],
        layoutDirections: [
          "정제된 센터 레이아웃",
          "좌텍스트 우이미지 에디토리얼 분할",
        ],
      },
    },
  },
  "support-service-entry": {
    scenarioId: "support-service-entry",
    scenarioLabel: "Support Service Entry",
    description: "지원 페이지의 서비스 진입 영역을 신뢰형 서비스 허브로 정리하는 시나리오.",
    input: {
      pageId: "support",
      viewportProfile: "ta",
      rendererSurface: "tailwind",
      targetGroup: {
        groupId: "service-entry",
        groupLabel: "Service Entry Cluster",
        componentIds: ["support.hero", "support.mainService", "support.bestcare"],
        slotIds: ["hero", "mainService", "bestcare"],
        layoutIntent: [
          "서비스 신뢰와 빠른 자기 해결 진입을 동시에 보여준다.",
        ],
      },
      pageIdentity: {
        character: "문제 해결을 빠르게 도와주는 신뢰형 서비스 허브",
        visualLanguage: "정보 밀도는 높되 시각 계층은 단순하고 명확해야 한다.",
        userGoal: "사용자가 자신에게 맞는 서비스 경로를 지체 없이 찾는다.",
        sectionFlow: "대표 안내 -> 주요 서비스 -> 안심 케어 -> 추가 도움말",
      },
      designPolicy: {
        problemStatement: [
          "서비스 링크가 동등하게 나열돼 우선 경로가 잘 보이지 않는다.",
        ],
        hierarchyGoals: [
          "대표 해결 경로를 먼저 제시하고 세부 진입은 2순위로 정리한다.",
        ],
        mustKeep: [
          "공식 지원센터의 신뢰감",
        ],
        mustChange: [
          "서비스 링크의 동등 나열",
        ],
        guardrails: [
          "프로모션형 카피보다 해결 안내를 우선한다.",
        ],
        exclusions: [
          {
            label: "FAQ 하단 영역 재구성",
            reason: "상단 서비스 진입 동선 개선과 직접 관련이 없다.",
          },
        ],
        layoutDirections: [
          "신뢰형 서비스 스테이지",
          "문제 해결 중심 허브 레이아웃",
        ],
      },
    },
  },
  "pdp-purchase-cluster": {
    scenarioId: "pdp-purchase-cluster",
    scenarioLabel: "PDP Purchase Cluster",
    description: "PDP의 summary + sticky를 구매 확신 영역으로 재정리하는 시나리오.",
    input: {
      pageId: "pdp-tv-general",
      viewportProfile: "pc",
      rendererSurface: "tailwind",
      targetGroup: {
        groupId: "purchase-cluster",
        groupLabel: "Purchase Cluster",
        componentIds: ["pdp-tv-general.summary", "pdp-tv-general.sticky"],
        slotIds: ["summary", "sticky"],
        layoutIntent: [
          "핵심 요약과 구매 박스를 하나의 확신 경험으로 연결한다.",
        ],
      },
      pageIdentity: {
        character: "상품 신뢰와 구매 결심을 동시에 끌어내는 판매 페이지",
        visualLanguage: "요약은 짧고 강하게, 가격과 CTA는 명확하게, 정보 과밀은 피한다.",
        userGoal: "핵심 가치 이해 후 바로 구매 행동으로 이동",
        sectionFlow: "갤러리 -> 요약 -> 가격/혜택 -> 구매 박스 -> 상세 정보",
      },
      designPolicy: {
        problemStatement: [
          "요약과 구매 박스가 따로 놀아 구매 확신 흐름이 끊긴다.",
        ],
        hierarchyGoals: [
          "핵심 가치 -> 가격/혜택 -> CTA 순으로 구매 위계를 단순화한다.",
        ],
        mustKeep: [
          "공식몰 상품 신뢰감",
          "가격/혜택 정보의 명확성",
        ],
        mustChange: [
          "길고 분산된 요약 카피",
          "sticky 영역의 기계적 정보 나열",
        ],
        guardrails: [
          "가격 수치 자체는 임의 변경하지 않는다.",
          "CTA를 여러 개로 분산하지 않는다.",
        ],
        exclusions: [
          {
            label: "하단 리뷰/QnA 재배치",
            reason: "이번 범위는 구매 결심 구간 정리다.",
          },
        ],
        layoutDirections: [
          "구매 확신 스택",
          "압축형 프리미엄 요약",
        ],
      },
    },
  },
};

function cloneJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, cloneJsonValue(entryValue)])
    );
  }
  return value;
}

function mergePlanningInputs(baseInput = {}, overrideInput = {}) {
  const base = baseInput && typeof baseInput === "object" ? baseInput : {};
  const override = overrideInput && typeof overrideInput === "object" ? overrideInput : {};
  return {
    ...cloneJsonValue(base),
    ...cloneJsonValue(override),
    targetGroup: {
      ...(base.targetGroup && typeof base.targetGroup === "object" ? cloneJsonValue(base.targetGroup) : {}),
      ...(override.targetGroup && typeof override.targetGroup === "object" ? cloneJsonValue(override.targetGroup) : {}),
    },
    pageIdentity: {
      ...(base.pageIdentity && typeof base.pageIdentity === "object" ? cloneJsonValue(base.pageIdentity) : {}),
      ...(override.pageIdentity && typeof override.pageIdentity === "object" ? cloneJsonValue(override.pageIdentity) : {}),
    },
    designPolicy: {
      ...(base.designPolicy && typeof base.designPolicy === "object" ? cloneJsonValue(base.designPolicy) : {}),
      ...(override.designPolicy && typeof override.designPolicy === "object" ? cloneJsonValue(override.designPolicy) : {}),
    },
  };
}

function listLocalPlanningScenarios() {
  return Object.values(LOCAL_PLANNING_SCENARIOS).map((scenario) => ({
    scenarioId: scenario.scenarioId,
    scenarioLabel: scenario.scenarioLabel,
    description: scenario.description,
  }));
}

function inferLocalPlanningScenarioId(pageId = "") {
  const normalizedPageId = String(pageId || "").trim();
  if (normalizedPageId === "home") return "home-top-stage";
  if (
    normalizedPageId === "support" ||
    normalizedPageId === "bestshop" ||
    normalizedPageId.startsWith("care-solutions") ||
    normalizedPageId.startsWith("homestyle-")
  ) {
    return "support-service-entry";
  }
  if (normalizedPageId.startsWith("pdp-")) return "pdp-purchase-cluster";
  return "home-top-stage";
}

function getLocalPlanningScenario(scenarioId = "home-top-stage") {
  const normalizedScenarioId = String(scenarioId || "").trim() || "home-top-stage";
  const scenario = LOCAL_PLANNING_SCENARIOS[normalizedScenarioId] || null;
  if (!scenario) return null;
  return cloneJsonValue(scenario);
}

function runLocalPlanningProvider(input = {}, options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const scenarioId = String(
    source.scenarioId || input?.scenarioId || inferLocalPlanningScenarioId(input?.pageId || "")
  ).trim() || "home-top-stage";
  const scenario = getLocalPlanningScenario(scenarioId);
  const mergedInput = mergePlanningInputs(scenario?.input || {}, input);
  const providerMeta = {
    provider: "local",
    deterministic: true,
    scenarioId: scenario ? scenario.scenarioId : null,
    scenarioLabel: scenario ? scenario.scenarioLabel : null,
  };
  return buildPlannerBrief(mergedInput, {
    selectedConceptId: source.selectedConceptId || input?.selectedConceptId,
    selectedConceptLabel: source.selectedConceptLabel || input?.selectedConceptLabel || input?.concept,
    selectedConceptIndex: source.selectedConceptIndex ?? input?.selectedConceptIndex,
    providerMeta,
  });
}

function uniqueStringList(values = []) {
  const seen = new Set();
  const list = [];
  for (const value of Array.isArray(values) ? values : [values]) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(normalized);
  }
  return list;
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
        "모바일 기준으로 작성한다. PC 레이아웃/자산 승인을 최종 기준으로 승격하지 않는다.",
        "1열 흐름, 터치 타겟, 세로 스크롤 리듬, 모바일 safe area를 우선한다.",
        "자산 registry에 mo variant가 있으면 mo variant만 최종 후보로 사용한다.",
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
        "태블릿 기준으로 작성한다. PC 위계를 좁은 폭에 맞춰 재검토한다.",
        "tablet variant가 있으면 우선 사용하고 없을 때만 승인된 pc fallback을 사용한다.",
      ],
    };
  }
  return {
    viewportProfile: "pc",
    viewportMode: "desktop",
    viewportLabel: "PC",
    assetVariantPolicy: "use-pc-variants-only",
    viewportGuidance: [
      "PC 기준으로 작성한다. 모바일 전용 레이아웃/자산 승인을 최종 기준으로 사용하지 않는다.",
      "넓은 가로폭, 다단 구성, 큰 hero safe area를 기준으로 설계한다.",
      "자산 registry에 pc variant가 있으면 pc variant만 최종 후보로 사용한다.",
    ],
  };
}

function humanizeSlotLabel(slotId = "", componentId = "") {
  const normalizedSlotId = String(slotId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const slotLabelMap = {
    hero: "히어로",
    quickmenu: "퀵메뉴",
    summary: "요약",
    sticky: "구매 박스",
    mainService: "주요 서비스",
    bestcare: "안심 케어",
  };
  if (slotLabelMap[normalizedSlotId]) return slotLabelMap[normalizedSlotId];
  return normalizedSlotId || normalizedComponentId.split(".").pop() || "섹션";
}

function buildRequirementPlanFromPlanningPreview(preview = {}, options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const request = preview?.request && typeof preview.request === "object" ? preview.request : {};
  const viewportMeta = normalizeViewportAuthoringMeta(source.viewportProfile || request.viewportProfile || request.viewportMode || "pc");
  const plannerBrief = preview?.plannerBrief && typeof preview.plannerBrief === "object" ? preview.plannerBrief : {};
  const pageIdentity = request.pageIdentity && typeof request.pageIdentity === "object" ? request.pageIdentity : {};
  const designPolicy = request.designPolicy && typeof request.designPolicy === "object" ? request.designPolicy : {};
  const targetGroup = request.targetGroup && typeof request.targetGroup === "object" ? request.targetGroup : {};
  const selectedConcept = plannerBrief.selectedConcept && typeof plannerBrief.selectedConcept === "object"
    ? plannerBrief.selectedConcept
    : {};
  const executionBrief = plannerBrief.executionBrief && typeof plannerBrief.executionBrief === "object"
    ? plannerBrief.executionBrief
    : {};
  const targetComponents = Array.isArray(targetGroup.componentIds) ? targetGroup.componentIds.slice(0, 24) : [];
  const slotIds = Array.isArray(targetGroup.slotIds) ? targetGroup.slotIds.slice(0, 24) : [];
  const requestSummary = uniqueStringList([
    ...toStringArray(designPolicy.problemStatement).slice(0, 2),
    ...toStringArray(designPolicy.hierarchyGoals).slice(0, 1),
    selectedConcept.conceptLabel ? `선택 컨셉: ${selectedConcept.conceptLabel}` : "",
  ]).slice(0, 4);
  const planningDirection = uniqueStringList([
    ...toStringArray(designPolicy.hierarchyGoals),
    ...toStringArray(targetGroup.layoutIntent),
    targetGroup.groupLabel ? `${targetGroup.groupLabel}를 하나의 흐름으로 다룹니다.` : "",
  ]).slice(0, 6);
  const designDirection = uniqueStringList([
    selectedConcept.layoutSystem ? `레이아웃 시스템: ${selectedConcept.layoutSystem}` : "",
    selectedConcept.typography?.headline ? `타이포: ${selectedConcept.typography.headline} 중심` : "",
    selectedConcept.colorSystem?.baseSurface ? `기본 배경: ${selectedConcept.colorSystem.baseSurface}` : "",
    selectedConcept.colorSystem?.accent ? `포인트 컬러: ${selectedConcept.colorSystem.accent}` : "",
    selectedConcept.promotionTonePolicy ? `프로모션 톤: ${selectedConcept.promotionTonePolicy}` : "",
  ]).slice(0, 6);
  const guardrails = uniqueStringList([
    `Asset variant policy: ${source.assetVariantPolicy || viewportMeta.assetVariantPolicy}`,
    ...viewportMeta.viewportGuidance,
    ...toStringArray(designPolicy.guardrails),
  ]).slice(0, 12);
  const mustKeep = uniqueStringList(designPolicy.mustKeep).slice(0, 4);
  const mustChange = uniqueStringList(designPolicy.mustChange).slice(0, 4);
  const sectionBlueprints = targetComponents.map((componentId, index) => {
    const slotId = String(slotIds[index] || componentId.split(".").pop() || `slot-${index + 1}`).trim();
    const label = humanizeSlotLabel(slotId, componentId);
    return {
      order: index + 1,
      slotId,
      label,
      archetype: selectedConcept.layoutSystem || targetGroup.groupLabel || "cluster-section",
      objective: executionBrief.northStar?.[0] || pageIdentity.userGoal || "",
      problemStatement: requestSummary[0] || "",
      visualDirection: selectedConcept.layoutSystem || "",
      hierarchy: planningDirection[index] || planningDirection[0] || "",
      actionCue: targetGroup.layoutIntent?.[index] || targetGroup.layoutIntent?.[0] || "",
      why: requestSummary[index] || requestSummary[0] || "",
      visual: designDirection[index] || designDirection[0] || "",
      keep: mustKeep[index] || mustKeep[0] || "",
      change: mustChange[index] || mustChange[0] || "",
      mustKeep: mustKeep[index] || mustKeep[0] || "",
      mustChange: mustChange[index] || mustChange[0] || "",
    };
  });
  const title = String(
    source.title ||
    source.requestTitle ||
    (targetGroup.groupLabel ? `${targetGroup.groupLabel} 로컬 기획서` : `${request.pageId || "page"} 로컬 기획서`)
  ).trim();
  const builderMarkdown = [
    `# ${title}`,
    "",
    "## 문제 정의",
    ...requestSummary.map((item) => `- ${item}`),
    "",
    "## 유지할 것",
    ...mustKeep.map((item) => `- ${item}`),
    "",
    "## 반드시 바꿀 것",
    ...mustChange.map((item) => `- ${item}`),
    "",
    "## 선택 컨셉",
    `- ${selectedConcept.conceptLabel || "기본 컨셉"}`,
    "",
    "## Viewport / Asset Variant",
    `- viewportProfile: ${viewportMeta.viewportProfile}`,
    `- viewportMode: ${viewportMeta.viewportMode}`,
    `- assetVariantPolicy: ${source.assetVariantPolicy || viewportMeta.assetVariantPolicy}`,
    ...viewportMeta.viewportGuidance.map((item) => `- ${item}`),
    "",
    "## 타겟 그룹",
    `- ${targetGroup.groupLabel || targetGroup.groupId || "target-group"}`,
    ...sectionBlueprints.map((item) => `- ${item.label}: ${item.change || item.visual || item.why || "방향 정리"}`),
  ].join("\n");
  const designSpecMarkdown = [
    `# ${title} Design Spec`,
    "",
    "## North Star",
    ...uniqueStringList(executionBrief.northStar).map((item) => `- ${item}`),
    "",
    "## Guardrails",
    ...guardrails.map((item) => `- ${item}`),
    "",
    "## Viewport Contract",
    `- viewportProfile: ${viewportMeta.viewportProfile}`,
    `- viewportMode: ${viewportMeta.viewportMode}`,
    `- assetVariantPolicy: ${source.assetVariantPolicy || viewportMeta.assetVariantPolicy}`,
    ...viewportMeta.viewportGuidance.map((item) => `- ${item}`),
    "",
    "## Builder Instructions",
    ...uniqueStringList(executionBrief.builderInstructions).map((item) => `- ${item}`),
    "",
    "## Section Blueprints",
    ...sectionBlueprints.flatMap((item) => [
      `### ${item.label}`,
      `- slotId: ${item.slotId}`,
      `- objective: ${item.objective || "목표 정리"}`,
      `- visualDirection: ${item.visual || item.visualDirection || "시각 방향 정리"}`,
      `- mustKeep: ${item.keep || item.mustKeep || ""}`,
      `- mustChange: ${item.change || item.mustChange || ""}`,
      "",
    ]),
  ].join("\n");
  return {
    title,
    viewportProfile: viewportMeta.viewportProfile,
    viewportMode: viewportMeta.viewportMode,
    viewportLabel: viewportMeta.viewportLabel,
    assetVariantPolicy: source.assetVariantPolicy || viewportMeta.assetVariantPolicy,
    viewportGuidance: viewportMeta.viewportGuidance,
    designChangeLevel: String(source.designChangeLevel || "medium").trim() || "medium",
    interventionLayer: String(source.interventionLayer || "section").trim() || "section",
    patchDepth: String(source.patchDepth || "medium").trim() || "medium",
    targetGroupId: String(targetGroup.groupId || source.targetGroupId || "").trim(),
    targetGroupLabel: String(targetGroup.groupLabel || source.targetGroupLabel || "").trim(),
    targetComponents,
    requestSummary,
    planningDirection,
    designDirection,
    priority: sectionBlueprints.map((item, index) => ({
      order: index + 1,
      target: item.label,
      reason: item.change || item.visual || item.why || "",
    })),
    guardrails,
    referenceNotes: uniqueStringList([
      preview?.providerMeta?.scenarioLabel ? `scenario=${preview.providerMeta.scenarioLabel}` : "",
      pageIdentity.character ? `identity=${pageIdentity.character}` : "",
    ]).slice(0, 4),
    builderBrief: {
      objective: executionBrief.northStar?.[0] || pageIdentity.userGoal || "",
      viewportProfile: viewportMeta.viewportProfile,
      viewportMode: viewportMeta.viewportMode,
      assetVariantPolicy: source.assetVariantPolicy || viewportMeta.assetVariantPolicy,
      viewportGuidance: viewportMeta.viewportGuidance,
      mustKeep,
      mustChange,
      suggestedFocusSlots: slotIds.slice(0, 4),
    },
    builderMarkdown,
    designSpecMarkdown,
    sectionBlueprints,
    conceptPlans: Array.isArray(plannerBrief.conceptPlans) ? plannerBrief.conceptPlans.slice(0, 4) : [],
    selectedConcept,
    planningPackage: {
      providerMeta: preview?.providerMeta || null,
      executionBrief,
      viewport: {
        viewportProfile: viewportMeta.viewportProfile,
        viewportMode: viewportMeta.viewportMode,
        viewportLabel: viewportMeta.viewportLabel,
        assetVariantPolicy: source.assetVariantPolicy || viewportMeta.assetVariantPolicy,
        viewportGuidance: viewportMeta.viewportGuidance,
      },
      pageIdentity,
      designPolicy,
    },
  };
}

function createLocalPlanningFoundation(input = {}, options = {}) {
  const brief = runLocalPlanningProvider(input, options);
  const draft = buildDesignDraftSkeleton(brief);
  const cloneRequest = buildCanonicalCloneRequest({
    snapshotState: "after",
    cloneRenderModel: draft.cloneRenderModel,
  });
  return {
    providerMeta: brief.providerMeta,
    request: brief.request,
    validation: brief.validation,
    plannerBrief: brief.plannerBrief,
    draft,
    cloneRequest,
  };
}

module.exports = {
  LOCAL_PLANNING_SCENARIOS,
  inferLocalPlanningScenarioId,
  listLocalPlanningScenarios,
  getLocalPlanningScenario,
  runLocalPlanningProvider,
  buildRequirementPlanFromPlanningPreview,
  createLocalPlanningFoundation,
};
