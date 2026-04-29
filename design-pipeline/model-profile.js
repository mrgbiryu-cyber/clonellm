"use strict";

const fs = require("fs");
const path = require("path");

const MODEL_PROFILE_PATH = path.join(__dirname, "..", "data", "runtime", "design-model-profile.json");

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readDesignModelProfile() {
  const payload = readJson(MODEL_PROFILE_PATH, null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload;
}

function normalizeModel(value = "") {
  return String(value || "").trim();
}

function resolveDesignStageModel(stage = "", fallbackModel = "") {
  if (String(process.env.DESIGN_MODEL_PROFILE_BYPASS || "").trim() === "1") {
    return normalizeModel(fallbackModel);
  }
  const profile = readDesignModelProfile();
  const normalizedStage = String(stage || "").trim();
  const normalizedFallbackModel = normalizeModel(fallbackModel);
  if (!profile) return normalizedFallbackModel;
  const stageMap = profile.stageModels && typeof profile.stageModels === "object" ? profile.stageModels : {};
  const stageModel = normalizeModel(stageMap[normalizedStage]);
  if (stageModel) return stageModel;
  const defaultModel = normalizeModel(profile.defaultModel);
  if (defaultModel) return defaultModel;
  return normalizedFallbackModel;
}

module.exports = {
  MODEL_PROFILE_PATH,
  readDesignModelProfile,
  resolveDesignStageModel,
};
