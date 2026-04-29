#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  listRequirementPlans,
  listDraftBuilds,
} = require("../auth.js");

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function parseArgs(argv) {
  const args = {
    login: "mrgbiryu",
    page: "care-solutions",
    viewport: "mo",
    expectJourney: "care-subscription",
    limit: 5,
    watch: 0,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") args.json = true;
    else if (token === "--watch") args.watch = Number(argv[++index] || 5);
    else if (token.startsWith("--")) {
      const key = token.slice(2);
      args[key] = argv[index + 1];
      index += 1;
    }
  }
  args.limit = Math.max(1, Math.min(50, Number(args.limit) || 5));
  args.watch = Math.max(0, Number(args.watch) || 0);
  return args;
}

function readJson(relativePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

function getUserByLogin(loginId) {
  const usersPayload = readJson("data/runtime/users.json", { users: [] });
  return (Array.isArray(usersPayload.users) ? usersPayload.users : [])
    .find((user) => String(user?.loginId || "").trim() === String(loginId || "").trim()) || null;
}

function normalizeViewport(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["mo", "mobile"].includes(normalized) ? "mo" : "pc";
}

function pageIdsFromFlow(flow) {
  return (Array.isArray(flow?.pages) ? flow.pages : [])
    .map((item) => String(item?.pageId || "").trim())
    .filter(Boolean);
}

function runnablePageIdsFromFlow(flow) {
  return (Array.isArray(flow?.pages) ? flow.pages : [])
    .filter((item) => String(item?.sourceType || "live-clone").trim() !== "reference-based")
    .map((item) => String(item?.pageId || "").trim())
    .filter(Boolean);
}

function resolvePlanJourneyFlow(plan) {
  return plan?.output?.requirementPlan?.journeyFlow && typeof plan.output.requirementPlan.journeyFlow === "object"
    ? plan.output.requirementPlan.journeyFlow
    : plan?.journeyFlow && typeof plan.journeyFlow === "object"
      ? plan.journeyFlow
      : null;
}

function summarizePlan(plan) {
  if (!plan) return null;
  const userInput = plan?.input?.userInput || {};
  const flow = resolvePlanJourneyFlow(plan);
  return {
    id: String(plan.id || "").trim(),
    pageId: String(plan.pageId || "").trim(),
    viewportProfile: normalizeViewport(plan.viewportProfile),
    updatedAt: plan.updatedAt || "",
    inputJourneyMode: String(userInput.journeyMode || "").trim(),
    inputJourneyId: String(userInput.journeyId || "").trim(),
    inputProvider: String(userInput.provider || userInput.plannerProvider || plan.provider || "").trim(),
    flowJourneyId: String(flow?.journeyId || "").trim(),
    flowJourneyLabel: String(flow?.journeyLabel || "").trim(),
    flowSource: String(flow?.source || "").trim(),
    executionApproved: flow?.executionApproved === true,
    flowPageIds: pageIdsFromFlow(flow),
    runnablePageIds: runnablePageIdsFromFlow(flow),
  };
}

function summarizeFlowRecord(record) {
  if (!record) return null;
  const flow = record.journeyFlow && typeof record.journeyFlow === "object" ? record.journeyFlow : {};
  return {
    id: String(record.id || "").trim(),
    planId: String(record.planId || "").trim(),
    sourcePageId: String(record.sourcePageId || record.pageId || "").trim(),
    viewportProfile: normalizeViewport(record.viewportProfile),
    journeyId: String(record.journeyId || flow.journeyId || "").trim(),
    flowJourneyId: String(flow.journeyId || "").trim(),
    flowJourneyLabel: String(flow.journeyLabel || "").trim(),
    flowSource: String(flow.source || "").trim(),
    executionApproved: flow.executionApproved === true,
    updatedAt: record.updatedAt || "",
    flowPageIds: pageIdsFromFlow(flow),
    runnablePageIds: runnablePageIdsFromFlow(flow),
  };
}

function summarizeDraft(draft) {
  if (!draft) return null;
  return {
    id: String(draft.id || draft.draftBuildId || "").trim(),
    pageId: String(draft.pageId || "").trim(),
    viewportProfile: normalizeViewport(draft.viewportProfile),
    status: String(draft.status || "").trim(),
    provider: String(draft.provider || draft.modelProvider || "").trim(),
    model: String(draft.model || draft.modelName || "").trim(),
    previewUrl: String(draft.previewUrl || "").trim(),
    compareUrl: String(draft.compareUrl || "").trim(),
    updatedAt: draft.updatedAt || draft.createdAt || "",
  };
}

function summarizeJourneyBuild(build) {
  if (!build) return null;
  const flow = build.journeyFlow && typeof build.journeyFlow === "object" ? build.journeyFlow : {};
  return {
    id: String(build.id || "").trim(),
    status: String(build.status || "").trim(),
    dryRun: build.dryRun === true,
    sourcePageId: String(build.sourcePageId || build.pageId || "").trim(),
    viewportProfile: normalizeViewport(build.viewportProfile),
    journeyId: String(build.journeyId || flow.journeyId || "").trim(),
    currentPageId: String(build.currentPageId || "").trim(),
    startedAt: build.startedAt || "",
    finishedAt: build.finishedAt || "",
    updatedAt: build.updatedAt || "",
    error: String(build.error || "").trim(),
    resultCount: Array.isArray(build.results) ? build.results.length : 0,
    results: (Array.isArray(build.results) ? build.results : []).map((item) => ({
      pageId: String(item?.pageId || "").trim(),
      status: String(item?.status || "").trim(),
      draftBuildId: String(item?.draftBuildId || "").trim(),
      error: String(item?.error || "").trim(),
    })),
  };
}

function buildReport(args) {
  const user = getUserByLogin(args.login);
  if (!user) {
    return {
      ok: false,
      error: `user_not_found:${args.login}`,
      checkedAt: new Date().toISOString(),
    };
  }

  const viewport = normalizeViewport(args.viewport);
  const plans = listRequirementPlans(user.userId, {
    pageId: args.page,
    viewportProfile: viewport,
    limit: args.limit,
    summaryOnly: false,
  });
  const drafts = listDraftBuilds(user.userId, {
    pageId: args.page,
    viewportProfile: viewport,
    limit: args.limit,
    summaryOnly: true,
  });
  const flowPayload = readJson("data/runtime/journey-flows.json", { flows: [] });
  const flowRecords = (Array.isArray(flowPayload.flows) ? flowPayload.flows : [])
    .filter((item) => String(item?.userId || "").trim() === String(user.userId || "").trim())
    .filter((item) => String(item?.sourcePageId || item?.pageId || "").trim() === String(args.page || "").trim())
    .filter((item) => normalizeViewport(item?.viewportProfile) === viewport)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .slice(0, args.limit);
  const buildPayload = readJson("data/runtime/journey-builds.json", { builds: [] });
  const journeyBuilds = (Array.isArray(buildPayload.builds) ? buildPayload.builds : [])
    .filter((item) => String(item?.userId || "").trim() === String(user.userId || "").trim())
    .filter((item) => !args.page || String(item?.sourcePageId || item?.pageId || "").trim() === String(args.page || "").trim())
    .filter((item) => normalizeViewport(item?.viewportProfile) === viewport)
    .sort((a, b) => String(b.updatedAt || b.finishedAt || b.startedAt || "").localeCompare(String(a.updatedAt || a.finishedAt || a.startedAt || "")))
    .slice(0, args.limit);

  const latestPlan = summarizePlan(plans[0]);
  const latestFlow = summarizeFlowRecord(flowRecords[0]);
  const latestDraft = summarizeDraft(drafts[0]);
  const latestBuild = summarizeJourneyBuild(journeyBuilds[0]);
  const expectedJourney = String(args.expectJourney || "").trim();

  const checks = [
    {
      id: "plan_exists",
      ok: Boolean(latestPlan?.id),
      detail: latestPlan?.id || "no plan",
    },
    {
      id: "plan_journey_matches",
      ok: !expectedJourney || latestPlan?.inputJourneyId === expectedJourney || latestPlan?.flowJourneyId === expectedJourney,
      detail: `input=${latestPlan?.inputJourneyId || "-"} flow=${latestPlan?.flowJourneyId || "-"}`,
    },
    {
      id: "plan_flow_includes_current_page",
      ok: Boolean(latestPlan?.flowPageIds?.includes(args.page)),
      detail: (latestPlan?.flowPageIds || []).join(" -> ") || "no flow pages",
    },
    {
      id: "flow_record_exists",
      ok: Boolean(latestFlow?.id),
      detail: latestFlow?.id || "no saved flow record",
    },
    {
      id: "flow_record_matches_plan",
      ok: Boolean(latestPlan?.id && latestFlow?.planId === latestPlan.id),
      detail: `flow.planId=${latestFlow?.planId || "-"} latestPlan=${latestPlan?.id || "-"}`,
    },
    {
      id: "flow_record_approved",
      ok: latestFlow?.executionApproved === true || ["manual", "approved", "llm-approved"].includes(latestFlow?.flowSource || ""),
      detail: `source=${latestFlow?.flowSource || "-"} approved=${latestFlow?.executionApproved === true}`,
    },
    {
      id: "flow_record_includes_current_page",
      ok: Boolean(latestFlow?.flowPageIds?.includes(args.page)),
      detail: (latestFlow?.flowPageIds || []).join(" -> ") || "no flow pages",
    },
  ];

  const hardFailures = checks.filter((check) => !check.ok);
  return {
    ok: hardFailures.length === 0,
    checkedAt: new Date().toISOString(),
    target: {
      login: args.login,
      userId: user.userId,
      pageId: args.page,
      viewportProfile: viewport,
      expectedJourneyId: expectedJourney,
    },
    checks,
    latestPlan,
    latestFlow,
    latestDraft,
    latestJourneyBuild: latestBuild,
    recentPlans: plans.map(summarizePlan),
    recentFlowRecords: flowRecords.map(summarizeFlowRecord),
    recentJourneyBuilds: journeyBuilds.map(summarizeJourneyBuild),
  };
}

function renderText(report) {
  const lines = [];
  lines.push(`[journey-flow-state] ${report.checkedAt}`);
  if (!report.ok) lines.push(`STATUS: BLOCKED`);
  else lines.push(`STATUS: READY`);
  if (report.error) {
    lines.push(`ERROR: ${report.error}`);
    return lines.join("\n");
  }
  lines.push(`TARGET: ${report.target.login} / ${report.target.pageId} / ${report.target.viewportProfile} / expected=${report.target.expectedJourneyId || "-"}`);
  lines.push("");
  lines.push("CHECKS:");
  for (const check of report.checks) {
    lines.push(`- ${check.ok ? "OK" : "FAIL"} ${check.id}: ${check.detail}`);
  }
  lines.push("");
  lines.push(`LATEST PLAN: ${report.latestPlan?.id || "-"} / input=${report.latestPlan?.inputJourneyId || "-"} / flow=${report.latestPlan?.flowJourneyId || "-"} / updated=${report.latestPlan?.updatedAt || "-"}`);
  lines.push(`PLAN FLOW: ${(report.latestPlan?.flowPageIds || []).join(" -> ") || "-"}`);
  lines.push(`LATEST FLOW: ${report.latestFlow?.id || "-"} / plan=${report.latestFlow?.planId || "-"} / journey=${report.latestFlow?.journeyId || "-"} / updated=${report.latestFlow?.updatedAt || "-"}`);
  lines.push(`FLOW PAGES: ${(report.latestFlow?.flowPageIds || []).join(" -> ") || "-"}`);
  lines.push(`LATEST BUILD: ${report.latestJourneyBuild?.id || "-"} / status=${report.latestJourneyBuild?.status || "-"} / dryRun=${report.latestJourneyBuild?.dryRun === true} / journey=${report.latestJourneyBuild?.journeyId || "-"} / results=${report.latestJourneyBuild?.resultCount ?? "-"}`);
  if (report.latestJourneyBuild?.error) lines.push(`BUILD ERROR: ${report.latestJourneyBuild.error}`);
  if (report.latestJourneyBuild?.results?.length) {
    lines.push("BUILD RESULTS:");
    for (const item of report.latestJourneyBuild.results) {
      lines.push(`- ${item.pageId}: ${item.status}${item.draftBuildId ? ` / ${item.draftBuildId}` : ""}${item.error ? ` / ${item.error}` : ""}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const run = () => {
    const report = buildReport(args);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else console.log(renderText(report));
    if (!args.watch && !report.ok) process.exitCode = 2;
  };
  run();
  if (!args.watch) return;
  setInterval(() => {
    console.log("\n---");
    run();
  }, args.watch * 1000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
