"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");
const OUT_DIR = path.join(ROOT, "docs", "snapshots", "2026-04-24-external-stock-review");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");
const CONTACT_DIR = path.join(OUT_DIR, "contact-sheets");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeText(filePath, value = "") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function writeJson(filePath, payload) {
  writeText(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFileName(value = "") {
  return String(value || "item")
    .replace(/[^a-z0-9가-힣_.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150) || "item";
}

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function absPath(ref = "") {
  return path.join(ROOT, String(ref || ""));
}

function publicAssetUrl(sourceRef = "") {
  const ref = String(sourceRef || "").trim();
  if (!ref.startsWith("data/raw/assets/")) return "";
  const relative = ref.slice("data/raw/assets/".length);
  return `/raw-assets/${relative.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function scoreReviewPriority(asset = {}, variant = {}) {
  let score = 0;
  const role = String(asset.role || "").trim();
  const status = String(variant.status || asset.status || "").trim();
  const width = Number(variant.width || 0) || 0;
  const height = Number(variant.height || 0) || 0;
  const aspect = width && height ? width / height : 0;
  if (status === "candidate") score += 20;
  if (role === "background-only") score += 18;
  if (role === "object-only") score += 10;
  if (aspect >= 1.55) score += 8;
  if (width >= 900) score += 5;
  if (/pd|cc0|no restrictions/i.test(`${asset.licenseProfile || ""} ${asset.licenseUrl || ""}`)) score += 4;
  if (/reference-only|town-crier|page|newspaper|prisoners/i.test(`${role} ${asset.sourceTitle || ""}`)) score -= 16;
  return score;
}

function variantRows(registry = {}) {
  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const rows = [];
  for (const asset of assets) {
    if (String(asset?.sourceType || "").trim() !== "external-stock") continue;
    const variants = asset?.variants && typeof asset.variants === "object" ? asset.variants : {};
    for (const [viewportProfile, variant] of Object.entries(variants)) {
      const sourceRef = String(variant?.sourceRef || asset.sourceRef || "").trim();
      rows.push({
        asset,
        variant,
        assetId: String(asset.assetId || "").trim(),
        variantId: String(variant?.variantId || "").trim(),
        viewportProfile,
        status: String(variant?.status || asset.status || "candidate").trim() || "candidate",
        sourceProfileId: String(asset.sourceProfileId || "").trim(),
        sourceTitle: String(asset.sourceTitle || "").trim(),
        sourceRef,
        localSourcePath: sourceRef,
        publicAssetUrl: publicAssetUrl(sourceRef),
        width: Number(variant?.width || 0) || 0,
        height: Number(variant?.height || 0) || 0,
        role: String(asset.role || "").trim(),
        pageFamilies: toStringList(asset.pageFamilies),
        slotFamilies: toStringList(asset.slotFamilies),
        visualTone: String(asset.visualTone || "").trim(),
        semanticRole: String(asset.semanticRole || "").trim(),
        licenseProfile: String(asset.licenseProfile || "").trim(),
        licenseUrl: String(asset.licenseUrl || "").trim(),
        attribution: String(asset.attribution || "").trim(),
        attributionRequired: String(asset.attributionRequired || "").trim(),
        pageUrl: String(variant?.pageUrl || asset.pageUrl || "").trim(),
        sourceUrl: String(variant?.sourceUrl || asset.sourceUrl || "").trim(),
        selectionHints: toStringList(asset.selectionHints),
        conflictHints: toStringList(asset.conflictHints),
        validationTags: toStringList(asset.validationTags),
        safeArea: variant?.safeArea && typeof variant.safeArea === "object" ? variant.safeArea : {},
        cropGuidance: variant?.cropGuidance && typeof variant.cropGuidance === "object" ? variant.cropGuidance : {},
        reviewPriority: scoreReviewPriority(asset, variant),
      });
    }
  }
  return rows.sort((a, b) => {
    const statusRank = (status) => (status === "candidate" ? 0 : status === "approved" ? 1 : status === "blocked" ? 2 : 3);
    return statusRank(a.status) - statusRank(b.status)
      || b.reviewPriority - a.reviewPriority
      || String(a.sourceProfileId).localeCompare(String(b.sourceProfileId), "ko")
      || String(a.assetId).localeCompare(String(b.assetId), "ko")
      || String(a.viewportProfile).localeCompare(String(b.viewportProfile), "ko");
  });
}

async function makeThumb(row = {}) {
  const sourcePath = absPath(row.localSourcePath);
  const thumbName = `${safeFileName(row.sourceProfileId)}.${safeFileName(row.assetId)}.${safeFileName(row.viewportProfile)}.jpg`;
  const thumbPath = path.join(THUMB_DIR, thumbName);
  await sharp(sourcePath)
    .rotate()
    .resize({ width: 560, height: 360, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#f4f4f4" })
    .jpeg({ quality: 86 })
    .toFile(thumbPath);
  return path.relative(OUT_DIR, thumbPath);
}

async function makeContactSheet(rows = [], fileName = "sheet.jpg") {
  const items = rows.slice(0, 48);
  const cellWidth = 480;
  const imageHeight = 280;
  const labelHeight = 112;
  const gap = 16;
  const columns = 2;
  const rowsCount = Math.ceil(items.length / columns) || 1;
  const width = columns * cellWidth + (columns + 1) * gap;
  const height = rowsCount * (imageHeight + labelHeight) + (rowsCount + 1) * gap;
  const base = sharp({
    create: { width, height, channels: 3, background: "#f1eee7" },
  });
  const composites = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const sourcePath = absPath(item.localSourcePath);
    if (!fs.existsSync(sourcePath)) continue;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const left = gap + col * (cellWidth + gap);
    const top = gap + row * (imageHeight + labelHeight + gap);
    const imageBuffer = await sharp(sourcePath)
      .rotate()
      .resize({ width: cellWidth, height: imageHeight, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 84 })
      .toBuffer();
    const label = [
      `${index + 1}. ${item.sourceProfileId} / ${item.viewportProfile} / ${item.role}`,
      `${item.status} / priority ${item.reviewPriority} / ${item.width}x${item.height}`,
      item.semanticRole,
      item.licenseProfile,
    ].join("\n");
    const svg = Buffer.from(`
      <svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#181818"/>
        <text x="14" y="23" font-family="Arial, sans-serif" font-size="14" fill="#fff">${escapeHtml(label).split("\n").map((line, i) => `<tspan x="14" dy="${i === 0 ? 0 : 21}">${line}</tspan>`).join("")}</text>
      </svg>
    `);
    composites.push({ input: imageBuffer, left, top });
    composites.push({ input: svg, left, top: top + imageHeight });
  }
  const outputPath = path.join(CONTACT_DIR, fileName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await base.composite(composites).jpeg({ quality: 88 }).toFile(outputPath);
  return path.relative(OUT_DIR, outputPath);
}

function summarize(rows = []) {
  const countBy = (field) => rows.reduce((acc, row) => {
    const value = String(row?.[field] || "unknown").trim() || "unknown";
    acc[value] = Number(acc[value] || 0) + 1;
    return acc;
  }, {});
  return {
    rowCount: rows.length,
    assetCount: new Set(rows.map((row) => row.assetId)).size,
    byStatus: countBy("status"),
    byViewport: countBy("viewportProfile"),
    byRole: countBy("role"),
    byProfile: countBy("sourceProfileId"),
  };
}

function renderDecisionScript(row = {}) {
  return JSON.stringify({
    assetId: row.assetId,
    viewportProfile: row.viewportProfile,
    decision: "pending",
    reviewNotes: [
      `sourceProfile=${row.sourceProfileId}`,
      `role=${row.role}`,
      `semantic=${row.semanticRole}`,
      "Replace decision with approved or blocked before applying.",
    ].join("; "),
  }, null, 2);
}

function renderHtml(rows = [], summary = {}, sheets = {}) {
  const cards = rows.map((row, index) => `
    <article class="card ${escapeHtml(row.status)}">
      <div class="image-wrap">
        <img src="${escapeHtml(row.thumbnailRef || row.publicAssetUrl)}" alt="">
      </div>
      <div class="body">
        <div class="topline">
          <strong>${index + 1}. ${escapeHtml(row.sourceProfileId)} / ${escapeHtml(row.viewportProfile)}</strong>
          <span>${escapeHtml(row.status)} · ${escapeHtml(row.role)} · priority ${escapeHtml(row.reviewPriority)}</span>
        </div>
        <h2>${escapeHtml(row.semanticRole || row.sourceTitle)}</h2>
        <p class="tone">${escapeHtml(row.visualTone)} · ${escapeHtml(`${row.width}x${row.height}`)}</p>
        <dl>
          <dt>assetId</dt><dd>${escapeHtml(row.assetId)}</dd>
          <dt>sourceTitle</dt><dd>${escapeHtml(row.sourceTitle)}</dd>
          <dt>pages</dt><dd>${escapeHtml(row.pageFamilies.join(", "))}</dd>
          <dt>slots</dt><dd>${escapeHtml(row.slotFamilies.join(", "))}</dd>
          <dt>license</dt><dd>${escapeHtml(row.licenseProfile || "unknown")} ${row.licenseUrl ? `<a href="${escapeHtml(row.licenseUrl)}">license</a>` : ""}</dd>
          <dt>attribution</dt><dd>${escapeHtml(row.attributionRequired || "unknown")} ${escapeHtml(row.attribution || "")}</dd>
          <dt>source</dt><dd><a href="${escapeHtml(row.pageUrl)}">${escapeHtml(row.pageUrl)}</a></dd>
          <dt>local</dt><dd>${escapeHtml(row.localSourcePath)}</dd>
          <dt>safeArea</dt><dd>${escapeHtml(JSON.stringify(row.safeArea))}</dd>
          <dt>hints</dt><dd>${escapeHtml(row.selectionHints.join(" / "))}</dd>
        </dl>
        <details>
          <summary>decision JSON snippet</summary>
          <pre>${escapeHtml(renderDecisionScript(row))}</pre>
        </details>
      </div>
    </article>
  `).join("\n");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>External Stock Review Pack</title>
  <style>
    :root { --ink:#171717; --muted:#6f675f; --paper:#f3efe7; --card:#fffaf2; --line:#dfd4c6; --ok:#155c3b; --warn:#8a5b00; --bad:#8b1e2d; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--paper); color:var(--ink); }
    header { padding:30px 34px; background:var(--ink); color:#fff; }
    h1 { margin:0 0 10px; font-size:28px; }
    header p { max-width:980px; line-height:1.6; color:#e8dfd2; }
    .summary { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
    .pill { background:#fff; color:var(--ink); border-radius:999px; padding:8px 12px; font-size:13px; font-weight:700; }
    .links { margin-top:18px; display:flex; gap:14px; flex-wrap:wrap; }
    .links a { color:#fff; }
    main { padding:28px; display:grid; grid-template-columns:repeat(auto-fit,minmax(420px,1fr)); gap:22px; }
    .card { border:1px solid var(--line); border-radius:22px; background:var(--card); overflow:hidden; box-shadow:0 16px 38px rgba(0,0,0,.08); }
    .card.approved { border-color:rgba(21,92,59,.45); }
    .card.blocked { border-color:rgba(139,30,45,.45); opacity:.78; }
    .image-wrap { background:#ebe5dc; min-height:220px; display:flex; align-items:center; justify-content:center; }
    img { width:100%; max-height:360px; object-fit:contain; display:block; }
    .body { padding:18px; }
    .topline { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
    .topline strong { font-size:15px; }
    .topline span { color:var(--muted); font-size:12px; text-align:right; }
    h2 { margin:14px 0 6px; font-size:20px; line-height:1.25; }
    .tone { margin:0 0 14px; color:var(--muted); font-size:13px; }
    dl { margin:0; display:grid; grid-template-columns:92px 1fr; gap:8px 12px; font-size:12px; }
    dt { font-weight:800; color:#4f463c; }
    dd { margin:0; word-break:break-all; }
    details { margin-top:16px; border-top:1px solid var(--line); padding-top:12px; }
    summary { cursor:pointer; font-weight:800; }
    pre { padding:12px; border-radius:12px; background:#171717; color:#f8ead5; overflow:auto; font-size:12px; }
    a { color:#8b1e2d; }
  </style>
</head>
<body>
  <header>
    <h1>External Stock Review Pack</h1>
    <p>외부/무료 이미지 후보를 PC/MO variant 단위로 승인/차단하기 위한 리뷰 패키지입니다. 현재 candidate 이미지는 최종 HTML 사용 시 validation에서 막히므로, 실제 빌드에 쓰려면 variant별 approval이 필요합니다.</p>
    <div class="summary">
      <span class="pill">rows ${summary.rowCount}</span>
      <span class="pill">assets ${summary.assetCount}</span>
      <span class="pill">candidate ${summary.byStatus?.candidate || 0}</span>
      <span class="pill">background ${summary.byRole?.["background-only"] || 0}</span>
      <span class="pill">object ${summary.byRole?.["object-only"] || 0}</span>
      <span class="pill">reference ${summary.byRole?.["reference-only"] || 0}</span>
    </div>
    <div class="links">
      ${sheets.candidateSheet ? `<a href="${escapeHtml(sheets.candidateSheet)}">candidate contact sheet</a>` : ""}
      ${sheets.backgroundSheet ? `<a href="${escapeHtml(sheets.backgroundSheet)}">background contact sheet</a>` : ""}
      <a href="review-pack.json">review-pack.json</a>
      <a href="review-decisions.template.json">review-decisions.template.json</a>
    </div>
  </header>
  <main>${cards}</main>
</body>
</html>`;
}

function decisionTemplate(rows = []) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    instructions: [
      "Set decision to approved or blocked for rows you reviewed.",
      "Leave unreviewed rows as pending.",
      "Run: node scripts/apply-external-stock-review-decisions.js --decisions=docs/snapshots/2026-04-24-external-stock-review/review-decisions.json --apply",
      "Approval is per viewport variant; approving pc does not approve mo.",
    ],
    decisions: rows
      .filter((row) => row.status === "candidate")
      .map((row) => ({
        assetId: row.assetId,
        viewportProfile: row.viewportProfile,
        currentStatus: row.status,
        decision: "pending",
        suggestedReviewFocus: [
          "license/attribution",
          "embedded text or watermark",
          "trademark or property risk",
          "PC/MO crop fit",
          "role correctness",
        ],
        sourceProfileId: row.sourceProfileId,
        sourceTitle: row.sourceTitle,
        role: row.role,
        semanticRole: row.semanticRole,
        visualTone: row.visualTone,
        pageFamilies: row.pageFamilies,
        slotFamilies: row.slotFamilies,
        licenseProfile: row.licenseProfile,
        pageUrl: row.pageUrl,
        localSourcePath: row.localSourcePath,
        reviewNotes: "",
      })),
  };
}

async function main() {
  const registry = readJson(REGISTRY_PATH, { assets: [] });
  const rows = variantRows(registry).filter((row) => fs.existsSync(absPath(row.localSourcePath)));
  fs.rmSync(THUMB_DIR, { recursive: true, force: true });
  fs.rmSync(CONTACT_DIR, { recursive: true, force: true });
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  fs.mkdirSync(CONTACT_DIR, { recursive: true });
  const enriched = [];
  for (const row of rows) {
    const thumbnailRef = await makeThumb(row);
    enriched.push({ ...row, thumbnailRef });
  }
  const candidates = enriched.filter((row) => row.status === "candidate");
  const backgroundCandidates = candidates.filter((row) => row.role === "background-only");
  const candidateSheet = candidates.length ? await makeContactSheet(candidates, "candidate-external-stock.jpg") : "";
  const backgroundSheet = backgroundCandidates.length ? await makeContactSheet(backgroundCandidates, "background-candidates.jpg") : "";
  const summary = summarize(enriched);
  writeText(path.join(OUT_DIR, "index.html"), renderHtml(enriched, summary, { candidateSheet, backgroundSheet }));
  writeJson(path.join(OUT_DIR, "review-pack.json"), {
    generatedAt: new Date().toISOString(),
    registryPath: path.relative(ROOT, REGISTRY_PATH),
    summary,
    contactSheets: { candidateSheet, backgroundSheet },
    rows: enriched,
  });
  writeJson(path.join(OUT_DIR, "review-decisions.template.json"), decisionTemplate(enriched));
  console.log(JSON.stringify({
    outDir: path.relative(ROOT, OUT_DIR),
    indexHtml: path.relative(ROOT, path.join(OUT_DIR, "index.html")),
    reviewPack: path.relative(ROOT, path.join(OUT_DIR, "review-pack.json")),
    decisionsTemplate: path.relative(ROOT, path.join(OUT_DIR, "review-decisions.template.json")),
    candidateSheet,
    backgroundSheet,
    summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
