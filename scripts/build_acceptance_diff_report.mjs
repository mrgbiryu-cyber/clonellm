#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import sharp from "sharp";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const HOME_DIR = path.join(ROOT, "data", "visual", "home");
const HOME_LOWER_DIR = path.join(ROOT, "data", "visual", "home-lower");
const SERVICE_INDEX_PATH = path.join(ROOT, "data", "visual", "service-pages", "index.json");
const PLP_INDEX_PATH = path.join(ROOT, "data", "visual", "plp", "index.json");
const OUT_MD = path.join(ROOT, "docs", "acceptance-diff-report.md");
const OUT_JSON = path.join(ROOT, "data", "reports", "acceptance-diff-report.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function loadPngAsRaw(filePath, width, height) {
  const buffer = await sharp(filePath)
    .resize(width, height, { fit: "fill" })
    .png()
    .toBuffer();
  return PNG.sync.read(buffer);
}

async function comparePair(referencePath, workingPath) {
  if (!referencePath || !workingPath) return null;
  if (!fs.existsSync(referencePath) || !fs.existsSync(workingPath)) return null;
  const refMeta = await sharp(referencePath).metadata();
  const workMeta = await sharp(workingPath).metadata();
  const width = Number(refMeta.width || workMeta.width || 0);
  const height = Number(refMeta.height || workMeta.height || 0);
  if (!width || !height) return null;
  const ref = await loadPngAsRaw(referencePath, width, height);
  const work = await loadPngAsRaw(workingPath, width, height);
  const diff = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(ref.data, work.data, diff.data, width, height, {
    threshold: 0.15,
    includeAA: true,
  });
  const totalPixels = width * height;
  return {
    referencePath,
    workingPath,
    referenceSize: { width: Number(refMeta.width || 0), height: Number(refMeta.height || 0) },
    workingSize: { width: Number(workMeta.width || 0), height: Number(workMeta.height || 0) },
    compareSize: { width, height },
    mismatchedPixels,
    totalPixels,
    mismatchRatio: totalPixels ? mismatchedPixels / totalPixels : null,
  };
}

function serviceCaptureMap(filePath) {
  const captures = readJson(filePath, {}).captures || [];
  const map = new Map();
  for (const item of captures) {
    const key = `${item.pageId}:${item.viewportProfile}:${item.sourceType}`;
    map.set(key, item);
  }
  return map;
}

async function buildReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    home: null,
    homeLower: [],
    servicePages: [],
    plpPages: [],
  };

  report.home = await comparePair(
    path.join(HOME_DIR, "reference.png"),
    path.join(HOME_DIR, "working.png")
  );

  for (const slotId of fs.readdirSync(HOME_LOWER_DIR)) {
    const slotDir = path.join(HOME_LOWER_DIR, slotId);
    if (!fs.statSync(slotDir).isDirectory()) continue;
    const diff = await comparePair(
      path.join(slotDir, "live-reference.png"),
      path.join(slotDir, "working.png")
    );
    report.homeLower.push({
      slotId,
      ...diff,
    });
  }

  const serviceMap = serviceCaptureMap(SERVICE_INDEX_PATH);
  for (const pageId of ["support", "bestshop", "care-solutions"]) {
    for (const viewportProfile of ["pc", "mo"]) {
      const reference = serviceMap.get(`${pageId}:${viewportProfile}:reference`);
      const working = serviceMap.get(`${pageId}:${viewportProfile}:working`);
      const diff = await comparePair(reference?.artifact?.screenshotPath, working?.artifact?.screenshotPath);
      report.servicePages.push({ pageId, viewportProfile, ...diff });
    }
  }

  const plpMap = serviceCaptureMap(PLP_INDEX_PATH);
  for (const pageId of ["category-tvs", "category-refrigerators"]) {
    for (const viewportProfile of ["pc", "mo"]) {
      const reference = plpMap.get(`${pageId}:${viewportProfile}:reference`);
      const working = plpMap.get(`${pageId}:${viewportProfile}:working`);
      const diff = await comparePair(reference?.artifact?.screenshotPath, working?.artifact?.screenshotPath);
      report.plpPages.push({ pageId, viewportProfile, ...diff });
    }
  }

  return report;
}

function pct(value) {
  if (typeof value !== "number") return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

function toMarkdown(report) {
  const lines = [];
  lines.push("# Acceptance Diff Report");
  lines.push("");
  lines.push(`- generatedAt: \`${report.generatedAt}\``);
  lines.push("- note: screenshot diff is heuristic; it helps prioritize review but does not replace visual acceptance.");
  lines.push("");

  if (report.home) {
    lines.push("## Home");
    lines.push("");
    lines.push(`- mismatchRatio: \`${pct(report.home.mismatchRatio)}\``);
    lines.push(`- reference: \`${report.home.referencePath}\``);
    lines.push(`- working: \`${report.home.workingPath}\``);
    lines.push("");
  }

  lines.push("## Home Lower");
  lines.push("");
  for (const item of report.homeLower.sort((a, b) => (b.mismatchRatio || 0) - (a.mismatchRatio || 0))) {
    lines.push(`- \`${item.slotId}\` mismatch=\`${pct(item.mismatchRatio)}\``);
  }
  lines.push("");

  lines.push("## Service Pages");
  lines.push("");
  for (const item of report.servicePages.sort((a, b) => (b.mismatchRatio || 0) - (a.mismatchRatio || 0))) {
    lines.push(`- \`${item.pageId}:${item.viewportProfile}\` mismatch=\`${pct(item.mismatchRatio)}\``);
  }
  lines.push("");

  lines.push("## PLP Pages");
  lines.push("");
  for (const item of report.plpPages.sort((a, b) => (b.mismatchRatio || 0) - (a.mismatchRatio || 0))) {
    lines.push(`- \`${item.pageId}:${item.viewportProfile}\` mismatch=\`${pct(item.mismatchRatio)}\``);
  }
  lines.push("");

  return lines.join("\n");
}

const report = await buildReport();
ensureDir(path.dirname(OUT_JSON));
fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
fs.writeFileSync(OUT_MD, `${toMarkdown(report)}\n`, "utf-8");
process.stdout.write(`${toMarkdown(report)}\n`);
