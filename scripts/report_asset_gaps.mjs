#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEFAULT_AUDIT_PATH = path.join(ROOT, "data", "normalized", "admin-design-target-audit-final.json");
const OUT_JSON = path.join(ROOT, "data", "normalized", "asset-gap-report.json");
const OUT_MD = path.join(ROOT, "data", "normalized", "asset-gap-report.md");

function parseArgs(argv = []) {
  const args = { input: DEFAULT_AUDIT_PATH, outJson: OUT_JSON, outMd: OUT_MD };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "").trim();
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function classifyPriority(page = {}) {
  if (page.emptySectionCount >= page.editableSectionCount && page.editableSectionCount > 0) return "critical";
  if (page.emptyRatio >= 0.75) return "high";
  if (page.emptyRatio >= 0.25) return "medium";
  if (page.emptySectionCount > 0) return "low";
  return "covered";
}

function inferRequiredRole(slotId = "") {
  const slot = String(slotId || "").trim();
  const lower = slot.toLowerCase();
  if (["hero", "visual", "brandbanner", "labelbanner", "carebanner", "brandstory", "marketing-area", "brand-showroom"].includes(lower)) {
    return "background-only";
  }
  if (["quickmenu", "quickmenu", "shortcut", "tabs"].includes(lower)) return "icon-only-family";
  if (["md-choice", "timedeal", "best-ranking", "bestproduct", "firstrow", "firstproduct", "latest-product-news", "subscription"].includes(lower)) {
    return "card-media";
  }
  if (["price", "option", "qna", "guides", "seller", "benefit", "noticebanner", "detailinfo", "review", "reviewinfo", "header-top", "header-bottom", "smart-life", "lg-best-care", "bestshop-guide"].includes(lower)) {
    return "css-composition-preferred";
  }
  return "slot-specific";
}

function inferFallbackMode(requiredRole = "") {
  if (requiredRole === "background-only") return "image-router-then-css";
  if (requiredRole === "icon-only-family") return "generated-icon-family-then-css";
  if (requiredRole === "card-media") return "css-first-image-router-when-safe";
  if (requiredRole === "css-composition-preferred") return "css-composition";
  return "policy-required";
}

function buildReport(audit = {}) {
  const results = Array.isArray(audit.results) ? audit.results : [];
  const pages = results.map((result) => {
    const editableSectionCount = Number(result.editableComponentCount || 0);
    const emptySections = Array.isArray(result.assetEmptySections) ? result.assetEmptySections : [];
    const emptySectionCount = emptySections.length;
    const emptyRatio = editableSectionCount > 0 ? emptySectionCount / editableSectionCount : 0;
    const missingSlots = emptySections.map((slotId) => {
      const requiredRole = inferRequiredRole(slotId);
      return {
        slotId,
        requiredRole,
        fallbackMode: inferFallbackMode(requiredRole),
      };
    });
    const page = {
      pageId: String(result.pageId || "").trim(),
      viewportProfile: String(result.viewportProfile || "").trim(),
      label: String(result.label || "").trim(),
      editableSectionCount,
      emptySectionCount,
      emptyRatio,
      availableAssets: {
        images: Number(result.assetAvailableCounts?.images || 0),
        iconFamilies: Number(result.assetAvailableCounts?.iconFamilies || 0),
        interactionComponents: Number(result.assetAvailableCounts?.interactionComponents || 0),
      },
      missingSlots,
    };
    page.priority = classifyPriority(page);
    return page;
  });
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, covered: 4 };
  pages.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff) return priorityDiff;
    const emptyDiff = b.emptyRatio - a.emptyRatio;
    if (emptyDiff) return emptyDiff;
    return `${a.pageId}:${a.viewportProfile}`.localeCompare(`${b.pageId}:${b.viewportProfile}`, "ko");
  });
  const summary = pages.reduce((acc, page) => {
    acc.targetCount += 1;
    acc.editableSectionCount += page.editableSectionCount;
    acc.emptySectionCount += page.emptySectionCount;
    acc.priority[page.priority] = Number(acc.priority[page.priority] || 0) + 1;
    return acc;
  }, { targetCount: 0, editableSectionCount: 0, emptySectionCount: 0, priority: {} });
  summary.emptyRatio = summary.editableSectionCount > 0
    ? summary.emptySectionCount / summary.editableSectionCount
    : 0;
  return {
    generatedAt: new Date().toISOString(),
    sourceAudit: path.relative(ROOT, path.resolve(audit.__sourcePath || DEFAULT_AUDIT_PATH)),
    summary,
    pages,
  };
}

function formatPercent(value = 0) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function buildMarkdown(report = {}) {
  const lines = [];
  lines.push("# Asset Gap Report");
  lines.push("");
  lines.push(`generatedAt: ${report.generatedAt}`);
  lines.push(`sourceAudit: ${report.sourceAudit}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- targets: ${report.summary?.targetCount || 0}`);
  lines.push(`- editable sections: ${report.summary?.editableSectionCount || 0}`);
  lines.push(`- empty asset sections: ${report.summary?.emptySectionCount || 0}`);
  lines.push(`- empty ratio: ${formatPercent(report.summary?.emptyRatio || 0)}`);
  lines.push(`- priority: ${JSON.stringify(report.summary?.priority || {})}`);
  lines.push("");
  lines.push("## Targets");
  lines.push("");
  lines.push("| priority | pageId | viewport | empty / editable | gap | available img/icon/int | missing slots |");
  lines.push("| --- | --- | --- | ---: | ---: | --- | --- |");
  for (const page of report.pages || []) {
    const missing = page.missingSlots
      .map((slot) => `${slot.slotId} (${slot.requiredRole}, ${slot.fallbackMode})`)
      .join("<br>");
    lines.push(`| ${page.priority} | ${page.pageId} | ${page.viewportProfile} | ${page.emptySectionCount} / ${page.editableSectionCount} | ${formatPercent(page.emptyRatio)} | ${page.availableAssets.images}/${page.availableAssets.iconFamilies}/${page.availableAssets.interactionComponents} | ${missing || "none"} |`);
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(ROOT, args.input);
  const audit = readJson(sourcePath);
  audit.__sourcePath = sourcePath;
  const report = buildReport(audit);
  const outJson = path.resolve(ROOT, args.outJson);
  const outMd = path.resolve(ROOT, args.outMd);
  ensureDir(outJson);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(outMd, buildMarkdown(report), "utf8");
  console.log(JSON.stringify({ outJson, outMd, summary: report.summary }, null, 2));
}

main();
