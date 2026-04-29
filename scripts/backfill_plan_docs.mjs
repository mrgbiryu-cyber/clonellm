import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { saveRequirementPlan } from "../auth.js";
import { buildDemoPlannerResult } from "../llm.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const USERS_PATH = path.join(RUNTIME_DIR, "users.json");
const SESSIONS_PATH = path.join(RUNTIME_DIR, "sessions.json");

const PAGE_TARGETS = [
  ["home", "pc"],
  ["home", "ta"],
  ["support", "pc"],
  ["bestshop", "pc"],
  ["care-solutions", "pc"],
  ["care-solutions-pdp", "pc"],
  ["homestyle-home", "pc"],
  ["homestyle-pdp", "pc"],
  ["category-tvs", "pc"],
  ["category-refrigerators", "pc"],
  ["pdp-tv-general", "pc"],
  ["pdp-tv-premium", "pc"],
  ["pdp-refrigerator-general", "pc"],
  ["pdp-refrigerator-knockon", "pc"],
  ["pdp-refrigerator-glass", "pc"],
];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeViewportLabel(viewportProfile = "pc") {
  const normalized = String(viewportProfile || "pc").trim().toLowerCase();
  if (normalized === "ta") return "TA";
  if (normalized === "mo") return "MO";
  return "PC";
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const next = [];
  for (const value of values) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
  }
  return next;
}

function getSessionTokenForLogin(loginId) {
  const normalizedLoginId = String(loginId || "").trim().toLowerCase();
  const users = readJson(USERS_PATH, { users: [] }).users || [];
  const sessions = readJson(SESSIONS_PATH, { sessions: [] }).sessions || [];
  const user = users.find((item) => String(item?.loginId || "").trim().toLowerCase() === normalizedLoginId);
  if (!user) {
    throw new Error(`login_id_not_found:${normalizedLoginId}`);
  }
  const session = [...sessions].reverse().find((item) => item.userId === user.userId);
  if (!session?.token) {
    throw new Error(`session_not_found:${normalizedLoginId}`);
  }
  return { userId: user.userId, token: session.token };
}

async function fetchJson(baseUrl, token, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      Cookie: `lge_workspace_session=${token}`,
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`fetch_failed:${pathname}:${response.status}:${detail.slice(0, 240)}`);
  }
  return response.json();
}

function buildRequestNarrative(pageLabel, identity, slotIds = []) {
  const slotNarrative = slotIds.length
    ? `대상 슬롯은 ${slotIds.slice(0, 8).join(", ")}이며, 모든 편집 가능 컴포넌트와 내부 요소 기준으로 빠짐없이 정리한다.`
    : "현재 편집 가능 컴포넌트 기준으로 빠짐없이 정리한다.";
  return uniqueStrings([
    `${pageLabel} 페이지를 현재 clone 구조와 브랜드 정체성을 유지한 채 builder-ready 수준으로 끝까지 문서화한다.`,
    slotNarrative,
    identity?.purpose ? `핵심 목적은 ${identity.purpose}` : "",
    identity?.designIntent ? `디자인 의도는 ${identity.designIntent}` : "",
  ]).join(" ");
}

async function main() {
  const baseUrl = process.argv[2] || "http://127.0.0.1:3000";
  const loginId = process.argv[3] || "mrgbiryu";
  const { userId, token } = getSessionTokenForLogin(loginId);
  const data = await fetch(`${baseUrl}/api/data`).then((response) => response.json());
  const pageMap = new Map((data.pages || []).map((page) => [String(page?.id || "").trim(), page]));
  const saved = [];

  for (const [pageId, viewportProfile] of PAGE_TARGETS) {
    const page = pageMap.get(pageId);
    if (!page) {
      throw new Error(`page_not_found:${pageId}`);
    }
    const [identityResp, editableResp, referenceResp] = await Promise.all([
      fetchJson(baseUrl, token, `/api/workspace/page-identity?pageId=${encodeURIComponent(pageId)}`),
      fetchJson(
        baseUrl,
        token,
        `/api/workspace/llm-editable-list?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`
      ),
      fetchJson(
        baseUrl,
        token,
        `/api/workspace/design-reference-library?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`
      ),
    ]);

    const identity = identityResp.effectiveIdentity || identityResp.defaultIdentity || {};
    const editableComponents = Array.isArray(editableResp.components) ? editableResp.components : [];
    const editableSlots = uniqueStrings(editableComponents.map((item) => item?.slotId));
    const pageLabel = String(page.title || pageId).trim();
    const requestText = buildRequestNarrative(pageLabel, identity, editableSlots);
    const preferredDirection = uniqueStrings([
      identity.designIntent,
      ...(Array.isArray(identity.mustPreserve) ? identity.mustPreserve : []),
    ]).join(" / ");
    const avoidDirection = uniqueStrings(identity.shouldAvoid || []).join(" / ");
    const guardrails = uniqueStrings([
      ...(Array.isArray(identity.visualGuardrails) ? identity.visualGuardrails : []),
      ...(Array.isArray(identity.mustPreserve) ? identity.mustPreserve : []),
      "사실 기반 가격/스펙/상품 정보는 임의 변경 금지",
    ]);

    const plannerInput = {
      mode: "direct",
      pageContext: {
        workspacePageId: pageId,
        pageLabel,
        pageGroup: String(page.pageGroup || "").trim() || "other",
        viewportProfile,
        viewportLabel: normalizeViewportLabel(viewportProfile),
        pageIdentity: identity,
      },
      workspaceContext: {
        userId,
        pageId,
        viewportProfile,
      },
      userInput: {
        requestText,
        keyMessage: String(identity.purpose || "").trim(),
        preferredDirection,
        avoidDirection,
        toneAndMood: String(identity.designIntent || "").trim(),
        referenceUrls: [],
        designChangeLevel: "medium",
        targetScope: "page",
        targetComponents: [],
      },
      pageSummary: {
        editableSlots,
        editableComponentCount: editableComponents.length,
        componentCount: Number(editableResp.componentCount || editableComponents.length || 0),
      },
      referenceSummary: {
        analyses: [],
        mergedSlotMatches: {},
        designReferenceLibrary: referenceResp,
      },
      guardrailBundle: {
        rules: guardrails,
      },
    };

    const plannerResult = buildDemoPlannerResult(plannerInput);
    const savedPlan = saveRequirementPlan(userId, {
      pageId,
      viewportProfile,
      mode: "direct",
      status: "draft",
      originType: "auto-backfilled",
      approvalState: "system-generated",
      generatedBy: "codex-docs-backfill",
      title: plannerResult.requirementPlan?.title || "",
      summary: `[codex-docs-backfill] ${plannerResult.summary || `${pageLabel} 요구사항 정리 완료`}`,
      input: plannerInput,
      output: {
        requirementPlan: plannerResult.requirementPlan || {},
        toolContext: {
          referenceSummary: plannerInput.referenceSummary,
          guardrailBundle: plannerInput.guardrailBundle,
        },
        generatedBy: "codex-docs-backfill",
      },
    });
    saved.push({
      pageId,
      viewportProfile,
      planId: savedPlan?.id || null,
      title: savedPlan?.title || plannerResult.requirementPlan?.title || "",
      sectionBlueprintCount: Array.isArray(plannerResult.requirementPlan?.sectionBlueprints)
        ? plannerResult.requirementPlan.sectionBlueprints.length
        : 0,
      designSpecMarkdownLength: String(plannerResult.requirementPlan?.designSpecMarkdown || "").trim().length,
    });
  }

  console.log(JSON.stringify({ baseUrl, loginId, savedCount: saved.length, saved }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
