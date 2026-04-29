"use strict";

const { normalizeAuthoredSectionHtmlPackage } = require("./author-output");
const { projectAuthoredMarkdownToHtmlPackage } = require("./author-document");

function buildRuntimeRendererInput(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const authoredSectionHtmlPackage = source.authoredSectionHtmlPackage && typeof source.authoredSectionHtmlPackage === "object"
    ? source.authoredSectionHtmlPackage
    : null;
  const authoredSectionMarkdownDocument = String(source.authoredSectionMarkdownDocument || "").trim();
  return {
    authoredSectionHtmlPackage: normalizeAuthoredSectionHtmlPackage(
      authoredSectionHtmlPackage || projectAuthoredMarkdownToHtmlPackage(authoredSectionMarkdownDocument) || source
    ),
    authoredSectionMarkdownDocument,
    referencePageShell: source.referencePageShell && typeof source.referencePageShell === "object"
      ? { ...source.referencePageShell }
      : {},
    runtimeContext: source.runtimeContext && typeof source.runtimeContext === "object"
      ? { ...source.runtimeContext }
      : {},
  };
}

module.exports = {
  buildRuntimeRendererInput,
};
