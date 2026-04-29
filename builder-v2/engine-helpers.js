"use strict";

function safeClone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return typeof fallback === "undefined" ? null : fallback;
  }
}

function buildCriticDebugEntry(stage = "", critic = {}) {
  const report = critic && typeof critic === "object" ? critic : {};
  const retryTrigger = report?.retryTrigger && typeof report.retryTrigger === "object" ? report.retryTrigger : {};
  const focusSlotCoverage = report?.focusSlotCoverage && typeof report.focusSlotCoverage === "object" ? report.focusSlotCoverage : {};
  const snapshotDelta = report?.snapshotDelta && typeof report.snapshotDelta === "object" ? report.snapshotDelta : {};
  return {
    stage: String(stage || "").trim() || "critic",
    status: String(report?.status || "").trim() || "unknown",
    averageScore: Number(report?.averageScore || 0),
    scores: safeClone(report?.scores || {}, {}),
    findings: Array.isArray(report?.findings) ? report.findings.slice(0, 8) : [],
    retryTrigger: {
      shouldRetry: Boolean(retryTrigger?.shouldRetry),
      failedDimensions: Array.isArray(retryTrigger?.failedDimensions) ? retryTrigger.failedDimensions.slice(0, 8) : [],
      targetSlots: Array.isArray(retryTrigger?.targetSlots) ? retryTrigger.targetSlots.slice(0, 8) : [],
      instructions: Array.isArray(retryTrigger?.instructions) ? retryTrigger.instructions.slice(0, 8) : [],
    },
    focusSlotCoverage: {
      requested: Array.isArray(focusSlotCoverage?.requested) ? focusSlotCoverage.requested.slice(0, 8) : [],
      covered: Array.isArray(focusSlotCoverage?.covered) ? focusSlotCoverage.covered.slice(0, 8) : [],
      missing: Array.isArray(focusSlotCoverage?.missing) ? focusSlotCoverage.missing.slice(0, 8) : [],
    },
    snapshotDelta: safeClone(snapshotDelta, {}),
    governanceViolationCount: Array.isArray(report?.governanceViolations) ? report.governanceViolations.length : 0,
  };
}

function appendCriticDebug(report = {}, stage = "", critic = {}) {
  const nextReport = report && typeof report === "object" ? report : {};
  const history = Array.isArray(nextReport.criticDebugHistory) ? nextReport.criticDebugHistory.slice(-3) : [];
  const entry = buildCriticDebugEntry(stage, critic);
  nextReport.criticDebug = entry;
  nextReport.criticDebugHistory = [...history, entry];
  return nextReport;
}

function buildChangedTargets(operations = [], pageId = "") {
  return Array.from(
    new Set(
      (Array.isArray(operations) ? operations : []).map((item) => `${String(item?.slotId || "").trim()}:${String(item?.action || "").trim()}`)
    )
  )
    .map((key) => {
      const [slotId, action] = key.split(":");
      return {
        slotId,
        componentId: `${String(pageId || "").trim()}.${slotId}`,
        changeType: action === "toggle_slot_source" ? "source_switch" : action === "replace_component_template" ? "template_replace" : "component_patch",
      };
    })
    .filter((item) => item.slotId);
}

function mergeComposerContractsIntoComposition({
  normalizedResult,
  compositionResult,
  detailerInput,
  helpers,
}) {
  const {
    synthesizeComponentCompositionFromComposer,
    buildComposerStyleContractMap,
    normalizeCompositionPrimitiveTree,
    synthesizePrimitiveTreeForComponent,
  } = helpers;

  if (!normalizedResult.buildResult.report.componentComposition.length && compositionResult?.composition?.compositionTree?.length) {
    normalizedResult.buildResult.report.componentComposition = synthesizeComponentCompositionFromComposer(compositionResult, detailerInput);
  }
  const composerStyleContractMap = buildComposerStyleContractMap(compositionResult);
  if (normalizedResult.buildResult.report.componentComposition.length) {
    normalizedResult.buildResult.report.componentComposition = normalizedResult.buildResult.report.componentComposition.map((item) => {
      const key = `${String(item?.componentId || "").trim()}::${String(item?.slotId || "").trim()}`;
      const styleContract = composerStyleContractMap.get(key);
      return styleContract
        ? {
            ...item,
            styleContract: item?.styleContract && typeof item.styleContract === "object" && Object.keys(item.styleContract).length
              ? item.styleContract
              : styleContract,
            primitiveTree:
              normalizeCompositionPrimitiveTree(item?.primitiveTree || null) ||
              synthesizePrimitiveTreeForComponent(String(item?.slotId || "").trim(), String(item?.templateId || "").trim(), styleContract, item),
          }
        : {
            ...item,
            primitiveTree:
              normalizeCompositionPrimitiveTree(item?.primitiveTree || null) ||
              synthesizePrimitiveTreeForComponent(String(item?.slotId || "").trim(), String(item?.templateId || "").trim(), item?.styleContract || null, item),
          };
    });
  }
}

function applyReplacementFirstOperations({
  normalizedResult,
  compositionResult,
  detailerInput,
  helpers,
}) {
  const {
    isReplacementFirstExecution,
    synthesizeTemplateOperationsFromComposer,
    uniqueNonEmptyLines,
  } = helpers;

  if (compositionResult?.composition?.compositionTree?.length && isReplacementFirstExecution(detailerInput)) {
    const synthesizedTemplateOperations = synthesizeTemplateOperationsFromComposer(
      compositionResult,
      detailerInput,
      normalizedResult.buildResult.operations || []
    );
    if (synthesizedTemplateOperations.length) {
      normalizedResult.buildResult.operations = [
        ...safeClone(synthesizedTemplateOperations, []),
        ...safeClone(Array.isArray(normalizedResult.buildResult.operations) ? normalizedResult.buildResult.operations : [], []),
      ];
      normalizedResult.buildResult.report.assumptions = uniqueNonEmptyLines([
        ...normalizedResult.buildResult.report.assumptions,
        `Composer-first template synthesis applied: ${synthesizedTemplateOperations.map((item) => `${item.slotId}:${item.templateId}`).join(", ")}`,
      ]);
    }
  }
}

async function runStructuralCriticFixLoop({
  normalizedResult,
  detailerInput,
  currentData,
  helpers,
}) {
  const {
    enforceBuilderOperations,
    extractPageScopedSnapshotLite,
    buildBuilderCriticReport,
    toStringArray,
    handleLlmFix,
    uniqueNonEmptyLines,
    normalizeEditableData,
    applyOperations,
  } = helpers;

  const pageId = String(detailerInput?.pageContext?.workspacePageId || "").trim();
  const viewportProfile = detailerInput?.pageContext?.viewportProfile || "pc";
  const builderMode = String(detailerInput?.generationOptions?.builderMode || "standard").trim() || "standard";

  const enforcement = enforceBuilderOperations(normalizedResult.buildResult.operations || [], detailerInput);
  normalizedResult.buildResult.operations = safeClone(enforcement.operations, []);
  normalizedResult.buildResult.changedTargets = buildChangedTargets(enforcement.operations, pageId);

  const current = normalizeEditableData(currentData || {});
  const beforeSnapshot = extractPageScopedSnapshotLite(current, pageId, viewportProfile);
  const next = applyOperations(current, normalizedResult.buildResult.operations || [], {
    viewportProfile,
  });
  const afterSnapshot = extractPageScopedSnapshotLite(next, pageId, viewportProfile);
  normalizedResult.buildResult.report.critic = buildBuilderCriticReport(normalizedResult, detailerInput, enforcement, {
    beforeSnapshot,
    afterSnapshot,
  });
  normalizedResult.buildResult.report = appendCriticDebug(
    normalizedResult.buildResult.report,
    "initial-structural-pass",
    normalizedResult.buildResult.report.critic
  );

  const retryTrigger = normalizedResult?.buildResult?.report?.critic?.retryTrigger || {};
  console.log(
    `[critic-v2] structural page=${pageId} status=${String(normalizedResult?.buildResult?.report?.critic?.status || "")} average=${Number(normalizedResult?.buildResult?.report?.critic?.averageScore || 0)} retry=${retryTrigger?.shouldRetry ? "yes" : "no"} failed=${toStringArray(retryTrigger?.failedDimensions).join(",") || "none"}`
  );

  if (builderMode === "compare") {
    return {
      result: {
        summary: normalizedResult.summary,
        buildResult: normalizedResult.buildResult,
        operations: normalizedResult.buildResult.operations || [],
        data: next,
      },
    };
  }

  if (!retryTrigger?.shouldRetry) {
    return {
      result: {
        summary: normalizedResult.summary,
        buildResult: normalizedResult.buildResult,
        operations: normalizedResult.buildResult.operations || [],
        data: next,
      },
    };
  }

  const fixResult = await handleLlmFix(detailerInput, normalizedResult.buildResult);
  const fixOperations = Array.isArray(fixResult?.fixResult?.operations) ? fixResult.fixResult.operations : [];
  if (!fixOperations.length) {
    return {
      result: {
        summary: normalizedResult.summary,
        buildResult: normalizedResult.buildResult,
        operations: normalizedResult.buildResult.operations || [],
        data: next,
      },
    };
  }

  const mergedOperations = [
    ...safeClone(normalizedResult.buildResult.operations || [], []),
    ...safeClone(fixOperations, []),
  ];
  const mergedEnforcement = enforceBuilderOperations(mergedOperations, detailerInput);
  normalizedResult.buildResult.operations = safeClone(mergedEnforcement.operations, []);
  normalizedResult.buildResult.changedTargets = buildChangedTargets(mergedEnforcement.operations, pageId);
  normalizedResult.buildResult.report.whatChanged = uniqueNonEmptyLines([
    ...normalizedResult.buildResult.report.whatChanged,
    ...toStringArray(fixResult?.fixResult?.whatChanged),
  ]);
  normalizedResult.buildResult.report.whyChanged = uniqueNonEmptyLines([
    ...normalizedResult.buildResult.report.whyChanged,
    ...toStringArray(fixResult?.fixResult?.whyChanged),
  ]);
  normalizedResult.buildResult.report.assumptions = uniqueNonEmptyLines([
    ...normalizedResult.buildResult.report.assumptions,
    ...toStringArray(fixResult?.fixResult?.assumptions),
    `Fix pass: ${String(fixResult?.summary || "").trim() || "targeted retry applied"}`,
  ]);
  const finalData = applyOperations(current, normalizedResult.buildResult.operations || [], {
    viewportProfile,
  });
  const finalSnapshot = extractPageScopedSnapshotLite(finalData, pageId, viewportProfile);
  normalizedResult.buildResult.report.critic = buildBuilderCriticReport(normalizedResult, detailerInput, mergedEnforcement, {
    beforeSnapshot,
    afterSnapshot: finalSnapshot,
  });
  normalizedResult.buildResult.report = appendCriticDebug(
    normalizedResult.buildResult.report,
    "post-fix-structural-pass",
    normalizedResult.buildResult.report.critic
  );
  console.log(
    `[critic-v2] after-fix page=${pageId} status=${String(normalizedResult?.buildResult?.report?.critic?.status || "")} average=${Number(normalizedResult?.buildResult?.report?.critic?.averageScore || 0)} retry=${normalizedResult?.buildResult?.report?.critic?.retryTrigger?.shouldRetry ? "yes" : "no"}`
  );
  return {
    result: {
      summary: normalizedResult.summary,
      buildResult: normalizedResult.buildResult,
      operations: normalizedResult.buildResult.operations || [],
      data: finalData,
    },
  };
}

module.exports = {
  buildChangedTargets,
  mergeComposerContractsIntoComposition,
  applyReplacementFirstOperations,
  runStructuralCriticFixLoop,
};
