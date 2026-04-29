#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASE_URL = process.env.BATCHED_BUILD_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_LOGIN_ID = process.env.BATCHED_BUILD_LOGIN_ID || "mrgbiryu";
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "data", "debug", "batched-model-builds");
const ADMIN_TARGET_AUDIT_PATH = path.join(ROOT, "data", "normalized", "admin-design-target-audit-final.json");

const DEFAULT_COMPONENTS = {
  "home/mo": [
    "home.hero",
    "home.quickmenu",
    "home.md-choice",
    "home.timedeal",
    "home.best-ranking",
    "home.marketing-area",
    "home.subscription",
    "home.brand-showroom",
    "home.latest-product-news",
    "home.smart-life",
    "home.lg-best-care",
    "home.bestshop-guide",
  ],
};

function parseArgs(argv = []) {
  const args = {};
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

function chunk(values = [], size = 4) {
  const out = [];
  const chunkSize = Math.max(1, Number(size) || 4);
  for (let index = 0; index < values.length; index += chunkSize) {
    out.push(values.slice(index, index + chunkSize));
  }
  return out;
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "batch";
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function getDefaultComponentsForPage(page = "", viewport = "") {
  const preset = DEFAULT_COMPONENTS[`${page}/${viewport}`];
  if (Array.isArray(preset) && preset.length) return preset;
  const audit = readJson(ADMIN_TARGET_AUDIT_PATH, { results: [] });
  const row = (Array.isArray(audit.results) ? audit.results : []).find((item) =>
    String(item?.pageId || "").trim() === page &&
    String(item?.viewportProfile || "").trim() === viewport
  );
  const slots = Array.isArray(row?.editableSlots) ? row.editableSlots : [];
  return slots
    .map((slotId) => String(slotId || "").trim())
    .filter(Boolean)
    .map((slotId) => `${page}.${slotId}`);
}

function printHelp() {
  console.log(`Usage:
  npm run design-pipeline:batched-compose -- --page home --viewport mo --batch-size 4

Options:
  --components a,b,c       Override component list. home/mo has a default 12-section list.
  --batch-size 4           Number of components per model comparison batch.
  --request "..."          Requirement text passed to every batch.
  --base-url URL           Base URL for generated preview/compare links.
  --login mrgbiryu         Workspace login id.
  --single-model           Run only the challenger model instead of baseline/challenger comparison.
  --dry-run                Print planned batches without calling models.
`);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runNodeScript(scriptRelativePath, args = []) {
  const scriptPath = path.join(ROOT, scriptRelativePath);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function findJsonObject(stdout = "") {
  const text = String(stdout || "");
  for (let index = text.lastIndexOf("{"); index >= 0; index = text.lastIndexOf("{", index - 1)) {
    const slice = text.slice(index).trim();
    try {
      return JSON.parse(slice);
    } catch {}
  }
  return null;
}

function buildCompareArgs({ args, batch, batchIndex, outputJson, outputMd, label }) {
  const page = String(args.page || "home").trim();
  const viewport = String(args.viewport || "mo").trim();
  const compareArgs = [
    "--page", page,
    "--viewport", viewport,
    "--target-scope", String(args["target-scope"] || "page"),
    "--target-group-id", String(args["target-group-id"] || "page"),
    "--target-group-label", label,
    "--components", batch.join(","),
    "--request", String(args.request || "LG전자 모바일 홈을 실제 운영 가능한 프리미엄 커머스 랜딩으로 재구성한다. 모든 문구는 고객에게 직접 노출 가능한 운영 카피로 작성한다."),
    "--message", String(args.message || `${label} 재정렬`),
    "--direction", String(args.direction || "모바일 단일 컬럼 리듬, 큰 터치 타깃, 선명한 섹션 구분, 실제 프로모션/제품 탐색/상담 CTA가 이어지는 구조"),
    "--avoid", String(args.avoid || "내부 지시문, fallback, debug, 컨셉 설명, target group, component 같은 제작용 문구를 절대 화면에 노출하지 않는다."),
    "--tone", String(args.tone || "프리미엄, 따뜻함, 명확한 쇼핑 안내"),
    "--level", String(args.level || "high"),
    "--output", path.relative(ROOT, outputJson),
    "--output-md", path.relative(ROOT, outputMd),
  ];
  const optionalMappings = [
    ["base-url", "base-url"],
    ["login", "login"],
    ["login-id", "login-id"],
    ["baseline-model", "baseline-model"],
    ["baseline-provider", "baseline-provider"],
    ["baseline-label", "baseline-label"],
    ["claude-model", "claude-model"],
    ["challenger-provider", "challenger-provider"],
    ["challenger-label", "challenger-label"],
    ["model", "model"],
  ];
  optionalMappings.forEach(([sourceKey, targetKey]) => {
    if (args[sourceKey]) compareArgs.push(`--${targetKey}`, String(args[sourceKey]));
  });
  if (args["single-model"] === true || String(args.mode || "").trim() === "single") {
    compareArgs.push("--single-model");
  }
  if (args.refs) compareArgs.push("--refs", String(args.refs));
  if (args.id) compareArgs.push("--id", `${String(args.id)}-batch-${batchIndex + 1}`);
  return compareArgs;
}

function getSelectedVariant(report = {}) {
  const variants = Array.isArray(report?.variants) ? report.variants : [];
  return variants.find((variant) => String(variant?.id || "").trim() === "challenger") || variants[1] || variants[0] || null;
}

function getChallengerDraftId(report = {}) {
  const challenger = getSelectedVariant(report);
  return String(challenger?.validation?.draftBuildId || "").trim();
}

function getChallengerValidation(report = {}) {
  const challenger = getSelectedVariant(report);
  return challenger?.validation && typeof challenger.validation === "object" ? challenger.validation : null;
}

function isBatchUsable(report = {}) {
  const challengerValidation = getChallengerValidation(report);
  if (!challengerValidation || !getChallengerDraftId(report)) return false;
  const checks = Array.isArray(challengerValidation.checks) ? challengerValidation.checks : [];
  const checkOk = (name) => {
    const record = checks.find((item) => String(item?.name || "").trim() === name);
    return record ? Boolean(record.ok) : false;
  };
  const providerMeta = challengerValidation.providerMeta || {};
  const providerReady =
    !providerMeta.usedDemoFallback &&
    String(providerMeta.provider || "").trim() !== "local-fallback";
  return Boolean(
    providerReady &&
      checkOk("build_ok") &&
      checkOk("runtime_urls") &&
      checkOk("rendered_html_non_empty") &&
      checkOk("compare_html_non_empty") &&
      checkOk("no_internal_or_legacy_text")
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printHelp();
    return;
  }
  const page = String(args.page || "home").trim();
  const viewport = String(args.viewport || "mo").trim();
  const login = String(args.login || args["login-id"] || DEFAULT_LOGIN_ID).trim();
  const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL).replace(/\/$/, "");
  const batchSize = Number.parseInt(String(args["batch-size"] || "4"), 10);
  const components = splitList(args.components || "").length
    ? splitList(args.components)
    : getDefaultComponentsForPage(page, viewport);
  if (!components.length) {
    throw new Error("components required for this page/viewport. Use --components page.slot,page.slot");
  }
  const runId = String(args["run-id"] || `${page}-${viewport}-${Date.now()}`).trim();
  const outputDir = path.resolve(ROOT, args["output-dir"] || path.join(DEFAULT_OUTPUT_DIR, slug(runId)));
  fs.mkdirSync(outputDir, { recursive: true });
  const batches = chunk(components, batchSize);
  if (args["dry-run"]) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      page,
      viewport,
      login,
      baseUrl,
      runId,
      outputDir,
      mode: args["single-model"] === true || String(args.mode || "").trim() === "single" ? "single" : "compare",
      batchSize,
      batches: batches.map((items, index) => ({ index: index + 1, components: items })),
    }, null, 2));
    return;
  }
  const batchReports = [];
  const challengerDraftIds = [];
  const skippedBatches = [];
  const localFallbackReports = [];

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const label = String(args.label || `${page} ${viewport} batch ${index + 1}`).trim();
    const outputJson = path.join(outputDir, `batch-${String(index + 1).padStart(2, "0")}.json`);
    const outputMd = path.join(outputDir, `batch-${String(index + 1).padStart(2, "0")}.md`);
    console.log(`[batched-build] batch ${index + 1}/${batches.length}: ${batch.join(",")}`);
    const result = runNodeScript("scripts/compare_requirement_concept_build_models.mjs", buildCompareArgs({
      args,
      batch,
      batchIndex: index,
      outputJson,
      outputMd,
      label,
    }));
    const report = readJson(outputJson, null);
    batchReports.push({
      index: index + 1,
      components: batch,
      outputJson,
      outputMd,
      exitCode: result.status,
      ok: isBatchUsable(report),
      bothPassed: Boolean(report?.comparison?.bothPassed),
      challengerDraftBuildId: getChallengerDraftId(report),
      report,
    });
    if (!isBatchUsable(report)) {
      skippedBatches.push({
        index: index + 1,
        components: batch,
        reason: "challenger_batch_unusable",
        exitCode: result.status,
        outputJson: path.relative(ROOT, outputJson),
        outputMd: path.relative(ROOT, outputMd),
      });
      writeJson(path.join(outputDir, "batched-run-partial.json"), {
        ok: true,
        partial: true,
        skippedBatches,
        batchReports,
      });
      continue;
    }
    const challengerDraftId = getChallengerDraftId(report);
    challengerDraftIds.push(challengerDraftId);
  }

  if (skippedBatches.length && args["no-local-fallback"] !== true) {
    for (const skipped of skippedBatches) {
      const index = Number(skipped.index || 0) - 1;
      const batch = batches[index] || skipped.components || [];
      if (!batch.length) continue;
      const label = `${String(args.label || `${page} ${viewport} batch ${index + 1}`).trim()} local fallback`;
      const outputJson = path.join(outputDir, `batch-${String(index + 1).padStart(2, "0")}-local-fallback.json`);
      const outputMd = path.join(outputDir, `batch-${String(index + 1).padStart(2, "0")}-local-fallback.md`);
      console.log(`[batched-build] local fallback batch ${index + 1}/${batches.length}: ${batch.join(",")}`);
      const fallbackArgs = {
        ...args,
        "challenger-provider": "local",
        "challenger-label": "local-debug",
        model: "",
      };
      const result = runNodeScript("scripts/compare_requirement_concept_build_models.mjs", buildCompareArgs({
        args: fallbackArgs,
        batch,
        batchIndex: index,
        outputJson,
        outputMd,
        label,
      }));
      const report = readJson(outputJson, null);
      const usable = isBatchUsable(report);
      localFallbackReports.push({
        index: index + 1,
        components: batch,
        outputJson,
        outputMd,
        exitCode: result.status,
        ok: usable,
        challengerDraftBuildId: getChallengerDraftId(report),
        report,
      });
      if (usable) {
        const fallbackDraftId = getChallengerDraftId(report);
        if (fallbackDraftId) challengerDraftIds.push(fallbackDraftId);
      }
    }
  }

  if (!challengerDraftIds.length) {
    writeJson(path.join(outputDir, "batched-run-failed.json"), {
      ok: false,
      reason: "no_usable_challenger_drafts",
      skippedBatches,
      localFallbackReports,
      batchReports,
    });
    process.exitCode = 1;
    return;
  }

  const composeArgs = [
    "--login", login,
    "--page", page,
    "--viewport", viewport,
    "--label", String(args["compose-label"] || args.label || `${page} ${viewport} composed batched draft`),
    "--summary", String(args.summary || `${page} ${viewport} composed batched draft`),
    "--version-label", String(args["version-label"] || `${page}-${viewport}-batched-composed`),
    "--drafts", challengerDraftIds.join(","),
    "--base-url", baseUrl,
  ];
  console.log(`[batched-build] compose: ${challengerDraftIds.join(",")}`);
  const composeResult = runNodeScript("scripts/compose_batched_draft_builds.mjs", composeArgs);
  const composeJson = findJsonObject(composeResult.stdout);
  const finalReport = {
    ok: composeResult.status === 0 && Boolean(composeJson?.ok),
    generatedAt: new Date().toISOString(),
    page,
    viewport,
    login,
    baseUrl,
    runId,
    batchSize,
    components,
    challengerDraftIds,
    skippedBatches,
    localFallbackReports: localFallbackReports.map((item) => ({
      index: item.index,
      components: item.components,
      ok: item.ok,
      outputJson: path.relative(ROOT, item.outputJson),
      outputMd: path.relative(ROOT, item.outputMd),
      challengerDraftBuildId: item.challengerDraftBuildId,
      comparison: item.report?.comparison || null,
    })),
    compose: composeJson,
    batchReports: batchReports.map((item) => ({
      index: item.index,
      components: item.components,
      ok: item.ok,
      bothPassed: item.bothPassed,
      outputJson: path.relative(ROOT, item.outputJson),
      outputMd: path.relative(ROOT, item.outputMd),
      challengerDraftBuildId: item.challengerDraftBuildId,
      comparison: item.report?.comparison || null,
    })),
  };
  writeJson(path.join(outputDir, "batched-run-report.json"), finalReport);
  console.log(JSON.stringify(finalReport, null, 2));
  if (!finalReport.ok) process.exitCode = composeResult.status || 1;
}

main();
