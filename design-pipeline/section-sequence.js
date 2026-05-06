"use strict";

function toStringArray(value, limit = 24) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }
  return [];
}

function inferSectionPriority(section = {}, index = 0) {
  const slotId = String(section?.slotId || "").trim().toLowerCase();
  if (slotId === "hero" || slotId === "summary") return 0;
  if (slotId === "quickmenu" || slotId === "sticky") return 1;
  return Math.max(2, index + 2);
}

function isShellChromeSlot(section = {}) {
  const slotId = String(section?.slotId || "").trim().toLowerCase();
  return (
    slotId === "header-top" ||
    slotId === "header-bottom" ||
    slotId.startsWith("header") ||
    slotId === "footer" ||
    slotId.startsWith("footer") ||
    slotId === "gnb" ||
    slotId.startsWith("nav")
  );
}

function shouldSkipSectionInSequence(authorInput = {}, section = {}) {
  const source = authorInput && typeof authorInput === "object" ? authorInput : {};
  const targetGroup = source.authoringRequest?.targetGroup && typeof source.authoringRequest.targetGroup === "object"
    ? source.authoringRequest.targetGroup
    : source.conceptPackage?.executionBrief?.targetGroup && typeof source.conceptPackage.executionBrief.targetGroup === "object"
      ? source.conceptPackage.executionBrief.targetGroup
      : {};
  const groupId = String(targetGroup?.groupId || "").trim().toLowerCase();
  if (groupId === "page" && isShellChromeSlot(section)) {
    return true;
  }
  return false;
}

function compactText(value = "", maxLength = 260) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function summarizeClassTokens(html = "", limit = 20) {
  const classes = Array.from(String(html || "").matchAll(/\bclass="([^"]+)"/gi))
    .flatMap((match) => String(match?.[1] || "").split(/\s+/))
    .map((item) => item.trim())
    .filter(Boolean);
  const useful = classes.filter((item) =>
    /^(bg-|text-|font-|tracking-|leading-|p[trblxy]?-\[|p[trblxy]?-\d|m[trblxy]?-\[|m[trblxy]?-\d|gap-|grid|flex|rounded|shadow|border|backdrop|from-|via-|to-)/.test(item)
  );
  return Array.from(new Set(useful)).slice(0, limit);
}

function summarizeHtmlExcerpt(html = "", maxLength = 360) {
  return compactText(
    String(html || "")
      .replace(/\s+/g, " ")
      .replace(/> </g, "><"),
    maxLength
  );
}

function buildSectionSequencePlan(authorInput = {}) {
  const source = authorInput && typeof authorInput === "object" ? authorInput : {};
  const sections = Array.isArray(source.designAuthorPacket?.sections)
    ? source.designAuthorPacket.sections.filter(Boolean).filter((section) => !shouldSkipSectionInSequence(source, section))
    : [];
  return sections
    .map((section, index) => ({
      order: index + 1,
      slotId: String(section?.slotId || "").trim(),
      componentId: String(section?.componentId || "").trim(),
      label: String(section?.label || section?.slotId || "").trim(),
      stage: inferSectionPriority(section, index) === 0 ? "anchor" : "support",
      priority: inferSectionPriority(section, index),
    }))
    .filter((item) => item.slotId)
    .sort((left, right) => left.priority - right.priority || left.order - right.order)
    .map((item, index) => ({
      ...item,
      sequenceIndex: index,
    }));
}

function normalizeClusterSlotIds(cluster = {}) {
  const direct = toStringArray(cluster?.slotIds, 12);
  if (direct.length) return direct;
  return toStringArray(cluster?.replacementTargets || cluster?.slots || cluster?.families, 12);
}

function normalizeAuthoringClusters(authorInput = {}) {
  const source = authorInput && typeof authorInput === "object" ? authorInput : {};
  const clusters = Array.isArray(source.designAuthorPacket?.execution?.authoringClusters)
    ? source.designAuthorPacket.execution.authoringClusters
    : Array.isArray(source.conceptPackage?.executionBrief?.authoringClusters)
      ? source.conceptPackage.executionBrief.authoringClusters
      : [];
  return clusters
    .map((cluster, index) => ({
      clusterId: String(cluster?.clusterId || `cluster-${index + 1}`).trim(),
      targetGroupId: String(cluster?.targetGroupId || "").trim(),
      goal: String(cluster?.goal || "").trim(),
      rules: toStringArray(cluster?.rules, 8),
      slotIds: normalizeClusterSlotIds(cluster),
    }))
    .filter((cluster) => cluster.clusterId && cluster.slotIds.length);
}

function buildSectionClusterPlan(authorInput = {}, sequencePlan = null, supportSteps = null) {
  const plan = Array.isArray(sequencePlan) ? sequencePlan : buildSectionSequencePlan(authorInput);
  const support = Array.isArray(supportSteps)
    ? supportSteps
    : plan.filter((step) => inferSectionPriority({ slotId: step?.slotId }, step?.order || 0) > 0);
  const supportBySlot = new Map(
    support
      .map((step) => [String(step?.slotId || "").trim(), step])
      .filter(([slotId, step]) => slotId && step)
  );
  const assigned = new Set();
  const groups = [];
  for (const cluster of normalizeAuthoringClusters(authorInput)) {
    const steps = cluster.slotIds
      .map((slotId) => supportBySlot.get(String(slotId || "").trim()))
      .filter((step) => step && !assigned.has(step.slotId))
      .sort((left, right) => left.sequenceIndex - right.sequenceIndex);
    if (steps.length < 2) continue;
    steps.forEach((step) => assigned.add(step.slotId));
    groups.push({
      type: "cluster",
      clusterId: cluster.clusterId,
      targetGroupId: cluster.targetGroupId,
      goal: cluster.goal,
      rules: cluster.rules,
      slotIds: steps.map((step) => step.slotId),
      steps,
      firstSequenceIndex: steps[0]?.sequenceIndex || 0,
    });
  }
  for (const step of support) {
    if (assigned.has(step.slotId)) continue;
    groups.push({
      type: "single",
      clusterId: "",
      slotIds: [step.slotId],
      steps: [step],
      firstSequenceIndex: step.sequenceIndex || 0,
    });
  }
  return groups.sort((left, right) => left.firstSequenceIndex - right.firstSequenceIndex);
}

function summarizeAuthoredSectionsForContext(sections = [], limit = 8) {
  return (Array.isArray(sections) ? sections : [])
    .filter(Boolean)
    .slice(0, limit)
    .map((section) => {
      const html = String(section?.html || "").trim();
      return {
        slotId: String(section?.slotId || "").trim(),
        componentId: String(section?.componentId || "").trim(),
        role: String(section?.role || section?.content?.role || "").trim(),
        intent: String(section?.content?.intent || "").trim(),
        advisory: toStringArray(section?.advisory, 4),
        styleSignature: {
          classTokens: summarizeClassTokens(html, 20),
        },
        htmlExcerpt: summarizeHtmlExcerpt(html, 360),
      };
    })
    .filter((item) => item.slotId);
}

module.exports = {
  buildSectionSequencePlan,
  buildSectionClusterPlan,
  summarizeAuthoredSectionsForContext,
};
