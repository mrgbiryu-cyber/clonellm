"use strict";

const fs = require("fs");
const path = require("path");

const POLICY_PATH = path.join(__dirname, "..", "data", "normalized", "asset-role-policies.json");

function readAssetRolePolicies() {
  if (!fs.existsSync(POLICY_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
    return Array.isArray(parsed?.policies) ? parsed.policies : [];
  } catch {
    return [];
  }
}

function normalizeSlotId(value = "") {
  return String(value || "").trim().toLowerCase();
}

function resolveAssetUsagePolicy(pageId = "", slotId = "") {
  const normalizedSlotId = normalizeSlotId(slotId);
  if (!normalizedSlotId) return null;
  const policies = readAssetRolePolicies();
  const matched =
    policies.find((policy) =>
      (Array.isArray(policy?.targetSlots) ? policy.targetSlots : [])
        .map((item) => normalizeSlotId(item))
        .includes(normalizedSlotId)
    ) || null;
  if (!matched) return null;
  return {
    policyId: String(matched.policyId || "").trim(),
    label: String(matched.label || "").trim(),
    pageId: String(pageId || "").trim(),
    slotId: String(slotId || "").trim(),
    imageUsageMode: String(matched.imageUsageMode || "").trim(),
    allowedBackgroundRoles: Array.isArray(matched.allowedBackgroundRoles) ? matched.allowedBackgroundRoles.slice(0, 8) : [],
    allowedAccentRoles: Array.isArray(matched.allowedAccentRoles) ? matched.allowedAccentRoles.slice(0, 8) : [],
    allowedPrimaryRoles: Array.isArray(matched.allowedPrimaryRoles) ? matched.allowedPrimaryRoles.slice(0, 8) : [],
    allowedCardMediaRoles: Array.isArray(matched.allowedCardMediaRoles) ? matched.allowedCardMediaRoles.slice(0, 8) : [],
    disallowPromoReoverlay: Boolean(matched.disallowPromoReoverlay),
    notes: Array.isArray(matched.notes) ? matched.notes.slice(0, 12) : [],
  };
}

module.exports = {
  readAssetRolePolicies,
  resolveAssetUsagePolicy,
};
