"use strict";

const MAX_COMPARE_FRESH_RERUNS = 1;
const MAX_VISUAL_FIX_PASSES = 1;
const MAX_RECOVERY_ROUTER_PASSES = 1;

function safeStructuredClone(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (error) {
      console.warn(`[builder-v2] structuredClone-fallback reason=${String(error?.message || error || "")}`);
    }
  }
  return JSON.parse(JSON.stringify(value || {}));
}

function buildVisualCriticErrorDetail(error, meta = {}) {
  return {
    stage: String(meta?.stage || "visual-critic").trim(),
    mode: String(meta?.mode || "standard").trim(),
    pageId: String(meta?.pageId || "").trim(),
    draftBuildId: String(meta?.draftBuildId || "").trim(),
    compareAttempt: Number(meta?.compareAttempt || 0),
    visualFixAttempt: Number(meta?.visualFixAttempt || 0),
    recoveryAttempt: Number(meta?.recoveryAttempt || 0),
    message: String(error?.message || error || "visual critic unavailable").trim() || "visual critic unavailable",
    stack: String(error?.stack || "").trim().split("\n").slice(0, 4),
  };
}

async function finalizeBuilderV2CompareRun({
  user,
  pageId,
  viewportProfile,
  planId,
  intensity,
  builderVersion,
  designChangeLevel,
  interventionLayer,
  patchDepth,
  targetGroupId,
  targetGroupLabel,
  versionLabelHint,
  builderInput,
  buildResult,
  generatedBuildAssets,
  beforePageSnapshot,
  sourceData,
  deps,
}) {
  const {
    setProgress,
    saveDataForUser,
    extractPageScopedSnapshot,
    mergeGeneratedAssetsIntoReport,
    saveDraftBuild,
    buildPreviewUrlForWorkspacePage,
    normalizeGeneratedRuntimeAsset,
    runVisualCriticForDraft,
    engine,
    buildVisualCriticFailurePayload,
  } = deps;

  const persistDraft = (savedDraft, activeBuilderInput, activeBuildResult, status = "draft", extras = {}, forceNew = false) => {
    const nextData = activeBuildResult.data || sourceData;
    saveDataForUser(user, nextData, activeBuildResult.summary || `llm_build:${pageId}`);
    const changedComponentIds = Array.from(
      new Set(
        (activeBuildResult.buildResult?.changedTargets || [])
          .map((item) => String(item.componentId || "").trim())
          .filter(Boolean)
      )
    );
    const pageSnapshot = extractPageScopedSnapshot(nextData, pageId);
    const reportToSave = generatedBuildAssets.length
      ? mergeGeneratedAssetsIntoReport(activeBuildResult.buildResult?.report || {}, generatedBuildAssets)
      : (activeBuildResult.buildResult?.report || {});
    const nextSaved = saveDraftBuild(user.userId, {
      ...(savedDraft || {}),
      id: forceNew ? "" : (savedDraft?.id || ""),
      pageId,
      viewportProfile,
      planId: planId || "",
      builderVersion,
      builderProvider: String(activeBuilderInput?.generationOptions?.builderProvider || "openrouter").trim() || "openrouter",
      rendererSurface: String(activeBuilderInput?.generationOptions?.rendererSurface || "custom").trim() || "custom",
      status,
      summary: activeBuildResult.summary || "",
      proposedVersionLabel: activeBuildResult.buildResult?.proposedVersionLabel || versionLabelHint || "",
      operations: activeBuildResult.buildResult?.operations || [],
      report: reportToSave,
      snapshotData: {
        ...(savedDraft?.snapshotData && typeof savedDraft.snapshotData === "object" ? savedDraft.snapshotData : {}),
        changedComponentIds,
        previewUrl: buildPreviewUrlForWorkspacePage(pageId),
        intensity,
        builderVersion,
        builderMode: String(activeBuilderInput?.generationOptions?.builderMode || "standard").trim() || "standard",
        builderProvider: String(activeBuilderInput?.generationOptions?.builderProvider || "openrouter").trim() || "openrouter",
        rendererSurface: String(activeBuilderInput?.generationOptions?.rendererSurface || "custom").trim() || "custom",
        designChangeLevel,
        executionMode: activeBuilderInput?.systemContext?.executionStrategy?.executionMode || null,
        interventionLayer,
        patchDepth,
        targetGroupId,
        targetGroupLabel,
        critic: reportToSave?.critic || null,
        generatedAssets: generatedBuildAssets.map((item) => normalizeGeneratedRuntimeAsset(item.asset)).filter((entry) => entry.assetUrl),
        beforePageSnapshot,
        pageSnapshot,
        ...extras,
      },
    });
    return { saved: nextSaved, nextData, changedComponentIds, pageSnapshot, reportToSave };
  };

  const saveVisualGate = (savedDraft, activeBuildResult, visualCritic, status) =>
    saveDraftBuild(user.userId, {
      ...savedDraft,
      id: savedDraft?.id || "",
      status,
      report: generatedBuildAssets.length
        ? mergeGeneratedAssetsIntoReport(
            {
              ...(savedDraft?.report && typeof savedDraft.report === "object" ? savedDraft.report : {}),
              critic: {
                ...(savedDraft?.report?.critic && typeof savedDraft.report.critic === "object" ? savedDraft.report.critic : {}),
                retryTrigger: visualCritic.report?.retryTrigger || null,
                visualComparison: visualCritic.report,
              },
            },
            generatedBuildAssets
          )
        : {
            ...(savedDraft?.report && typeof savedDraft.report === "object" ? savedDraft.report : {}),
            critic: {
              ...(savedDraft?.report?.critic && typeof savedDraft.report.critic === "object" ? savedDraft.report.critic : {}),
              retryTrigger: visualCritic.report?.retryTrigger || null,
              visualComparison: visualCritic.report,
            },
          },
      snapshotData: {
        ...(savedDraft?.snapshotData && typeof savedDraft.snapshotData === "object" ? savedDraft.snapshotData : {}),
        qualityGate: visualCritic.qualityGate || null,
        visualCriticAssets: visualCritic.assets || null,
        visualCriticRaw: visualCritic.rawResult || null,
      },
    });

  setProgress?.({
    status: "running",
    stage: "save_result",
    message: "compare 모드 초안을 저장하고 1차 시각 판정을 수행하고 있습니다.",
    percent: 90,
  });

  let activeBuilderInput = builderInput;
  let activeBuildResult = buildResult;
  let savedState = persistDraft(null, activeBuilderInput, activeBuildResult, "draft");
  let saved = savedState.saved;
  let firstDraftId = saved?.id || "";
  let nextData = savedState.nextData;
  let changedComponentIds = savedState.changedComponentIds;
  let hardVisualGateFailed = false;
  let executionVisualGateFailed = false;
  let visualCriticFailure = null;
  let compareAttempt = Number(activeBuilderInput?.systemContext?.compareMode?.attempt || 0) || 0;

  try {
    let visualCritic = await runVisualCriticForDraft({
      userId: user.userId,
      pageId,
      viewportProfile,
      draftBuildId: saved?.id || "",
      builderInput: activeBuilderInput,
      buildResult: activeBuildResult.buildResult || {},
    });
    if (!visualCritic?.report) {
      throw new Error("visual critic report unavailable");
    }
    const firstGate = visualCritic?.qualityGate && typeof visualCritic.qualityGate === "object" ? visualCritic.qualityGate : {};
    hardVisualGateFailed = Boolean(firstGate.qualityFailed);
    executionVisualGateFailed = Boolean(firstGate.executionFailed);
    saved = saveVisualGate(saved, activeBuildResult, visualCritic, executionVisualGateFailed ? "execution-failed" : hardVisualGateFailed ? "quality-failed" : "draft");

    const canFreshRerun =
      !executionVisualGateFailed &&
      hardVisualGateFailed &&
      compareAttempt < MAX_COMPARE_FRESH_RERUNS &&
      typeof engine?.run === "function";

    if (canFreshRerun) {
      setProgress?.({
        status: "running",
        stage: "fresh_rerun",
        message: "compare 모드가 critic 피드백을 반영해 새 초안을 한 번만 다시 생성하고 있습니다.",
        percent: 94,
      });
      const rerunBuilderInput = safeStructuredClone(activeBuilderInput);
      rerunBuilderInput.systemContext = rerunBuilderInput.systemContext && typeof rerunBuilderInput.systemContext === "object"
        ? rerunBuilderInput.systemContext
        : {};
      rerunBuilderInput.systemContext.compareMode = {
        enabled: true,
        attempt: compareAttempt + 1,
        strategy: "fresh-rerun",
        visualRetry: Boolean(visualCritic?.report?.retryTrigger?.shouldRetry),
        failedDimensions: Array.isArray(visualCritic?.report?.retryTrigger?.failedDimensions) ? visualCritic.report.retryTrigger.failedDimensions : [],
        findings: Array.isArray(visualCritic?.report?.findings) ? visualCritic.report.findings : [],
        instructions: Array.isArray(visualCritic?.report?.retryTrigger?.instructions) ? visualCritic.report.retryTrigger.instructions : [],
        visualAssets: visualCritic?.compareVisualAssets && typeof visualCritic.compareVisualAssets === "object"
          ? visualCritic.compareVisualAssets
          : null,
      };
      rerunBuilderInput.generationOptions = rerunBuilderInput.generationOptions && typeof rerunBuilderInput.generationOptions === "object"
        ? rerunBuilderInput.generationOptions
        : {};
      rerunBuilderInput.generationOptions.builderMode = "compare";
      const rerunEngineResult = await engine.run({
        builderInput: rerunBuilderInput,
        currentData: sourceData,
      });
      activeBuilderInput = rerunBuilderInput;
      compareAttempt = Number(rerunBuilderInput?.systemContext?.compareMode?.attempt || 0) || 0;
      activeBuildResult = rerunEngineResult?.result || rerunEngineResult;
      savedState = persistDraft(null, activeBuilderInput, activeBuildResult, "draft", {
        compareMode: {
          enabled: Boolean(rerunBuilderInput.systemContext?.compareMode?.enabled),
          attempt: Number(rerunBuilderInput.systemContext?.compareMode?.attempt || 0) || 0,
          strategy: rerunBuilderInput.systemContext?.compareMode?.strategy || "",
          visualRetry: Boolean(rerunBuilderInput.systemContext?.compareMode?.visualRetry),
          failedDimensions: Array.isArray(rerunBuilderInput.systemContext?.compareMode?.failedDimensions)
            ? rerunBuilderInput.systemContext.compareMode.failedDimensions
            : [],
          findings: Array.isArray(rerunBuilderInput.systemContext?.compareMode?.findings)
            ? rerunBuilderInput.systemContext.compareMode.findings
            : [],
          instructions: Array.isArray(rerunBuilderInput.systemContext?.compareMode?.instructions)
            ? rerunBuilderInput.systemContext.compareMode.instructions
            : [],
          visualAssets: rerunBuilderInput.systemContext?.compareMode?.visualAssets
            ? {
                beforeLabel: rerunBuilderInput.systemContext.compareMode.visualAssets.beforeLabel || null,
                afterLabel: rerunBuilderInput.systemContext.compareMode.visualAssets.afterLabel || null,
                referenceLabel: rerunBuilderInput.systemContext.compareMode.visualAssets.referenceLabel || null,
                targetSlots: Array.isArray(rerunBuilderInput.systemContext.compareMode.visualAssets.targetSlots)
                  ? rerunBuilderInput.systemContext.compareMode.visualAssets.targetSlots
                  : [],
              }
            : null,
          rootDraftBuildId: firstDraftId || null,
          previousDraftBuildId: saved?.id || null,
        },
      }, true);
      saved = savedState.saved;
      nextData = savedState.nextData;
      changedComponentIds = savedState.changedComponentIds;
      visualCritic = await runVisualCriticForDraft({
        userId: user.userId,
        pageId,
        viewportProfile,
        draftBuildId: saved?.id || "",
        builderInput: activeBuilderInput,
        buildResult: activeBuildResult.buildResult || {},
      });
      if (!visualCritic?.report) {
        throw new Error("visual critic report unavailable after compare rerun");
      }
      const secondGate = visualCritic?.qualityGate && typeof visualCritic.qualityGate === "object" ? visualCritic.qualityGate : {};
      hardVisualGateFailed = Boolean(secondGate.qualityFailed);
      executionVisualGateFailed = Boolean(secondGate.executionFailed);
      saved = saveVisualGate(saved, activeBuildResult, visualCritic, executionVisualGateFailed ? "execution-failed" : hardVisualGateFailed ? "quality-failed" : "draft");
    }
  } catch (error) {
    const failureDetail = buildVisualCriticErrorDetail(error, {
      stage: "compare-run",
      mode: "compare",
      pageId,
      draftBuildId: saved?.id || "",
      compareAttempt,
    });
    console.warn(
      `[visual-critic] compare-failed user=${user.userId} page=${pageId} build=${saved?.id || ""} attempt=${compareAttempt} reason=${failureDetail.message}`
    );
    visualCriticFailure = buildVisualCriticFailurePayload(`${failureDetail.stage}: ${failureDetail.message}`, activeBuilderInput);
    hardVisualGateFailed = true;
    executionVisualGateFailed = true;
    saved = saveDraftBuild(user.userId, {
      ...saved,
      id: saved?.id || "",
      status: "execution-failed",
      report: generatedBuildAssets.length
        ? mergeGeneratedAssetsIntoReport(
            {
              ...(saved?.report && typeof saved.report === "object" ? saved.report : {}),
              critic: {
                ...(saved?.report?.critic && typeof saved.report.critic === "object" ? saved.report.critic : {}),
                retryTrigger: visualCriticFailure.report.retryTrigger,
                visualComparison: visualCriticFailure.report,
                visualComparisonError: failureDetail,
              },
            },
            generatedBuildAssets
          )
        : {
            ...(saved?.report && typeof saved.report === "object" ? saved.report : {}),
            critic: {
              ...(saved?.report?.critic && typeof saved.report.critic === "object" ? saved.report.critic : {}),
              retryTrigger: visualCriticFailure.report.retryTrigger,
              visualComparison: visualCriticFailure.report,
              visualComparisonError: failureDetail,
            },
          },
      snapshotData: {
        ...(saved?.snapshotData && typeof saved.snapshotData === "object" ? saved.snapshotData : {}),
        qualityGate: visualCriticFailure.qualityGate,
        visualCriticAssets: visualCriticFailure.assets,
        visualCriticRaw: activeBuildResult?.buildResult?.report?.critic?.visualCriticRaw || null,
        visualCriticError: failureDetail,
      },
    });
  }

  return {
    saved,
    buildResult: activeBuildResult,
    nextData,
    changedComponentIds,
    hardVisualGateFailed,
    executionVisualGateFailed,
    visualCriticFailure,
  };
}

async function finalizeBuilderV2Run({
  user,
  pageId,
  viewportProfile,
  planId,
  intensity,
  builderVersion,
  designChangeLevel,
  interventionLayer,
  patchDepth,
  targetGroupId,
  targetGroupLabel,
  versionLabelHint,
  builderInput,
  buildResult,
  generatedBuildAssets,
  beforePageSnapshot,
  sourceData,
  deps,
}) {
  const builderMode = String(builderInput?.generationOptions?.builderMode || "standard").trim() || "standard";
  if (builderMode === "compare") {
    return finalizeBuilderV2CompareRun({
      user,
      pageId,
      viewportProfile,
      planId,
      intensity,
      builderVersion,
      designChangeLevel,
      interventionLayer,
      patchDepth,
      targetGroupId,
      targetGroupLabel,
      versionLabelHint,
      builderInput,
      buildResult,
      generatedBuildAssets,
      beforePageSnapshot,
      sourceData,
      deps,
    });
  }

  const {
    setProgress,
    saveDataForUser,
    extractPageScopedSnapshot,
    mergeGeneratedAssetsIntoReport,
    saveDraftBuild,
    buildPreviewUrlForWorkspacePage,
    normalizeGeneratedRuntimeAsset,
    runVisualCriticForDraft,
    toStringArray,
    handleLlmFix,
    enforceBuilderOperations,
    uniqueNonEmptyLines,
    applyGeneratedAssetsToBuildResult,
    normalizeEditableData,
    applyOperations,
    getGeneratedAssetCountFromBuildResult,
    resolveQualityRecoveryRoute,
    withRecoveryRouter,
    materializeGeneratedBuildAssets,
    buildVisualCriticFailurePayload,
  } = deps;

  const mapChangedTargetsFromOperations = (operations = []) =>
    Array.from(
      new Set(
        (Array.isArray(operations) ? operations : []).map((item) => `${String(item?.slotId || "").trim()}:${String(item?.action || "").trim()}`)
      )
    )
      .map((key) => {
        const [slotId, action] = key.split(":");
        return {
          slotId,
          componentId: `${pageId}.${slotId}`,
          changeType: action === "toggle_slot_source" ? "source_switch" : action === "replace_component_template" ? "template_replace" : "component_patch",
        };
      })
      .filter((item) => item.slotId);

  setProgress?.({
    status: "running",
    stage: "save_result",
    message: "생성된 draft를 저장하고 미리보기 반영을 준비하고 있습니다.",
    percent: 90,
  });

  let nextData = buildResult.data || sourceData;
  saveDataForUser(user, nextData, buildResult.summary || `llm_build:${pageId}`);

  let changedComponentIds = Array.from(
    new Set(
      (buildResult.buildResult?.changedTargets || [])
        .map((item) => String(item.componentId || "").trim())
        .filter(Boolean)
    )
  );
  let pageSnapshot = extractPageScopedSnapshot(nextData, pageId);
  const initialReportToSave = generatedBuildAssets.length
    ? mergeGeneratedAssetsIntoReport(buildResult.buildResult?.report || {}, generatedBuildAssets)
    : (buildResult.buildResult?.report || {});

  let saved = saveDraftBuild(user.userId, {
    pageId,
    viewportProfile,
    planId: planId || "",
    builderVersion,
    rendererSurface: String(builderInput?.generationOptions?.rendererSurface || "custom").trim() || "custom",
    builderProvider: String(builderInput?.generationOptions?.builderProvider || "openrouter").trim() || "openrouter",
    status: "draft",
    summary: buildResult.summary || "",
    proposedVersionLabel: buildResult.buildResult?.proposedVersionLabel || versionLabelHint || "",
    operations: buildResult.buildResult?.operations || [],
    report: initialReportToSave,
    snapshotData: {
      changedComponentIds,
      previewUrl: buildPreviewUrlForWorkspacePage(pageId),
      intensity,
      builderVersion,
      builderMode,
      builderProvider: String(builderInput?.generationOptions?.builderProvider || "openrouter").trim() || "openrouter",
      rendererSurface: String(builderInput?.generationOptions?.rendererSurface || "custom").trim() || "custom",
      designChangeLevel,
      executionMode: builderInput?.systemContext?.executionStrategy?.executionMode || null,
      interventionLayer,
      patchDepth,
      targetGroupId,
      targetGroupLabel,
      critic: initialReportToSave?.critic || null,
      generatedAssets: generatedBuildAssets.map((item) => normalizeGeneratedRuntimeAsset(item.asset)).filter((entry) => entry.assetUrl),
      beforePageSnapshot,
      pageSnapshot,
    },
  });

  let hardVisualGateFailed = false;
  let executionVisualGateFailed = false;
  let visualCriticFailure = null;
  let visualFixAttempt = 0;
  let recoveryAttempt = Number(builderInput?.systemContext?.recoveryRouter?.attempt || 0) || 0;

  try {
    let visualCritic = await runVisualCriticForDraft({
      userId: user.userId,
      pageId,
      viewportProfile,
      draftBuildId: saved?.id || "",
      builderInput,
      buildResult: buildResult.buildResult || {},
    });
    if (!visualCritic?.report) {
      throw new Error("visual critic report unavailable");
    }
    if (visualCritic?.report) {
      let currentCritic = saved?.report && saved.report.critic && typeof saved.report.critic === "object"
        ? saved.report.critic
        : {};
      let currentRetry = currentCritic?.retryTrigger && typeof currentCritic.retryTrigger === "object"
        ? currentCritic.retryTrigger
        : {};
      let visualRetry = visualCritic.report?.retryTrigger && typeof visualCritic.report.retryTrigger === "object"
        ? visualCritic.report.retryTrigger
        : {};
      let mergedRetryTrigger = {
        shouldRetry: Boolean(currentRetry.shouldRetry || visualRetry.shouldRetry),
        failedDimensions: Array.from(new Set([
          ...toStringArray(currentRetry.failedDimensions),
          ...toStringArray(visualRetry.failedDimensions).map((item) => `visual:${item}`),
        ])),
        targetSlots: Array.from(new Set([
          ...toStringArray(currentRetry.targetSlots),
          ...toStringArray(visualRetry.targetSlots),
        ])),
        instructions: Array.from(new Set([
          ...toStringArray(currentRetry.instructions),
          ...toStringArray(visualRetry.instructions),
        ])),
      };
      if (visualRetry.shouldRetry && visualFixAttempt < MAX_VISUAL_FIX_PASSES) {
        visualFixAttempt += 1;
        const visualFixResult = await handleLlmFix(builderInput, {
          ...buildResult.buildResult,
          report: {
            ...(buildResult.buildResult?.report || {}),
            critic: {
              ...(buildResult.buildResult?.report?.critic || {}),
              retryTrigger: mergedRetryTrigger,
              visualComparison: visualCritic.report,
            },
          },
        });
        const visualFixOps = Array.isArray(visualFixResult?.fixResult?.operations) ? visualFixResult.fixResult.operations : [];
        if (visualFixOps.length) {
          const enforced = enforceBuilderOperations(
            [
              ...(buildResult.buildResult?.operations || []),
              ...visualFixOps,
            ],
            builderInput
          );
          const changedTargets = mapChangedTargetsFromOperations(enforced.operations);
          buildResult = {
            ...buildResult,
            buildResult: {
              ...(buildResult.buildResult || {}),
              operations: enforced.operations,
              changedTargets,
              report: {
                ...(buildResult.buildResult?.report || {}),
                whatChanged: uniqueNonEmptyLines([
                  ...toStringArray(buildResult.buildResult?.report?.whatChanged),
                  ...toStringArray(visualFixResult?.fixResult?.whatChanged),
                ]),
                whyChanged: uniqueNonEmptyLines([
                  ...toStringArray(buildResult.buildResult?.report?.whyChanged),
                  ...toStringArray(visualFixResult?.fixResult?.whyChanged),
                ]),
                assumptions: uniqueNonEmptyLines([
                  ...toStringArray(buildResult.buildResult?.report?.assumptions),
                  ...toStringArray(visualFixResult?.fixResult?.assumptions),
                  `Visual fix pass: ${String(visualFixResult?.summary || "").trim() || "targeted retry applied"}`,
                ]),
              },
            },
          };
          if (generatedBuildAssets.length) {
            buildResult = {
              ...buildResult,
              buildResult: applyGeneratedAssetsToBuildResult(buildResult.buildResult || {}, generatedBuildAssets),
            };
          }
          nextData = applyOperations(normalizeEditableData(sourceData), buildResult.buildResult.operations || [], {
            viewportProfile,
          });
          saveDataForUser(user, nextData, `${buildResult.summary || `llm_build:${pageId}`}::visual_fix`);
          changedComponentIds = Array.from(
            new Set(
              (buildResult.buildResult?.changedTargets || [])
                .map((item) => String(item.componentId || "").trim())
                .filter(Boolean)
            )
          );
          pageSnapshot = extractPageScopedSnapshot(nextData, pageId);
          const visualFixReportToSave = generatedBuildAssets.length
            ? mergeGeneratedAssetsIntoReport(buildResult.buildResult?.report || {}, generatedBuildAssets)
            : (buildResult.buildResult?.report || {});
          saved = saveDraftBuild(user.userId, {
            ...saved,
            id: saved?.id || "",
            status: "draft",
            summary: buildResult.summary || "",
            operations: buildResult.buildResult?.operations || [],
            report: visualFixReportToSave,
            snapshotData: {
              ...(saved?.snapshotData && typeof saved.snapshotData === "object" ? saved.snapshotData : {}),
              changedComponentIds,
              critic: visualFixReportToSave?.critic || null,
              generatedAssets: generatedBuildAssets.map((item) => normalizeGeneratedRuntimeAsset(item.asset)).filter((entry) => entry.assetUrl),
              pageSnapshot,
              visualFixAttempt,
            },
          });
          if (generatedBuildAssets.length) {
            const generatedCounts = getGeneratedAssetCountFromBuildResult(buildResult.buildResult || {});
            console.log(
              `[builder] generated-assets-preserved user=${user.userId} page=${pageId} draft=${saved?.id || ""} reportGenerated=${generatedCounts.reportGenerated} componentGenerated=${generatedCounts.componentGenerated}`
            );
          }
          visualCritic = await runVisualCriticForDraft({
            userId: user.userId,
            pageId,
            viewportProfile,
            draftBuildId: saved?.id || "",
            builderInput,
            buildResult: buildResult.buildResult || {},
          });
          if (!visualCritic?.report) {
            throw new Error("visual critic report unavailable after visual fix");
          }
          currentCritic = saved?.report && saved.report.critic && typeof saved.report.critic === "object"
            ? saved.report.critic
            : {};
          currentRetry = currentCritic?.retryTrigger && typeof currentCritic.retryTrigger === "object"
            ? currentCritic.retryTrigger
            : {};
          visualRetry = visualCritic.report?.retryTrigger && typeof visualCritic.report.retryTrigger === "object"
            ? visualCritic.report.retryTrigger
            : {};
          mergedRetryTrigger = {
            shouldRetry: Boolean(currentRetry.shouldRetry || visualRetry.shouldRetry),
            failedDimensions: Array.from(new Set([
              ...toStringArray(currentRetry.failedDimensions),
              ...toStringArray(visualRetry.failedDimensions).map((item) => `visual:${item}`),
            ])),
            targetSlots: Array.from(new Set([
              ...toStringArray(currentRetry.targetSlots),
              ...toStringArray(visualRetry.targetSlots),
            ])),
            instructions: Array.from(new Set([
              ...toStringArray(currentRetry.instructions),
              ...toStringArray(visualRetry.instructions),
            ])),
          };
        }
      } else if (visualRetry.shouldRetry) {
        console.warn(
          `[builder] visual-fix-limit page=${pageId} draft=${saved?.id || ""} attempts=${visualFixAttempt} max=${MAX_VISUAL_FIX_PASSES}`
        );
      }
      const finalQualityGate = visualCritic?.qualityGate && typeof visualCritic.qualityGate === "object"
        ? visualCritic.qualityGate
        : {};
      hardVisualGateFailed = Boolean(finalQualityGate.qualityFailed);
      executionVisualGateFailed = Boolean(finalQualityGate.executionFailed);
      const finalReportToSave = generatedBuildAssets.length
        ? mergeGeneratedAssetsIntoReport(
            {
              ...(saved?.report && typeof saved.report === "object" ? saved.report : {}),
              critic: {
                ...currentCritic,
                retryTrigger: mergedRetryTrigger,
                visualComparison: visualCritic.report,
              },
            },
            generatedBuildAssets
          )
        : {
            ...(saved?.report && typeof saved.report === "object" ? saved.report : {}),
            critic: {
              ...currentCritic,
              retryTrigger: mergedRetryTrigger,
              visualComparison: visualCritic.report,
            },
          };
      saved = saveDraftBuild(user.userId, {
        ...saved,
        id: saved?.id || "",
        status: executionVisualGateFailed
          ? "execution-failed"
          : hardVisualGateFailed
            ? "quality-failed"
            : (saved?.status || "draft"),
        report: finalReportToSave,
        snapshotData: {
          ...(saved?.snapshotData && typeof saved.snapshotData === "object" ? saved.snapshotData : {}),
          visualCriticAssets: visualCritic.assets || null,
          qualityGate: visualCritic.qualityGate || null,
          generatedAssets: generatedBuildAssets.map((item) => normalizeGeneratedRuntimeAsset(item.asset)).filter((entry) => entry.assetUrl),
        },
      });
      if (
        hardVisualGateFailed &&
        !executionVisualGateFailed &&
        recoveryAttempt < MAX_RECOVERY_ROUTER_PASSES &&
        !Boolean(builderInput?.systemContext?.recoveryRouter?.attempted)
      ) {
        const recoveryRouter = resolveQualityRecoveryRoute(
          builderInput,
          visualCritic.report,
          finalQualityGate,
          generatedBuildAssets.map((item) => item?.asset).filter(Boolean)
        );
        console.log(
          `[builder] recovery-router user=${user.userId} page=${pageId} draft=${saved?.id || ""} mode=${recoveryRouter.mode} failed=${recoveryRouter.failedDimensions.join(",") || "none"} targets=${recoveryRouter.targetSlots.join(",") || "none"}`
        );
        const recoveryBuilderInput = withRecoveryRouter(builderInput, {
          ...recoveryRouter,
          attempt: recoveryAttempt + 1,
          attempted: true,
        });
        recoveryAttempt = Number(recoveryBuilderInput?.systemContext?.recoveryRouter?.attempt || recoveryAttempt + 1) || (recoveryAttempt + 1);
        let recoveryGeneratedAssets = [];
        if (["asset-assisted-recovery", "generation-backed-recovery"].includes(recoveryRouter.mode)) {
          recoveryGeneratedAssets = await materializeGeneratedBuildAssets({
            userId: user.userId,
            pageId,
            viewportProfile,
            builderInput: recoveryBuilderInput,
            buildResult: buildResult.buildResult || {},
          });
          if (recoveryGeneratedAssets.length) {
            const seen = new Set(generatedBuildAssets.map((item) => String(item?.asset?.id || "").trim()).filter(Boolean));
            recoveryGeneratedAssets.forEach((item) => {
              const assetId = String(item?.asset?.id || "").trim();
              if (assetId && seen.has(assetId)) return;
              if (assetId) seen.add(assetId);
              generatedBuildAssets.push(item);
            });
            buildResult = {
              ...buildResult,
              buildResult: applyGeneratedAssetsToBuildResult(buildResult.buildResult || {}, generatedBuildAssets),
            };
          }
        }
        const recoveryFixResult = await handleLlmFix(recoveryBuilderInput, {
          ...buildResult.buildResult,
          report: {
            ...(buildResult.buildResult?.report || {}),
            critic: {
              ...(buildResult.buildResult?.report?.critic || {}),
              retryTrigger: {
                ...mergedRetryTrigger,
                shouldRetry: true,
                failedDimensions: Array.from(new Set([
                  ...toStringArray(mergedRetryTrigger.failedDimensions),
                  ...recoveryRouter.failedDimensions.map((item) => `recovery:${item}`),
                ])),
                targetSlots: Array.from(new Set([
                  ...toStringArray(mergedRetryTrigger.targetSlots),
                  ...recoveryRouter.targetSlots,
                ])),
                instructions: Array.from(new Set([
                  ...toStringArray(mergedRetryTrigger.instructions),
                  ...toStringArray(recoveryRouter.instructions),
                ])),
              },
              visualComparison: visualCritic.report,
            },
          },
        });
        const recoveryFixOps = Array.isArray(recoveryFixResult?.fixResult?.operations) ? recoveryFixResult.fixResult.operations : [];
        if (recoveryFixOps.length || recoveryGeneratedAssets.length) {
          if (recoveryFixOps.length) {
            const enforced = enforceBuilderOperations(
              [
                ...(buildResult.buildResult?.operations || []),
                ...recoveryFixOps,
              ],
              recoveryBuilderInput
            );
            const changedTargets = mapChangedTargetsFromOperations(enforced.operations);
            buildResult = {
              ...buildResult,
              buildResult: {
                ...(buildResult.buildResult || {}),
                operations: enforced.operations,
                changedTargets,
                report: {
                  ...(buildResult.buildResult?.report || {}),
                  whatChanged: uniqueNonEmptyLines([
                    ...toStringArray(buildResult.buildResult?.report?.whatChanged),
                    ...toStringArray(recoveryFixResult?.fixResult?.whatChanged),
                  ]),
                  whyChanged: uniqueNonEmptyLines([
                    ...toStringArray(buildResult.buildResult?.report?.whyChanged),
                    ...toStringArray(recoveryFixResult?.fixResult?.whyChanged),
                  ]),
                  assumptions: uniqueNonEmptyLines([
                    ...toStringArray(buildResult.buildResult?.report?.assumptions),
                    ...toStringArray(recoveryFixResult?.fixResult?.assumptions),
                    `Recovery router: ${recoveryRouter.mode}`,
                  ]),
                },
              },
            };
          }
          if (generatedBuildAssets.length) {
            buildResult = {
              ...buildResult,
              buildResult: applyGeneratedAssetsToBuildResult(buildResult.buildResult || {}, generatedBuildAssets),
            };
          }
          nextData = applyOperations(normalizeEditableData(sourceData), buildResult.buildResult.operations || [], {
            viewportProfile,
          });
          saveDataForUser(user, nextData, `${buildResult.summary || `llm_build:${pageId}`}::recovery_router`);
          changedComponentIds = Array.from(
            new Set(
              (buildResult.buildResult?.changedTargets || [])
                .map((item) => String(item.componentId || "").trim())
                .filter(Boolean)
            )
          );
          pageSnapshot = extractPageScopedSnapshot(nextData, pageId);
          const recoveryReportToSave = generatedBuildAssets.length
            ? mergeGeneratedAssetsIntoReport(buildResult.buildResult?.report || {}, generatedBuildAssets)
            : (buildResult.buildResult?.report || {});
          saved = saveDraftBuild(user.userId, {
            ...saved,
            id: saved?.id || "",
            status: "draft",
            summary: buildResult.summary || "",
            operations: buildResult.buildResult?.operations || [],
            report: recoveryReportToSave,
            snapshotData: {
              ...(saved?.snapshotData && typeof saved.snapshotData === "object" ? saved.snapshotData : {}),
              changedComponentIds,
              critic: recoveryReportToSave?.critic || null,
              generatedAssets: generatedBuildAssets.map((item) => normalizeGeneratedRuntimeAsset(item.asset)).filter((entry) => entry.assetUrl),
              pageSnapshot,
              recoveryRouter: {
                ...recoveryRouter,
                attempt: recoveryAttempt,
                attempted: true,
              },
            },
          });
          visualCritic = await runVisualCriticForDraft({
            userId: user.userId,
            pageId,
            viewportProfile,
            draftBuildId: saved?.id || "",
            builderInput: recoveryBuilderInput,
            buildResult: buildResult.buildResult || {},
          });
          if (!visualCritic?.report) {
            throw new Error("visual critic report unavailable after recovery router");
          }
          const recoveryQualityGate = visualCritic?.qualityGate && typeof visualCritic.qualityGate === "object"
            ? visualCritic.qualityGate
            : {};
          hardVisualGateFailed = Boolean(recoveryQualityGate.qualityFailed);
          executionVisualGateFailed = Boolean(recoveryQualityGate.executionFailed);
          const recoveryCritic = saved?.report?.critic && typeof saved.report.critic === "object"
            ? saved.report.critic
            : {};
          const recoveryRetry = recoveryCritic?.retryTrigger && typeof recoveryCritic.retryTrigger === "object"
            ? recoveryCritic.retryTrigger
            : {};
          const recoveryVisualRetry = visualCritic.report?.retryTrigger && typeof visualCritic.report.retryTrigger === "object"
            ? visualCritic.report.retryTrigger
            : {};
          const mergedRecoveryRetryTrigger = {
            shouldRetry: Boolean(recoveryRetry.shouldRetry || recoveryVisualRetry.shouldRetry),
            failedDimensions: Array.from(new Set([
              ...toStringArray(recoveryRetry.failedDimensions),
              ...toStringArray(recoveryVisualRetry.failedDimensions).map((item) => `visual:${item}`),
            ])),
            targetSlots: Array.from(new Set([
              ...toStringArray(recoveryRetry.targetSlots),
              ...toStringArray(recoveryVisualRetry.targetSlots),
            ])),
            instructions: Array.from(new Set([
              ...toStringArray(recoveryRetry.instructions),
              ...toStringArray(recoveryVisualRetry.instructions),
            ])),
          };
          const recoveredFinalReport = generatedBuildAssets.length
            ? mergeGeneratedAssetsIntoReport(
                {
                  ...(saved?.report && typeof saved.report === "object" ? saved.report : {}),
                  critic: {
                    ...recoveryCritic,
                    retryTrigger: mergedRecoveryRetryTrigger,
                    visualComparison: visualCritic.report,
                  },
                },
                generatedBuildAssets
              )
            : {
                ...(saved?.report && typeof saved.report === "object" ? saved.report : {}),
                critic: {
                  ...recoveryCritic,
                  retryTrigger: mergedRecoveryRetryTrigger,
                  visualComparison: visualCritic.report,
                },
              };
          saved = saveDraftBuild(user.userId, {
            ...saved,
            id: saved?.id || "",
            status: executionVisualGateFailed
              ? "execution-failed"
              : hardVisualGateFailed
                ? "quality-failed"
                : "draft",
            report: recoveredFinalReport,
            snapshotData: {
              ...(saved?.snapshotData && typeof saved.snapshotData === "object" ? saved.snapshotData : {}),
              visualCriticAssets: visualCritic.assets || null,
              qualityGate: visualCritic.qualityGate || null,
              generatedAssets: generatedBuildAssets.map((item) => normalizeGeneratedRuntimeAsset(item.asset)).filter((entry) => entry.assetUrl),
              recoveryRouter: {
                ...recoveryRouter,
                attempt: recoveryAttempt,
                attempted: true,
              },
            },
          });
        }
      } else if (hardVisualGateFailed && !executionVisualGateFailed) {
        console.warn(
          `[builder] recovery-router-limit page=${pageId} draft=${saved?.id || ""} attempts=${recoveryAttempt} max=${MAX_RECOVERY_ROUTER_PASSES}`
        );
      }
    }
  } catch (error) {
    const failureDetail = buildVisualCriticErrorDetail(error, {
      stage: "standard-run",
      mode: builderMode,
      pageId,
      draftBuildId: saved?.id || "",
      visualFixAttempt,
      recoveryAttempt,
    });
    console.warn(
      `[visual-critic] failed user=${user.userId} page=${pageId} build=${saved?.id || ""} visualFixAttempt=${visualFixAttempt} recoveryAttempt=${recoveryAttempt} reason=${failureDetail.message}`
    );
    visualCriticFailure = buildVisualCriticFailurePayload(`${failureDetail.stage}: ${failureDetail.message}`, builderInput);
    hardVisualGateFailed = true;
    executionVisualGateFailed = true;
    const failureReportToSave = generatedBuildAssets.length
      ? mergeGeneratedAssetsIntoReport(
          {
            ...(saved?.report && typeof saved.report === "object" ? saved.report : {}),
            critic: {
              ...(saved?.report?.critic && typeof saved.report.critic === "object" ? saved.report.critic : {}),
              retryTrigger: visualCriticFailure.report.retryTrigger,
              visualComparison: visualCriticFailure.report,
              visualComparisonError: failureDetail,
            },
          },
          generatedBuildAssets
        )
      : {
          ...(saved?.report && typeof saved.report === "object" ? saved.report : {}),
          critic: {
            ...(saved?.report?.critic && typeof saved.report.critic === "object" ? saved.report.critic : {}),
            retryTrigger: visualCriticFailure.report.retryTrigger,
            visualComparison: visualCriticFailure.report,
            visualComparisonError: failureDetail,
          },
        };
    saved = saveDraftBuild(user.userId, {
      ...saved,
      id: saved?.id || "",
      status: "execution-failed",
      report: failureReportToSave,
      snapshotData: {
        ...(saved?.snapshotData && typeof saved.snapshotData === "object" ? saved.snapshotData : {}),
        visualCriticAssets: visualCriticFailure.assets,
        qualityGate: visualCriticFailure.qualityGate,
        generatedAssets: generatedBuildAssets.map((item) => normalizeGeneratedRuntimeAsset(item.asset)).filter((entry) => entry.assetUrl),
        visualCriticError: failureDetail,
      },
    });
  }

  return {
    saved,
    buildResult,
    nextData,
    changedComponentIds,
    hardVisualGateFailed,
    executionVisualGateFailed,
    visualCriticFailure,
  };
}

module.exports = {
  finalizeBuilderV2Run,
};
