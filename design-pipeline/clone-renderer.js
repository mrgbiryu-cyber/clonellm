"use strict";

const { buildCloneSnapshotEnvelope } = require("./clone-model");

function buildCanonicalCloneRequest(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const envelope = buildCloneSnapshotEnvelope({
    snapshotState: source.snapshotState || "after",
    cloneRenderModel: source.cloneRenderModel || source,
  });
  return {
    pageId: envelope.cloneRenderModel.pageId,
    viewportProfile: envelope.cloneRenderModel.viewportProfile,
    snapshotState: envelope.snapshotState,
    rendererSurface: envelope.cloneRenderModel.rendererSurface,
    renderIntent: envelope.cloneRenderModel.renderIntent,
    targetGroup: envelope.cloneRenderModel.targetGroup,
    sections: envelope.cloneRenderModel.sections,
  };
}

module.exports = {
  buildCanonicalCloneRequest,
};
