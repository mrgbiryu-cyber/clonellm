"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");
const ARCHIVE_INDEX_PATH = path.join(ROOT, "data", "raw", "archive-index.json");
const SITE_DOCUMENT_PATH = path.join(ROOT, "data", "normalized", "site-document.json");
const MOBILE_REFERENCE_ASSETS_PATH = path.join(ROOT, "data", "normalized", "lge-mobile-reference-assets.json");
const ASSET_DIR = path.join(ROOT, "data", "raw", "assets");
const REPORT_PATH = path.join(ROOT, "data", "normalized", "lge-asset-import-report.json");

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

function hash(value = "") {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 10);
}

function slug(value = "") {
  const decoded = decodeURIComponent(String(value || "")).toLowerCase();
  return decoded
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "asset";
}

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function unique(values = []) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));
}

function localAssetPath(rawPath = "") {
  const base = path.basename(String(rawPath || "").trim());
  if (!base) return "";
  const filePath = path.join(ASSET_DIR, base);
  return fs.existsSync(filePath) ? filePath : "";
}

async function readDimensions(filePath = "") {
  if (!filePath) return null;
  try {
    const meta = await sharp(filePath).metadata();
    if (!meta.width || !meta.height) return null;
    return { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

function inferPageId(url = "", fallback = "") {
  const source = String(url || "").trim();
  const pathName = (() => {
    try {
      return new URL(source).pathname;
    } catch {
      return source;
    }
  })();
  if (/\/home\/?$/i.test(pathName)) return source.includes("homestyle.lge.co.kr") ? "homestyle-home" : "home";
  if (/\/support/i.test(pathName)) return "support";
  if (/\/bestshop/i.test(pathName)) return "bestshop";
  if (/\/care-solutions\/water-purifiers\/wd523vc/i.test(pathName)) return "care-solutions-pdp";
  if (/\/care-solutions/i.test(pathName)) return "care-solutions";
  if (/\/category\/tvs/i.test(pathName)) return "category-tvs";
  if (/\/category\/refrigerators/i.test(pathName)) return "category-refrigerators";
  if (/\/category\/stan-by-me/i.test(pathName)) return "category-stan-by-me";
  if (/\/category\/tumbler-cleaner/i.test(pathName)) return "category-tumbler-cleaner";
  if (/\/lg-signature\/info/i.test(pathName)) return "lg-signature-info";
  if (/\/objet-collection\/story/i.test(pathName)) return "objet-collection-story";
  return String(fallback || "").trim() || "unknown";
}

function inferViewport(pageUrl = "", sourceUrl = "") {
  const joined = `${pageUrl} ${sourceUrl}`.toLowerCase();
  if (/\/m\//.test(joined) || /(^|[_\-/])mo([_\-.]|$)/.test(joined) || /mobile/.test(joined)) return "mo";
  if (/(^|[_\-/])pc([_\-.]|$)/.test(joined) || /1760x500/.test(joined)) return "pc";
  return "pc";
}

function inferMobileReferenceViewport(sourceUrl = "") {
  const text = String(sourceUrl || "").toLowerCase();
  if (/(^|[_\-/])mo([_\-.]|$)|mobile/.test(text)) return "mo";
  if (/(^|[_\-/])pc([_\-.]|$)|1760x|1380x|1440x|_pc_|-pc-|pc_/.test(text)) return "pc";
  return "mo";
}

function inferSlot(sourceUrl = "", altText = "", pageId = "") {
  const text = `${sourceUrl} ${altText}`.toLowerCase();
  if (/gnb/.test(text)) return "gnb";
  if (/hero|homemain/.test(text)) return "hero";
  if (/category_plp_banner|banner|bn_/.test(text)) return "banner";
  if (/md|md초이스|choice/.test(text)) return "md-choice";
  if (/ranking|rank/.test(text)) return "ranking";
  if (/benefit|혜택|event|이벤트/.test(text)) return "benefit";
  if (/care/.test(pageId)) return "careBanner";
  return "marketing-area";
}

function classifyRole({ sourceUrl = "", altText = "", slotId = "", dimensions = null } = {}) {
  const text = `${decodeURIComponent(sourceUrl)} ${altText}`.toLowerCase();
  const textSignals = [
    "타이틀", "글자", "할인", "쿠폰", "이벤트", "세일", "기획전", "자세히 보기", "혜택",
    "기간한정", "sale", "coupon", "event", "banner", "days", "프로모션",
  ];
  const hasTextSignal = textSignals.some((item) => text.includes(String(item).toLowerCase()));
  if (slotId === "gnb") return hasTextSignal ? "promo-complete" : "reference-only";
  if (hasTextSignal) return "promo-complete";
  const aspect = dimensions?.width && dimensions?.height ? dimensions.width / dimensions.height : 0;
  if (slotId === "hero" || slotId === "banner") {
    if (aspect >= 2.2) return "background-only";
    return "object-only";
  }
  if (/제품|가전|냉장고|tv|소파|침대|스타일러|워시타워|공기청정기/.test(text)) return "object-only";
  return "reference-only";
}

function usageForRole(role = "") {
  if (role === "promo-complete") {
    return {
      allowedUsage: ["unchanged-reference-only"],
      restrictedUsage: ["reoverlay", "new-copy-overlay", "icon", "object-accent"],
    };
  }
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

function buildDescription({ role, sourceUrl, altText, slotId, viewport }) {
  const fileName = path.basename(decodeURIComponent(sourceUrl));
  const base = altText || fileName;
  if (role === "promo-complete") {
    return `LGE ${slotId} ${viewport} complete promotional visual. Use as reference only unless explicitly approved as unchanged content. ${base}`;
  }
  if (role === "background-only") {
    return `LGE ${slotId} ${viewport} text-light visual candidate for background use after review. ${base}`;
  }
  if (role === "object-only") {
    return `LGE ${slotId} ${viewport} object/product visual candidate for foreground or editorial accent use after review. ${base}`;
  }
  return `LGE ${slotId} ${viewport} reference asset candidate. ${base}`;
}

function collectCandidates() {
  const rows = [];
  const archive = readJson(ARCHIVE_INDEX_PATH, []);
  for (const row of Array.isArray(archive) ? archive : []) {
    const pageId = inferPageId(row.url, row.pageId);
    for (const asset of Array.isArray(row.assets) ? row.assets : []) {
      const sourceUrl = String(asset?.src || asset?.sourceUrl || "").trim();
      if (!/https:\/\/www\.lge\.co\.kr\/kr\/upload\/admin\/display\/displayObject\//.test(sourceUrl)) continue;
      rows.push({
        pageId,
        pageUrl: row.url || "",
        pageGroup: row.pageGroup || "",
        sourceUrl,
        localPath: asset.localPath || "",
        altText: String(asset.alt || "").trim(),
      });
    }
  }
  const siteDoc = readJson(SITE_DOCUMENT_PATH, {});
  for (const asset of Array.isArray(siteDoc.assets) ? siteDoc.assets : []) {
    const sourceUrl = String(asset?.sourceUrl || "").trim();
    if (!/https:\/\/www\.lge\.co\.kr\/kr\/upload\/admin\/display\/displayObject\//.test(sourceUrl)) continue;
    rows.push({
      pageId: String(asset.sourcePageId || "home").trim() || "home",
      pageUrl: "https://www.lge.co.kr/home",
      pageGroup: "home",
      sourceUrl,
      localPath: asset.localPath || "",
      altText: String(asset.alt || "").trim(),
    });
  }
  const mobileReference = readJson(MOBILE_REFERENCE_ASSETS_PATH, {});
  for (const asset of Array.isArray(mobileReference.assets) ? mobileReference.assets : []) {
    const sourceUrl = String(asset?.sourceUrl || "").trim();
    if (!/https:\/\/www\.lge\.co\.kr\/kr\/upload\/admin\/display\/displayObject\//.test(sourceUrl)) continue;
    rows.push({
      pageId: String(asset.pageId || "home").trim() || "home",
      pageUrl: String(asset.pageUrl || "").trim() || "https://www.lge.co.kr/home",
      pageGroup: String(asset.pageGroup || "").trim(),
      sourceUrl,
      localPath: asset.localPath || "",
      altText: String(asset.altText || "").trim(),
      viewportProfile: inferMobileReferenceViewport(sourceUrl),
    });
  }
  const seen = new Set();
  return rows.filter((row) => {
    const slotId = inferSlot(row.sourceUrl, row.altText, row.pageId);
    if (slotId === "gnb") return false;
    const key = `${row.pageId}|${row.viewportProfile || ""}|${row.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeAsset(existing, next) {
  const variants = {
    ...(existing.variants && typeof existing.variants === "object" ? existing.variants : {}),
    ...(next.variants && typeof next.variants === "object" ? next.variants : {}),
  };
  return {
    ...existing,
    ...next,
    status: existing.status === "approved" ? "approved" : next.status,
    variants,
    pageFamilies: unique([...(existing.pageFamilies || []), ...(next.pageFamilies || [])]),
    slotFamilies: unique([...(existing.slotFamilies || []), ...(next.slotFamilies || [])]),
    componentIds: String(next.assetId || "").startsWith("lge.")
      ? []
      : unique([...(existing.componentIds || []), ...(next.componentIds || [])]),
    viewportProfiles: unique([...(existing.viewportProfiles || []), ...(next.viewportProfiles || [])]),
    provenanceNotes: unique([existing.provenanceNotes, next.provenanceNotes]).join(" | "),
  };
}

async function main() {
  const registry = readJson(REGISTRY_PATH, { assets: [] });
  const existingAssets = Array.isArray(registry.assets) ? registry.assets : [];
  const byId = new Map(existingAssets.map((asset) => [String(asset.assetId || "").trim(), asset]).filter(([id]) => id));
  const candidates = collectCandidates();
  const added = [];
  const updated = [];
  const skipped = [];
  for (const row of candidates) {
    const viewport = String(row.viewportProfile || "").trim() || inferViewport(row.pageUrl, row.sourceUrl);
    const slotId = inferSlot(row.sourceUrl, row.altText, row.pageId);
    const localPath = localAssetPath(row.localPath);
    const dimensions = await readDimensions(localPath);
    const role = classifyRole({ sourceUrl: row.sourceUrl, altText: row.altText, slotId, dimensions });
    const status = role === "promo-complete" ? "blocked" : "candidate";
    const fileNameSlug = slug(path.basename(row.sourceUrl));
    const assetId = `lge.${row.pageId}.${slotId}.${fileNameSlug}.${hash(row.sourceUrl)}`;
    const existingVariantStatus = String(byId.get(assetId)?.variants?.[viewport]?.status || "").trim();
    if (byId.has(assetId) && ["approved", "blocked"].includes(existingVariantStatus)) {
      skipped.push({ assetId, viewport, reason: `${existingVariantStatus}-existing` });
      continue;
    }
    const usage = usageForRole(role);
    const variant = {
      variantId: `${assetId}.${viewport}`,
      status,
      sourceUrl: row.sourceUrl,
      sourceRef: localPath ? `data/raw/assets/${path.basename(localPath)}` : `source-url:${row.sourceUrl}`,
      assetUrl: `/asset-proxy?url=${encodeURIComponent(row.sourceUrl)}`,
      viewportProfile: viewport,
      width: dimensions?.width || 0,
      height: dimensions?.height || 0,
      aspectRatio: dimensions?.width && dimensions?.height ? `${dimensions.width}:${dimensions.height}` : "",
      safeArea: {
        copyZone: role === "promo-complete" ? "none" : "review-required",
        primarySubjectZone: "review-required",
        avoidOverlayZones: role === "promo-complete" ? ["entire image"] : ["unknown until visual review"],
        notes: role === "promo-complete"
          ? "Complete promotional image with possible embedded copy. Do not re-overlay new copy."
          : "Candidate requires visual safe-area review before approval.",
      },
      cropGuidance: {
        mode: viewport === "mo" ? "mobile-review-required" : "desktop-review-required",
        objectFit: "cover",
        objectPosition: "center",
      },
      processing: ["imported-from-lge-clone", `status-${status}`, "role-heuristic"],
    };
    const next = {
      assetId,
      assetKind: "image",
      status,
      sourceType: "lge-derived",
      providerName: "LGE",
      sourceUrl: row.sourceUrl,
      sourceRef: variant.sourceRef,
      variantPolicy: "viewport-specific",
      variants: { [viewport]: variant },
      licenseProfile: "internal-lge-derived",
      processing: ["imported-from-lge-clone", "role-heuristic"],
      pageFamilies: [row.pageId],
      slotFamilies: [slotId],
      componentIds: [],
      viewportProfiles: [viewport],
      role,
      ...usage,
      containsText: role === "promo-complete",
      textDensity: role === "promo-complete" ? "unknown-or-high" : "unknown",
      visualTone: role === "promo-complete" ? "promo" : "lge-reference",
      brandRisk: role === "promo-complete" ? "medium" : "low",
      semanticRole: `${row.pageId} ${slotId} ${role} ${viewport} LGE-derived asset`,
      llmDescription: buildDescription({ role, sourceUrl: row.sourceUrl, altText: row.altText, slotId, viewport }),
      llmDo: role === "promo-complete"
        ? ["use as reference context only", "preserve as unchanged content only after explicit approval"]
        : ["use as candidate visual direction", "promote to approved only after viewport fit and safe-area review"],
      llmDont: role === "promo-complete"
        ? ["overlay new headline or CTA", "use as icon", "crop into generic background"]
        : ["use as final output before approval", "reuse across viewport without matching variant"],
      selectionHints: [row.pageId, slotId, viewport, role],
      conflictHints: role === "promo-complete"
        ? ["conflicts with new authored copy", "blocked for re-overlay"]
        : ["requires safe-area review", "requires viewport-specific approval"],
      validationTags: unique(["lge-derived", role, viewport, status]),
      provenanceNotes: `Imported from LGE clone archive. pageUrl=${row.pageUrl}`,
    };
    if (byId.has(assetId)) {
      byId.set(assetId, mergeAsset(byId.get(assetId), next));
      updated.push(assetId);
    } else {
      byId.set(assetId, next);
      added.push(assetId);
    }
  }
  const nextRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
    assets: Array.from(byId.values()).sort((a, b) => String(a.assetId).localeCompare(String(b.assetId), "ko")),
    importLog: [
      ...(Array.isArray(registry.importLog) ? registry.importLog : []),
      {
        type: "lge-clone-import",
        createdAt: new Date().toISOString(),
        candidateCount: candidates.length,
        addedCount: added.length,
        updatedCount: updated.length,
        skippedCount: skipped.length,
      },
    ].slice(-50),
  };
  writeJson(REGISTRY_PATH, nextRegistry);
  writeJson(REPORT_PATH, {
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    addedCount: added.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    added,
    updated,
    skipped,
  });
  console.log(JSON.stringify({
    candidateCount: candidates.length,
    addedCount: added.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    totalAssets: nextRegistry.assets.length,
    reportPath: path.relative(ROOT, REPORT_PATH),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
