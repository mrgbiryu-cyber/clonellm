"use strict";

const {
  normalizeBuildRequest,
  validateBuildRequest,
} = require("./contracts");
const { buildConceptPlans, buildExecutionBrief } = require("./policy");

function pickSelectedConcept(conceptPlans = [], options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const plans = Array.isArray(conceptPlans) ? conceptPlans.filter(Boolean) : [];
  if (!plans.length) return null;
  const selectedConceptId = String(
    source.selectedConceptId || source.conceptId || ""
  ).trim();
  if (selectedConceptId) {
    const matchedById = plans.find((plan) => String(plan?.conceptId || "").trim() === selectedConceptId);
    if (matchedById) return matchedById;
  }
  const selectedConceptLabel = String(
    source.selectedConceptLabel || source.conceptLabel || source.concept || ""
  ).trim();
  if (selectedConceptLabel) {
    const normalizedLabel = selectedConceptLabel.toLowerCase();
    const matchedByLabel = plans.find((plan) => String(plan?.conceptLabel || "").trim().toLowerCase() === normalizedLabel);
    if (matchedByLabel) return matchedByLabel;
  }
  const selectedConceptIndex = Number.isInteger(source.selectedConceptIndex)
    ? source.selectedConceptIndex
    : Number.parseInt(source.selectedConceptIndex, 10);
  if (Number.isInteger(selectedConceptIndex) && selectedConceptIndex >= 0 && selectedConceptIndex < plans.length) {
    return plans[selectedConceptIndex];
  }
  return plans[0] || null;
}

function buildPlannerBrief(input = {}, options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const request = normalizeBuildRequest(input);
  const validation = validateBuildRequest(request);
  const conceptPlans = buildConceptPlans(request);
  const selectedConcept = pickSelectedConcept(conceptPlans, source);
  const executionBrief = buildExecutionBrief(request, {
    selectedConcept,
  });
  return {
    request,
    validation,
    providerMeta: source.providerMeta || null,
    plannerBrief: {
      pageId: request.pageId,
      viewportProfile: request.viewportProfile,
      rendererSurface: request.rendererSurface,
      targetGroup: request.targetGroup,
      pageIdentity: request.pageIdentity,
      designPolicy: request.designPolicy,
      conceptPlans,
      selectedConcept,
      executionBrief,
      systemNorthStar: [
        ...request.designPolicy.problemStatement,
        ...request.designPolicy.hierarchyGoals,
      ].slice(0, 8),
      providerMeta: source.providerMeta || null,
    },
  };
}

module.exports = {
  buildPlannerBrief,
  pickSelectedConcept,
};
