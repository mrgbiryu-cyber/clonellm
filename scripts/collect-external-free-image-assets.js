"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const PROFILE_PATH = path.join(ROOT, "data", "normalized", "external-free-image-source-profiles.json");
const REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");
const OUTPUT_DIR = path.join(ROOT, "data", "raw", "assets", "external-free");
const REPORT_PATH = path.join(ROOT, "data", "normalized", "external-free-image-asset-collection-report.json");

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

function hash(value = "") {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}

function slug(value = "") {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/^file:/i, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "asset";
}

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function unique(values = []) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => String(item || "").startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function getNumberArg(name, fallback) {
  const parsed = Number(getArg(name, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function httpsGetBuffer(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "clonellm-asset-collector/1.0 (local project asset registry)",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(httpsGetBuffer(new URL(res.headers.location, url).toString()));
        return;
      }
      if (res.statusCode !== 200) {
        if (res.statusCode === 429 && attempt < 3) {
          res.resume();
          windowlessDelay(1200 * (attempt + 1)).then(() => {
            httpsGetBuffer(url, attempt + 1).then(resolve, reject);
          });
          return;
        }
        res.resume();
        reject(new Error(`http_${res.statusCode}:${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

function windowlessDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const buffer = await httpsGetBuffer(url);
  return JSON.parse(buffer.toString("utf8"));
}

async function downloadFile(url, filePath) {
  const buffer = await httpsGetBuffer(url);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return buffer.length;
}

function buildCommonsApiUrl(provider, profile, limit, options = {}) {
  const thumbWidth = Number(options.thumbWidth || 1200) || 1200;
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: String(profile.query || "").trim(),
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: String(thumbWidth),
    format: "json",
    origin: "*",
  });
  return `${provider.apiBaseUrl}?${params.toString()}`;
}

function getExtMetadata(imageInfo = {}, key = "") {
  const value = imageInfo?.extmetadata?.[key]?.value;
  return String(value || "").replace(/<[^>]+>/g, "").trim();
}

function normalizeLicenseProfile(imageInfo = {}) {
  const shortName = getExtMetadata(imageInfo, "LicenseShortName");
  const license = getExtMetadata(imageInfo, "License");
  return unique([shortName, license]).join(" / ") || "wikimedia-commons-license-unspecified";
}

function inferRole(width, height) {
  const aspect = width && height ? width / height : 0;
  if (aspect >= 1.55) return "background-only";
  if (aspect >= 0.75) return "object-only";
  return "reference-only";
}

function usageForRole(role = "") {
  if (role === "background-only") {
    return {
      allowedUsage: ["section-background", "hero-background", "banner-background"],
      restrictedUsage: ["icon", "quickmenu-icon", "promo-reoverlay", "trademark-claim"],
    };
  }
  if (role === "object-only") {
    return {
      allowedUsage: ["object-accent", "editorial-stage-foreground", "card-media-review"],
      restrictedUsage: ["icon", "quickmenu-icon", "promo-reoverlay", "trademark-claim"],
    };
  }
  return {
    allowedUsage: ["reference-context", "card-media-review"],
    restrictedUsage: ["icon", "quickmenu-icon", "promo-reoverlay", "final-use-without-review"],
  };
}

async function buildCandidate(provider, profile, page, nowIso, options = {}) {
  const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : {};
  const mime = String(imageInfo.mime || "").trim();
  if (!/^image\/(jpeg|png|webp)$/i.test(mime)) return { skipped: "unsupported_mime", title: page.title, mime };
  const sourceUrl = String(imageInfo.url || "").trim();
  const downloadUrl = String(imageInfo.thumburl || imageInfo.url || "").trim();
  if (!sourceUrl || !downloadUrl) return { skipped: "missing_url", title: page.title };
  const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const idHash = hash(`${provider.providerId}:${profile.profileId}:${sourceUrl}`);
  const assetSlug = slug(page.title || sourceUrl);
  const fileName = `${provider.providerId}__${profile.profileId}__${assetSlug}__${idHash}.${extension}`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  const sourceRef = `data/raw/assets/external-free/${fileName}`;
  let downloaded = false;
  if (!options.dryRun && !fs.existsSync(filePath)) {
    await downloadFile(downloadUrl, filePath);
    downloaded = true;
  }
  const meta = !options.dryRun && fs.existsSync(filePath)
    ? await sharp(filePath).metadata()
    : {};
  const width = Number(meta.width || imageInfo.thumbwidth || imageInfo.width || 0) || 0;
  const height = Number(meta.height || imageInfo.thumbheight || imageInfo.height || 0) || 0;
  if (!width || !height) return { skipped: "missing_dimensions", title: page.title, sourceUrl };
  const role = inferRole(width, height);
  const usage = usageForRole(role);
  const pageUrl = String(imageInfo.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || "")}`).trim();
  const licenseProfile = normalizeLicenseProfile(imageInfo);
  const attribution = unique([
    getExtMetadata(imageInfo, "Artist"),
    getExtMetadata(imageInfo, "Credit"),
    getExtMetadata(imageInfo, "ObjectName"),
  ]).join(" / ");
  const licenseUrl = getExtMetadata(imageInfo, "LicenseUrl");
  const assetId = `external.${provider.providerId}.${profile.profileId}.${assetSlug}.${idHash}`;
  return {
    downloaded,
    asset: {
      assetId,
      assetKind: "image",
      status: "candidate",
      sourceType: "external-stock",
      providerName: provider.providerName,
      sourceProfileId: String(profile.profileId || "").trim(),
      sourceTitle: String(page.title || "").trim(),
      sourceRef,
      sourceUrl,
      pageUrl,
      variantPolicy: "viewport-specific",
      variants: {
        pc: {
          variantId: `${assetId}.pc`,
          status: "candidate",
          sourceRef,
          sourceUrl,
          pageUrl,
          viewportProfile: "pc",
          width,
          height,
          aspectRatio: `${width}:${height}`,
          safeArea: {
            copyZone: "review-required",
            primarySubjectZone: "review-required",
            avoidOverlayZones: ["unknown until visual review"],
            notes: "External free candidate. Human review must check license, attribution, embedded text, trademarks, and crop fit before approval."
          },
          cropGuidance: {
            mode: "review-crop-for-pc",
            objectFit: "cover",
            objectPosition: "center"
          },
          processing: ["external-free-imported", "license-metadata-recorded", "pc-fit-review-required"]
        },
        mo: {
          variantId: `${assetId}.mo`,
          status: "candidate",
          sourceRef,
          sourceUrl,
          pageUrl,
          viewportProfile: "mo",
          width,
          height,
          aspectRatio: `${width}:${height}`,
          safeArea: {
            copyZone: "review-required",
            primarySubjectZone: "review-required",
            avoidOverlayZones: ["unknown until visual review"],
            notes: "External free candidate. Mobile crop and safe area must be reviewed before approval."
          },
          cropGuidance: {
            mode: "review-crop-for-mobile",
            objectFit: "cover",
            objectPosition: "center"
          },
          processing: ["external-free-imported", "license-metadata-recorded", "mo-fit-review-required"]
        }
      },
      licenseProfile,
      licenseUrl,
      licenseCheckedAt: nowIso,
      attribution,
      attributionRequired: getExtMetadata(imageInfo, "AttributionRequired") || "unknown",
      processing: ["external-free-imported", "license-metadata-recorded", "human-approval-required"],
      pageFamilies: toStringList(profile.pageFamilies),
      slotFamilies: toStringList(profile.slotFamilies),
      viewportProfiles: ["pc", "mo"],
      role,
      ...usage,
      containsText: false,
      textDensity: "unknown",
      visualTone: String(profile.visualTone || "").trim(),
      brandRisk: "medium",
      semanticRole: String(profile.semanticRole || "").trim(),
      llmDescription: `${provider.providerName} external free image candidate for ${profile.semanticRole || profile.profileId}. Use only after approval; keep attribution and license constraints visible.`,
      llmDo: [
        "use only after candidate is approved",
        "respect PC/MO crop review notes",
        "preserve attribution and license metadata"
      ],
      llmDont: [
        "use as final output while candidate",
        "use as icon",
        "claim trademark or brand ownership",
        "remove required attribution metadata"
      ],
      selectionHints: [
        profile.profileId,
        String(profile.query || "").trim(),
        role
      ],
      conflictHints: [
        "candidate approval required",
        "license and attribution must be checked",
        "embedded signage or trademarks require blocking"
      ],
      validationTags: [
        "external-stock",
        "candidate",
        "license-metadata-recorded",
        provider.providerId,
        profile.profileId
      ],
      provenanceNotes: `Collected from ${provider.providerName} API search profile ${profile.profileId}. Query: ${profile.query}.`
    }
  };
}

function mergeAssets(registry, nextAssets) {
  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const byId = new Map(assets.map((asset) => [String(asset?.assetId || "").trim(), asset]));
  let inserted = 0;
  let updated = 0;
  for (const next of nextAssets) {
    const assetId = String(next?.assetId || "").trim();
    if (!assetId) continue;
    const existing = byId.get(assetId);
    if (existing) {
      next.status = existing.status || next.status;
      for (const viewport of ["pc", "mo"]) {
        if (existing.variants?.[viewport]?.status && next.variants?.[viewport]) {
          next.variants[viewport].status = existing.variants[viewport].status;
          next.variants[viewport].reviewedAt = existing.variants[viewport].reviewedAt;
          next.variants[viewport].reviewedBy = existing.variants[viewport].reviewedBy;
          next.variants[viewport].reviewNotes = existing.variants[viewport].reviewNotes;
        }
      }
      Object.assign(existing, next);
      updated += 1;
    } else {
      assets.push(next);
      byId.set(assetId, next);
      inserted += 1;
    }
  }
  registry.assets = assets;
  return { inserted, updated };
}

async function main() {
  const limitPerProfile = getNumberArg("limit", 8);
  const maxImports = getNumberArg("max-imports", 12);
  const maxPerProfile = getNumberArg("max-per-profile", 4);
  const delayMs = getNumberArg("delay-ms", 250);
  const thumbWidth = getNumberArg("thumb-width", 1200);
  const dryRun = process.argv.includes("--dry-run");
  const profiles = readJson(PROFILE_PATH, { providerProfiles: [] });
  const registry = readJson(REGISTRY_PATH, { assets: [] });
  const nowIso = new Date().toISOString();
  const collected = [];
  const skipped = [];
  const errors = [];
  const existingSourceUrls = new Set((Array.isArray(registry.assets) ? registry.assets : [])
    .map((asset) => String(asset?.sourceUrl || "").trim())
    .filter(Boolean));
  const collectedSourceUrls = new Set();
  for (const provider of Array.isArray(profiles.providerProfiles) ? profiles.providerProfiles : []) {
    for (const profile of Array.isArray(provider.searchProfiles) ? provider.searchProfiles : []) {
      if (collected.length >= maxImports) break;
      let profileCollected = 0;
      try {
        const payload = await fetchJson(buildCommonsApiUrl(provider, profile, limitPerProfile, { thumbWidth }));
        const pages = Object.values(payload?.query?.pages || {});
        for (const page of pages) {
          if (collected.length >= maxImports) break;
          if (profileCollected >= maxPerProfile) break;
          try {
            const result = await buildCandidate(provider, profile, page, nowIso, { dryRun });
            if (result.asset) {
              const sourceUrl = String(result.asset.sourceUrl || "").trim();
              if (existingSourceUrls.has(sourceUrl) || collectedSourceUrls.has(sourceUrl)) {
                skipped.push({ profileId: profile.profileId, skipped: "duplicate_source_url", assetId: result.asset.assetId, sourceUrl });
              } else {
                collected.push(result);
                collectedSourceUrls.add(sourceUrl);
                profileCollected += 1;
              }
            } else {
              skipped.push({ profileId: profile.profileId, ...result });
            }
            if (delayMs > 0) await windowlessDelay(delayMs);
          } catch (error) {
            errors.push({ profileId: profile.profileId, title: page.title, error: String(error.message || error) });
            if (delayMs > 0) await windowlessDelay(delayMs);
          }
        }
      } catch (error) {
        errors.push({ profileId: profile.profileId, query: profile.query, error: String(error.message || error) });
      }
      if (delayMs > 0) await windowlessDelay(delayMs);
    }
  }
  const assets = collected.map((item) => item.asset);
  const mergeSummary = dryRun ? { inserted: 0, updated: 0 } : mergeAssets(registry, assets);
  if (!dryRun) {
    registry.updatedAt = nowIso;
    registry.auditLog = [
      ...(Array.isArray(registry.auditLog) ? registry.auditLog : []),
      {
        type: "external-free-image-collection",
        providerId: "wikimedia-commons",
        inserted: mergeSummary.inserted,
        updated: mergeSummary.updated,
        collected: assets.length,
        updatedAt: nowIso
      }
    ].slice(-120);
    writeJson(REGISTRY_PATH, registry);
  }
  const report = {
    generatedAt: nowIso,
    dryRun,
    limitPerProfile,
    maxImports,
    maxPerProfile,
    delayMs,
    thumbWidth,
    collected: assets.length,
    downloaded: collected.filter((item) => item.downloaded).length,
    inserted: mergeSummary.inserted,
    updated: mergeSummary.updated,
    skipped,
    errors,
    assets: assets.map((asset) => ({
      assetId: asset.assetId,
      status: asset.status,
      sourceType: asset.sourceType,
      providerName: asset.providerName,
      sourceProfileId: asset.sourceProfileId,
      sourceTitle: asset.sourceTitle,
      sourceRef: asset.sourceRef,
      sourceUrl: asset.sourceUrl,
      pageUrl: asset.pageUrl,
      licenseProfile: asset.licenseProfile,
      licenseUrl: asset.licenseUrl,
      role: asset.role,
      pageFamilies: asset.pageFamilies,
      slotFamilies: asset.slotFamilies,
      width: asset.variants?.pc?.width || 0,
      height: asset.variants?.pc?.height || 0,
    }))
  };
  writeJson(REPORT_PATH, report);
  console.log(JSON.stringify({
    dryRun,
    collected: report.collected,
    downloaded: report.downloaded,
    inserted: report.inserted,
    updated: report.updated,
    skipped: skipped.length,
    errors: errors.length,
    reportPath: path.relative(ROOT, REPORT_PATH),
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
