"use strict";

const { toStringArray } = require("./contracts");

function buildConceptPlans(request = {}) {
  const designPolicy = request?.designPolicy && typeof request.designPolicy === "object" ? request.designPolicy : {};
  const layoutDirections = Array.isArray(designPolicy.layoutDirections) ? designPolicy.layoutDirections : [];
  const plans = layoutDirections.length ? layoutDirections : ["clean-core"];
  return plans.slice(0, 4).map((direction, index) => ({
    conceptId: `concept-${index + 1}`,
    conceptLabel: String(direction || `Concept ${index + 1}`).trim() || `Concept ${index + 1}`,
    narrative: toStringArray(designPolicy.problemStatement).slice(0, 3),
    layoutSystem: String(direction || "").trim(),
    typography: {
      body: "brand-body",
      headline: "brand-headline-strong",
    },
    colorSystem: {
      baseSurface: "light-neutral",
      accent: "brand-accent",
    },
    ctaPolicy: {
      primary: "single-strong-primary",
      secondary: "supporting-secondary",
    },
    promotionTonePolicy: "editorial-over-discount",
  }));
}

function buildExecutionBrief(request = {}, options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const selectedConcept = source.selectedConcept && typeof source.selectedConcept === "object" ? source.selectedConcept : null;
  const designPolicy = request?.designPolicy && typeof request.designPolicy === "object" ? request.designPolicy : {};
  return {
    northStar: [
      ...toStringArray(request?.pageIdentity?.character),
      ...toStringArray(designPolicy.problemStatement),
      ...toStringArray(designPolicy.hierarchyGoals),
    ].slice(0, 8),
    targetGroup: request?.targetGroup || null,
    selectedConcept,
    guardrails: Array.isArray(designPolicy.guardrails) ? designPolicy.guardrails.slice(0, 16) : [],
    excludedChoices: Array.isArray(designPolicy.exclusions) ? designPolicy.exclusions.slice(0, 12) : [],
    builderInstructions: [
      ...toStringArray(designPolicy.mustKeep).map((item) => `Keep: ${item}`),
      ...toStringArray(designPolicy.mustChange).map((item) => `Change: ${item}`),
    ].slice(0, 20),
  };
}

module.exports = {
  buildConceptPlans,
  buildExecutionBrief,
};
