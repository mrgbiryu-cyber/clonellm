#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEFAULT_AUDIT_PATH = path.join(ROOT, "data", "normalized", "admin-design-target-audit-final.json");
const DEFAULT_ASSET_CONTRACT_AUDIT_PATH = path.join(ROOT, "data", "normalized", "asset-authoring-contract-audit.json");
const BLUEPRINT_PATH = path.join(ROOT, "data", "normalized", "page-builder-prompt-blueprints.json");
const OUT_JSON = path.join(ROOT, "data", "normalized", "page-runtime-status.json");
const OUT_MD = path.join(ROOT, "data", "normalized", "page-runtime-status.md");

function parseArgs(argv = []) {
  const args = {
    input: DEFAULT_AUDIT_PATH,
    assetContractAudit: DEFAULT_ASSET_CONTRACT_AUDIT_PATH,
    outJson: OUT_JSON,
    outMd: OUT_MD,
    viewports: "pc,mo",
  };
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

function splitList(value = "") {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeBlueprintMap() {
  const source = readJson(BLUEPRINT_PATH, {});
  const blueprints = Array.isArray(source?.pageBlueprints) ? source.pageBlueprints : [];
  return new Map(
    blueprints
      .map((item) => [
        String(item?.pageId || item?.blueprintId || "").trim(),
        {
          blueprintId: String(item?.blueprintId || item?.pageId || "").trim(),
          implementationStatus: String(item?.implementationStatus || "").trim() || "unknown",
          targetKind: String(item?.targetKind || "").trim(),
          label: String(item?.label || "").trim(),
        },
      ])
      .filter(([pageId]) => pageId)
  );
}

function normalizeAssetContractMap(contractAudit = {}) {
  const pages = Array.isArray(contractAudit?.pages) ? contractAudit.pages : [];
  return new Map(
    pages
      .map((page) => {
        const pageId = String(page?.pageId || "").trim();
        if (!pageId) return null;
        const viewports = Array.isArray(page?.viewports) ? page.viewports : [];
        const viewportMap = new Map(
          viewports
            .map((viewport) => {
              const viewportProfile = String(viewport?.viewportProfile || "").trim();
              if (!viewportProfile) return null;
              const rowsNeedingReview = Number(viewport?.rowsNeedingReview || 0);
              const componentCount = Number(viewport?.componentCount || 0);
              const rowsWithApprovedImage = Number(viewport?.rowsWithApprovedImage || 0);
              const rowsWithApprovedIconFamily = Number(viewport?.rowsWithApprovedIconFamily || 0);
              const rowsWithApprovedInteraction = Number(viewport?.rowsWithApprovedInteraction || 0);
              return [
                viewportProfile,
                {
                  viewportProfile,
                  componentCount,
                  rowsWithAssets: Number(viewport?.rowsWithAssets || 0),
                  rowsWithApprovedImage,
                  rowsWithApprovedIconFamily,
                  rowsWithApprovedInteraction,
                  rowsNeedingReview,
                  contractStatus: rowsNeedingReview > 0 ? "asset-contract-review" : "asset-contract-pass",
                },
              ];
            })
            .filter(Boolean)
        );
        return [pageId, viewportMap];
      })
      .filter(Boolean)
  );
}

function getRuntimeStatus(result = {}) {
  const missingAuthoredSlots = Array.isArray(result?.build?.missingAuthoredSlots)
    ? result.build.missingAuthoredSlots
    : [];
  if (Number(result.cloneStatus || 0) !== 200) return "clone-fail";
  if (Number(result.editableComponentCount || 0) <= 0) return "no-editable-components";
  if (Number(result.sidecarSectionCount || 0) <= 0) return "no-sidecar-sections";
  if (!result.build) return "not-built";
  if (result.build.ok !== true) return "build-fail";
  if (missingAuthoredSlots.length) return "authored-slot-missing";
  return "runtime-pass";
}

function getAssetStatus(result = {}) {
  const editableCount = Number(result.editableComponentCount || 0);
  const emptyCount = Array.isArray(result.assetEmptySections) ? result.assetEmptySections.length : 0;
  if (editableCount <= 0) return "asset-unknown";
  if (emptyCount <= 0) return "asset-sufficient";
  if (emptyCount >= editableCount) return "asset-empty";
  return "asset-insufficient";
}

function summarizePage(pageId, results = [], blueprint = {}, assetContractMap = new Map()) {
  const pageContractMap = assetContractMap.get(pageId) || new Map();
  const viewports = results.map((result) => ({
    viewportProfile: String(result.viewportProfile || "").trim(),
    runtimeStatus: getRuntimeStatus(result),
    assetStatus: getAssetStatus(result),
    cloneStatus: Number(result.cloneStatus || 0),
    editableComponentCount: Number(result.editableComponentCount || 0),
    authoredSectionCount: Number(result.build?.authoredSectionCount || 0),
    assetEmptySectionCount: Array.isArray(result.assetEmptySections) ? result.assetEmptySections.length : 0,
    assetEmptySections: Array.isArray(result.assetEmptySections) ? result.assetEmptySections : [],
    draftBuildId: String(result.build?.draftBuildId || "").trim(),
    previewPath: String(result.build?.previewPath || "").trim(),
    comparePath: String(result.build?.comparePath || "").trim(),
  })).map((viewport) => {
    const contract = pageContractMap.get(viewport.viewportProfile) || null;
    return {
      ...viewport,
      assetContractStatus: contract?.contractStatus || "asset-contract-unknown",
      assetContract: contract,
    };
  });
  const runtimeStatuses = new Set(viewports.map((item) => item.runtimeStatus));
  const assetStatuses = new Set(viewports.map((item) => item.assetStatus));
  const assetContractStatuses = new Set(viewports.map((item) => item.assetContractStatus));
  const runtimeStatus = runtimeStatuses.size === 1 && runtimeStatuses.has("runtime-pass") ? "runtime-pass" : "runtime-attention";
  const assetStatus = assetStatuses.size === 1 && assetStatuses.has("asset-sufficient")
    ? "asset-sufficient"
    : assetStatuses.has("asset-empty")
      ? "asset-empty"
      : assetStatuses.has("asset-insufficient")
        ? "asset-insufficient"
        : "asset-unknown";
  const assetContractStatus = assetContractStatuses.size === 1 && assetContractStatuses.has("asset-contract-pass")
    ? "asset-contract-pass"
    : assetContractStatuses.has("asset-contract-review")
      ? "asset-contract-review"
      : "asset-contract-unknown";
  const blueprintStatus = String(blueprint.implementationStatus || "unknown").trim() || "unknown";
  return {
    pageId,
    label: String(blueprint.label || results[0]?.label || pageId).trim(),
    targetKind: String(blueprint.targetKind || "").trim(),
    blueprintStatus,
    runtimeStatus,
    assetStatus,
    assetContractStatus,
    staleBlueprintSignal: blueprintStatus === "blueprint-only" && runtimeStatus === "runtime-pass",
    viewports,
  };
}

function buildReport(audit = {}, assetContractAudit = {}, options = {}) {
  const allowedViewports = new Set(splitList(options.viewports || ""));
  const results = (Array.isArray(audit.results) ? audit.results : []).filter((result) => {
    if (!allowedViewports.size) return true;
    return allowedViewports.has(String(result?.viewportProfile || "").trim());
  });
  const blueprintMap = normalizeBlueprintMap();
  const assetContractMap = normalizeAssetContractMap(assetContractAudit);
  const byPage = new Map();
  for (const result of results) {
    const pageId = String(result?.pageId || "").trim();
    if (!pageId) continue;
    byPage.set(pageId, [...(byPage.get(pageId) || []), result]);
  }
  const pages = Array.from(byPage.entries())
    .map(([pageId, pageResults]) => summarizePage(pageId, pageResults, blueprintMap.get(pageId) || {}, assetContractMap))
    .sort((a, b) => a.pageId.localeCompare(b.pageId, "ko"));
  const summary = pages.reduce((acc, page) => {
    acc.pageCount += 1;
    acc.runtimeStatus[page.runtimeStatus] = Number(acc.runtimeStatus[page.runtimeStatus] || 0) + 1;
    acc.assetStatus[page.assetStatus] = Number(acc.assetStatus[page.assetStatus] || 0) + 1;
    acc.assetContractStatus[page.assetContractStatus] = Number(acc.assetContractStatus[page.assetContractStatus] || 0) + 1;
    if (page.staleBlueprintSignal) acc.staleBlueprintSignals += 1;
    return acc;
  }, { pageCount: 0, runtimeStatus: {}, assetStatus: {}, assetContractStatus: {}, staleBlueprintSignals: 0 });
  return {
    generatedAt: new Date().toISOString(),
    sourceAudit: path.relative(ROOT, path.resolve(audit.__sourcePath || DEFAULT_AUDIT_PATH)),
    sourceAssetContractAudit: assetContractAudit?.__sourcePath
      ? path.relative(ROOT, path.resolve(assetContractAudit.__sourcePath))
      : null,
    principle: "Runtime pass, source asset sufficiency, and authoring contract readiness are separate statuses.",
    viewports: Array.from(allowedViewports),
    summary,
    pages,
  };
}

function buildMarkdown(report = {}) {
  const lines = [];
  lines.push("# Page Runtime Status");
  lines.push("");
  lines.push(`generatedAt: ${report.generatedAt}`);
  lines.push(`sourceAudit: ${report.sourceAudit}`);
  if (report.sourceAssetContractAudit) lines.push(`sourceAssetContractAudit: ${report.sourceAssetContractAudit}`);
  if (Array.isArray(report.viewports) && report.viewports.length) lines.push(`viewports: ${report.viewports.join(", ")}`);
  lines.push("");
  lines.push("Runtime pass, source asset sufficiency, and authoring contract readiness are intentionally separate.");
  lines.push("");
  lines.push("- `assets` uses the original strict source/registry empty-section signal.");
  lines.push("- `asset contract` uses approved asset plus CSS/image-router fallback policy readiness.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- pages: ${report.summary?.pageCount || 0}`);
  lines.push(`- stale blueprint signals: ${report.summary?.staleBlueprintSignals || 0}`);
  lines.push(`- runtime status: ${JSON.stringify(report.summary?.runtimeStatus || {})}`);
  lines.push(`- asset status: ${JSON.stringify(report.summary?.assetStatus || {})}`);
  lines.push(`- asset contract status: ${JSON.stringify(report.summary?.assetContractStatus || {})}`);
  lines.push("");
  lines.push("## Pages");
  lines.push("");
  lines.push("| pageId | blueprint | runtime | assets | asset contract | stale blueprint | viewports |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const page of report.pages || []) {
    const viewports = (page.viewports || [])
      .map((item) => {
        const contract = item.assetContract || {};
        const approved = [
          `img=${Number(contract.rowsWithApprovedImage || 0)}`,
          `icon=${Number(contract.rowsWithApprovedIconFamily || 0)}`,
          `ix=${Number(contract.rowsWithApprovedInteraction || 0)}`,
          `review=${Number(contract.rowsNeedingReview || 0)}`,
        ].join("/");
        return `${item.viewportProfile}:${item.runtimeStatus}/${item.assetStatus}/${item.assetContractStatus} empty=${item.assetEmptySectionCount} ${approved}`;
      })
      .join("<br>");
    lines.push(`| ${page.pageId} | ${page.blueprintStatus} | ${page.runtimeStatus} | ${page.assetStatus} | ${page.assetContractStatus} | ${page.staleBlueprintSignal ? "yes" : "no"} | ${viewports} |`);
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(ROOT, args.input);
  const assetContractAuditPath = path.resolve(ROOT, args.assetContractAudit);
  const audit = readJson(sourcePath, null);
  if (!audit) throw new Error(`audit file not found or invalid: ${sourcePath}`);
  audit.__sourcePath = sourcePath;
  const assetContractAudit = readJson(assetContractAuditPath, null);
  if (assetContractAudit) assetContractAudit.__sourcePath = assetContractAuditPath;
  const report = buildReport(audit, assetContractAudit || {}, { viewports: args.viewports });
  const outJson = path.resolve(ROOT, args.outJson);
  const outMd = path.resolve(ROOT, args.outMd);
  ensureDir(outJson);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(outMd, buildMarkdown(report), "utf8");
  console.log(JSON.stringify({ outJson, outMd, summary: report.summary }, null, 2));
}

main();
