"use strict";

const { buildRuntimeRendererInput } = require("./runtime-input");
const { buildReferencePageShell } = require("./shell-loader");
const { resolveAuthoredAssetPlaceholders } = require("./asset-resolver");
const { sanitizeRuntimeHtml } = require("./runtime-sanitize");
const { insertAuthoredSectionsIntoShell } = require("./html-inserter");
const { buildRuntimeDraftPayload } = require("./draft-save-adapter");

function renderRuntimeDraft(input = {}) {
  const runtimeInput = buildRuntimeRendererInput(input);
  const referencePageShell = buildReferencePageShell(runtimeInput.referencePageShell || {});
  const beforeHtml = String(referencePageShell.rawShellHtml || "").trim();
  const afterInsert = insertAuthoredSectionsIntoShell({
    rawShellHtml: beforeHtml,
    authoredSectionHtmlPackage: runtimeInput.authoredSectionHtmlPackage,
    sectionBoundaryMap: referencePageShell.sectionBoundaryMap || {},
  });
  const assetResolved = resolveAuthoredAssetPlaceholders({
    html: afterInsert.afterHtml,
    authoredSectionHtmlPackage: runtimeInput.authoredSectionHtmlPackage,
    assetMap:
      runtimeInput.runtimeContext?.assetResolutionContext?.currentPageAssetMap &&
      typeof runtimeInput.runtimeContext.assetResolutionContext.currentPageAssetMap === "object"
        ? runtimeInput.runtimeContext.assetResolutionContext.currentPageAssetMap
        : {},
  });
  const sanitized = sanitizeRuntimeHtml({
    html: assetResolved.html,
  });
  const pageId = runtimeInput.authoredSectionHtmlPackage.pageId;
  const viewportProfile = runtimeInput.authoredSectionHtmlPackage.viewportProfile;
  const advisory = [
    ...afterInsert.advisory,
    ...assetResolved.advisory,
    ...sanitized.advisory,
  ];
  return {
    beforeHtml,
    afterHtml: sanitized.html,
    draftBuild: buildRuntimeDraftPayload({
      pageId,
      viewportProfile,
      summary: "runtime authored html draft",
      proposedVersionLabel: `${pageId || "page"}-runtime-v1`,
      authoredSectionHtmlPackage: runtimeInput.authoredSectionHtmlPackage,
      renderedHtmlReference: {
        beforeHtml,
        afterHtml: sanitized.html,
      },
      report: {
        authoredSections: Array.isArray(runtimeInput.authoredSectionHtmlPackage.sections)
          ? runtimeInput.authoredSectionHtmlPackage.sections.map((section) => ({
              slotId: String(section?.slotId || "").trim(),
              componentId: String(section?.componentId || "").trim(),
            }))
          : [],
        sanitizeRemoved: sanitized.removedItems,
        resolvedAssets: assetResolved.resolvedAssets,
      },
      snapshotData: {
        source: "design-runtime-renderer",
        authoredSectionMarkdownDocument: runtimeInput.authoredSectionMarkdownDocument || "",
        renderedHtmlReference: {
          beforeHtml,
          afterHtml: sanitized.html,
        },
      },
      advisory,
    }),
    advisory,
  };
}

module.exports = {
  renderRuntimeDraft,
};
