"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");
const QUEUE_PATH = path.join(ROOT, "data", "normalized", "lge-text-removal-queue.json");
const DERIVATIVE_DIR = path.join(ROOT, "data", "raw", "assets", "text-removed");

const TEXT_SIGNAL_RE = new RegExp([
  "타이틀", "문구", "글자", "텍스트", "로고", "new", "sale", "coupon", "event",
  "출시", "기념", "할인", "쿠폰", "이벤트", "기획전", "혜택", "기간", "한정", "세일",
  "자세히", "보기", "신청", "구매", "상담", "런칭", "사전", "포인트", "%",
  "wedding", "community", "d5", "베스트샵",
].join("|"), "i");

const ESSENTIAL_PROMO_RE = new RegExp([
  "쿠폰", "할인율", "할인", "기간", "한정", "이벤트", "기획전", "세일", "sale", "%",
  "포인트", "혜택", "카드혜택", "다품목할인", "혜택이벤트", "구매혜택", "자세히 보기",
].join("|"), "i");

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

function hash(value = "") {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 10);
}

function localPathFromSourceRef(sourceRef = "") {
  const ref = String(sourceRef || "").trim();
  if (!ref.startsWith("data/raw/assets/")) return "";
  const filePath = path.join(ROOT, ref);
  return fs.existsSync(filePath) ? filePath : "";
}

function extensionFromPath(filePath = "") {
  const ext = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return ext;
  if (ext === ".gif") return ".png";
  return ".png";
}

function derivativeFileName(assetId = "", viewportProfile = "", sourcePath = "") {
  const safeId = String(assetId || "asset")
    .replace(/^lge\./, "")
    .replace(/[^a-z0-9가-힣_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return `${safeId}.${viewportProfile}.text-removed.${hash(`${assetId}:${viewportProfile}:${sourcePath}`)}${extensionFromPath(sourcePath)}`;
}

function compactText(asset = {}, variant = {}) {
  return [
    asset.assetId,
    asset.role,
    asset.semanticRole,
    asset.llmDescription,
    asset.provenanceNotes,
    variant.sourceUrl,
    variant.sourceRef,
    ...(Array.isArray(asset.validationTags) ? asset.validationTags : []),
  ].map((item) => String(item || "")).join(" ");
}

function classifyWorkOrder(asset = {}, variant = {}, viewportProfile = "") {
  const width = Number(variant.width || 0) || 0;
  const height = Number(variant.height || 0) || 0;
  const role = String(asset.role || "").trim();
  const pageId = toStringList(asset.pageFamilies)[0] || "";
  const slotId = toStringList(asset.slotFamilies)[0] || "";
  const sourcePath = localPathFromSourceRef(variant.sourceRef || asset.sourceRef);
  const text = compactText(asset, variant);
  const hasTextSignal = TEXT_SIGNAL_RE.test(text);
  const essentialPromo = ESSENTIAL_PROMO_RE.test(text);
  const aspect = width && height ? width / height : 0;
  const isTinyLabel = width > 0 && height > 0 && width <= 320 && height <= 140;
  const isUsableLargeSurface =
    (viewportProfile === "pc" && width >= 600 && height >= 180) ||
    (viewportProfile === "mo" && width >= 260 && height >= 180);
  const isStageSlot = ["hero", "banner", "marketing-area"].includes(slotId);

  if (!sourcePath) {
    return { bucket: "excluded", reason: "local-source-missing", sourcePath };
  }
  if (!width || !height) {
    return { bucket: "excluded", reason: "dimension-missing", sourcePath };
  }
  if (isTinyLabel) {
    return { bucket: "excluded", reason: "small-label-or-badge-not-worth-inpainting", sourcePath };
  }
  if (!isStageSlot) {
    return { bucket: "excluded", reason: "non-stage-slot", sourcePath };
  }
  if (!isUsableLargeSurface) {
    return { bucket: "excluded", reason: "surface-too-small-for-reusable-background", sourcePath };
  }
  if (role !== "promo-complete" && !hasTextSignal) {
    return { bucket: "excluded", reason: "no-text-removal-signal", sourcePath };
  }

  const targetRole = slotId === "hero" || slotId === "banner" || aspect >= 2.2 ? "background-only" : "object-only";
  const deriveMode = essentialPromo ? "regenerate-or-heavy-inpaint" : "text-removal-inpaint";
  const priority = (() => {
    if (slotId === "hero" && viewportProfile === "mo") return 90;
    if (slotId === "hero" && viewportProfile === "pc") return 85;
    if (slotId === "banner") return 70;
    return 50;
  })();
  return {
    bucket: essentialPromo ? "manual-heavy-derivative" : "text-removal-candidate",
    reason: essentialPromo ? "embedded-promo-message-is-central" : "large-surface-with-removable-copy",
    sourcePath,
    targetRole,
    deriveMode,
    priority,
  };
}

function buildPrompt({ asset = {}, variant = {}, viewportProfile = "", targetRole = "" } = {}) {
  const slotId = toStringList(asset.slotFamilies)[0] || "";
  return [
    "Create a clean text-free derivative from the provided LGE-derived source image.",
    "Remove visible copy, badges, CTA text, sale labels, dates, coupons, and logos only when they are overlaid graphic elements.",
    "Preserve product objects, room/interior composition, lighting, material texture, and overall brand mood.",
    "Do not add new text, logos, badges, UI, CTA, people, products, or campaign meaning.",
    `Viewport variant: ${viewportProfile}. Target slot: ${slotId}. Target asset role after review: ${targetRole}.`,
    "Output must remain a candidate asset until visual safe-area and runtime-fit review approve it.",
    String(asset.llmDescription || "").trim(),
  ].filter(Boolean).join("\n");
}

function main() {
  const registry = readJson(REGISTRY_PATH, { assets: [] });
  const workOrders = [];
  const excluded = [];
  const nowIso = new Date().toISOString();

  for (const asset of Array.isArray(registry.assets) ? registry.assets : []) {
    for (const [viewportProfile, variant] of Object.entries(asset.variants || {})) {
      const status = String(variant?.status || asset.status || "").trim();
      if (status !== "blocked") continue;
      const classification = classifyWorkOrder(asset, variant, viewportProfile);
      const sourceRef = String(variant.sourceRef || asset.sourceRef || "").trim();
      const sourcePath = classification.sourcePath || localPathFromSourceRef(sourceRef);
      const outputFileName = sourcePath ? derivativeFileName(asset.assetId, viewportProfile, sourcePath) : "";
      const row = {
        workOrderId: `text-remove.${hash(`${asset.assetId}:${viewportProfile}:${sourceRef}`)}`,
        parentAssetId: String(asset.assetId || "").trim(),
        parentVariantId: String(variant.variantId || "").trim(),
        pageId: toStringList(asset.pageFamilies)[0] || "",
        slotId: toStringList(asset.slotFamilies)[0] || "",
        viewportProfile,
        parentRole: String(asset.role || "").trim(),
        targetRole: classification.targetRole || "",
        sourceRef,
        sourceUrl: String(variant.sourceUrl || asset.sourceUrl || "").trim(),
        localSourcePath: sourcePath ? path.relative(ROOT, sourcePath) : "",
        width: Number(variant.width || 0) || 0,
        height: Number(variant.height || 0) || 0,
        deriveMode: classification.deriveMode || "",
        priority: Number(classification.priority || 0) || 0,
        decision: classification.bucket,
        reason: classification.reason,
        outputRef: outputFileName ? `data/raw/assets/text-removed/${outputFileName}` : "",
        outputExists: outputFileName ? fs.existsSync(path.join(DERIVATIVE_DIR, outputFileName)) : false,
        registerAsStatus: "candidate",
        prompt: classification.bucket === "excluded"
          ? ""
          : buildPrompt({ asset, variant, viewportProfile, targetRole: classification.targetRole }),
        parentDescription: String(asset.llmDescription || "").trim(),
      };
      if (classification.bucket === "excluded") {
        excluded.push(row);
      } else {
        workOrders.push(row);
      }
    }
  }

  workOrders.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || a.parentAssetId.localeCompare(b.parentAssetId, "ko"));
  excluded.sort((a, b) => a.reason.localeCompare(b.reason, "ko") || a.parentAssetId.localeCompare(b.parentAssetId, "ko"));

  const countBy = (rows = [], key = "") => rows.reduce((acc, row) => {
    const value = String(row[key] || "unknown").trim() || "unknown";
    acc[value] = Number(acc[value] || 0) + 1;
    return acc;
  }, {});
  const report = {
    generatedAt: nowIso,
    registryPath: path.relative(ROOT, REGISTRY_PATH),
    derivativeOutputDir: path.relative(ROOT, DERIVATIVE_DIR),
    summary: {
      candidateCount: workOrders.filter((row) => row.decision === "text-removal-candidate").length,
      heavyDerivativeCount: workOrders.filter((row) => row.decision === "manual-heavy-derivative").length,
      excludedCount: excluded.length,
      totalBlockedVariantCount: workOrders.length + excluded.length,
      outputExistingCount: workOrders.filter((row) => row.outputExists).length,
    },
    byViewport: countBy(workOrders, "viewportProfile"),
    byPage: countBy(workOrders, "pageId"),
    bySlot: countBy(workOrders, "slotId"),
    excludedByReason: countBy(excluded, "reason"),
    workOrders,
    excluded,
  };
  writeJson(QUEUE_PATH, report);
  console.log(JSON.stringify({
    queuePath: path.relative(ROOT, QUEUE_PATH),
    summary: report.summary,
    byViewport: report.byViewport,
    byPage: report.byPage,
    bySlot: report.bySlot,
    excludedByReason: report.excludedByReason,
  }, null, 2));
}

main();
