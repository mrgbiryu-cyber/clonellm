"use strict";

function buildReferencePageShell(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    pageId: String(source.pageId || "").trim(),
    viewportProfile: String(source.viewportProfile || "pc").trim() || "pc",
    rawShellHtml: String(source.rawShellHtml || "").trim(),
    sectionBoundaryMap: source.sectionBoundaryMap && typeof source.sectionBoundaryMap === "object"
      ? { ...source.sectionBoundaryMap }
      : {},
    shellMetadata: source.shellMetadata && typeof source.shellMetadata === "object"
      ? { ...source.shellMetadata }
      : {},
  };
}

module.exports = {
  buildReferencePageShell,
};
