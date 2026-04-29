"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const QUEUE_PATH = path.join(ROOT, "data", "normalized", "lge-text-removal-queue.json");
const OUT_DIR = path.join(ROOT, "docs", "snapshots", "2026-04-24-lge-text-removal-review");
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
    .slice(0, 140) || "item";
}

function absPath(ref = "") {
  return path.join(ROOT, String(ref || ""));
}

async function makeThumb(workOrder = {}) {
  const sourcePath = absPath(workOrder.localSourcePath);
  const thumbName = `${safeFileName(workOrder.workOrderId)}.${safeFileName(workOrder.pageId)}.${safeFileName(workOrder.slotId)}.${safeFileName(workOrder.viewportProfile)}.jpg`;
  const thumbPath = path.join(THUMB_DIR, thumbName);
  await sharp(sourcePath)
    .rotate()
    .resize({ width: 460, height: 300, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#f4f4f4" })
    .jpeg({ quality: 86 })
    .toFile(thumbPath);
  return path.relative(OUT_DIR, thumbPath);
}

async function makeContactSheet(items = [], fileName = "sheet.jpg") {
  const cellWidth = 520;
  const cellHeight = 390;
  const labelHeight = 86;
  const gap = 18;
  const columns = 2;
  const rows = Math.ceil(items.length / columns) || 1;
  const width = columns * cellWidth + (columns + 1) * gap;
  const height = rows * cellHeight + (rows + 1) * gap;
  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#f2f0ea",
    },
  });
  const composites = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const col = index % columns;
    const row = Math.floor(index / columns);
    const left = gap + col * (cellWidth + gap);
    const top = gap + row * (cellHeight + gap);
    const sourcePath = absPath(item.localSourcePath);
    const imageBuffer = await sharp(sourcePath)
      .rotate()
      .resize({ width: cellWidth, height: cellHeight - labelHeight, fit: "inside", withoutEnlargement: true, background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86 })
      .toBuffer();
    const label = [
      `${index + 1}. ${item.pageId} / ${item.slotId} / ${item.viewportProfile} / ${item.width}x${item.height}`,
      `${item.decision} / priority ${item.priority}`,
      item.parentAssetId,
    ].join("\n");
    const svg = Buffer.from(`
      <svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#151515"/>
        <text x="14" y="24" font-family="Arial, sans-serif" font-size="16" fill="#ffffff">${escapeHtml(label).split("\n").map((line, i) => `<tspan x="14" dy="${i === 0 ? 0 : 22}">${line}</tspan>`).join("")}</text>
      </svg>
    `);
    composites.push({ input: imageBuffer, left, top });
    composites.push({ input: svg, left, top: top + cellHeight - labelHeight });
  }
  const outputPath = path.join(CONTACT_DIR, fileName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await base.composite(composites).jpeg({ quality: 88 }).toFile(outputPath);
  return path.relative(OUT_DIR, outputPath);
}

function renderHtml(queue = {}, workOrders = []) {
  const rows = workOrders.map((item, index) => `
    <article class="card">
      <div class="meta">
        <strong>${index + 1}. ${escapeHtml(item.pageId)} / ${escapeHtml(item.slotId)} / ${escapeHtml(item.viewportProfile)}</strong>
        <span>${escapeHtml(item.decision)} · priority ${escapeHtml(item.priority)} · ${escapeHtml(`${item.width}x${item.height}`)}</span>
      </div>
      <img src="${escapeHtml(item.thumbnailRef)}" alt="">
      <dl>
        <dt>parent</dt><dd>${escapeHtml(item.parentAssetId)}</dd>
        <dt>source</dt><dd>${escapeHtml(item.localSourcePath)}</dd>
        <dt>output</dt><dd>${escapeHtml(item.outputRef)}</dd>
        <dt>reason</dt><dd>${escapeHtml(item.reason)}</dd>
      </dl>
      <pre>${escapeHtml(item.prompt)}</pre>
    </article>
  `).join("\n");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LGE Text Removal Review Pack</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f2f0ea; color: #171717; }
    header { padding: 28px 34px; background: #171717; color: #fff; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    .summary { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .pill { background: #fff; color: #171717; border-radius: 999px; padding: 7px 12px; font-size: 13px; }
    main { padding: 28px; display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 22px; }
    .card { background: #fff; border: 1px solid #ded8cc; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 38px rgba(0,0,0,.08); }
    .meta { padding: 16px 18px; display: grid; gap: 5px; }
    .meta strong { font-size: 16px; }
    .meta span { color: #666; font-size: 13px; }
    img { width: 100%; min-height: 180px; object-fit: contain; background: #eee; display: block; }
    dl { margin: 0; padding: 16px 18px; display: grid; grid-template-columns: 74px 1fr; gap: 8px 12px; font-size: 12px; border-top: 1px solid #eee; }
    dt { font-weight: 700; color: #555; }
    dd { margin: 0; word-break: break-all; }
    pre { margin: 0; padding: 16px 18px; background: #171717; color: #f7f0e4; font-size: 12px; white-space: pre-wrap; line-height: 1.45; }
    a { color: inherit; }
  </style>
</head>
<body>
  <header>
    <h1>LGE Text Removal Review Pack</h1>
    <p>원본 blocked 자산을 수정하지 않고, 텍스트 제거 파생 자산 후보만 검토하기 위한 패키지입니다.</p>
    <div class="summary">
      <span class="pill">direct ${queue.summary?.candidateCount || 0}</span>
      <span class="pill">heavy ${queue.summary?.heavyDerivativeCount || 0}</span>
      <span class="pill">excluded ${queue.summary?.excludedCount || 0}</span>
      <span class="pill">work orders ${workOrders.length}</span>
    </div>
  </header>
  <main>${rows}</main>
</body>
</html>`;
}

async function main() {
  const queue = readJson(QUEUE_PATH, { workOrders: [], summary: {} });
  const workOrders = (Array.isArray(queue.workOrders) ? queue.workOrders : [])
    .filter((item) => item.localSourcePath && fs.existsSync(absPath(item.localSourcePath)))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.parentAssetId || "").localeCompare(String(b.parentAssetId || ""), "ko"));
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  fs.mkdirSync(CONTACT_DIR, { recursive: true });
  const enriched = [];
  for (const item of workOrders) {
    const thumbnailRef = await makeThumb(item);
    enriched.push({ ...item, thumbnailRef });
  }
  const direct = enriched.filter((item) => item.decision === "text-removal-candidate");
  const heavy = enriched.filter((item) => item.decision === "manual-heavy-derivative");
  const directSheet = direct.length ? await makeContactSheet(direct, "direct-text-removal-candidates.jpg") : "";
  const heavySheet = heavy.length ? await makeContactSheet(heavy, "heavy-derivative-candidates.jpg") : "";
  const indexHtml = renderHtml(queue, enriched);
  writeText(path.join(OUT_DIR, "index.html"), indexHtml);
  writeJson(path.join(OUT_DIR, "review-pack.json"), {
    generatedAt: new Date().toISOString(),
    queuePath: path.relative(ROOT, QUEUE_PATH),
    summary: {
      workOrderCount: enriched.length,
      directCount: direct.length,
      heavyCount: heavy.length,
      directSheet,
      heavySheet,
    },
    workOrders: enriched,
  });
  console.log(JSON.stringify({
    outDir: path.relative(ROOT, OUT_DIR),
    indexHtml: path.relative(ROOT, path.join(OUT_DIR, "index.html")),
    directSheet,
    heavySheet,
    workOrderCount: enriched.length,
    directCount: direct.length,
    heavyCount: heavy.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
