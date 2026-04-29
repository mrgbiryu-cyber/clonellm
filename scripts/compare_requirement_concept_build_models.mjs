#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const USERS_PATH = path.join(ROOT, "data", "runtime", "users.json");
const SESSIONS_PATH = path.join(ROOT, "data", "runtime", "sessions.json");
const OUTPUT_DIR = path.join(ROOT, "data", "debug");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "model-comparison-pipeline-report.json");
const OUTPUT_MD = path.join(OUTPUT_DIR, "model-comparison-pipeline-report.md");
const COOKIE_NAME = "lge_workspace_session";
const DEFAULT_BASE_URL = process.env.MODEL_COMPARE_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_LOGIN_ID = process.env.MODEL_COMPARE_LOGIN_ID || "mrgbiryu";
// TEST MODEL PROFILE (2026-04-29)
// 모델 비교 스크립트도 디버깅 중에는 저가 모델을 기본값으로 둔다.
// 품질 비교 재개 시 MODEL_COMPARE_CLAUDE_MODEL=anthropic/claude-sonnet-4.6 으로 명시 복구한다.
const DEFAULT_CLAUDE_MODEL = process.env.MODEL_COMPARE_CLAUDE_MODEL || "anthropic/claude-haiku-4.5";
const DEFAULT_MAX_ATTEMPTS = Number.parseInt(process.env.MODEL_COMPARE_MAX_ATTEMPTS || "3", 10);
const BANNED_TEXTS = [
  "운영 카피 확인용",
  "현재 원본 구조",
  "Bestshop Mobile Fallback Concept",
  "target group layout system",
  "must change internal text",
  "fallback coverage validation",
  "/clone?",
];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

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

function uniqueList(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function findSessionToken(loginId) {
  const users = readJson(USERS_PATH, { users: [] }).users || [];
  const sessions = readJson(SESSIONS_PATH, { sessions: [] }).sessions || [];
  const user = users.find((item) => String(item?.loginId || "").trim() === loginId);
  if (!user) throw new Error(`user_not_found:${loginId}`);
  const session = sessions
    .filter((item) => item.userId === user.userId)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))[0];
  if (!session?.token) throw new Error(`session_not_found:${loginId}`);
  return session.token;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
  const message = String(error?.message || error || "");
  return /fetch failed|ECONNRESET|ECONNREFUSED|UND_ERR|socket|terminated|timeout/i.test(message);
}

async function apiFetch({ baseUrl, token, pathname, payload = null, method = "GET", expectJson = true }) {
  const headers = { Cookie: `${COOKIE_NAME}=${token}` };
  if (payload !== null) headers["Content-Type"] = "application/json";
  const maxAttempts = Number.isFinite(DEFAULT_MAX_ATTEMPTS) && DEFAULT_MAX_ATTEMPTS > 0 ? DEFAULT_MAX_ATTEMPTS : 1;
  let response = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers,
        body: payload !== null ? JSON.stringify(payload) : undefined,
      });
      break;
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableFetchError(error)) throw error;
      const delayMs = Math.min(15000, 1000 * 2 ** (attempt - 1));
      console.warn(`[compare] fetch retry ${attempt}/${maxAttempts} ${method} ${pathname}: ${error?.message || error}`);
      await sleep(delayMs);
    }
  }
  const text = await response.text();
  if (!expectJson) return { status: response.status, ok: response.ok, text };
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status, ok: response.ok, json };
}

async function waitForServerReady(baseUrl) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/llm/status`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("server_not_ready");
}

function buildScenario(args = {}) {
  const pageId = String(args.page || args["page-id"] || "bestshop").trim();
  const viewportProfile = String(args.viewport || args["viewport-profile"] || "mo").trim() || "mo";
  const explicitComponents = args.components || args["target-components"] || "";
  const defaultComponents =
    pageId === "bestshop"
      ? "bestshop.hero,bestshop.shortcut,bestshop.review,bestshop.brandBanner"
      : "";
  const components = splitList(explicitComponents || defaultComponents)
    .map((componentId) => componentId.replace(/^page\./, `${pageId}.`));
  const targetScope = String(args.scope || args["target-scope"] || "page").trim() || "page";
  const targetGroupId = String(args["target-group-id"] || (targetScope === "page" ? "page" : "model-compare")).trim();
  return {
    id: String(args.id || `${pageId}-${viewportProfile}-model-compare`).trim(),
    pageId,
    viewportProfile,
    requestText: String(
      args.request ||
        "모바일 첫 화면에서 매장 상담, 주요 서비스, 고객 후기, 브랜드 체험 제안이 자연스럽게 이어지도록 실제 운영 가능한 랜딩 페이지 톤으로 정리한다."
    ).trim(),
    keyMessage: String(args.message || "베스트샵 모바일 경험을 상담과 체험 중심으로 명확하게 제안").trim(),
    preferredDirection: String(
      args.direction ||
        "터치하기 쉬운 단일 컬럼 흐름, 명확한 CTA, 실제 사용자에게 보여도 어색하지 않은 마케팅 문구를 우선한다."
    ).trim(),
    avoidDirection: String(args.avoid || "내부 지시문, 컨셉 라벨, fallback/debug 문구를 화면이나 저장본에 노출하지 않는다.").trim(),
    toneAndMood: String(args.tone || "프리미엄, 신뢰감, 매장 상담 친화").trim(),
    referenceUrls: splitList(args.refs || ""),
    designChangeLevel: String(args.level || args["design-change-level"] || "medium").trim() || "medium",
    interventionLayer: String(args.layer || args["intervention-layer"] || "page").trim() || "page",
    patchDepth: String(args.depth || args["patch-depth"] || "full").trim() || "full",
    rendererSurface: String(args.renderer || args["renderer-surface"] || "tailwind").trim() || "tailwind",
    targetScope,
    targetComponents: components,
    targetGroupId,
    targetGroupLabel: String(args["target-group-label"] || "모델 비교 대상").trim(),
    targetGroupReplacementMode: String(args["replacement-mode"] || (targetGroupId === "page" ? "main" : "")).trim(),
  };
}

function buildPlanPayload(scenario) {
  return {
    pageId: scenario.pageId,
    viewportProfile: scenario.viewportProfile,
    mode: "direct",
    requestText: scenario.requestText,
    keyMessage: scenario.keyMessage,
    preferredDirection: scenario.preferredDirection,
    avoidDirection: scenario.avoidDirection,
    toneAndMood: scenario.toneAndMood,
    referenceUrls: scenario.referenceUrls,
    title: scenario.keyMessage,
    designChangeLevel: scenario.designChangeLevel,
    interventionLayer: scenario.interventionLayer,
    patchDepth: scenario.patchDepth,
    rendererSurface: scenario.rendererSurface,
    builderProvider: "local",
    targetScope: scenario.targetScope,
    targetComponents: scenario.targetComponents,
    targetGroupId: scenario.targetGroupId,
    targetGroupLabel: scenario.targetGroupLabel,
  };
}

function buildSavePayloadFromLocalPlanningPreview(previewPlan) {
  const preview = previewPlan && typeof previewPlan === "object" ? previewPlan : {};
  const userInput = preview?.input?.userInput && typeof preview.input.userInput === "object" ? preview.input.userInput : {};
  const requirementPlan =
    preview?.output?.requirementPlan && typeof preview.output.requirementPlan === "object"
      ? preview.output.requirementPlan
      : {};
  return {
    pageId: String(preview.pageId || userInput.pageId || "").trim(),
    viewportProfile: String(preview.viewportProfile || userInput.viewportProfile || "pc").trim() || "pc",
    mode: String(preview.mode || "local-provider-preview").trim() || "local-provider-preview",
    status: "draft",
    originType: "local-provider-saved",
    generatedBy: "design-pipeline-local",
    title: String(requirementPlan.title || preview.title || "").trim(),
    summary: String(preview.summary || requirementPlan.requestSummary?.[0] || "").trim(),
    designChangeLevel: String(requirementPlan.designChangeLevel || userInput.designChangeLevel || "").trim(),
    interventionLayer: String(requirementPlan.interventionLayer || userInput.interventionLayer || "").trim(),
    patchDepth: String(requirementPlan.patchDepth || userInput.patchDepth || "").trim(),
    targetGroupId: String(requirementPlan.targetGroupId || userInput.targetGroupId || "").trim(),
    targetGroupLabel: String(requirementPlan.targetGroupLabel || userInput.targetGroupLabel || "").trim(),
    targetComponents: Array.isArray(requirementPlan.targetComponents)
      ? requirementPlan.targetComponents
      : Array.isArray(userInput.targetComponents)
        ? userInput.targetComponents
        : [],
    planningDirection: Array.isArray(requirementPlan.planningDirection) ? requirementPlan.planningDirection : [],
    designDirection: Array.isArray(requirementPlan.designDirection) ? requirementPlan.designDirection : [],
    guardrails: Array.isArray(requirementPlan.guardrails) ? requirementPlan.guardrails : [],
    referenceNotes: Array.isArray(requirementPlan.referenceNotes) ? requirementPlan.referenceNotes : [],
    builderBrief: requirementPlan.builderBrief && typeof requirementPlan.builderBrief === "object" ? requirementPlan.builderBrief : null,
    builderMarkdown: String(requirementPlan.builderMarkdown || ""),
    designSpecMarkdown: String(requirementPlan.designSpecMarkdown || ""),
    sectionBlueprints: Array.isArray(requirementPlan.sectionBlueprints) ? requirementPlan.sectionBlueprints : [],
    conceptPlans: Array.isArray(requirementPlan.conceptPlans) ? requirementPlan.conceptPlans : [],
    selectedConcept: requirementPlan.selectedConcept && typeof requirementPlan.selectedConcept === "object" ? requirementPlan.selectedConcept : null,
    planningPackage: requirementPlan.planningPackage && typeof requirementPlan.planningPackage === "object" ? requirementPlan.planningPackage : null,
    input: { userInput: { ...userInput } },
    output: { requirementPlan, providerResult: preview?.output?.providerResult || null },
  };
}

function buildDraftPayload({ scenario, planId, approvedPlan, variant }) {
  return {
    pageId: scenario.pageId,
    viewportProfile: scenario.viewportProfile,
    planId,
    approvedPlan,
    rendererSurface: scenario.rendererSurface,
    builderProvider: variant.provider,
    authorProvider: variant.provider,
    designAuthorModel: variant.model || "",
    authorModel: variant.model || "",
    model: variant.model || "",
    bypassDesignModelProfile: Boolean(variant.model),
    designChangeLevel: scenario.designChangeLevel,
    interventionLayer: scenario.interventionLayer,
    patchDepth: scenario.patchDepth,
    targetScope: scenario.targetScope,
    targetComponents: scenario.targetComponents,
    targetGroupId: scenario.targetGroupId,
    targetGroupLabel: `${scenario.targetGroupLabel} - ${variant.label}`,
    targetGroupReplacementMode: scenario.targetGroupReplacementMode,
    requestText: scenario.requestText,
    keyMessage: scenario.keyMessage,
    preferredDirection: scenario.preferredDirection,
  };
}

function collectRenderedMetrics(html = "") {
  const textOnly = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sectionSlots = uniqueList(Array.from(String(html || "").matchAll(/data-codex-slot="([^"]+)"/g)).map((match) => match[1]));
  const assetSlots = uniqueList(Array.from(String(html || "").matchAll(/data-asset-slot="([^"]+)"/g)).map((match) => match[1]));
  const classAttrs = Array.from(String(html || "").matchAll(/class="([^"]+)"/g)).map((match) => match[1]);
  const classTokens = uniqueList(classAttrs.flatMap((value) => value.split(/\s+/).filter(Boolean)));
  return {
    htmlLength: String(html || "").length,
    visibleTextLength: textOnly.length,
    sectionSlots,
    assetSlotCount: assetSlots.length,
    classTokenCount: classTokens.length,
    ctaLikeCount: (textOnly.match(/보기|예약|찾기|확인|상담|구매/g) || []).length,
  };
}

function collectBannedHits(...texts) {
  const joined = texts.map((text) => String(text || "")).join("\n");
  return BANNED_TEXTS.filter((needle) => joined.includes(needle));
}

function renderedSlotMatches(expectedSlotId = "", renderedSlots = []) {
  const normalized = String(expectedSlotId || "").trim();
  if (!normalized) return true;
  if (renderedSlots.includes(normalized)) return true;
  const aliases = {
    "marketing-area": ["promotion"],
    "best-ranking": ["ranking", "space-renewal"],
    productGrid: ["product-grid", "bestProduct"],
    quickMenu: ["quickmenu"],
  };
  return (aliases[normalized] || []).some((alias) => renderedSlots.includes(alias));
}

function validateVariant({ scenario, approvedPlan, buildJson, renderedHtml, compareHtml }) {
  const draft = buildJson?.item || {};
  const expectedSlots = (Array.isArray(approvedPlan?.sectionBlueprints) ? approvedPlan.sectionBlueprints : [])
    .map((item) => String(item?.slotId || "").trim())
    .filter(Boolean);
  const authoredSlots = Array.isArray(draft?.report?.authoredSections)
    ? draft.report.authoredSections.map((item) => String(item?.slotId || "").trim()).filter(Boolean)
    : [];
  const renderedSlots = collectRenderedMetrics(renderedHtml).sectionSlots;
  const serialized = JSON.stringify({ draft, providerResult: buildJson?.providerResult || null });
  const bannedHits = collectBannedHits(renderedHtml, compareHtml, serialized);
  const providerMeta = draft?.snapshotData?.designAuthorProviderMeta || buildJson?.providerResult?.authorProviderMeta || {};
  const actualProvider = String(providerMeta?.provider || draft?.builderProvider || "").trim();
  const actualModel = String(providerMeta?.model || "").trim();
  const usedDemoFallback = Boolean(providerMeta?.usedDemoFallback);
  const checks = [
    { name: "build_ok", ok: Boolean(buildJson?.ok && draft?.id) },
    { name: "runtime_urls", ok: Boolean(buildJson?.previewPath?.startsWith("/runtime-draft/") && buildJson?.comparePath?.startsWith("/runtime-compare/")) },
    { name: "approved_plan_has_sections", ok: expectedSlots.length > 0, detail: { expectedSlots } },
    { name: "authored_sections_match", ok: expectedSlots.every((slotId) => authoredSlots.includes(slotId)), detail: { expectedSlots, authoredSlots } },
    { name: "rendered_slots_present", ok: expectedSlots.every((slotId) => renderedSlotMatches(slotId, renderedSlots)), detail: { expectedSlots, renderedSlots } },
    { name: "rendered_html_non_empty", ok: String(renderedHtml || "").length > 1000 },
    { name: "compare_html_non_empty", ok: String(compareHtml || "").length > 1000 },
    { name: "no_internal_or_legacy_text", ok: bannedHits.length === 0, detail: { bannedHits } },
    { name: "provider_not_fallback", ok: !usedDemoFallback && actualProvider !== "local-fallback", detail: { provider: actualProvider, model: actualModel, error: String(providerMeta?.error || "").trim() } },
  ];
  return {
    ok: checks.every((check) => check.ok),
    checks,
    draftBuildId: String(draft?.id || "").trim(),
    previewPath: String(buildJson?.previewPath || "").trim(),
    comparePath: String(buildJson?.comparePath || "").trim(),
    providerMeta: {
      provider: actualProvider,
      model: actualModel,
      usedDemoFallback,
      error: String(providerMeta?.error || "").trim(),
    },
    metrics: collectRenderedMetrics(renderedHtml),
    reportSummary: {
      whatChanged: Array.isArray(draft?.report?.whatChanged) ? draft.report.whatChanged.slice(0, 8) : [],
      authoredSlots,
    },
    scenario: {
      pageId: scenario.pageId,
      viewportProfile: scenario.viewportProfile,
    },
  };
}

function compareVariants(variants = []) {
  const [baseline, challenger] = variants;
  if (variants.length === 1) {
    const [single] = variants;
    return {
      mode: "single",
      baseline: "",
      challenger: single?.label || "",
      bothPassed: Boolean(single?.validation?.ok),
      challengerUsedRequestedModel: single?.validation?.providerMeta?.model === single?.model,
      challengerFellBack: Boolean(single?.validation?.providerMeta?.usedDemoFallback),
      metricDelta: {},
    };
  }
  if (!baseline || !challenger) return {};
  const metricDelta = {};
  for (const key of ["htmlLength", "visibleTextLength", "assetSlotCount", "classTokenCount", "ctaLikeCount"]) {
    metricDelta[key] = (challenger.validation?.metrics?.[key] || 0) - (baseline.validation?.metrics?.[key] || 0);
  }
  return {
    baseline: baseline.label,
    challenger: challenger.label,
    bothPassed: Boolean(baseline.validation?.ok && challenger.validation?.ok),
    challengerUsedRequestedModel: challenger.validation?.providerMeta?.model === challenger.model,
    challengerFellBack: Boolean(challenger.validation?.providerMeta?.usedDemoFallback),
    metricDelta,
  };
}

function toMarkdown(report) {
  const lines = [
    "# Model Comparison Pipeline Report",
    "",
    `- GeneratedAt: ${report.generatedAt}`,
    `- BaseUrl: ${report.baseUrl}`,
    `- LoginId: ${report.loginId}`,
    `- Scenario: ${report.scenario.id}`,
    `- Page: ${report.scenario.pageId}`,
    `- Viewport: ${report.scenario.viewportProfile}`,
    `- PlanId: ${report.plan.id}`,
    `- Overall: ${report.comparison.bothPassed ? "pass" : "needs-review"}`,
    "",
    "## Variants",
    "",
  ];
  for (const variant of report.variants) {
    lines.push(`### ${variant.label}`);
    lines.push(`- Provider: ${variant.provider}`);
    lines.push(`- Model: ${variant.model || "default/local"}`);
    lines.push(`- Result: ${variant.validation.ok ? "pass" : "fail"}`);
    lines.push(`- DraftBuildId: ${variant.validation.draftBuildId || "n/a"}`);
    lines.push(`- PreviewUrl: ${variant.urls.previewUrl || "n/a"}`);
    lines.push(`- CompareUrl: ${variant.urls.compareUrl || "n/a"}`);
    lines.push(`- ProviderMeta: ${JSON.stringify(variant.validation.providerMeta)}`);
    lines.push(`- Metrics: ${JSON.stringify(variant.validation.metrics)}`);
    for (const check of variant.validation.checks) {
      lines.push(`- ${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? `: ${JSON.stringify(check.detail)}` : ""}`);
    }
    lines.push("");
  }
  lines.push("## Delta");
  lines.push("");
  lines.push(`- ${JSON.stringify(report.comparison)}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function buildVariant({ baseUrl, token, scenario, planId, approvedPlan, variant }) {
  console.log(`[compare] build:start ${variant.label} provider=${variant.provider} model=${variant.model || "default"}`);
  const build = await apiFetch({
    baseUrl,
    token,
    pathname: "/api/workspace/build-local-draft",
    payload: buildDraftPayload({ scenario, planId, approvedPlan, variant }),
    method: "POST",
  });
  if (!build.ok) {
    return {
      ...variant,
      validation: {
        ok: false,
        checks: [{ name: "build_http_ok", ok: false, detail: { status: build.status, error: build.json?.error, detail: build.json?.detail } }],
        providerMeta: {},
        metrics: {},
      },
      urls: {},
      rawError: build.json,
    };
  }
  const previewPath = String(build.json?.previewPath || "").trim();
  const comparePath = String(build.json?.comparePath || "").trim();
  const rendered = await apiFetch({ baseUrl, token, pathname: previewPath, expectJson: false });
  const compared = await apiFetch({ baseUrl, token, pathname: comparePath, expectJson: false });
  const validation = validateVariant({
    scenario,
    approvedPlan,
    buildJson: build.json,
    renderedHtml: rendered.text,
    compareHtml: compared.text,
  });
  return {
    ...variant,
    validation,
    urls: {
      previewUrl: previewPath ? `${baseUrl}${previewPath}` : "",
      compareUrl: comparePath ? `${baseUrl}${comparePath}` : "",
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL).replace(/\/$/, "");
  const loginId = String(args.login || args["login-id"] || DEFAULT_LOGIN_ID).trim();
  const claudeModel = String(args["claude-model"] || args.model || DEFAULT_CLAUDE_MODEL).trim();
  const baselineModel = String(args["baseline-model"] || "google/gemini-2.5-flash").trim();
  const baselineProvider = String(args["baseline-provider"] || "openrouter").trim();
  const baselineLabel = String(args["baseline-label"] || "gemini-current").trim();
  const challengerProvider = String(args["challenger-provider"] || "openrouter").trim();
  const challengerLabel = String(args["challenger-label"] || "claude-sonnet-4.6").trim();
  const singleModelMode = args["single-model"] === true || String(args.mode || "").trim() === "single";
  const outputJson = path.resolve(ROOT, args.output || OUTPUT_JSON);
  const outputMd = path.resolve(ROOT, args["output-md"] || OUTPUT_MD);
  const scenario = buildScenario(args);
  const variants = singleModelMode
    ? [{ id: "challenger", label: challengerLabel, provider: challengerProvider, model: claudeModel }]
    : [
        { id: "baseline", label: baselineLabel, provider: baselineProvider, model: baselineModel },
        { id: "challenger", label: challengerLabel, provider: challengerProvider, model: claudeModel },
      ];
  if (args["dry-run"]) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      mode: singleModelMode ? "single" : "compare",
      scenario,
      variants,
    }, null, 2));
    return;
  }
  const token = findSessionToken(loginId);

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.mkdirSync(path.dirname(outputMd), { recursive: true });
  await waitForServerReady(baseUrl);

  console.log(`[compare] plan-preview:start ${scenario.id}`);
  const preview = await apiFetch({ baseUrl, token, pathname: "/api/workspace/plan-local-preview", payload: buildPlanPayload(scenario), method: "POST" });
  if (!preview.ok) throw new Error(`plan_preview_failed:${preview.status}:${JSON.stringify(preview.json)}`);

  console.log(`[compare] plan-save:start ${scenario.id}`);
  const plan = await apiFetch({
    baseUrl,
    token,
    pathname: "/api/workspace/plan",
    payload: buildSavePayloadFromLocalPlanningPreview(preview.json?.item || {}),
    method: "POST",
  });
  if (!plan.ok) throw new Error(`plan_save_failed:${plan.status}:${JSON.stringify(plan.json)}`);

  const approvedPlan = plan.json?.item?.output?.requirementPlan || preview.json?.item?.output?.requirementPlan || null;
  if (!approvedPlan) throw new Error("approved_plan_missing");

  const results = [];
  for (const variant of variants) {
    results.push(await buildVariant({ baseUrl, token, scenario, planId: plan.json.item.id, approvedPlan, variant }));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    loginId,
    scenario,
    plan: {
      id: plan.json.item.id,
      previewId: preview.json?.item?.id || "",
      sectionBlueprintCount: Array.isArray(approvedPlan.sectionBlueprints) ? approvedPlan.sectionBlueprints.length : 0,
      builderMarkdownLength: String(approvedPlan.builderMarkdown || "").length,
      designSpecMarkdownLength: String(approvedPlan.designSpecMarkdown || "").length,
    },
    variants: results,
    comparison: compareVariants(results),
  };
  fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(outputMd, toMarkdown(report), "utf8");
  console.log(`[compare] report:json ${outputJson}`);
  console.log(`[compare] report:md ${outputMd}`);
  console.log(JSON.stringify({
    ok: report.comparison.bothPassed,
    planId: report.plan.id,
    variants: report.variants.map((variant) => ({
      label: variant.label,
      ok: variant.validation.ok,
      draftBuildId: variant.validation.draftBuildId,
      previewUrl: variant.urls.previewUrl,
      compareUrl: variant.urls.compareUrl,
      providerMeta: variant.validation.providerMeta,
    })),
    comparison: report.comparison,
  }, null, 2));
  if (!report.comparison.bothPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[compare] failed ${error?.stack || error}`);
  process.exitCode = 1;
});
