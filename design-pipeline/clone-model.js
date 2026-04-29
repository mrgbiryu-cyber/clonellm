"use strict";

function normalizeStringMap(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [String(key || "").trim(), String(entryValue || "").trim()])
      .filter(([key, entryValue]) => key && entryValue)
  );
}

function normalizeStringArray(value = null, limit = 12) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit)
    : [];
}

function normalizePrimitiveTree(value = null) {
  if (!value || typeof value !== "object") return null;
  return {
    type: String(value.type || "").trim(),
    variant: String(value.variant || "").trim(),
    props: value.props && typeof value.props === "object" ? { ...value.props } : {},
    children: Array.isArray(value.children) ? value.children.slice(0, 12) : [],
  };
}

function normalizeSectionLayout(value = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    sectionRole: String(source.sectionRole || "").trim(),
    layoutMode: String(source.layoutMode || "").trim(),
    containerMode: String(source.containerMode || "").trim(),
    hierarchy: normalizeStringArray(source.hierarchy, 8),
    density: String(source.density || "").trim(),
    alignment: String(source.alignment || "").trim(),
    rhythm: String(source.rhythm || "").trim(),
  };
}

function normalizeSectionTone(value = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    surfaceTone: String(source.surfaceTone || "").trim(),
    emphasisTone: String(source.emphasisTone || "").trim(),
    contrastMode: String(source.contrastMode || "").trim(),
    accentTone: String(source.accentTone || "").trim(),
    badgeTone: String(source.badgeTone || "").trim(),
  };
}

function normalizeSectionTypography(value = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    headlinePreset: String(source.headlinePreset || "").trim(),
    bodyPreset: String(source.bodyPreset || "").trim(),
    eyebrowPreset: String(source.eyebrowPreset || "").trim(),
    ctaPreset: String(source.ctaPreset || "").trim(),
  };
}

function normalizeSectionAssets(value = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    visualRole: String(source.visualRole || "").trim(),
    visualPolicy: String(source.visualPolicy || "").trim(),
    iconPolicy: String(source.iconPolicy || "").trim(),
    assetPlan: source.assetPlan && typeof source.assetPlan === "object" && !Array.isArray(source.assetPlan)
      ? JSON.parse(JSON.stringify(source.assetPlan))
      : {},
  };
}

function normalizeSectionContent(value = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    objective: String(source.objective || "").trim(),
    primaryMessage: String(source.primaryMessage || "").trim(),
    supportMessage: String(source.supportMessage || "").trim(),
    keep: normalizeStringArray(source.keep, 6),
    change: normalizeStringArray(source.change, 6),
    ctaLabels: normalizeStringArray(source.ctaLabels, 4),
  };
}

function normalizeSectionConstraints(value = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    preserve: normalizeStringArray(source.preserve, 6),
    avoid: normalizeStringArray(source.avoid, 6),
    guardrails: normalizeStringArray(source.guardrails, 8),
  };
}

function normalizeSection(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    slotId: String(source.slotId || "").trim(),
    componentId: String(source.componentId || "").trim(),
    familyId: String(source.familyId || "").trim(),
    templateId: String(source.templateId || "").trim(),
    primitiveTree: normalizePrimitiveTree(source.primitiveTree),
    patch: source.patch && typeof source.patch === "object" ? { ...source.patch } : {},
    priority: String(source.priority || "normal").trim() || "normal",
    layout: normalizeSectionLayout(source.layout),
    tone: normalizeSectionTone(source.tone),
    typography: normalizeSectionTypography(source.typography),
    assets: normalizeSectionAssets(source.assets),
    content: normalizeSectionContent(source.content),
    constraints: normalizeSectionConstraints(source.constraints),
  };
}

function normalizeRenderIntent(value = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    modelVersion: String(source.modelVersion || "canonical-render-model.v1").trim() || "canonical-render-model.v1",
    designChangeLevel: String(source.designChangeLevel || "").trim(),
    compositionMode: String(source.compositionMode || "").trim(),
    selectedConceptId: String(source.selectedConceptId || "").trim(),
    selectedConceptLabel: String(source.selectedConceptLabel || "").trim(),
    layoutDirection: String(source.layoutDirection || "").trim(),
    themeTone: String(source.themeTone || "").trim(),
    northStar: normalizeStringArray(source.northStar, 8),
    guardrails: normalizeStringArray(source.guardrails, 10),
    toolAccess: normalizeStringMap(source.toolAccess),
  };
}

function normalizeBoundary(value = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    mode: String(source.mode || "replace-inside-group").trim() || "replace-inside-group",
    preserveOutsideGroup: source.preserveOutsideGroup !== false,
    entrySlotId: String(source.entrySlotId || "").trim(),
    exitSlotId: String(source.exitSlotId || "").trim(),
  };
}

function buildCloneRenderModel(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const sections = Array.isArray(source.sections) ? source.sections.map(normalizeSection).filter((item) => item.slotId) : [];
  return {
    pageId: String(source.pageId || "").trim(),
    viewportProfile: String(source.viewportProfile || "pc").trim() || "pc",
    rendererSurface: String(source.rendererSurface || "tailwind").trim() || "tailwind",
    renderIntent: normalizeRenderIntent(source.renderIntent),
    targetGroup: source.targetGroup && typeof source.targetGroup === "object"
      ? {
          groupId: String(source.targetGroup.groupId || "").trim(),
          groupLabel: String(source.targetGroup.groupLabel || "").trim(),
          componentIds: Array.isArray(source.targetGroup.componentIds) ? source.targetGroup.componentIds.slice(0, 24) : [],
          slotIds: Array.isArray(source.targetGroup.slotIds) ? source.targetGroup.slotIds.slice(0, 24) : [],
          replacementMode: String(source.targetGroup.replacementMode || "").trim(),
          layoutIntent: Array.isArray(source.targetGroup.layoutIntent) ? source.targetGroup.layoutIntent.slice(0, 12) : [],
          boundary: normalizeBoundary(source.targetGroup.boundary),
        }
      : null,
    sections,
  };
}

function buildCloneSnapshotEnvelope(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    snapshotState: String(source.snapshotState || "after").trim() || "after",
    cloneRenderModel: buildCloneRenderModel(source.cloneRenderModel || source),
  };
}

module.exports = {
  normalizeStringArray,
  normalizePrimitiveTree,
  normalizeSectionLayout,
  normalizeSectionTone,
  normalizeSectionTypography,
  normalizeSectionAssets,
  normalizeSectionContent,
  normalizeSectionConstraints,
  normalizeSection,
  normalizeRenderIntent,
  normalizeBoundary,
  buildCloneRenderModel,
  buildCloneSnapshotEnvelope,
};
