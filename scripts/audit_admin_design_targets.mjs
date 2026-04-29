#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const OUT_JSON = path.join(ROOT, "data", "normalized", "admin-design-target-audit.json");
const OUT_MD = path.join(ROOT, "data", "normalized", "admin-design-target-audit.md");
const COOKIE_NAME = "lge_workspace_session";

const ADMIN_TARGETS = [
  ["home", "pc", "홈 - PC"],
  ["home", "ta", "홈 - 테블릿"],
  ["home", "mo", "홈 - 모바일"],
  ["support", "pc", "고객지원 - PC"],
  ["support", "mo", "고객지원 - 모바일"],
  ["bestshop", "pc", "베스트샵 - PC"],
  ["bestshop", "mo", "베스트샵 - 모바일"],
  ["care-solutions", "pc", "가전 구독 메인 - PC"],
  ["care-solutions", "mo", "가전 구독 메인 - 모바일"],
  ["care-solutions-pdp", "pc", "가전 구독 PDP - PC"],
  ["care-solutions-pdp", "mo", "가전 구독 PDP - 모바일"],
  ["homestyle-home", "pc", "홈스타일 메인 - PC"],
  ["homestyle-home", "mo", "홈스타일 메인 - 모바일"],
  ["homestyle-pdp", "pc", "홈스타일 PDP - PC"],
  ["homestyle-pdp", "mo", "홈스타일 PDP - 모바일"],
  ["category-tvs", "pc", "PLP - TV 카테고리 - PC"],
  ["category-tvs", "mo", "PLP - TV 카테고리 - 모바일"],
  ["category-refrigerators", "pc", "PLP - 냉장고 카테고리 - PC"],
  ["category-refrigerators", "mo", "PLP - 냉장고 카테고리 - 모바일"],
  ["pdp-tv-general", "pc", "PDP - TV 일반형 - PC"],
  ["pdp-tv-general", "mo", "PDP - TV 일반형 - 모바일"],
  ["pdp-tv-premium", "pc", "PDP - TV 프리미엄형 - PC"],
  ["pdp-tv-premium", "mo", "PDP - TV 프리미엄형 - 모바일"],
  ["pdp-refrigerator-general", "pc", "PDP - 냉장고 일반형 - PC"],
  ["pdp-refrigerator-general", "mo", "PDP - 냉장고 일반형 - 모바일"],
  ["pdp-refrigerator-knockon", "pc", "PDP - 냉장고 노크온형 - PC"],
  ["pdp-refrigerator-knockon", "mo", "PDP - 냉장고 노크온형 - 모바일"],
  ["pdp-refrigerator-glass", "pc", "PDP - 냉장고 글라스형 - PC"],
  ["pdp-refrigerator-glass", "mo", "PDP - 냉장고 글라스형 - 모바일"],
];

function parseArgs(argv) {
  const args = {
    baseUrl: "http://127.0.0.1:3000",
    loginId: "mrgbiryu",
    targetSet: "admin",
    build: false,
    filter: "",
    outputTag: "",
    limit: 0,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "").trim();
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (key === "build") {
      args.build = true;
      continue;
    }
    if (!next || String(next).startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  args.baseUrl = String(args.baseUrl || "").replace(/\/+$/, "") || "http://127.0.0.1:3000";
  args.limit = Math.max(0, Number(args.limit || 0));
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getLatestSessionToken(loginId) {
  const users = readJson(path.join(RUNTIME_DIR, "users.json")).users || [];
  const sessions = readJson(path.join(RUNTIME_DIR, "sessions.json")).sessions || [];
  const user = users.find((item) => String(item.loginId || "") === String(loginId || ""));
  if (!user) return "";
  return String([...sessions].reverse().find((item) => item.userId === user.userId)?.token || "");
}

async function fetchJson(baseUrl, token, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      cookie: `${COOKIE_NAME}=${token}`,
    },
    signal: AbortSignal.timeout(Number(options.timeoutMs || 60_000)),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: response.ok, status: response.status, text, json };
}

function clonePath(pageId, viewportProfile) {
  return `/clone/${encodeURIComponent(pageId)}?viewportProfile=${encodeURIComponent(viewportProfile)}&baseline=origin`;
}

function normalizeTargets(args) {
  let targets = ADMIN_TARGETS;
  if (args.filter) {
    const needle = String(args.filter).toLowerCase();
    targets = targets.filter(([pageId, viewportProfile, label]) =>
      `${pageId} ${viewportProfile} ${label}`.toLowerCase().includes(needle)
    );
  }
  if (args.limit > 0) targets = targets.slice(0, args.limit);
  return targets;
}

function buildSyntheticApprovedPlan({ pageId, viewportProfile, label, components }) {
  const sectionBlueprints = components.map((component, index) => {
    const slotId = String(component.slotId || component.componentId || `section-${index + 1}`).trim();
    return {
      slotId,
      label: String(component.label || slotId).trim(),
      objective: `${label}의 ${slotId} 섹션을 현재 원본 구조를 보존하면서 명확한 디자인 시안으로 재구성한다.`,
      visualDirection: "LG 브랜드 톤, 섹션별 정보 위계, 반응형 밀도, 접근 가능한 CTA 상태를 유지한다.",
      mustKeep: "원본 섹션의 의미, 링크 목적, 주요 텍스트 흐름, 섹션 순서",
      mustChange: "시각 위계, 카드 밀도, 여백, 에셋 배치, CTA 강조",
    };
  });
  return {
    pageId,
    viewportProfile,
    title: `${label} 전체 섹션 디자인 검증`,
    requestSummary: [`${label} 기준으로 모든 editable 섹션이 authored runtime draft에 포함되는지 검증한다.`],
    designChangeLevel: "medium",
    interventionLayer: "page",
    patchDepth: "medium",
    targetScope: "page",
    targetGroupId: "page",
    targetGroupLabel: "전체 페이지",
    targetComponents: components.map((component) => String(component.componentId || "").trim()).filter(Boolean),
    sectionBlueprints,
    builderBrief: {
      viewportProfile,
      objective: `${label} 전체 섹션 디자인 생성 경로 검증`,
      suggestedFocusSlots: sectionBlueprints.map((item) => item.slotId),
      mustKeep: ["원본 클론의 정보 구조와 섹션 순서", "뷰포트별 자산 정책", "Tailwind runtime 렌더 정합성"],
      mustChange: ["각 섹션의 시각 위계", "카드/배너/CTA의 디자인 완성도", "모바일/PC별 밀도"],
    },
    builderMarkdown: [
      `# ${label} 전체 섹션 디자인 검증`,
      "",
      "- 모든 editable 섹션을 Author 입력에 포함한다.",
      "- 원본 의미와 링크 목적은 보존하고 디자인 위계를 개선한다.",
      "- PC/MO 자산 역할 정책을 위반하지 않는다.",
    ].join("\n"),
    designSpecMarkdown: [
      `# ${label} Design Spec`,
      "",
      "- Runtime draft는 Tailwind shell에서 렌더되어야 한다.",
      "- Section preview와 full after는 같은 authored package에서 파생되어야 한다.",
    ].join("\n"),
    designDirection: ["섹션별 위계 강화", "반응형 밀도 유지", "자산 역할 정책 준수"],
    guardrails: ["promo-complete 자산을 배경/아이콘으로 재사용하지 않음", "원본 섹션 식별자 보존", "legacy clone draft 경로 사용 금지"],
    referenceNotes: ["전수 검증용 synthetic plan"],
    selectedConcept: {
      conceptId: "coverage-validation",
      conceptLabel: "Coverage Validation",
      layoutSystem: "section-by-section authored runtime validation",
      typography: { headline: "clear hierarchy" },
      colorSystem: { baseSurface: "LG clean neutral" },
      ctaPolicy: { primary: "clear and accessible" },
      promotionTonePolicy: "restrained",
    },
    conceptPlans: [],
    planningPackage: {
      viewport: { viewportProfile },
      pageIdentity: {
        character: "LG전자 공식 사이트의 신뢰감 있는 제품/서비스 경험",
        visualLanguage: "정돈된 여백, 명확한 카드 위계, 브랜드 중심 톤",
        userGoal: "원하는 제품/서비스 정보를 빠르게 이해하고 다음 행동으로 이동",
        sectionFlow: "상단 탐색에서 핵심 정보, 비교/혜택, 상세 정보로 이어지는 흐름",
      },
      designPolicy: {
        problemStatement: ["전수 생성 시 섹션 누락이나 runtime 렌더 실패가 없어야 한다."],
        hierarchyGoals: ["각 섹션의 목적이 첫 화면에서 분명해야 한다."],
        mustKeep: ["원본 정보 구조", "링크 목적", "섹션 순서"],
        mustChange: ["시각 위계", "디자인 밀도"],
        guardrails: ["Tailwind runtime parity", "asset role policy"],
        layoutDirections: ["섹션별 독립 카드/배너 리듬 유지"],
      },
    },
  };
}

async function auditTarget({ baseUrl, token, pageId, viewportProfile, label, build }) {
  const cloneResponse = await fetch(`${baseUrl}${clonePath(pageId, viewportProfile)}`, {
    signal: AbortSignal.timeout(60_000),
  });
  const editableResponse = await fetchJson(
    baseUrl,
    token,
    `/api/workspace/llm-editable-list?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`
  );
  const assetResponse = await fetchJson(
    baseUrl,
    token,
    `/api/workspace/asset-registry-cards?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}&includeEmpty=1`
  );
  const sidecarResponse = await fetchJson(
    baseUrl,
    token,
    `/api/workspace/artifact-sidecar-registry?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`
  );
  const components = Array.isArray(editableResponse.json?.components) ? editableResponse.json.components : [];
  const assetSections = Array.isArray(assetResponse.json?.sections) ? assetResponse.json.sections : [];
  const sidecarSections = Array.isArray(sidecarResponse.json?.sections) ? sidecarResponse.json.sections : [];
  const assetTotals = assetSections.reduce((totals, section) => {
    totals.images += Number(section?.summary?.availableImageCount || 0);
    totals.icons += Number(section?.summary?.availableIconFamilyCount || 0);
    totals.interactions += Number(section?.summary?.availableInteractionComponentCount || 0);
    if (
      Number(section?.summary?.availableImageCount || 0) <= 0 &&
      Number(section?.summary?.availableIconFamilyCount || 0) <= 0 &&
      Number(section?.summary?.availableInteractionComponentCount || 0) <= 0
    ) {
      totals.emptySections.push(String(section?.slotId || section?.componentId || "").trim());
    }
    return totals;
  }, { images: 0, icons: 0, interactions: 0, emptySections: [] });
  const result = {
    pageId,
    viewportProfile,
    label,
    cloneStatus: cloneResponse.status,
    editableComponentCount: components.length,
    editableSlots: components.map((component) => String(component.slotId || component.componentId || "").trim()).filter(Boolean),
    sidecarSectionCount: sidecarSections.length,
    sidecarMissingReferenceMarkupCount: sidecarSections.filter((section) => !section?.sourceFidelity?.hasReferenceMarkup).length,
    assetSectionCount: assetSections.length,
    assetAvailableCounts: {
      images: assetTotals.images,
      iconFamilies: assetTotals.icons,
      interactionComponents: assetTotals.interactions,
    },
    assetEmptySections: assetTotals.emptySections,
    build: null,
  };
  if (build) {
    const approvedPlan = buildSyntheticApprovedPlan({ pageId, viewportProfile, label, components });
    const buildResponse = await fetchJson(baseUrl, token, "/api/workspace/build-local-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId,
        viewportProfile,
        planId: "",
        approvedPlan,
        editableComponents: components,
        rendererSurface: "tailwind",
        builderProvider: "local",
        designChangeLevel: "medium",
        interventionLayer: "page",
        patchDepth: "medium",
        targetScope: "page",
        targetComponents: approvedPlan.targetComponents,
        targetGroupId: "page",
        targetGroupLabel: "전체 페이지",
        requestText: `${label} 전체 섹션 디자인 검증`,
        keyMessage: "전 섹션 누락 없는 디자인 생성",
        preferredDirection: "원본 구조 보존, 디자인 위계 강화",
      }),
      timeoutMs: 120_000,
    });
    const item = buildResponse.json?.item || {};
    const authoredSections = Array.isArray(item?.report?.authoredSections)
      ? item.report.authoredSections
      : (Array.isArray(item?.snapshotData?.authoredSectionHtmlPackage?.sections) ? item.snapshotData.authoredSectionHtmlPackage.sections : []);
    const authoredSlotIds = authoredSections.map((section) => String(section?.slotId || "").trim()).filter(Boolean);
    result.build = {
      ok: buildResponse.ok,
      status: buildResponse.status,
      error: buildResponse.ok ? "" : String(buildResponse.json?.error || buildResponse.text || "").slice(0, 500),
      validation: buildResponse.ok ? null : (buildResponse.json?.validation || null),
      draftBuildId: String(item?.id || "").trim(),
      previewPath: String(buildResponse.json?.previewPath || "").trim(),
      comparePath: String(buildResponse.json?.comparePath || "").trim(),
      authoredSectionCount: authoredSlotIds.length,
      authoredSlotIds,
      missingAuthoredSlots: result.editableSlots.filter((slotId) => !authoredSlotIds.includes(slotId)),
    };
  }
  return result;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Admin Design Target Audit");
  lines.push("");
  lines.push(`generatedAt: ${report.generatedAt}`);
  lines.push(`baseUrl: ${report.baseUrl}`);
  lines.push(`targetCount: ${report.results.length}`);
  lines.push(`buildExecuted: ${report.buildExecuted ? "yes" : "no"}`);
  lines.push("");
  lines.push("| target | viewport | clone | editable | sidecar | assets img/icon/int | empty assets | build | authored | missing authored |");
  lines.push("| --- | --- | ---: | ---: | ---: | --- | ---: | --- | ---: | --- |");
  for (const item of report.results) {
    const buildStatus = item.build ? (item.build.ok ? "pass" : `fail ${item.build.status}`) : "not-run";
    lines.push(
      `| ${item.pageId} | ${item.viewportProfile} | ${item.cloneStatus} | ${item.editableComponentCount} | ${item.sidecarSectionCount} | ${item.assetAvailableCounts.images}/${item.assetAvailableCounts.iconFamilies}/${item.assetAvailableCounts.interactionComponents} | ${item.assetEmptySections.length} | ${buildStatus} | ${item.build?.authoredSectionCount ?? ""} | ${(item.build?.missingAuthoredSlots || []).join(", ")} |`
    );
  }
  const failures = report.results.filter((item) =>
    item.cloneStatus !== 200 ||
    item.editableComponentCount <= 0 ||
    item.sidecarSectionCount <= 0 ||
    item.build?.ok === false ||
    (item.build && item.build.missingAuthoredSlots.length > 0)
  );
  lines.push("");
  lines.push("## Gaps");
  lines.push("");
  if (!failures.length) {
    lines.push("- none");
  } else {
    for (const item of failures) {
      lines.push(`- ${item.pageId}/${item.viewportProfile}: clone=${item.cloneStatus}, editable=${item.editableComponentCount}, sidecar=${item.sidecarSectionCount}, build=${item.build ? item.build.status : "not-run"}, missing=${(item.build?.missingAuthoredSlots || []).join(", ") || "none"}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = getLatestSessionToken(args.loginId);
  if (!token) throw new Error(`session token not found for ${args.loginId}`);
  const targets = normalizeTargets(args);
  const results = [];
  for (const [pageId, viewportProfile, label] of targets) {
    process.stderr.write(`[audit] ${pageId}/${viewportProfile}${args.build ? " build" : ""}\n`);
    results.push(await auditTarget({
      baseUrl: args.baseUrl,
      token,
      pageId,
      viewportProfile,
      label,
      build: args.build,
    }));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: args.baseUrl,
    loginId: args.loginId,
    targetSet: args.targetSet,
    buildExecuted: args.build,
    results,
  };
  const outputTag = String(args.outputTag || "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  const outJson = outputTag
    ? path.join(ROOT, "data", "normalized", `admin-design-target-audit-${outputTag}.json`)
    : OUT_JSON;
  const outMd = outputTag
    ? path.join(ROOT, "data", "normalized", `admin-design-target-audit-${outputTag}.md`)
    : OUT_MD;
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(outMd, buildMarkdown(report), "utf8");
  console.log(JSON.stringify({
    outJson,
    outMd,
    targetCount: results.length,
    buildExecuted: args.build,
    failures: results.filter((item) => item.build?.ok === false || item.cloneStatus !== 200 || item.editableComponentCount <= 0).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
