"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");
const REPORT_PATH = path.join(ROOT, "data", "normalized", "lge-asset-review-queue.json");

const APPLY = process.argv.includes("--apply");
const REVIEWER = "codex-auto-review";

const HARD_TEXT_SIGNAL_RE = new RegExp([
  "출시", "기념", "할인", "쿠폰", "이벤트", "기획전", "혜택", "기간", "한정", "특가", "세일",
  "로고", "타이틀", "문구", "글자", "텍스트", "자세히\\s*보기", "더\\s*보기", "신청", "구매",
  "sale", "coupon", "event", "logo", "wedding", "community", "d5",
].join("|"), "i");

const WEAK_TEXT_SIGNAL_RE = new RegExp([
  "베스트샵", "고객지원", "소모품", "가전\\s*구독", "상담", "렌탈", "구독",
].join("|"), "i");

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

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function unique(values = []) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));
}

function compactAssetText(asset = {}, variant = {}) {
  return [
    asset.assetId,
    asset.sourceUrl,
    asset.sourceRef,
    asset.llmDescription,
    asset.semanticRole,
    asset.provenanceNotes,
    ...(Array.isArray(asset.selectionHints) ? asset.selectionHints : []),
    variant.sourceUrl,
    variant.sourceRef,
    variant.assetUrl,
    variant.variantId,
  ].map((item) => String(item || "")).join(" ");
}

function statusDistribution(assets = []) {
  const root = {};
  const variants = {};
  for (const asset of assets) {
    const status = String(asset?.status || "unknown").trim() || "unknown";
    root[status] = (root[status] || 0) + 1;
    for (const variant of Object.values(asset?.variants || {})) {
      const variantStatus = String(variant?.status || asset?.status || "unknown").trim() || "unknown";
      variants[variantStatus] = (variants[variantStatus] || 0) + 1;
    }
  }
  return { root, variants };
}

function variantRows(assets = []) {
  const rows = [];
  for (const asset of assets) {
    const variants = asset?.variants && typeof asset.variants === "object" ? asset.variants : {};
    for (const [viewportProfile, variant] of Object.entries(variants)) {
      rows.push({ asset, variant, viewportProfile });
    }
  }
  return rows;
}

function candidateReason(asset = {}, variant = {}, viewportProfile = "pc") {
  const status = String(variant.status || asset.status || "").trim();
  if (status !== "candidate") return { decision: "skip", reason: "not-candidate" };
  if (String(asset.sourceType || "").trim() !== "lge-derived") {
    return { decision: "manual-review", reason: "non-lge-derived-source" };
  }
  if (viewportProfile !== "pc") {
    return { decision: "manual-review", reason: "mobile-variant-requires-visual-review" };
  }
  const role = String(asset.role || "").trim();
  const pageId = toStringList(asset.pageFamilies)[0] || "";
  const slotId = toStringList(asset.slotFamilies)[0] || "";
  const width = Number(variant.width || 0) || 0;
  const height = Number(variant.height || 0) || 0;
  const aspect = width && height ? width / height : 0;
  const text = compactAssetText(asset, variant);
  const hasHardTextSignal = HARD_TEXT_SIGNAL_RE.test(text);
  const hasWeakTextSignal = WEAK_TEXT_SIGNAL_RE.test(text);
  const sourceUrl = String(variant.sourceUrl || asset.sourceUrl || "").trim();
  const sourceRef = String(variant.sourceRef || asset.sourceRef || "").trim();
  const isLocalCaptured = /^data\/raw\/assets\//.test(sourceRef);
  const isLgeDisplayObject = /^https:\/\/www\.lge\.co\.kr\/kr\/upload\/admin\/display\/displayObject\//.test(sourceUrl);

  if (hasHardTextSignal) return { decision: "auto-block", reason: "embedded-copy-or-logo-signal" };
  if (hasWeakTextSignal && role === "reference-only" && width > 0 && height > 0 && width <= 320 && height <= 140) {
    return { decision: "auto-block", reason: "small-label-or-service-copy-signal" };
  }
  if (hasWeakTextSignal) return { decision: "manual-review", reason: "weak-text-or-category-signal" };
  if (!isLgeDisplayObject) return { decision: "manual-review", reason: "source-url-not-lge-display-object" };
  if (!isLocalCaptured) return { decision: "manual-review", reason: "local-capture-missing" };
  if (!width || !height) return { decision: "manual-review", reason: "dimension-missing" };
  if (role === "promo-complete") return { decision: "auto-block", reason: "promo-complete-role" };
  if (role === "background-only" && ["hero", "banner"].includes(slotId) && width >= 1200 && height >= 300 && aspect >= 2.2) {
    return { decision: "auto-approve", reason: "pc-text-free-stage-background" };
  }
  if (role === "object-only" && pageId === "home" && slotId === "hero" && width >= 600 && height >= 160) {
    return { decision: "auto-approve", reason: "pc-home-hero-object-visual" };
  }
  return { decision: "manual-review", reason: "safe-but-not-auto-approval-scope" };
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
  if (statuses.includes("blocked") && !statuses.includes("candidate")) {
    asset.status = "blocked";
    return;
  }
  if (statuses.includes("candidate")) {
    asset.status = "candidate";
    return;
  }
  if (statuses.includes("blocked")) asset.status = "blocked";
}

function applyDecision(asset = {}, variant = {}, viewportProfile = "", decision = "", reason = "", nowIso = "") {
  const nextStatus = decision === "auto-approve" ? "approved" : decision === "auto-block" ? "blocked" : "";
  if (!nextStatus) return false;
  variant.status = nextStatus;
  variant.reviewedAt = nowIso;
  variant.reviewedBy = REVIEWER;
  variant.reviewNotes = `${reason}; automated narrow-scope LGE asset review`;
  variant.processing = unique([
    ...toStringList(variant.processing),
    "automated-lge-candidate-review",
    `status-${nextStatus}`,
  ]);
  asset.validationTags = unique([
    ...toStringList(asset.validationTags).filter((tag) => tag !== "candidate"),
    nextStatus,
    "automated-lge-candidate-review",
  ]);
  if (decision === "auto-approve") {
    asset.llmDo = unique([
      ...toStringList(asset.llmDo).filter((item) => !/candidate|promote/i.test(item)),
      "use in final builder output only for the matching page, slot, role, and viewport variant",
    ]);
    asset.llmDont = unique([
      ...toStringList(asset.llmDont).filter((item) => !/before approval/i.test(item)),
      "reuse across viewport without a matching approved variant",
      "use as icon or promo-complete surface",
    ]);
    asset.conflictHints = unique([
      ...toStringList(asset.conflictHints).filter((item) => !/requires safe-area review|requires viewport-specific approval/i.test(item)),
      "approval is limited to this reviewed viewport variant",
    ]);
  }
  updateRootStatus(asset);
  return true;
}

function reportRow(asset = {}, variant = {}, viewportProfile = "", decision = "", reason = "") {
  return {
    assetId: String(asset.assetId || "").trim(),
    variantId: String(variant.variantId || "").trim(),
    pageId: toStringList(asset.pageFamilies)[0] || "",
    slotId: toStringList(asset.slotFamilies)[0] || "",
    viewportProfile,
    status: String(variant.status || asset.status || "").trim(),
    sourceType: String(asset.sourceType || "").trim(),
    role: String(asset.role || "").trim(),
    width: Number(variant.width || 0) || 0,
    height: Number(variant.height || 0) || 0,
    sourceRef: String(variant.sourceRef || asset.sourceRef || "").trim(),
    sourceUrl: String(variant.sourceUrl || asset.sourceUrl || "").trim(),
    decision,
    reason,
    llmDescription: String(asset.llmDescription || "").trim(),
  };
}

function main() {
  const registry = readJson(REGISTRY_PATH, { assets: [] });
  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const before = statusDistribution(assets);
  const nowIso = new Date().toISOString();
  const decisions = {
    autoApproved: [],
    autoBlocked: [],
    manualReview: [],
    skipped: [],
  };
  const auditLog = [];

  for (const { asset, variant, viewportProfile } of variantRows(assets)) {
    const { decision, reason } = candidateReason(asset, variant, viewportProfile);
    const row = reportRow(asset, variant, viewportProfile, decision, reason);
    if (decision === "auto-approve") {
      decisions.autoApproved.push(row);
      if (APPLY && applyDecision(asset, variant, viewportProfile, decision, reason, nowIso)) auditLog.push(row);
    } else if (decision === "auto-block") {
      decisions.autoBlocked.push(row);
      if (APPLY && applyDecision(asset, variant, viewportProfile, decision, reason, nowIso)) auditLog.push(row);
    } else if (decision === "manual-review") {
      decisions.manualReview.push(row);
    } else {
      decisions.skipped.push(row);
    }
  }

  const after = statusDistribution(assets);
  const report = {
    generatedAt: nowIso,
    apply: APPLY,
    criteria: {
      autoApprove: [
        "lge-derived source",
        "pc variant only",
        "local captured file exists in data/raw/assets",
        "known LGE displayObject sourceUrl",
        "non-promo role",
        "no embedded copy/logo text signal",
        "hero/banner background-only at >=1200x300 and aspect >=2.2, or home hero object-only at >=600x160",
      ],
      autoBlock: [
        "candidate variant with embedded copy/logo/promotion text signal",
        "candidate variant with promo-complete role",
      ],
      manualReview: [
        "mobile variants",
        "generated/external/imported variants",
        "missing dimensions or missing local capture",
        "reference-only assets",
        "object/card/icon-like assets outside the narrow auto-approval scope",
      ],
    },
    summary: {
      candidateVariantCount: decisions.autoApproved.length + decisions.autoBlocked.length + decisions.manualReview.length,
      autoApprovedCount: decisions.autoApproved.length,
      autoBlockedCount: decisions.autoBlocked.length,
      manualReviewCount: decisions.manualReview.length,
      skippedCount: decisions.skipped.length,
      appliedUpdateCount: auditLog.length,
    },
    statusDistributionBefore: before,
    statusDistributionAfter: after,
    autoApproved: decisions.autoApproved,
    autoBlocked: decisions.autoBlocked,
    manualReview: decisions.manualReview,
  };

  writeJson(REPORT_PATH, report);

  if (APPLY) {
    registry.updatedAt = nowIso;
    registry.auditLog = [
      ...(Array.isArray(registry.auditLog) ? registry.auditLog : []),
      ...auditLog.map((row) => ({
        type: "image-variant-automated-review",
        assetId: row.assetId,
        variantId: row.variantId,
        viewportProfile: row.viewportProfile,
        status: row.decision === "auto-approve" ? "approved" : "blocked",
        reviewedBy: REVIEWER,
        reviewNotes: row.reason,
        updatedAt: nowIso,
      })),
    ].slice(-120);
    writeJson(REGISTRY_PATH, registry);
  }

  console.log(JSON.stringify({
    apply: APPLY,
    reportPath: path.relative(ROOT, REPORT_PATH),
    summary: report.summary,
    statusDistributionBefore: before,
    statusDistributionAfter: after,
  }, null, 2));
}

main();
