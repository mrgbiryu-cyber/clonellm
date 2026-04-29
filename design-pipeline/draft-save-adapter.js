"use strict";

function buildRuntimeDraftPayload(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    id: String(source.id || "").trim() || `runtime-draft-${Date.now()}`,
    pageId: String(source.pageId || "").trim(),
    viewportProfile: String(source.viewportProfile || "pc").trim() || "pc",
    builderVersion: "design-runtime-v1",
    rendererSurface: String(source.rendererSurface || "tailwind").trim() || "tailwind",
    status: String(source.status || "draft").trim() || "draft",
    summary: String(source.summary || "").trim(),
    proposedVersionLabel: String(source.proposedVersionLabel || "").trim(),
    operations: Array.isArray(source.operations) ? source.operations.slice(0, 24) : [],
    report: source.report && typeof source.report === "object" ? source.report : {},
    authoredSectionHtmlPackage: source.authoredSectionHtmlPackage && typeof source.authoredSectionHtmlPackage === "object"
      ? source.authoredSectionHtmlPackage
      : null,
    renderedHtmlReference: source.renderedHtmlReference && typeof source.renderedHtmlReference === "object"
      ? source.renderedHtmlReference
      : {},
    snapshotData: source.snapshotData && typeof source.snapshotData === "object"
      ? source.snapshotData
      : {},
    advisory: Array.isArray(source.advisory) ? source.advisory.slice(0, 24) : [],
  };
}

module.exports = {
  buildRuntimeDraftPayload,
};
