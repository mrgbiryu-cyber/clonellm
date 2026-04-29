"use strict";

const { buildCloneRenderModel } = require("./clone-model");

function buildDesignDraftSkeleton(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const plannerBrief = source.plannerBrief && typeof source.plannerBrief === "object" ? source.plannerBrief : {};
  const request = source.request && typeof source.request === "object" ? source.request : {};
  const targetGroup = plannerBrief.targetGroup || request.targetGroup || {};
  const componentIds = Array.isArray(targetGroup.componentIds) ? targetGroup.componentIds : [];
  const slotIds = Array.isArray(targetGroup.slotIds) ? targetGroup.slotIds : [];
  const sections = componentIds.map((componentId, index) => ({
    slotId: String(slotIds[index] || componentId.split(".").pop() || `slot-${index + 1}`).trim(),
    componentId: String(componentId || "").trim(),
    familyId: "",
    templateId: "",
    primitiveTree: null,
    patch: {},
    priority: index === 0 ? "primary" : "secondary",
  }));
  const cloneRenderModel = buildCloneRenderModel({
    pageId: request.pageId,
    viewportProfile: request.viewportProfile,
    rendererSurface: request.rendererSurface,
    targetGroup,
    sections,
  });
  return {
    summary: "",
    conceptPlan: plannerBrief.selectedConcept || null,
    executionBrief: plannerBrief.executionBrief || null,
    operations: [],
    componentComposition: [],
    cloneRenderModel,
    advisory: {
      notes: [],
    },
  };
}

module.exports = {
  buildDesignDraftSkeleton,
};
