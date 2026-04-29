#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const USERS_PATH = path.join(ROOT, "data", "runtime", "users.json");
const SESSIONS_PATH = path.join(ROOT, "data", "runtime", "sessions.json");
const OUTPUT_DIR = path.join(ROOT, "data", "debug");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "track-b-validation-report.json");
const OUTPUT_MD = path.join(OUTPUT_DIR, "track-b-validation-report.md");
const LOCK_PATH = path.join(OUTPUT_DIR, "track-b-validation.lock");
const BASE_URL = process.env.TRACK_B_VALIDATION_BASE_URL || "http://127.0.0.1:3000";
const COOKIE_NAME = "lge_workspace_session";
const LOGIN_ID = process.env.TRACK_B_VALIDATION_LOGIN_ID || "mrgbiryu";
const REQUEST_MAX_ATTEMPTS = Math.max(1, Number(process.env.TRACK_B_VALIDATION_MAX_ATTEMPTS || 3));

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function findSessionToken(loginId) {
  const users = readJson(USERS_PATH, { users: [] }).users || [];
  const sessions = readJson(SESSIONS_PATH, { sessions: [] }).sessions || [];
  const user = users.find((item) => String(item?.loginId || "").trim() === loginId);
  if (!user) throw new Error(`user_not_found:${loginId}`);
  const userSessions = sessions
    .filter((item) => item.userId === user.userId)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  const session = userSessions[0];
  if (!session?.token) throw new Error(`session_not_found:${loginId}`);
  return session.token;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid) {
  const numericPid = Number(pid || 0);
  if (!numericPid) return false;
  try {
    process.kill(numericPid, 0);
    return true;
  } catch {
    return false;
  }
}

function releaseValidationLock() {
  try {
    const lock = readJson(LOCK_PATH, null);
    if (!lock || Number(lock.pid || 0) !== process.pid) return;
    fs.unlinkSync(LOCK_PATH);
  } catch {}
}

function acquireValidationLock() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const existing = readJson(LOCK_PATH, null);
  if (existing?.pid && isProcessAlive(existing.pid)) {
    throw new Error(`validation_already_running:${existing.pid}`);
  }
  fs.writeFileSync(
    LOCK_PATH,
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf-8"
  );
}

function isRetryableFetchError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("socket") ||
    message.includes("terminated") ||
    message.includes("network")
  );
}

async function apiFetch(token, pathname, payload = null, method = "GET") {
  const headers = {
    Cookie: `${COOKIE_NAME}=${token}`,
  };
  if (payload !== null) {
    headers["Content-Type"] = "application/json";
  }
  let lastError = null;
  for (let attempt = 1; attempt <= REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}${pathname}`, {
        method,
        headers,
        body: payload !== null ? JSON.stringify(payload) : undefined,
      });
      const text = await response.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
      return {
        status: response.status,
        ok: response.ok,
        json,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= REQUEST_MAX_ATTEMPTS || !isRetryableFetchError(error)) throw error;
      await sleep(1500 * attempt);
    }
  }
  throw lastError || new Error("fetch_failed");
}

async function waitForServerReady() {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/llm/status`);
      if (response.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("server_not_ready");
}

function summarizeResult(item = {}) {
  const qualityGate = item?.build?.json?.qualityGate || item?.draft?.qualityGate || null;
  const criticReport = item?.build?.json?.criticReport || item?.draft?.report?.critic || null;
  const visualComparison = criticReport?.visualComparison || null;
  const apiError = item?.build?.json?.error || item?.build?.json?.detail || null;
  const buildStatusCode = Number(item?.build?.status || 0);
  let outcome = "unknown";
  if (item?.exception) outcome = "exception";
  else if (buildStatusCode === 502 || apiError === "visual_critic_execution_failed") outcome = "execution-failed";
  else if (buildStatusCode === 409) outcome = "quality-failed";
  else if (item?.build?.ok) outcome = "success";
  else if (item?.build) outcome = "build-failed";
  else if (item?.plan && !item?.plan?.ok) outcome = "plan-failed";
  return {
    outcome,
    plannerStatus: item?.plan?.status || null,
    buildStatus: item?.build?.status || null,
    draftStatus: item?.draft?.status || null,
    draftBuildId: item?.build?.draftBuildId || item?.draft?.id || null,
    qualityGate,
    visualComparison,
    error: item?.build?.error || item?.plan?.error || item?.exception || null,
  };
}

function buildSavePayloadFromLocalPlanningPreview(previewPlan) {
  const preview = previewPlan && typeof previewPlan === "object" ? previewPlan : {};
  const userInput = preview?.input?.userInput && typeof preview.input.userInput === "object"
    ? preview.input.userInput
    : {};
  const requirementPlan = preview?.output?.requirementPlan && typeof preview.output.requirementPlan === "object"
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
      : (Array.isArray(userInput.targetComponents) ? userInput.targetComponents : []),
    planningDirection: Array.isArray(requirementPlan.planningDirection) ? requirementPlan.planningDirection : [],
    designDirection: Array.isArray(requirementPlan.designDirection) ? requirementPlan.designDirection : [],
    guardrails: Array.isArray(requirementPlan.guardrails) ? requirementPlan.guardrails : [],
    referenceNotes: Array.isArray(requirementPlan.referenceNotes) ? requirementPlan.referenceNotes : [],
    builderBrief: requirementPlan.builderBrief && typeof requirementPlan.builderBrief === "object"
      ? requirementPlan.builderBrief
      : null,
    builderMarkdown: String(requirementPlan.builderMarkdown || ""),
    designSpecMarkdown: String(requirementPlan.designSpecMarkdown || ""),
    sectionBlueprints: Array.isArray(requirementPlan.sectionBlueprints) ? requirementPlan.sectionBlueprints : [],
    conceptPlans: Array.isArray(requirementPlan.conceptPlans) ? requirementPlan.conceptPlans : [],
    selectedConcept: requirementPlan.selectedConcept && typeof requirementPlan.selectedConcept === "object"
      ? requirementPlan.selectedConcept
      : null,
    planningPackage: requirementPlan.planningPackage && typeof requirementPlan.planningPackage === "object"
      ? requirementPlan.planningPackage
      : null,
    input: {
      userInput: {
        ...userInput,
      },
    },
    output: {
      requirementPlan,
      providerResult: preview?.output?.providerResult || null,
    },
  };
}

function toMarkdown(report = {}) {
  const outcomeCounts = (report.items || []).reduce((acc, item) => {
    const outcome = summarizeResult(item).outcome || "unknown";
    acc[outcome] = (acc[outcome] || 0) + 1;
    return acc;
  }, {});
  const lines = [
    "# Track B Validation Report",
    "",
    `- GeneratedAt: ${report.generatedAt || ""}`,
    `- BaseUrl: ${report.baseUrl || ""}`,
    `- LoginId: ${report.loginId || ""}`,
    `- OutcomeCounts: ${JSON.stringify(outcomeCounts)}`,
    "",
    "## Scenarios",
    "",
  ];
  for (const item of report.items || []) {
    const summary = summarizeResult(item);
    lines.push(`### ${item.id}`);
    lines.push(`- Outcome: ${summary.outcome}`);
    lines.push(`- Page: ${item.pageId}`);
    lines.push(`- Layer: ${item.planPayload?.interventionLayer}`);
    lines.push(`- Depth: ${item.planPayload?.patchDepth}`);
    lines.push(`- PlanStatus: ${summary.plannerStatus || "n/a"}`);
    lines.push(`- BuildStatus: ${summary.buildStatus || "n/a"}`);
    lines.push(`- DraftStatus: ${summary.draftStatus || "n/a"}`);
    lines.push(`- DraftBuildId: ${summary.draftBuildId || "n/a"}`);
    if (summary.qualityGate) {
      lines.push(`- QualityGate: ${JSON.stringify(summary.qualityGate)}`);
    }
    if (summary.visualComparison) {
      lines.push(`- VisualComparison: ${JSON.stringify(summary.visualComparison)}`);
    }
    if (summary.error) {
      lines.push(`- Error: ${summary.error}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  acquireValidationLock();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await waitForServerReady();
  const token = findSessionToken(LOGIN_ID);
  const scenarios = [
    {
      id: "home-hero-quickmenu-full",
      pageId: "home",
      viewportProfile: "pc",
      planPayload: {
        pageId: "home",
        viewportProfile: "pc",
        mode: "direct",
        requestText: "홈 상단 진입부를 브랜드 제안형으로 재구성하고 hero와 quickmenu를 하나의 리듬으로 강하게 재디자인한다. 기존보다 더 명확한 위계와 프리미엄 시각 중심 구조가 필요하다.",
        designChangeLevel: "high",
        interventionLayer: "section-group",
        patchDepth: "full",
        targetScope: "components",
        targetComponents: ["home.hero", "home.quickmenu"],
        targetGroupId: "top",
        targetGroupLabel: "상단 진입부",
        forceDemoPlanner: true,
      },
      buildPayload: {
        pageId: "home",
        viewportProfile: "pc",
        intensity: "high",
        interventionLayer: "section-group",
        patchDepth: "full",
        targetScope: "components",
        targetComponents: ["home.hero", "home.quickmenu"],
        targetGroupId: "top",
        targetGroupLabel: "상단 진입부",
      },
    },
    {
      id: "home-page-full",
      pageId: "home",
      viewportProfile: "pc",
      planPayload: {
        pageId: "home",
        viewportProfile: "pc",
        mode: "direct",
        requestText: "홈 전체를 웹디자인 제안 수준으로 전면 재구성한다. 상단부터 중단, 하단까지 하나의 시각 언어와 리듬으로 연결되고 기존보다 명확한 계층과 시각 완성도를 가져야 한다.",
        designChangeLevel: "high",
        interventionLayer: "page",
        patchDepth: "full",
        targetScope: "page",
        targetComponents: [],
        forceDemoPlanner: true,
      },
      buildPayload: {
        pageId: "home",
        viewportProfile: "pc",
        intensity: "high",
        interventionLayer: "page",
        patchDepth: "full",
        targetScope: "page",
        targetComponents: [],
        forceDemoPlanner: true,
      },
    },
    {
      id: "homestyle-home-page-full",
      pageId: "homestyle-home",
      viewportProfile: "pc",
      planPayload: {
        pageId: "homestyle-home",
        viewportProfile: "pc",
        mode: "direct",
        requestText: "홈스타일 메인을 editorial commerce landing 수준으로 전면 재구성한다. 콘텐츠 편집감과 제품 제안의 균형을 강하게 만들고 전체 페이지의 질감을 높인다.",
        designChangeLevel: "high",
        interventionLayer: "page",
        patchDepth: "full",
        targetScope: "page",
        targetComponents: [],
        forceDemoPlanner: true,
      },
      buildPayload: {
        pageId: "homestyle-home",
        viewportProfile: "pc",
        intensity: "high",
        interventionLayer: "page",
        patchDepth: "full",
        targetScope: "page",
        targetComponents: [],
      },
    },
    {
      id: "care-solutions-page-full",
      pageId: "care-solutions",
      viewportProfile: "pc",
      planPayload: {
        pageId: "care-solutions",
        viewportProfile: "pc",
        mode: "direct",
        requestText: "케어솔루션 메인을 서비스 랜딩 페이지 수준으로 전면 재구성한다. 신뢰, 혜택, 전환 구조가 더 명확하게 읽히고 전체가 하나의 상업적 서비스 제안처럼 보이게 만든다.",
        designChangeLevel: "high",
        interventionLayer: "page",
        patchDepth: "full",
        targetScope: "page",
        targetComponents: [],
        forceDemoPlanner: true,
      },
      buildPayload: {
        pageId: "care-solutions",
        viewportProfile: "pc",
        intensity: "high",
        interventionLayer: "page",
        patchDepth: "full",
        targetScope: "page",
        targetComponents: [],
      },
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    loginId: LOGIN_ID,
    items: [],
  };

  try {
    for (const scenario of scenarios) {
      const item = {
        id: scenario.id,
        pageId: scenario.pageId,
        viewportProfile: scenario.viewportProfile,
        planPayload: scenario.planPayload,
        buildPayload: scenario.buildPayload,
      };
      try {
        console.log(`[validation] plan-preview:start ${scenario.id}`);
        const planPreview = await apiFetch(token, "/api/workspace/plan-local-preview", scenario.planPayload, "POST");
        item.planPreview = {
          status: planPreview.status,
          ok: planPreview.ok,
          error: planPreview.ok ? null : (planPreview.json?.error || planPreview.json?.detail || null),
          response: planPreview.json,
        };
        const previewPlan = planPreview.json?.item || null;
        if (!planPreview.ok || !previewPlan) {
          console.warn(`[validation] plan-preview:failed ${scenario.id} status=${planPreview.status}`);
          report.items.push(item);
          continue;
        }
        console.log(`[validation] plan-save:start ${scenario.id}`);
        const plan = await apiFetch(
          token,
          "/api/workspace/plan",
          buildSavePayloadFromLocalPlanningPreview(previewPlan),
          "POST"
        );
        item.plan = {
          status: plan.status,
          ok: plan.ok,
          planId: plan.json?.item?.id || null,
          error: plan.ok ? null : (plan.json?.error || plan.json?.detail || null),
          response: plan.json,
        };
        if (!plan.ok || !plan.json?.item?.id) {
          console.warn(`[validation] plan-save:failed ${scenario.id} status=${plan.status}`);
          report.items.push(item);
          continue;
        }
        const approvedPlan = plan.json?.item?.output?.requirementPlan || previewPlan?.output?.requirementPlan || null;
        if (!approvedPlan) {
          item.build = {
            status: null,
            ok: false,
            draftBuildId: null,
            error: "approved_plan_missing_after_save",
            json: null,
          };
          report.items.push(item);
          continue;
        }
        console.log(`[validation] build:start ${scenario.id} planId=${plan.json.item.id}`);
        const build = await apiFetch(token, "/api/workspace/build-local-draft", {
          ...scenario.buildPayload,
          planId: plan.json.item.id,
          approvedPlan,
        }, "POST");
        item.build = {
          status: build.status,
          ok: build.ok,
          draftBuildId: build.json?.item?.id || build.json?.draftBuildId || null,
          error: build.ok ? null : (build.json?.error || build.json?.detail || null),
          json: build.json,
        };
        if (build.json?.item?.id || build.json?.draftBuildId) {
          const draftBuildId = build.json?.item?.id || build.json?.draftBuildId;
          const draftResp = await apiFetch(
            token,
            `/api/workspace/draft-builds?pageId=${encodeURIComponent(scenario.pageId)}&viewportProfile=${encodeURIComponent(scenario.viewportProfile)}&limit=10`,
            null,
            "GET"
          );
          const items = Array.isArray(draftResp.json?.items) ? draftResp.json.items : [];
          item.draft = items.find((entry) => entry.id === draftBuildId) || null;
        }
      } catch (error) {
        item.exception = String(error?.stack || error);
        console.error(`[validation] scenario:failed ${scenario.id} ${item.exception}`);
      }
      report.items.push(item);
    }
  } finally {
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
    fs.writeFileSync(OUTPUT_MD, toMarkdown(report), "utf-8");
    console.log(`[validation] report written ${OUTPUT_JSON}`);
    console.log(`[validation] report written ${OUTPUT_MD}`);
    releaseValidationLock();
  }
}

process.on("SIGINT", () => {
  releaseValidationLock();
  process.exit(130);
});

process.on("SIGTERM", () => {
  releaseValidationLock();
  process.exit(143);
});

process.on("exit", () => {
  releaseValidationLock();
});

main().catch((error) => {
  releaseValidationLock();
  console.error(`[validation] failed ${error?.stack || error}`);
  process.exitCode = 1;
});
