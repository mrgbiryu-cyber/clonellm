"use strict";

const llmHelpers = require("../llm");
const {
  resolveOpenRouterModel,
  resolveOpenRouterModelCandidates,
  logModelFallbackFailure,
  isRetryableOpenRouterFailure,
  buildReferenceVisualUserContent,
  measureMessageChars,
  resolveOpenRouterMaxTokens,
  callOpenRouterJson,
  withLlmTimeout,
  toStringArray,
  normalizeDesignChangeLevel,
  normalizePatchDepth,
  uniqueNonEmptyLines,
  buildBuilderSystemPrompt,
  buildBuilderUserPrompt,
  buildDemoBuilderResult,
  normalizeComposerAssetBindings,
  handleLlmCompose,
  normalizeBuilderResult,
} = llmHelpers;
const { runLocalBuilderProvider } = require("./provider-local");
const {
  mergeComposerContractsIntoComposition,
  applyReplacementFirstOperations,
  runStructuralCriticFixLoop,
} = require("./engine-helpers");

async function runV2Engine({ builderInput, currentData }) {
  const builderProvider = String(builderInput?.generationOptions?.builderProvider || "openrouter").trim() || "openrouter";
  let compositionResult = null;
  let result = null;
  if (builderProvider === "local") {
    const localProviderResult = await runLocalBuilderProvider(builderInput);
    if (localProviderResult?.rawResult) {
      compositionResult = localProviderResult.compositionResult || null;
      result = localProviderResult.rawResult;
      console.log(
        `[detailer-v2] provider=local page=${String(builderInput?.pageContext?.workspacePageId || "")} surface=${String(builderInput?.generationOptions?.rendererSurface || "custom")} targets=${Array.isArray(builderInput?.generationOptions?.targetComponents) ? builderInput.generationOptions.targetComponents.length : 0}`
      );
    } else {
      result = buildDemoBuilderResult(builderInput);
      console.warn(
        `[detailer-v2] provider=local unsupported page=${String(builderInput?.pageContext?.workspacePageId || "")} surface=${String(builderInput?.generationOptions?.rendererSurface || "custom")} - using local demo fallback instead of external model`
      );
    }
  }
  if (!result) {
    compositionResult = await handleLlmCompose(builderInput);
  }
  const detailerInput = {
    ...builderInput,
    compositionResult,
  };
  if (!result) {
    const primaryModel = resolveOpenRouterModel("BUILDER_MODEL", "OPENROUTER_MODEL");
    const fallbackModels = resolveOpenRouterModelCandidates("BUILDER_FALLBACK_MODEL")
      .filter((model) => model !== primaryModel);
    const builderTimeoutMs = Math.max(90_000, Number(process.env.BUILDER_REQUEST_TIMEOUT_MS || process.env.LLM_REQUEST_TIMEOUT_MS || 180_000));
    const builderMaxTokens = resolveOpenRouterMaxTokens(process.env.BUILDER_MAX_TOKENS, 2048);
    const designChangeLevel = normalizeDesignChangeLevel(detailerInput?.generationOptions?.designChangeLevel, "medium");
    const patchDepth = normalizePatchDepth(
      detailerInput?.generationOptions?.patchDepth,
      designChangeLevel === "low" ? "light" : designChangeLevel === "high" ? "strong" : "medium"
    );
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
      `[detailer-v2] model=${primaryModel} timeoutMs=${builderTimeoutMs} promptChars=${builderPromptChars} page=${String(detailerInput?.pageContext?.workspacePageId || "")} layer=${String(detailerInput?.generationOptions?.interventionLayer || "page")} depth=${String(detailerInput?.generationOptions?.patchDepth || "medium")} composerTree=${Array.isArray(compositionResult?.composition?.compositionTree) ? compositionResult.composition.compositionTree.length : 0}`
    );
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
      console.warn(`[detailer-v2] primary-failed model=${primaryModel} reason=${String(error?.message || error || "").trim()}`);
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
          logModelFallbackFailure("detailer-v2", fallbackModel, fallbackError);
          lastFallbackError = fallbackError;
          if (!isRetryableOpenRouterFailure(fallbackError)) throw fallbackError;
        }
      }
      if (!recovered) throw lastFallbackError;
    }
  }
  const normalizedResult = normalizeBuilderResult(result, detailerInput);
  mergeComposerContractsIntoComposition({
    normalizedResult,
    compositionResult,
    detailerInput,
    helpers: llmHelpers,
  });
  applyReplacementFirstOperations({
    normalizedResult,
    compositionResult,
    detailerInput,
    helpers: llmHelpers,
  });
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
  if (!Array.isArray(normalizedResult?.buildResult?.operations) || !normalizedResult.buildResult.operations.length) {
    const page = String(detailerInput?.pageContext?.workspacePageId || "").trim();
    const provider = String(detailerInput?.generationOptions?.builderProvider || "openrouter").trim() || "openrouter";
    const surface = String(detailerInput?.generationOptions?.rendererSurface || "custom").trim() || "custom";
    const error = new Error(`builder_v2_no_operations page=${page} provider=${provider} surface=${surface}`);
    error.code = "builder_v2_no_operations";
    throw error;
  }
  console.log(
    `[detailer-v2] normalized page=${String(detailerInput?.pageContext?.workspacePageId || "")} operations=${Array.isArray(normalizedResult?.buildResult?.operations) ? normalizedResult.buildResult.operations.length : 0} componentComposition=${Array.isArray(normalizedResult?.buildResult?.report?.componentComposition) ? normalizedResult.buildResult.report.componentComposition.length : 0}`
  );
  const componentComposition = Array.isArray(normalizedResult?.buildResult?.report?.componentComposition)
    ? normalizedResult.buildResult.report.componentComposition
    : [];
  const primitiveEntries = componentComposition.filter((item) => item?.primitiveTree && typeof item.primitiveTree === "object");
  const missingPrimitiveEntries = componentComposition
    .filter((item) => !(item?.primitiveTree && typeof item.primitiveTree === "object"))
    .map((item) => String(item?.componentId || item?.slotId || "").trim())
    .filter(Boolean);
  console.log(
    `[builder-v2] primitive-coverage page=${String(detailerInput?.pageContext?.workspacePageId || "")} total=${componentComposition.length} withPrimitive=${primitiveEntries.length} withoutPrimitive=${missingPrimitiveEntries.length} primitiveTargets=${primitiveEntries.map((item) => String(item?.componentId || item?.slotId || "").trim()).filter(Boolean).join(",") || "none"} missingTargets=${missingPrimitiveEntries.join(",") || "none"}`
  );
  const structuralResult = await runStructuralCriticFixLoop({
    normalizedResult,
    detailerInput,
    currentData,
    helpers: llmHelpers,
  });
  return {
    engineId: "builder-v2-engine-v1",
    result: structuralResult.result,
  };
}

module.exports = {
  runV2Engine,
};
