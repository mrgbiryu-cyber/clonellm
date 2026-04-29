"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");
const PROFILE_PATH = path.join(ROOT, "data", "normalized", "external-free-image-source-profiles.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function titleFromUrl(value = "") {
  const source = String(value || "").trim();
  if (!source) return "";
  const last = source.split("/").pop() || "";
  try {
    return `File:${decodeURIComponent(last).replace(/_/g, " ")}`;
  } catch {
    return `File:${last.replace(/_/g, " ")}`;
  }
}

function profileIdFromAssetId(assetId = "") {
  const parts = String(assetId || "").split(".");
  return parts[0] === "external" && parts[1] ? parts[2] || "" : "";
}

function buildProfileMap(payload = {}) {
  const map = new Map();
  for (const provider of Array.isArray(payload.providerProfiles) ? payload.providerProfiles : []) {
    for (const profile of Array.isArray(provider.searchProfiles) ? provider.searchProfiles : []) {
      const profileId = String(profile?.profileId || "").trim();
      if (!profileId) continue;
      map.set(profileId, profile);
    }
  }
  return map;
}

function main() {
  const registry = readJson(REGISTRY_PATH, { assets: [] });
  const profileMap = buildProfileMap(readJson(PROFILE_PATH, { providerProfiles: [] }));
  const nowIso = new Date().toISOString();
  let updated = 0;

  for (const asset of Array.isArray(registry.assets) ? registry.assets : []) {
    if (String(asset?.sourceType || "").trim() !== "external-stock") continue;
    const profileId = String(asset.sourceProfileId || "").trim() || profileIdFromAssetId(asset.assetId);
    const profile = profileMap.get(profileId) || null;
    let touched = false;
    if (profileId && !asset.sourceProfileId) {
      asset.sourceProfileId = profileId;
      touched = true;
    }
    if (!asset.sourceTitle) {
      asset.sourceTitle = titleFromUrl(asset.sourceUrl);
      touched = true;
    }
    if (profile) {
      if (!asset.visualTone && profile.visualTone) {
        asset.visualTone = profile.visualTone;
        touched = true;
      }
      if (!asset.semanticRole && profile.semanticRole) {
        asset.semanticRole = profile.semanticRole;
        touched = true;
      }
      if (!Array.isArray(asset.pageFamilies) || !asset.pageFamilies.length) {
        asset.pageFamilies = Array.isArray(profile.pageFamilies) ? profile.pageFamilies : [];
        touched = true;
      }
      if (!Array.isArray(asset.slotFamilies) || !asset.slotFamilies.length) {
        asset.slotFamilies = Array.isArray(profile.slotFamilies) ? profile.slotFamilies : [];
        touched = true;
      }
    }
    if (touched) updated += 1;
  }

  if (updated) {
    registry.updatedAt = nowIso;
    registry.auditLog = [
      ...(Array.isArray(registry.auditLog) ? registry.auditLog : []),
      { type: "external-stock-metadata-backfill", updated, updatedAt: nowIso },
    ].slice(-160);
    writeJson(REGISTRY_PATH, registry);
  }

  console.log(JSON.stringify({ updated }, null, 2));
}

main();
