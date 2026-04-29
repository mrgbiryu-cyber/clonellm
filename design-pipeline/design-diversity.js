"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIVERSITY_PROFILES_PATH = path.join(ROOT, "data", "normalized", "design-diversity-profiles.json");
const DIVERSITY_SAMPLE_LIBRARY_PATH = path.join(ROOT, "data", "normalized", "design-diversity-sample-library.json");

function readJsonFile(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeScopeToken(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function listMatchesScopeValue(list = [], value = "") {
  const source = toStringList(list);
  const exact = String(value || "").trim();
  if (!source.length) return true;
  if (source.includes(exact)) return true;
  const normalizedValue = normalizeScopeToken(exact);
  return Boolean(normalizedValue && source.some((item) => normalizeScopeToken(item) === normalizedValue));
}

function matchesScope(entry = {}, scope = {}) {
  const pageId = String(scope.pageId || "").trim();
  const slotId = String(scope.slotId || "").trim();
  const componentId = String(scope.componentId || "").trim();
  const viewportProfile = String(scope.viewportProfile || "pc").trim() || "pc";
  const pageFamilies = toStringList(entry.pageFamilies);
  const slotFamilies = toStringList(entry.slotFamilies);
  const componentIds = toStringList(entry.componentIds);
  const viewportProfiles = toStringList(entry.viewportProfiles);
  const pageOk = listMatchesScopeValue(pageFamilies, pageId);
  const slotOk = listMatchesScopeValue(slotFamilies, slotId);
  const componentOk = listMatchesScopeValue(componentIds, componentId);
  const viewportOk = listMatchesScopeValue(viewportProfiles, viewportProfile);
  return pageOk && slotOk && componentOk && viewportOk;
}

function compactDiversityProfile(profile = {}) {
  return {
    profileId: String(profile.profileId || "").trim(),
    visualLanguage: String(profile.visualLanguage || "").trim(),
    layoutMoves: toStringList(profile.layoutMoves).slice(0, 5),
    typographyMoves: toStringList(profile.typographyMoves).slice(0, 4),
    colorMoves: toStringList(profile.colorMoves).slice(0, 4),
    motionIntent: String(profile.motionIntent || "").trim(),
    assetFit: toStringList(profile.assetFit).slice(0, 4),
    avoid: toStringList(profile.avoid).slice(0, 4),
    whenToUse: toStringList(profile.whenToUse).slice(0, 4),
  };
}

function clipText(value = "", maxLength = 520) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function compactDiversitySample(sample = {}) {
  return {
    sampleId: String(sample.sampleId || "").trim(),
    profileId: String(sample.profileId || "").trim(),
    sampleLabel: String(sample.sampleLabel || "").trim(),
    designIntent: clipText(sample.designIntent, 220),
    layoutSketch: clipText(sample.layoutSketch, 260),
    htmlSketch: clipText(sample.htmlSketch, 700),
    interactionCue: clipText(sample.interactionCue, 220),
    assetCue: clipText(sample.assetCue, 220),
    avoid: toStringList(sample.avoid).slice(0, 4),
  };
}

function resolveDesignDiversitySamples(input = {}, profileId = "") {
  const source = input && typeof input === "object" ? input : {};
  const targetProfileId = String(profileId || "").trim();
  const payload = readJsonFile(DIVERSITY_SAMPLE_LIBRARY_PATH, { samples: [] });
  const samples = Array.isArray(payload.samples) ? payload.samples : [];
  return samples
    .filter((sample) => String(sample?.status || "approved").trim() === "approved")
    .filter((sample) => !targetProfileId || String(sample?.profileId || "").trim() === targetProfileId)
    .filter((sample) => matchesScope(sample, source))
    .map(compactDiversitySample)
    .filter((sample) => sample.sampleId)
    .slice(0, 3);
}

function resolveDesignDiversityProfiles(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const payload = readJsonFile(DIVERSITY_PROFILES_PATH, { profiles: [] });
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  return profiles
    .filter((profile) => String(profile?.status || "approved").trim() === "approved")
    .filter((profile) => matchesScope(profile, source))
    .map((profile) => {
      const compactProfile = compactDiversityProfile(profile);
      return {
        ...compactProfile,
        samples: resolveDesignDiversitySamples(source, compactProfile.profileId).slice(0, 2),
      };
    })
    .filter((profile) => profile.profileId)
    .slice(0, 3);
}

module.exports = {
  resolveDesignDiversityProfiles,
  resolveDesignDiversitySamples,
};
