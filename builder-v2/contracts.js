"use strict";

function resolveAlias(value, aliases = {}, fallback = "") {
  const raw = String(value || "").trim();
  const normalizedRaw = raw.toLowerCase();
  if (normalizedRaw && Object.prototype.hasOwnProperty.call(aliases, normalizedRaw)) {
    return {
      raw,
      normalized: aliases[normalizedRaw],
      recognized: true,
    };
  }
  return {
    raw,
    normalized: fallback,
    recognized: !normalizedRaw,
  };
}

function normalizeBuilderVersion(value, fallback = "v2") {
  return resolveAlias(value, {
    legacy: "legacy",
    v1: "legacy",
    v2: "v2",
  }, fallback).normalized;
}

function normalizeBuilderMode(value, fallback = "standard") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "compare" || normalized === "quality-compare") return "compare";
  if (normalized === "standard" || normalized === "default" || normalized === "normal") return "standard";
  return fallback;
}

function normalizeRendererSurface(value, fallback = "custom") {
  return resolveAlias(value, {
    tailwind: "tailwind",
    tw: "tailwind",
    custom: "custom",
    "scoped-css": "custom",
    "v2-custom": "custom",
  }, fallback).normalized;
}

function normalizeBuilderProvider(value, fallback = "openrouter") {
  return resolveAlias(value, {
    local: "local",
    codex: "local",
    "local-codex": "local",
    fixture: "local",
    openrouter: "openrouter",
    remote: "openrouter",
    llm: "openrouter",
  }, fallback).normalized;
}

function buildBuilderRequestValidation(meta = {}) {
  const issues = [];
  if (!meta.builderVersion.recognized) {
    issues.push(`Unsupported builderVersion "${meta.builderVersion.raw || "unknown"}". Expected "v2".`);
  }
  if (!meta.rendererSurface.recognized) {
    issues.push(`Unsupported rendererSurface "${meta.rendererSurface.raw || "unknown"}". Expected "custom" or "tailwind".`);
  }
  if (!meta.builderProvider.recognized) {
    issues.push(`Unsupported builderProvider "${meta.builderProvider.raw || "unknown"}". Expected "openrouter" or "local".`);
  }
  if (meta.builderVersion.normalized !== "v2") {
    issues.push(`builder-v2 orchestrator cannot execute builderVersion "${meta.builderVersion.normalized}".`);
  }
  return {
    valid: issues.length === 0,
    issues,
    normalized: {
      builderVersion: meta.builderVersion.normalized,
      rendererSurface: meta.rendererSurface.normalized,
      builderProvider: meta.builderProvider.normalized,
    },
    raw: {
      builderVersion: meta.builderVersion.raw,
      rendererSurface: meta.rendererSurface.raw,
      builderProvider: meta.builderProvider.raw,
    },
  };
}

function resolveBuilderVersion(payload = {}, matchedPlan = null) {
  return normalizeBuilderVersion(
    payload?.builderVersion ||
      matchedPlan?.input?.userInput?.builderVersion ||
      matchedPlan?.output?.requirementPlan?.builderVersion ||
      process.env.BUILDER_DEFAULT_VERSION ||
      "v2",
    "v2"
  );
}

function normalizeBuilderV2Request(payload = {}, matchedPlan = null) {
  const builderVersionValue =
    payload?.builderVersion ||
    matchedPlan?.input?.userInput?.builderVersion ||
    matchedPlan?.output?.requirementPlan?.builderVersion ||
    process.env.BUILDER_DEFAULT_VERSION ||
    "v2";
  const rendererSurfaceValue =
    payload?.rendererSurface ||
    matchedPlan?.input?.userInput?.rendererSurface ||
    matchedPlan?.output?.requirementPlan?.rendererSurface ||
    process.env.BUILDER_DEFAULT_RENDERER_SURFACE ||
    "custom";
  const builderProviderValue =
    payload?.builderProvider ||
    matchedPlan?.input?.userInput?.builderProvider ||
    matchedPlan?.output?.requirementPlan?.builderProvider ||
    process.env.BUILDER_DEFAULT_PROVIDER ||
    "openrouter";
  const builderVersionMeta = resolveAlias(builderVersionValue, {
    legacy: "legacy",
    v1: "legacy",
    v2: "v2",
  }, "v2");
  const rendererSurfaceMeta = resolveAlias(rendererSurfaceValue, {
    tailwind: "tailwind",
    tw: "tailwind",
    custom: "custom",
    "scoped-css": "custom",
    "v2-custom": "custom",
  }, "custom");
  const builderProviderMeta = resolveAlias(builderProviderValue, {
    local: "local",
    codex: "local",
    "local-codex": "local",
    fixture: "local",
    openrouter: "openrouter",
    remote: "openrouter",
    llm: "openrouter",
  }, "openrouter");
  const builderVersion = builderVersionMeta.normalized;
  return {
    builderVersion,
    builderMode: normalizeBuilderMode(
      payload?.builderMode ||
        matchedPlan?.input?.userInput?.builderMode ||
        matchedPlan?.output?.requirementPlan?.builderMode ||
        process.env.BUILDER_DEFAULT_MODE ||
        "compare",
      "compare"
    ),
    rendererSurface: normalizeRendererSurface(
      rendererSurfaceValue,
      "custom"
    ),
    builderProvider: normalizeBuilderProvider(
      builderProviderValue,
      "openrouter"
    ),
    intensity: String(payload?.intensity || "balanced").trim() || "balanced",
    versionLabelHint: String(payload?.versionLabelHint || "").trim(),
    validation: buildBuilderRequestValidation({
      builderVersion: builderVersionMeta,
      rendererSurface: rendererSurfaceMeta,
      builderProvider: builderProviderMeta,
    }),
  };
}

function shouldUseBuilderV2(payload = {}, matchedPlan = null) {
  return resolveBuilderVersion(payload, matchedPlan) === "v2";
}

module.exports = {
  normalizeBuilderVersion,
  normalizeBuilderMode,
  resolveBuilderVersion,
  normalizeBuilderV2Request,
  shouldUseBuilderV2,
  normalizeRendererSurface,
  normalizeBuilderProvider,
};
