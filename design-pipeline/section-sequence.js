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

function summarizeAuthoredSectionsForContext(sections = [], limit = 8) {
  return (Array.isArray(sections) ? sections : [])
    .filter(Boolean)
    .slice(0, limit)
    .map((section) => ({
      slotId: String(section?.slotId || "").trim(),
      componentId: String(section?.componentId || "").trim(),
      role: String(section?.role || section?.content?.role || "").trim(),
      intent: String(section?.content?.intent || "").trim(),
      advisory: toStringArray(section?.advisory, 4),
    }))
    .filter((item) => item.slotId);
}

module.exports = {
  buildSectionSequencePlan,
  summarizeAuthoredSectionsForContext,
};
