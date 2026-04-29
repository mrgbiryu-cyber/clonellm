"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");

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

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => String(item || "").startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function unique(values = []) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));
}

function normalizeDecision(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (["approved", "approve"].includes(normalized)) return "approved";
  if (["blocked", "block", "rejected", "reject"].includes(normalized)) return "blocked";
  if (["pending", "skip", ""].includes(normalized)) return "pending";
  throw new Error(`unsupported_decision:${value}`);
}

function updateRootStatus(asset = {}) {
  const statuses = Object.values(asset.variants || {})
    .map((variant) => String(variant?.status || "").trim())
    .filter(Boolean);
  if (!statuses.length) return;
  if (statuses.every((status) => status === "approved")) {
    asset.status = "approved";
    return;
  }
  if (statuses.includes("candidate")) {
    asset.status = "candidate";
    return;
  }
  if (statuses.includes("approved")) {
    asset.status = "candidate";
    return;
  }
  if (statuses.includes("blocked")) asset.status = "blocked";
}

function applyDecision(asset = {}, variant = {}, viewportProfile = "", decision = {}, nowIso = "") {
  const status = normalizeDecision(decision.decision);
  if (status === "pending") return null;
  if (String(asset.sourceType || "").trim() !== "external-stock") {
    throw new Error(`not_external_stock:${asset.assetId}`);
  }
  const reviewedBy = String(decision.reviewedBy || "external-stock-review").trim();
  const reviewNotes = String(decision.reviewNotes || "").trim()
    || `external stock ${status}; sourceProfile=${asset.sourceProfileId || ""}; role=${asset.role || ""}`;
  variant.status = status;
  variant.reviewedAt = nowIso;
  variant.reviewedBy = reviewedBy;
  variant.reviewNotes = reviewNotes;
  variant.processing = unique([
    ...toStringList(variant.processing),
    "external-stock-manual-review",
    `status-${status}`,
  ]);
  asset.validationTags = unique([
    ...toStringList(asset.validationTags).filter((tag) => tag !== "candidate"),
    status,
    "external-stock-manual-review",
  ]);
  if (status === "approved") {
    asset.llmDo = unique([
      ...toStringList(asset.llmDo).filter((item) => !/only after candidate is approved/i.test(item)),
      "use only for the matching approved viewport variant, page family, slot family, and asset role",
      "preserve license and attribution metadata when required",
    ]);
    asset.llmDont = unique([
      ...toStringList(asset.llmDont).filter((item) => !/use as final output while candidate/i.test(item)),
      "reuse across unapproved viewport variants",
      "use as icon or promo-complete art",
    ]);
    asset.conflictHints = unique([
      ...toStringList(asset.conflictHints).filter((item) => !/candidate approval required/i.test(item)),
      "approval is limited to the reviewed viewport variant",
    ]);
  }
  updateRootStatus(asset);
  return {
    assetId: String(asset.assetId || "").trim(),
    variantId: String(variant.variantId || "").trim(),
    viewportProfile,
    status,
    reviewedBy,
    reviewNotes,
  };
}

function main() {
  const decisionsPathArg = getArg("decisions", "");
  const apply = process.argv.includes("--apply");
  if (!decisionsPathArg) throw new Error("decisions_path_required");
  const decisionsPath = path.isAbsolute(decisionsPathArg) ? decisionsPathArg : path.join(ROOT, decisionsPathArg);
  const payload = readJson(decisionsPath, null);
  if (!payload || !Array.isArray(payload.decisions)) throw new Error("invalid_decisions_file");
  const registry = readJson(REGISTRY_PATH, { assets: [] });
  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const byId = new Map(assets.map((asset) => [String(asset?.assetId || "").trim(), asset]));
  const nowIso = new Date().toISOString();
  const applied = [];
  const skipped = [];
  const errors = [];

  for (const decision of payload.decisions) {
    try {
      const status = normalizeDecision(decision.decision);
      if (status === "pending") {
        skipped.push({ assetId: decision.assetId, viewportProfile: decision.viewportProfile, reason: "pending" });
        continue;
      }
      const assetId = String(decision.assetId || "").trim();
      const viewportProfile = String(decision.viewportProfile || "").trim();
      const asset = byId.get(assetId);
      if (!asset) throw new Error(`asset_not_found:${assetId}`);
      const variant = asset.variants?.[viewportProfile];
      if (!variant) throw new Error(`variant_not_found:${assetId}:${viewportProfile}`);
      const row = applyDecision(asset, variant, viewportProfile, decision, nowIso);
      if (row) applied.push(row);
    } catch (error) {
      errors.push({ assetId: decision.assetId, viewportProfile: decision.viewportProfile, error: String(error.message || error) });
    }
  }

  if (apply && applied.length && !errors.length) {
    registry.updatedAt = nowIso;
    registry.auditLog = [
      ...(Array.isArray(registry.auditLog) ? registry.auditLog : []),
      ...applied.map((row) => ({
        type: "external-stock-review-decision",
        ...row,
        updatedAt: nowIso,
      })),
    ].slice(-160);
    writeJson(REGISTRY_PATH, registry);
  }

  console.log(JSON.stringify({
    apply,
    decisionsPath: path.relative(ROOT, decisionsPath),
    appliedCount: applied.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    applied,
    skipped: skipped.slice(0, 20),
    errors,
  }, null, 2));

  if (errors.length) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}
