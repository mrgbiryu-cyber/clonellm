"use strict";

const fs = require("fs");
const path = require("path");

const POLICY_PATH = path.join(__dirname, "..", "data", "normalized", "asset-fallback-policies.json");

function readAssetFallbackPolicies() {
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

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function findFallbackPolicy(slotId = "") {
  const normalizedSlotId = normalizeSlotId(slotId);
  if (!normalizedSlotId) return null;
  return readAssetFallbackPolicies().find((policy) =>
    toStringList(policy?.targetSlots).map(normalizeSlotId).includes(normalizedSlotId)
  ) || null;
}

function hasApprovedImageForRoles(assetRegistry = {}, roles = []) {
  const allowedRoles = new Set(toStringList(roles));
  if (!allowedRoles.size) return false;
  const images = Array.isArray(assetRegistry.images) ? assetRegistry.images : [];
  return images.some((asset) =>
    String(asset?.status || "").trim() === "approved" &&
    allowedRoles.has(String(asset?.role || "").trim())
  );
}

function hasApprovedIconFamily(assetRegistry = {}) {
  const families = Array.isArray(assetRegistry.iconFamilies) ? assetRegistry.iconFamilies : [];
  return families.some((family) =>
    String(family?.status || "").trim() === "approved" &&
    String(family?.role || "icon-only").trim() === "icon-only"
  );
}

function resolveAssetFallbackPolicy(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const slotId = String(source.slotId || "").trim();
  const assetRegistry = source.assetRegistry && typeof source.assetRegistry === "object"
    ? source.assetRegistry
    : {};
  const policy = findFallbackPolicy(slotId);
  if (!policy) {
    return {
      policyId: "default-css-composition",
      slotId,
      mode: "css-composition",
      preferred: "css-composition",
      fallback: "css-composition",
      finalFallback: "css-composition",
      reason: "no_slot_policy",
      requiredApprovedAssetRoles: [],
      allowedGeneratedAssetRoles: [],
      allowGeneratedTextInImage: false,
      notes: ["No explicit fallback policy exists; render complete CSS/Tailwind structure without inventing assets."],
    };
  }

  const requiredRoles = toStringList(policy.requiredApprovedAssetRoles);
  const preferred = String(policy.preferred || "asset-first").trim() || "asset-first";
  const fallback = String(policy.fallback || "css-composition").trim() || "css-composition";
  const iconFamilyRequired = requiredRoles.includes("icon-only") || fallback === "icon-family-router";
  const hasApprovedAsset = iconFamilyRequired
    ? hasApprovedIconFamily(assetRegistry)
    : hasApprovedImageForRoles(assetRegistry, requiredRoles);
  const mode = preferred === "css-composition"
    ? "css-composition"
    : hasApprovedAsset
      ? "asset-first"
      : fallback;
  const reason = preferred === "css-composition"
    ? "css_preferred_for_slot"
    : hasApprovedAsset
      ? "approved_role_asset_available"
      : `missing_approved_${iconFamilyRequired ? "icon_family" : "role_asset"}`;

  return {
    policyId: String(policy.policyId || "").trim(),
    slotId,
    mode,
    preferred,
    fallback,
    finalFallback: String(policy.finalFallback || "css-composition").trim() || "css-composition",
    reason,
    requiredApprovedAssetRoles: requiredRoles,
    allowedGeneratedAssetRoles: toStringList(policy.allowedGeneratedAssetRoles),
    allowGeneratedTextInImage: Boolean(policy.allowGeneratedTextInImage),
    notes: toStringList(policy.notes, 8),
  };
}

module.exports = {
  readAssetFallbackPolicies,
  resolveAssetFallbackPolicy,
};
