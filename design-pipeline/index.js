"use strict";

const contracts = require("./contracts");
const { buildPlannerBrief } = require("./brief");
const { buildDesignDraftSkeleton } = require("./builder");
const localBuild = require("./build-local");
const { buildCanonicalCloneRequest } = require("./clone-renderer");
const cloneModel = require("./clone-model");
const policy = require("./policy");
const providerLocal = require("./provider-local");
const authorInput = require("./author-input");
const authorDocument = require("./author-document");
const authorLlm = require("./author-llm");
const authorOutput = require("./author-output");
const authorValidation = require("./author-validation");
const sectionSequence = require("./section-sequence");
const assetFamily = require("./asset-family");
const assetRegistry = require("./asset-registry");
const designDiversity = require("./design-diversity");
const runtimeInput = require("./runtime-input");
const shellLoader = require("./shell-loader");
const htmlInserter = require("./html-inserter");
const assetResolver = require("./asset-resolver");
const runtimeSanitize = require("./runtime-sanitize");
const draftSaveAdapter = require("./draft-save-adapter");
const runtimeRenderer = require("./runtime-renderer");

function createDesignPipelineFoundation(input = {}) {
  const brief = buildPlannerBrief(input);
  const draft = buildDesignDraftSkeleton(brief);
  const cloneRequest = buildCanonicalCloneRequest({
    snapshotState: "after",
    cloneRenderModel: draft.cloneRenderModel,
  });
  return {
    request: brief.request,
    validation: brief.validation,
    plannerBrief: brief.plannerBrief,
    draft,
    cloneRequest,
  };
}

module.exports = {
  ...contracts,
  ...cloneModel,
  ...localBuild,
  ...policy,
  ...providerLocal,
  ...authorInput,
  ...authorDocument,
  ...authorLlm,
  ...authorOutput,
  ...authorValidation,
  ...sectionSequence,
  ...assetFamily,
  ...assetRegistry,
  ...designDiversity,
  ...runtimeInput,
  ...shellLoader,
  ...htmlInserter,
  ...assetResolver,
  ...runtimeSanitize,
  ...draftSaveAdapter,
  ...runtimeRenderer,
  buildPlannerBrief,
  buildDesignDraftSkeleton,
  buildCanonicalCloneRequest,
  createDesignPipelineFoundation,
};
