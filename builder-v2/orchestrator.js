"use strict";

const { normalizeBuilderV2Request } = require("./contracts");

function sanitizeVisualAssetList(assets = [], log, context = "reference-assets") {
  const normalizedAssets = Array.isArray(assets) ? assets : [];
  const kept = [];
  const dropped = [];
  normalizedAssets.forEach((item, index) => {
    const asset = item && typeof item === "object" ? item : null;
    const id = String(asset?.id || "").trim();
    const imageDataUrl = String(asset?.imageDataUrl || "").trim();
    if (!asset || !id || !/^data:image\//.test(imageDataUrl)) {
      dropped.push({
        index,
        id: id || null,
        reason: !asset ? "non-object" : !id ? "missing-id" : "invalid-imageDataUrl",
      });
      return;
    }
    kept.push({
      ...asset,
      id,
      label: String(asset?.label || id).trim(),
      sourceName: String(asset?.sourceName || "").trim(),
      sourceClass: String(asset?.sourceClass || "").trim(),
      targetLayer: String(asset?.targetLayer || "").trim(),
      targetComponents: Array.isArray(asset?.targetComponents)
        ? asset.targetComponents.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 8)
        : [],
      why: Array.isArray(asset?.why) ? asset.why.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 4) : [],
      avoid: Array.isArray(asset?.avoid) ? asset.avoid.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 4) : [],
      sourceUrl: String(asset?.sourceUrl || "").trim(),
      imageDataUrl,
    });
  });
  if (dropped.length) {
    log?.(
      `[builder-v2] ${context}-sanitized kept=${kept.length} dropped=${dropped.length} reasons=${dropped.map((item) => `${item.id || item.index}:${item.reason}`).join(",")}`
    );
  }
  return kept;
}

function ensureReferenceLibraryContainer(builderInput = {}) {
  builderInput.systemContext = builderInput.systemContext && typeof builderInput.systemContext === "object"
    ? builderInput.systemContext
    : {};
  builderInput.systemContext.designReferenceLibrary =
    builderInput.systemContext.designReferenceLibrary && typeof builderInput.systemContext.designReferenceLibrary === "object"
      ? builderInput.systemContext.designReferenceLibrary
      : {};
  return builderInput.systemContext.designReferenceLibrary;
}

async function runBuilderV2({
  user,
  payload,
  matchedPlan,
  pageId,
  viewportProfile,
  pageIdentityOverride,
  approvedPlan,
  data,
  designChangeLevel,
  interventionLayer,
  patchDepth,
  targetScope,
  targetComponents,
  targetGroupId,
  targetGroupLabel,
  deps,
}) {
  const request = normalizeBuilderV2Request(payload, matchedPlan);
  if (request?.validation?.valid === false) {
    return {
      blocked: true,
      response: {
        statusCode: 400,
        body: {
          error: "builder_v2_invalid_request",
          validation: request.validation,
        },
      },
    };
  }
  const {
    setProgress,
    log,
    buildBuilderInputPayload,
    extractPageScopedSnapshot,
    materializeReferenceVisualAssets,
    materializeCloneTargetReferenceAssets,
    materializeWholePageContextVisualAssets,
    evaluateBuilderSufficiencyGate,
    materializeSufficiencyRecoveryVisualAssets,
    normalizePatchDepth,
    materializeGeneratedBuildAssets,
    applyGeneratedAssetsToBuildResult,
    getGeneratedAssetCountFromBuildResult,
    engine,
  } = deps;

  setProgress?.({
    status: "running",
    stage: "prepare_input",
    message: "V2 빌더가 실행 범위와 실행 surface를 준비하고 있습니다.",
    percent: 28,
  });

  const beforePageSnapshot = extractPageScopedSnapshot(data, pageId, viewportProfile);
  const builderInput = buildBuilderInputPayload({
    editableData: data,
    pageId,
    viewportProfile,
    pageIdentityOverride,
    approvedPlan,
    intensity: request.intensity,
    versionLabelHint: request.versionLabelHint,
    designChangeLevel,
    interventionLayer,
    patchDepth,
    targetScope,
    targetComponents,
    targetGroupId,
    targetGroupLabel,
    builderVersion: request.builderVersion,
    builderMode: request.builderMode,
    builderProvider: request.builderProvider,
    rendererSurface: request.rendererSurface,
  });

  log?.(
    `[builder-v2] input-context user=${user.userId} page=${pageId} editableComponents=${Array.isArray(builderInput?.systemContext?.editableComponents) ? builderInput.systemContext.editableComponents.length : 0} sidecarSections=${Array.isArray(builderInput?.systemContext?.artifactSidecarRegistry?.sections) ? builderInput.systemContext.artifactSidecarRegistry.sections.length : 0}`
  );

  let referenceVisualAssets = sanitizeVisualAssetList(
    await materializeReferenceVisualAssets(builderInput),
    log,
    "reference-assets"
  );
  if (referenceVisualAssets.length) {
    ensureReferenceLibraryContainer(builderInput).referenceVisualAssets = referenceVisualAssets;
    log?.(
      `[builder-v2] reference-assets user=${user.userId} page=${pageId} count=${referenceVisualAssets.length} ids=${referenceVisualAssets.map((item) => item.id).join(",")}`
    );
  }

  const currentRequiredReferenceCount = ["strong", "full"].includes(normalizePatchDepth(builderInput?.generationOptions?.patchDepth, "medium")) ? 2 : 1;
  if (referenceVisualAssets.length < currentRequiredReferenceCount) {
    const cloneReferenceAssets = sanitizeVisualAssetList(
      await materializeCloneTargetReferenceAssets(builderInput, {
        userId: user.userId,
        pageId,
        viewportProfile,
        editableData: data,
      }),
      log,
      "clone-reference-assets"
    );
    if (cloneReferenceAssets.length) {
      referenceVisualAssets = [...cloneReferenceAssets, ...referenceVisualAssets];
      ensureReferenceLibraryContainer(builderInput).referenceVisualAssets = referenceVisualAssets;
      log?.(
        `[builder-v2] clone-reference-assets user=${user.userId} page=${pageId} count=${cloneReferenceAssets.length} ids=${cloneReferenceAssets.map((item) => item.id).join(",")}`
      );
    }
  }

  const wholePageContextAssets = sanitizeVisualAssetList(
    await materializeWholePageContextVisualAssets(builderInput, {
      userId: user.userId,
      pageId,
      viewportProfile,
      editableData: data,
    }),
    log,
    "whole-page-context-assets"
  );
  if (wholePageContextAssets.length) {
    ensureReferenceLibraryContainer(builderInput).wholePageContextAssets = wholePageContextAssets;
    log?.(
      `[builder-v2] whole-page-context user=${user.userId} page=${pageId} count=${wholePageContextAssets.length} ids=${wholePageContextAssets.map((item) => item.id).join(",")}`
    );
  }

  let sufficiencyGate = evaluateBuilderSufficiencyGate(builderInput, {
    referenceVisualAssets,
    wholePageContextAssets,
  });
  if (sufficiencyGate.status !== "ready") {
    setProgress?.({
      status: "running",
      stage: "asset_recovery",
      message: "V2 빌더가 레퍼런스/자산 충분성을 먼저 보강하고 있습니다.",
      percent: 44,
      detail: {
        recoveryMode: sufficiencyGate.recoveryMode,
        missingDimensions: sufficiencyGate.missingDimensions,
      },
    });
    const recoveryVisualAssets = sanitizeVisualAssetList(
      await materializeSufficiencyRecoveryVisualAssets(builderInput, sufficiencyGate),
      log,
      "sufficiency-recovery-assets"
    );
    if (recoveryVisualAssets.length) {
      referenceVisualAssets = [...recoveryVisualAssets, ...referenceVisualAssets];
      ensureReferenceLibraryContainer(builderInput).referenceVisualAssets = referenceVisualAssets;
      log?.(
        `[builder-v2] sufficiency-recovery user=${user.userId} page=${pageId} count=${recoveryVisualAssets.length} ids=${recoveryVisualAssets.map((item) => item.id).join(",")}`
      );
      sufficiencyGate = evaluateBuilderSufficiencyGate(builderInput, {
        referenceVisualAssets,
        wholePageContextAssets,
      });
    }
  }

  builderInput.systemContext = builderInput.systemContext && typeof builderInput.systemContext === "object"
    ? builderInput.systemContext
    : {};
  builderInput.systemContext.sufficiencyGate = sufficiencyGate;
  log?.(
    `[builder-v2] sufficiency-gate user=${user.userId} page=${pageId} status=${sufficiencyGate.status} recoveryMode=${sufficiencyGate.recoveryMode} missing=${sufficiencyGate.missingDimensions.join(",") || "none"}`
  );

  if (sufficiencyGate.blocking && sufficiencyGate.status !== "ready") {
    return {
      blocked: true,
      response: {
        statusCode: 409,
        body: {
          error: "reference_asset_sufficiency_failed",
          sufficiencyGate,
        },
      },
    };
  }

  setProgress?.({
    status: "running",
    stage: "model_generation",
    message: "V2 빌더가 primitive/replacement-first 결과를 생성하고 있습니다.",
    percent: 64,
    detail: {
      editableComponentCount: Array.isArray(builderInput?.systemContext?.editableComponents)
        ? builderInput.systemContext.editableComponents.length
        : 0,
    },
  });

  const engineResult = await engine.run({
    builderInput,
    currentData: data,
  });
  let buildResult = engineResult?.result || engineResult;

  log?.(
    `[builder-v2] pipeline user=${user.userId} page=${pageId} engine=${String(engineResult?.engineId || "unknown")} operations=${Array.isArray(buildResult?.buildResult?.operations) ? buildResult.buildResult.operations.length : 0} changedTargets=${Array.isArray(buildResult?.buildResult?.changedTargets) ? buildResult.buildResult.changedTargets.length : 0}`
  );

  let generatedBuildAssets = [];
  if (
    request.builderMode !== "compare" &&
    ["strong", "full"].includes(String(builderInput?.generationOptions?.patchDepth || "").trim())
  ) {
    setProgress?.({
      status: "running",
      stage: "asset_generation",
      message: "V2 빌더가 고임팩트 비주얼 자산을 생성하고 있습니다.",
      percent: 78,
    });
    generatedBuildAssets = await materializeGeneratedBuildAssets({
      userId: user.userId,
      pageId,
      viewportProfile,
      builderInput,
      buildResult: buildResult.buildResult || {},
    });
    if (generatedBuildAssets.length) {
      buildResult = {
        ...buildResult,
        buildResult: applyGeneratedAssetsToBuildResult(buildResult.buildResult || {}, generatedBuildAssets),
      };
      const generatedCounts = getGeneratedAssetCountFromBuildResult(buildResult.buildResult || {});
      log?.(
        `[builder-v2] generated-assets user=${user.userId} page=${pageId} count=${generatedBuildAssets.length} ids=${generatedBuildAssets.map((item) => item.asset.id).join(",")} reportGenerated=${generatedCounts.reportGenerated} componentGenerated=${generatedCounts.componentGenerated}`
      );
    }
  }

  return {
    blocked: false,
    builderVersion: request.builderVersion,
    builderMode: request.builderMode,
    builderProvider: request.builderProvider,
    rendererSurface: request.rendererSurface,
    beforePageSnapshot,
    builderInput,
    buildResult,
    generatedBuildAssets,
    referenceVisualAssets,
    wholePageContextAssets,
    sufficiencyGate,
  };
}

module.exports = {
  runBuilderV2,
};
