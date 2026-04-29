import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  runLocalPlanningProvider,
  buildRequirementPlanFromPlanningPreview,
  buildConceptPackageFromRequirementPlan,
  buildDesignAuthorInput,
} = require("../design-pipeline");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "").trim();
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function buildSimulatedSavedPlan(input = {}, preview = {}, requirementPlan = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    id: "simulated-local-plan",
    pageId: String(source.pageId || "").trim(),
    viewportProfile: String(source.viewportProfile || "pc").trim() || "pc",
    mode: "local-provider-preview",
    status: "draft",
    originType: "local-provider-saved",
    generatedBy: "design-pipeline-local",
    title: requirementPlan.title || "",
    summary: Array.isArray(requirementPlan.requestSummary) ? requirementPlan.requestSummary[0] || "" : "",
    designChangeLevel: requirementPlan.designChangeLevel || source.designChangeLevel || "",
    interventionLayer: requirementPlan.interventionLayer || source.interventionLayer || "",
    patchDepth: requirementPlan.patchDepth || source.patchDepth || "",
    targetGroupId: requirementPlan.targetGroupId || source.targetGroupId || "",
    targetGroupLabel: requirementPlan.targetGroupLabel || source.targetGroupLabel || "",
    targetComponents: Array.isArray(requirementPlan.targetComponents)
      ? requirementPlan.targetComponents
      : (Array.isArray(source.targetComponents) ? source.targetComponents : []),
    planningDirection: Array.isArray(requirementPlan.planningDirection) ? requirementPlan.planningDirection : [],
    designDirection: Array.isArray(requirementPlan.designDirection) ? requirementPlan.designDirection : [],
    guardrails: Array.isArray(requirementPlan.guardrails) ? requirementPlan.guardrails : [],
    referenceNotes: Array.isArray(requirementPlan.referenceNotes) ? requirementPlan.referenceNotes : [],
    builderBrief: requirementPlan.builderBrief || null,
    builderMarkdown: String(requirementPlan.builderMarkdown || ""),
    designSpecMarkdown: String(requirementPlan.designSpecMarkdown || ""),
    sectionBlueprints: Array.isArray(requirementPlan.sectionBlueprints) ? requirementPlan.sectionBlueprints : [],
    conceptPlans: Array.isArray(requirementPlan.conceptPlans) ? requirementPlan.conceptPlans : [],
    selectedConcept: requirementPlan.selectedConcept || null,
    planningPackage: requirementPlan.planningPackage || null,
    input: {
      userInput: {
        requestText: String(source.requestText || "").trim(),
        keyMessage: String(source.keyMessage || "").trim(),
        preferredDirection: String(source.preferredDirection || "").trim(),
        avoidDirection: String(source.avoidDirection || "").trim(),
        toneAndMood: String(source.toneAndMood || "").trim(),
        referenceUrls: [],
        designChangeLevel: String(source.designChangeLevel || "medium").trim() || "medium",
        interventionLayer: String(source.interventionLayer || "section").trim() || "section",
        patchDepth: String(source.patchDepth || "medium").trim() || "medium",
        rendererSurface: String(source.rendererSurface || "tailwind").trim() || "tailwind",
        builderProvider: String(source.builderProvider || "local").trim() || "local",
        targetScope: String(source.targetScope || "section").trim() || "section",
        targetComponents: Array.isArray(source.targetComponents) ? source.targetComponents : [],
        targetGroupId: String(source.targetGroupId || "").trim(),
        targetGroupLabel: String(source.targetGroupLabel || "").trim(),
        scopePreset: String(source.scopePreset || "").trim(),
      },
    },
    output: {
      requirementPlan,
      providerResult: preview,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = {
    pageId: String(args["page-id"] || "home").trim(),
    viewportProfile: String(args["viewport-profile"] || "pc").trim() || "pc",
    rendererSurface: String(args["renderer-surface"] || "tailwind").trim() || "tailwind",
    builderProvider: "local",
    requestText: String(args["request-text"] || "상단 흐름을 더 정돈되고 브랜드 중심으로 재구성한다.").trim(),
    keyMessage: String(args["key-message"] || "히어로와 퀵메뉴 중심으로 브랜드 홈 상단을 재정리").trim(),
    preferredDirection: String(args["preferred-direction"] || "문제 정의, 정보 위계, 범위 통제 기준으로 상단 흐름을 다시 잡는다.").trim(),
    avoidDirection: String(args["avoid-direction"] || "과도한 할인몰 톤, 단일 슬롯 과장, 파편화된 대비는 피한다.").trim(),
    toneAndMood: String(args["tone-and-mood"] || "프리미엄 브랜드, 라이트 테마, 정제된 톤").trim(),
    designChangeLevel: String(args["design-change-level"] || "high").trim() || "high",
    interventionLayer: String(args["intervention-layer"] || "section-group").trim() || "section-group",
    patchDepth: String(args["patch-depth"] || "full").trim() || "full",
    targetScope: String(args["target-scope"] || "section").trim() || "section",
    targetGroupId: String(args["target-group-id"] || "top-stage").trim() || "top-stage",
    targetGroupLabel: String(args["target-group-label"] || "Top Stage Cluster").trim() || "Top Stage Cluster",
    scopePreset: String(args["scope-preset"] || "top-stage").trim() || "top-stage",
    targetComponents: String(args["target-components"] || "home.hero,home.quickmenu")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };

  const preview = runLocalPlanningProvider(input, {});
  const requirementPlan = buildRequirementPlanFromPlanningPreview(preview, {
    title: input.keyMessage,
    designChangeLevel: input.designChangeLevel,
    interventionLayer: input.interventionLayer,
    patchDepth: input.patchDepth,
    targetGroupId: input.targetGroupId,
    targetGroupLabel: input.targetGroupLabel,
  });
  const simulatedSavedPlan = buildSimulatedSavedPlan(input, preview, requirementPlan);
  const conceptPackage = buildConceptPackageFromRequirementPlan(simulatedSavedPlan, {
    targetGroupId: simulatedSavedPlan.targetGroupId,
    targetGroupLabel: simulatedSavedPlan.targetGroupLabel,
    targetScope: simulatedSavedPlan.input?.userInput?.targetScope,
    patchDepth: simulatedSavedPlan.patchDepth,
    designChangeLevel: simulatedSavedPlan.designChangeLevel,
  });
  const authorInput = buildDesignAuthorInput({
    pageId: simulatedSavedPlan.pageId,
    viewportProfile: simulatedSavedPlan.viewportProfile,
    conceptPackage,
    referenceContext: {
      currentPageHtmlExcerpt: "",
      currentPageAssetMap: {},
    },
    currentSectionContext: {
      currentSectionHtmlMap: {},
      currentSectionAssetMap: {},
    },
  });

  console.log(JSON.stringify({
    requirementPlan: {
      title: requirementPlan.title,
      targetGroupId: requirementPlan.targetGroupId,
      targetComponents: requirementPlan.targetComponents,
      sectionBlueprintCount: Array.isArray(requirementPlan.sectionBlueprints) ? requirementPlan.sectionBlueprints.length : 0,
      planningPackageKeys: requirementPlan.planningPackage ? Object.keys(requirementPlan.planningPackage) : [],
    },
    conceptPackage: {
      selectedConceptId: conceptPackage.selectedConceptId,
      targetGroup: conceptPackage.executionBrief?.targetGroup || {},
      sectionBlueprintCount: Array.isArray(conceptPackage.executionBrief?.sectionBlueprints)
        ? conceptPackage.executionBrief.sectionBlueprints.length
        : 0,
    },
    designAuthorPacket: {
      sectionCount: authorInput.packetStats?.sectionCount || 0,
      slotIds: Array.isArray(authorInput.designAuthorPacket?.sections)
        ? authorInput.designAuthorPacket.sections.map((item) => item.slotId)
        : [],
    },
  }, null, 2));

  if ((authorInput.packetStats?.sectionCount || 0) <= 0) {
    process.exitCode = 2;
  }
}

main();
