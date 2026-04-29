"use strict";

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeRendererSurface(value, fallback = "tailwind") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "tailwind" || normalized === "tw") return "tailwind";
  if (normalized === "custom" || normalized === "scoped-css") return "custom";
  return fallback;
}

function normalizeViewportProfile(pageId = "", viewportProfile = "") {
  const normalizedPageId = String(pageId || "").trim();
  const normalized = String(viewportProfile || "").trim().toLowerCase();
  if (normalizedPageId === "home" && ["pc", "mo", "ta"].includes(normalized)) return normalized;
  if (["pc", "mo", "ta"].includes(normalized)) return normalized;
  return "pc";
}

function normalizeTargetGroup(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const componentIds = toStringArray(source.componentIds || source.targetComponents);
  const slotIds = toStringArray(source.slotIds);
  return {
    groupId: String(source.groupId || source.targetGroupId || "group").trim() || "group",
    groupLabel: String(source.groupLabel || source.targetGroupLabel || "Target Group").trim() || "Target Group",
    componentIds,
    slotIds,
    replacementMode: String(source.replacementMode || source.targetGroupReplacementMode || "").trim(),
    layoutIntent: toStringArray(source.layoutIntent || source.instructions || source.designIntent),
  };
}

function normalizePageIdentity(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    character: String(source.character || "").trim(),
    visualLanguage: String(source.visualLanguage || "").trim(),
    userGoal: String(source.userGoal || "").trim(),
    sectionFlow: String(source.sectionFlow || "").trim(),
  };
}

function normalizeDesignPolicy(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    problemStatement: toStringArray(source.problemStatement || source.problem || source.whyChange),
    hierarchyGoals: toStringArray(source.hierarchyGoals || source.informationHierarchy),
    mustKeep: toStringArray(source.mustKeep),
    mustChange: toStringArray(source.mustChange),
    guardrails: toStringArray(source.guardrails),
    exclusions: Array.isArray(source.exclusions)
      ? source.exclusions
        .map((item) => {
          const entry = item && typeof item === "object" ? item : {};
          const label = String(entry.label || entry.item || "").trim();
          const reason = String(entry.reason || "").trim();
          if (!label && !reason) return null;
          return { label, reason };
        })
        .filter(Boolean)
      : [],
    layoutDirections: toStringArray(source.layoutDirections || source.variations || source.directions),
  };
}

function normalizeBuildRequest(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const pageId = String(source.pageId || "").trim();
  return {
    pageId,
    viewportProfile: normalizeViewportProfile(pageId, source.viewportProfile),
    rendererSurface: normalizeRendererSurface(source.rendererSurface, "tailwind"),
    targetGroup: normalizeTargetGroup(source.targetGroup || source),
    pageIdentity: normalizePageIdentity(source.pageIdentity || source),
    designPolicy: normalizeDesignPolicy(source.designPolicy || source.designIntent || source),
  };
}

function validateBuildRequest(request = {}) {
  const issues = [];
  if (!String(request.pageId || "").trim()) issues.push("pageId is required");
  if (!String(request.targetGroup?.groupId || "").trim()) issues.push("targetGroup.groupId is required");
  if (!Array.isArray(request.targetGroup?.componentIds) || !request.targetGroup.componentIds.length) {
    issues.push("targetGroup.componentIds must include at least one component");
  }
  if (
    !String(request.pageIdentity?.character || "").trim() &&
    !String(request.pageIdentity?.visualLanguage || "").trim()
  ) {
    issues.push("pageIdentity should define at least character or visualLanguage");
  }
  return {
    valid: issues.length === 0,
    issues,
  };
}

module.exports = {
  toStringArray,
  normalizeRendererSurface,
  normalizeViewportProfile,
  normalizeTargetGroup,
  normalizePageIdentity,
  normalizeDesignPolicy,
  normalizeBuildRequest,
  validateBuildRequest,
};
