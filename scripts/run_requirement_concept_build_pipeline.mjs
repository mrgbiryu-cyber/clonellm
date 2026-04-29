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
const DEFAULT_OUTPUT_JSON = path.join(OUTPUT_DIR, "requirement-concept-build-pipeline-report.json");
const DEFAULT_OUTPUT_MD = path.join(OUTPUT_DIR, "requirement-concept-build-pipeline-report.md");

const COOKIE_NAME = "lge_workspace_session";
const DEFAULT_BASE_URL = process.env.PIPELINE_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_LOGIN_ID = process.env.PIPELINE_LOGIN_ID || "mrgbiryu";
const DEFAULT_BANNED_TEXTS = [
  "운영 카피 확인용",
  "현재 원본 구조",
  "재구성한다",
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
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

async function apiFetch({ baseUrl, token, pathname, payload = null, method = "GET", expectJson = true }) {
  const headers = { Cookie: `${COOKIE_NAME}=${token}` };
  if (payload !== null) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: payload !== null ? JSON.stringify(payload) : undefined,
  });
  const text = await response.text();
  if (!expectJson) {
    return { status: response.status, ok: response.ok, text };
  }
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

function buildDefaultScenario(args = {}) {
  const pageId = String(args.page || args["page-id"] || "bestshop").trim();
  const viewportProfile = String(args.viewport || args["viewport-profile"] || "mo").trim() || "mo";
  const targetComponents = splitList(args.components || args["target-components"] || "bestshop.hero,bestshop.shortcut,bestshop.review,bestshop.brandBanner")
    .map((componentId) => componentId.replace(/^page\./, `${pageId}.`));
  const targetScope = String(args.scope || args["target-scope"] || "page").trim() || "page";
  const targetGroupId = String(args["target-group-id"] || (targetScope === "page" ? "page" : "pipeline-test")).trim();
  const targetGroupLabel = String(args["target-group-label"] || "자동 검증 대상").trim();
  const requestText = String(
    args.request ||
      "모바일 첫 화면에서 매장 상담, 주요 서비스, 고객 후기, 브랜드 체험 제안이 자연스럽게 이어지도록 운영 가능한 랜딩 페이지 톤으로 정리한다."
  ).trim();
  const keyMessage = String(args.message || "베스트샵 모바일 경험을 상담과 체험 중심으로 명확하게 제안").trim();
  const preferredDirection = String(
    args.direction ||
      "실제 고객에게 노출 가능한 문구만 사용하고, 터치하기 쉬운 단일 컬럼 흐름과 명확한 CTA를 우선한다."
  ).trim();
  return {
    id: String(args.id || `${pageId}-${viewportProfile}-requirement-concept-build`).trim(),
    pageId,
    viewportProfile,
    requestText,
    keyMessage,
    preferredDirection,
    avoidDirection: String(args.avoid || "내부 지시문, 컨셉 라벨, fallback/debug 문구를 화면이나 저장본에 노출하지 않는다.").trim(),
    toneAndMood: String(args.tone || "프리미엄, 신뢰감, 매장 상담 친화").trim(),
    referenceUrls: splitList(args.refs || ""),
    designChangeLevel: String(args.level || args["design-change-level"] || "medium").trim() || "medium",
    interventionLayer: String(args.layer || args["intervention-layer"] || "page").trim() || "page",
    patchDepth: String(args.depth || args["patch-depth"] || "full").trim() || "full",
    rendererSurface: String(args.renderer || args["renderer-surface"] || "tailwind").trim() || "tailwind",
    builderProvider: String(args.provider || args["builder-provider"] || "local").trim() || "local",
    designAuthorModel: String(args.model || args["author-model"] || args["design-author-model"] || "").trim(),
    targetScope,
    targetComponents,
    targetGroupId,
    targetGroupLabel,
    targetGroupReplacementMode: String(args["replacement-mode"] || (targetGroupId === "page" ? "main" : "")).trim(),
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
    output: {
      requirementPlan,
      providerResult: preview?.output?.providerResult || null,
    },
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
    builderProvider: scenario.builderProvider,
    designAuthorModel: scenario.designAuthorModel,
    targetScope: scenario.targetScope,
    targetComponents: scenario.targetComponents,
    targetGroupId: scenario.targetGroupId,
    targetGroupLabel: scenario.targetGroupLabel,
  };
}

function buildDraftPayload(scenario, planId, approvedPlan) {
  return {
    pageId: scenario.pageId,
    viewportProfile: scenario.viewportProfile,
    planId,
    approvedPlan,
    rendererSurface: scenario.rendererSurface,
    builderProvider: scenario.builderProvider,
    designAuthorModel: scenario.designAuthorModel,
    authorModel: scenario.designAuthorModel,
    model: scenario.designAuthorModel,
    designChangeLevel: scenario.designChangeLevel,
    interventionLayer: scenario.interventionLayer,
    patchDepth: scenario.patchDepth,
    targetScope: scenario.targetScope,
    targetComponents: scenario.targetComponents,
    targetGroupId: scenario.targetGroupId,
    targetGroupLabel: scenario.targetGroupLabel,
    targetGroupReplacementMode: scenario.targetGroupReplacementMode,
    requestText: scenario.requestText,
    keyMessage: scenario.keyMessage,
    preferredDirection: scenario.preferredDirection,
  };
}

function collectHits(text = "", bannedTexts = []) {
  return bannedTexts.filter((needle) => needle && String(text || "").includes(needle));
}

function uniqueList(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function validatePipeline({ scenario, previewJson, planJson, buildJson, renderedHtml, compareHtml, bannedTexts }) {
  const checks = [];
  const previewItem = previewJson?.item || null;
  const savedPlan = planJson?.item || null;
  const requirementPlan = savedPlan?.output?.requirementPlan || previewItem?.output?.requirementPlan || null;
  const draft = buildJson?.item || null;
  const draftId = String(draft?.id || "").trim();
  const sectionBlueprints = Array.isArray(requirementPlan?.sectionBlueprints) ? requirementPlan.sectionBlueprints : [];
  const expectedSlotIds = sectionBlueprints
    .map((item) => String(item?.slotId || "").trim())
    .filter(Boolean);
  const authoredSlotIds = Array.isArray(draft?.report?.authoredSections)
    ? draft.report.authoredSections.map((item) => String(item?.slotId || "").trim()).filter(Boolean)
    : [];
  const renderedSlotIds = uniqueList(
    Array.from(String(renderedHtml || "").matchAll(/data-codex-slot="([^"]+)"/g)).map((match) => match[1])
  );
  const serializedBuild = JSON.stringify({ draft, providerResult: buildJson?.providerResult || null });
  const bannedHits = uniqueList([
    ...collectHits(renderedHtml, bannedTexts),
    ...collectHits(compareHtml, bannedTexts),
    ...collectHits(serializedBuild, bannedTexts),
  ]);

  function add(name, ok, detail = {}) {
    checks.push({ name, ok: Boolean(ok), detail });
  }

  add("plan_preview_ok", Boolean(previewJson?.ok && previewItem), { id: previewItem?.id || null });
  add("plan_saved_ok", Boolean(planJson?.ok && savedPlan?.id), { id: savedPlan?.id || null });
  add("requirement_plan_shape", Boolean(requirementPlan && sectionBlueprints.length > 0), {
    sectionBlueprintCount: sectionBlueprints.length,
    targetComponents: requirementPlan?.targetComponents || [],
  });
  add("target_shape_preserved", scenario.targetComponents.every((componentId) => (requirementPlan?.targetComponents || []).includes(componentId)), {
    expected: scenario.targetComponents,
    actual: requirementPlan?.targetComponents || [],
  });
  add("concept_docs_present", Boolean(String(requirementPlan?.builderMarkdown || "").trim() && String(requirementPlan?.designSpecMarkdown || "").trim()), {
    builderMarkdownLength: String(requirementPlan?.builderMarkdown || "").length,
    designSpecMarkdownLength: String(requirementPlan?.designSpecMarkdown || "").length,
  });
  add("build_ok", Boolean(buildJson?.ok && draftId), { draftId });
  add("runtime_urls", Boolean(buildJson?.previewPath?.startsWith("/runtime-draft/") && buildJson?.comparePath?.startsWith("/runtime-compare/")), {
    previewPath: buildJson?.previewPath || null,
    comparePath: buildJson?.comparePath || null,
  });
  add("authored_sections_match", expectedSlotIds.every((slotId) => authoredSlotIds.includes(slotId)), {
    expectedSlotIds,
    authoredSlotIds,
  });
  add("rendered_slots_present", expectedSlotIds.every((slotId) => renderedSlotIds.includes(slotId)), {
    expectedSlotIds,
    renderedSlotIds,
  });
  add("rendered_html_non_empty", String(renderedHtml || "").length > 1000, { htmlLength: String(renderedHtml || "").length });
  add("compare_html_non_empty", String(compareHtml || "").length > 1000, { htmlLength: String(compareHtml || "").length });
  add("no_internal_or_legacy_text", bannedHits.length === 0, { bannedHits });

  return {
    ok: checks.every((check) => check.ok),
    checks,
    ids: {
      previewPlanId: previewItem?.id || null,
      savedPlanId: savedPlan?.id || null,
      draftBuildId: draftId || null,
    },
    urls: {
      previewPath: buildJson?.previewPath || null,
      comparePath: buildJson?.comparePath || null,
    },
  };
}

function toMarkdown(report) {
  const lines = [
    "# Requirement -> Concept -> Build Pipeline Report",
    "",
    `- GeneratedAt: ${report.generatedAt}`,
    `- BaseUrl: ${report.baseUrl}`,
    `- LoginId: ${report.loginId}`,
    `- Scenario: ${report.scenario.id}`,
    `- Page: ${report.scenario.pageId}`,
    `- Viewport: ${report.scenario.viewportProfile}`,
    `- Provider: ${report.scenario.builderProvider}`,
    `- Model: ${report.scenario.designAuthorModel || "default"}`,
    `- Result: ${report.validation.ok ? "pass" : "fail"}`,
    `- PlanId: ${report.validation.ids.savedPlanId || "n/a"}`,
    `- DraftBuildId: ${report.validation.ids.draftBuildId || "n/a"}`,
    `- PreviewUrl: ${report.urls.previewUrl || "n/a"}`,
    `- CompareUrl: ${report.urls.compareUrl || "n/a"}`,
    "",
    "## Checks",
    "",
  ];
  for (const check of report.validation.checks) {
    lines.push(`- ${check.ok ? "PASS" : "FAIL"} ${check.name}: ${JSON.stringify(check.detail || {})}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL).replace(/\/$/, "");
  const loginId = String(args.login || args["login-id"] || DEFAULT_LOGIN_ID).trim();
  const token = findSessionToken(loginId);
  const scenario = buildDefaultScenario(args);
  const bannedTexts = uniqueList([...DEFAULT_BANNED_TEXTS, ...splitList(args["banned-texts"] || "")]);
  const outputJson = path.resolve(ROOT, args.output || DEFAULT_OUTPUT_JSON);
  const outputMd = path.resolve(ROOT, args["output-md"] || DEFAULT_OUTPUT_MD);

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.mkdirSync(path.dirname(outputMd), { recursive: true });
  await waitForServerReady(baseUrl);

  const planPayload = buildPlanPayload(scenario);
  console.log(`[pipeline] plan-preview:start ${scenario.id}`);
  const preview = await apiFetch({ baseUrl, token, pathname: "/api/workspace/plan-local-preview", payload: planPayload, method: "POST" });
  if (!preview.ok) throw new Error(`plan_preview_failed:${preview.status}:${JSON.stringify(preview.json)}`);

  console.log(`[pipeline] plan-save:start ${scenario.id}`);
  const savePayload = buildSavePayloadFromLocalPlanningPreview(preview.json?.item || {});
  const plan = await apiFetch({ baseUrl, token, pathname: "/api/workspace/plan", payload: savePayload, method: "POST" });
  if (!plan.ok) throw new Error(`plan_save_failed:${plan.status}:${JSON.stringify(plan.json)}`);

  const approvedPlan = plan.json?.item?.output?.requirementPlan || preview.json?.item?.output?.requirementPlan || null;
  if (!approvedPlan) throw new Error("approved_plan_missing");

  console.log(`[pipeline] build-draft:start ${scenario.id} planId=${plan.json.item.id}`);
  const draftPayload = buildDraftPayload(scenario, plan.json.item.id, approvedPlan);
  const build = await apiFetch({ baseUrl, token, pathname: "/api/workspace/build-local-draft", payload: draftPayload, method: "POST" });
  if (!build.ok) throw new Error(`build_draft_failed:${build.status}:${JSON.stringify(build.json)}`);

  const previewPath = String(build.json?.previewPath || "").trim();
  const comparePath = String(build.json?.comparePath || "").trim();
  console.log(`[pipeline] render-check:start ${previewPath}`);
  const rendered = await apiFetch({ baseUrl, token, pathname: previewPath, expectJson: false });
  const compared = await apiFetch({ baseUrl, token, pathname: comparePath, expectJson: false });

  const validation = validatePipeline({
    scenario,
    previewJson: preview.json,
    planJson: plan.json,
    buildJson: build.json,
    renderedHtml: rendered.text,
    compareHtml: compared.text,
    bannedTexts,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    loginId,
    scenario,
    planPayload,
    provider: scenario.builderProvider,
    model: scenario.designAuthorModel || "",
    ids: validation.ids,
    urls: {
      previewUrl: previewPath ? `${baseUrl}${previewPath}` : "",
      compareUrl: comparePath ? `${baseUrl}${comparePath}` : "",
    },
    validation,
  };

  fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(outputMd, toMarkdown(report), "utf8");
  console.log(`[pipeline] report:json ${outputJson}`);
  console.log(`[pipeline] report:md ${outputMd}`);
  console.log(JSON.stringify({
    ok: validation.ok,
    planId: validation.ids.savedPlanId,
    draftBuildId: validation.ids.draftBuildId,
    previewUrl: report.urls.previewUrl,
    compareUrl: report.urls.compareUrl,
    failedChecks: validation.checks.filter((check) => !check.ok).map((check) => check.name),
  }, null, 2));
  if (!validation.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[pipeline] failed ${error?.stack || error}`);
  process.exitCode = 1;
});
