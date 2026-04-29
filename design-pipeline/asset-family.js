"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STARTER_REGISTRY_PATH = path.join(ROOT, "data", "normalized", "asset-pipeline-starter.json");
const GENERATED_FAMILY_REGISTRY_PATH = path.join(ROOT, "data", "normalized", "generated-asset-families.json");

function toStringArray(value, limit = 24) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }
  return [];
}

function readJsonFileSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readStarterAssetFamilies() {
  const payload = readJsonFileSafe(STARTER_REGISTRY_PATH, { assetFamilies: [] });
  return Array.isArray(payload?.assetFamilies) ? payload.assetFamilies : [];
}

function readGeneratedAssetFamilies() {
  const payload = readJsonFileSafe(GENERATED_FAMILY_REGISTRY_PATH, { families: {} });
  const families = payload?.families && typeof payload.families === "object" ? payload.families : {};
  return Object.fromEntries(
    Object.entries(families)
      .map(([key, value]) => [String(key || "").trim(), value && typeof value === "object" ? value : {}])
      .filter(([key]) => key)
  );
}

function writeGeneratedAssetFamilies(families = {}) {
  const normalizedFamilies =
    families && typeof families === "object" && !Array.isArray(families)
      ? families
      : {};
  fs.mkdirSync(path.dirname(GENERATED_FAMILY_REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(
    GENERATED_FAMILY_REGISTRY_PATH,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        families: normalizedFamilies,
      },
      null,
      2
    )
  );
}

function normalizeFamilySpec(item = {}) {
  const source = item && typeof item === "object" ? item : {};
  return {
    assetFamilyId: String(source.id || source.assetFamilyId || "").trim(),
    familyId: String(source.familyId || "").trim(),
    role: String(source.role || "").trim(),
    usage: toStringArray(source.usage, 12),
    status: String(source.status || "").trim(),
    memberCount: Number(source.memberCount || 0),
    memberLabels: toStringArray(source.memberLabels, 24),
    styleSummary: String(source.styleSummary || "").trim(),
    styleSpec: source.styleSpec && typeof source.styleSpec === "object" ? { ...source.styleSpec } : {},
    generationMode: String(source.generationMode || "").trim(),
    restrictedUse: toStringArray(source.restrictedUse, 12),
  };
}

function normalizeGeneratedFamilyPackage(item = {}) {
  const source = item && typeof item === "object" ? item : {};
  return {
    assetFamilyId: String(source.assetFamilyId || source.id || "").trim(),
    familyId: String(source.familyId || "").trim(),
    generatedAt: String(source.generatedAt || "").trim(),
    status: String(source.status || "").trim() || "ready",
    styleSummary: String(source.styleSummary || "").trim(),
    styleSpec: source.styleSpec && typeof source.styleSpec === "object" ? { ...source.styleSpec } : {},
    members: Array.isArray(source.members)
      ? source.members
          .map((member) => ({
            label: String(member?.label || "").trim(),
            assetId: String(member?.assetId || "").trim(),
            assetUrl: String(member?.assetUrl || "").trim(),
            format: String(member?.format || "").trim(),
          }))
          .filter((member) => member.label && member.assetUrl)
      : [],
  };
}

function saveGeneratedAssetFamilyPackage(input = {}) {
  const normalized = normalizeGeneratedFamilyPackage(input);
  if (!normalized.assetFamilyId || !normalized.familyId) {
    throw new Error("generated asset family package requires assetFamilyId and familyId");
  }
  const families = readGeneratedAssetFamilies();
  families[normalized.assetFamilyId] = {
    ...normalized,
    generatedAt: normalized.generatedAt || new Date().toISOString(),
    status: normalized.status || "ready",
  };
  writeGeneratedAssetFamilies(families);
  return families[normalized.assetFamilyId];
}

function removeGeneratedAssetFamilyPackage(assetFamilyId = "") {
  const normalizedAssetFamilyId = String(assetFamilyId || "").trim();
  if (!normalizedAssetFamilyId) return false;
  const families = readGeneratedAssetFamilies();
  if (!families[normalizedAssetFamilyId]) return false;
  delete families[normalizedAssetFamilyId];
  writeGeneratedAssetFamilies(families);
  return true;
}

function resolveAvailableAssetFamilies(pageId = "", slotId = "") {
  const normalizedUsageId = `${String(pageId || "").trim()}.${String(slotId || "").trim()}`.toLowerCase();
  if (!normalizedUsageId || normalizedUsageId === ".") return [];

  const starterFamilies = readStarterAssetFamilies().map((item) => normalizeFamilySpec(item));
  const generatedFamilies = readGeneratedAssetFamilies();

  return starterFamilies
    .filter((item) => item.assetFamilyId && item.familyId)
    .filter((item) => item.usage.some((entry) => String(entry || "").trim().toLowerCase() === normalizedUsageId))
    .map((item) => {
      const generatedPackage = normalizeGeneratedFamilyPackage(generatedFamilies[item.assetFamilyId] || {});
      const hasGeneratedMembers = Array.isArray(generatedPackage.members) && generatedPackage.members.length > 0;
      return {
        ...item,
        status: hasGeneratedMembers ? generatedPackage.status || "ready" : item.status,
        generatedFamilyPackage: hasGeneratedMembers ? generatedPackage : null,
      };
    });
}

module.exports = {
  readStarterAssetFamilies,
  readGeneratedAssetFamilies,
  writeGeneratedAssetFamilies,
  saveGeneratedAssetFamilyPackage,
  removeGeneratedAssetFamilyPackage,
  normalizeGeneratedFamilyPackage,
  resolveAvailableAssetFamilies,
};
