"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");
const QUEUE_PATH = path.join(ROOT, "data", "normalized", "lge-text-removal-queue.json");
const REPORT_PATH = path.join(ROOT, "data", "normalized", "lge-text-removed-registration-report.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function unique(values = []) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));
}

function usageForRole(role = "") {
  if (role === "background-only") {
    return {
      allowedUsage: ["section-background", "hero-background", "banner-background"],
      restrictedUsage: ["icon", "quickmenu-icon", "promo-reoverlay"],
    };
  }
  if (role === "object-only") {
    return {
      allowedUsage: ["object-accent", "product-visual", "editorial-stage-foreground"],
      restrictedUsage: ["icon", "promo-reoverlay"],
    };
  }
  return {
    allowedUsage: ["reference-context", "card-media-review"],
    restrictedUsage: ["icon", "promo-reoverlay"],
  };
}

async function readDimensions(filePath = "") {
  const meta = await sharp(filePath).metadata();
  if (!meta.width || !meta.height) throw new Error(`dimension_missing:${filePath}`);
  return { width: meta.width, height: meta.height };
}

function assetIdForWorkOrder(workOrder = {}) {
  return `${String(workOrder.parentAssetId || "").trim()}.text-removed.${String(workOrder.viewportProfile || "pc").trim()}.v1`;
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
  if (asset.status === "approved") return;
  if (statuses.includes("candidate")) {
    asset.status = "candidate";
    return;
  }
  if (statuses.includes("blocked")) asset.status = "blocked";
}

async function buildDerivedAsset(workOrder = {}, parentAsset = {}) {
  const viewportProfile = String(workOrder.viewportProfile || "pc").trim() || "pc";
  const outputRef = String(workOrder.outputRef || "").trim();
  if (!outputRef.startsWith("data/raw/assets/text-removed/")) throw new Error("output_ref_required");
  const outputPath = path.join(ROOT, outputRef);
  if (!fs.existsSync(outputPath)) throw new Error("output_file_missing");
  const dimensions = await readDimensions(outputPath);
  const role = String(workOrder.targetRole || "background-only").trim() || "background-only";
  const assetId = assetIdForWorkOrder(workOrder);
  const usage = usageForRole(role);
  return {
    assetId,
    assetKind: "image",
    status: "candidate",
    sourceType: "lge-derived",
    derivativeType: "text-removed",
    providerName: "LGE-derived text-removed",
    sourceRef: outputRef,
    sourceUrl: String(workOrder.sourceUrl || "").trim(),
    parentAssetId: String(workOrder.parentAssetId || "").trim(),
    parentVariantId: String(workOrder.parentVariantId || "").trim(),
    variantPolicy: "viewport-specific",
    variants: {
      [viewportProfile]: {
        variantId: `${assetId}.${viewportProfile}`,
        status: "candidate",
        sourceRef: outputRef,
        sourceUrl: String(workOrder.sourceUrl || "").trim(),
        viewportProfile,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: `${dimensions.width}:${dimensions.height}`,
        safeArea: {
          copyZone: "review-required-after-text-removal",
          primarySubjectZone: "review-required",
          avoidOverlayZones: ["unknown until text-removal review"],
          notes: "Text-removed derivative. Candidate until visual artifacts, remaining copy, and viewport safe area are reviewed.",
        },
        cropGuidance: {
          mode: viewportProfile === "mo" ? "mobile-text-removed-review" : "desktop-text-removed-review",
          objectFit: "cover",
          objectPosition: "center",
        },
        processing: [
          "derived-from-lge",
          "text-removed",
          String(workOrder.deriveMode || "").trim() || "text-removal-inpaint",
          "status-candidate",
        ],
        reviewNotes: "Registered as candidate from text-removal output; requires visual approval before final builder use.",
      },
    },
    licenseProfile: "internal-lge-derived",
    processing: [
      "derived-from-lge",
      "text-removed",
      String(workOrder.deriveMode || "").trim() || "text-removal-inpaint",
    ],
    pageFamilies: [String(workOrder.pageId || "").trim()].filter(Boolean),
    slotFamilies: [String(workOrder.slotId || "").trim()].filter(Boolean),
    componentIds: [],
    viewportProfiles: [viewportProfile],
    role,
    ...usage,
    containsText: false,
    textDensity: "none-after-edit-unverified",
    visualTone: String(parentAsset.visualTone || "lge-derived-text-removed").trim() || "lge-derived-text-removed",
    brandRisk: "medium",
    semanticRole: `${workOrder.pageId} ${workOrder.slotId} ${viewportProfile} text-removed LGE-derived ${role} candidate`,
    llmDescription: `Text-removed derivative candidate from ${workOrder.parentAssetId}. Use only after approval. ${String(workOrder.parentDescription || "").trim()}`,
    llmDo: [
      "use for visual review and asset approval only",
      "promote to approved only after text-removal artifact and safe-area review",
    ],
    llmDont: [
      "use in final builder output before approval",
      "reuse across viewport without a matching approved variant",
      "treat as original LGE source",
    ],
    selectionHints: unique([
      String(workOrder.pageId || "").trim(),
      String(workOrder.slotId || "").trim(),
      viewportProfile,
      role,
      "text-removed",
    ]),
    conflictHints: [
      "candidate derivative must not bypass approval gate",
      "check for residual embedded text or inpainting artifacts",
    ],
    validationTags: unique([
      "lge-derived",
      "text-removed",
      "candidate",
      viewportProfile,
      role,
    ]),
    provenanceNotes: `Derived from blocked LGE source asset ${workOrder.parentAssetId} (${workOrder.parentVariantId}). Original sourceUrl=${workOrder.sourceUrl}`,
  };
}

function mergeAsset(existing = {}, next = {}) {
  const variants = {
    ...(existing.variants && typeof existing.variants === "object" ? existing.variants : {}),
    ...(next.variants && typeof next.variants === "object" ? next.variants : {}),
  };
  const merged = {
    ...existing,
    ...next,
    status: existing.status === "approved" ? "approved" : next.status,
    variants,
    pageFamilies: unique([...(existing.pageFamilies || []), ...(next.pageFamilies || [])]),
    slotFamilies: unique([...(existing.slotFamilies || []), ...(next.slotFamilies || [])]),
    componentIds: unique([...(existing.componentIds || []), ...(next.componentIds || [])]),
    viewportProfiles: unique([...(existing.viewportProfiles || []), ...(next.viewportProfiles || [])]),
    validationTags: unique([...(existing.validationTags || []), ...(next.validationTags || [])]),
  };
  updateRootStatus(merged);
  return merged;
}

async function main() {
  const registry = readJson(REGISTRY_PATH, { assets: [] });
  const queue = readJson(QUEUE_PATH, { workOrders: [] });
  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const byId = new Map(assets.map((asset) => [String(asset.assetId || "").trim(), asset]).filter(([id]) => id));
  const registered = [];
  const skipped = [];
  const failed = [];
  const nowIso = new Date().toISOString();

  for (const workOrder of Array.isArray(queue.workOrders) ? queue.workOrders : []) {
    const outputRef = String(workOrder.outputRef || "").trim();
    const outputPath = outputRef ? path.join(ROOT, outputRef) : "";
    if (!outputPath || !fs.existsSync(outputPath)) {
      skipped.push({ workOrderId: workOrder.workOrderId, reason: "output-file-missing", outputRef });
      continue;
    }
    try {
      const parentAsset = byId.get(String(workOrder.parentAssetId || "").trim()) || {};
      const next = await buildDerivedAsset(workOrder, parentAsset);
      const existing = byId.get(next.assetId);
      const existingVariantStatus = String(existing?.variants?.[workOrder.viewportProfile]?.status || "").trim();
      if (["approved", "blocked"].includes(existingVariantStatus)) {
        skipped.push({ workOrderId: workOrder.workOrderId, assetId: next.assetId, reason: `${existingVariantStatus}-existing` });
        continue;
      }
      byId.set(next.assetId, existing ? mergeAsset(existing, next) : next);
      registered.push({ workOrderId: workOrder.workOrderId, assetId: next.assetId, outputRef });
    } catch (error) {
      failed.push({ workOrderId: workOrder.workOrderId, outputRef, error: String(error?.message || error) });
    }
  }

  registry.assets = Array.from(byId.values()).sort((a, b) => String(a.assetId || "").localeCompare(String(b.assetId || ""), "ko"));
  registry.updatedAt = nowIso;
  registry.auditLog = [
    ...(Array.isArray(registry.auditLog) ? registry.auditLog : []),
    {
      type: "text-removed-asset-registration",
      registeredCount: registered.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      updatedAt: nowIso,
    },
  ].slice(-120);
  writeJson(REGISTRY_PATH, registry);
  writeJson(REPORT_PATH, {
    generatedAt: nowIso,
    registeredCount: registered.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    registered,
    skipped,
    failed,
  });
  console.log(JSON.stringify({
    reportPath: path.relative(ROOT, REPORT_PATH),
    registeredCount: registered.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
