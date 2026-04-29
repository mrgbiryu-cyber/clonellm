#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const USERS_PATH = path.join(RUNTIME_DIR, "users.json");
const WORKSPACES_PATH = path.join(RUNTIME_DIR, "workspaces.json");
const ACTIVITY_PATH = path.join(RUNTIME_DIR, "activity-log.json");

const ADMIN_TARGETS = [
  { label: "홈 - PC", pageId: "home", viewportProfile: "pc" },
  { label: "홈 - TA", pageId: "home", viewportProfile: "ta" },
  { label: "고객지원", pageId: "support", viewportProfile: "pc" },
  { label: "베스트샵", pageId: "bestshop", viewportProfile: "pc" },
  { label: "가전 구독 메인", pageId: "care-solutions", viewportProfile: "pc" },
  { label: "가전 구독 PDP", pageId: "care-solutions-pdp", viewportProfile: "pc" },
  { label: "홈스타일 메인", pageId: "homestyle-home", viewportProfile: "pc" },
  { label: "홈스타일 PDP", pageId: "homestyle-pdp", viewportProfile: "pc" },
  { label: "PLP - TV", pageId: "category-tvs", viewportProfile: "pc" },
  { label: "PLP - 냉장고", pageId: "category-refrigerators", viewportProfile: "pc" },
  { label: "PDP - TV 일반형", pageId: "pdp-tv-general", viewportProfile: "pc" },
  { label: "PDP - TV 프리미엄형", pageId: "pdp-tv-premium", viewportProfile: "pc" },
  { label: "PDP - 냉장고 일반형", pageId: "pdp-refrigerator-general", viewportProfile: "pc" },
  { label: "PDP - 냉장고 노크온형", pageId: "pdp-refrigerator-knockon", viewportProfile: "pc" },
  { label: "PDP - 냉장고 글라스형", pageId: "pdp-refrigerator-glass", viewportProfile: "pc" },
];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const output = {
    loginId: "mrgbiryu",
    userId: "",
    pageKey: "",
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1] || "";
    if (token === "--login-id" && next) {
      output.loginId = next;
      index += 1;
      continue;
    }
    if (token === "--user-id" && next) {
      output.userId = next;
      index += 1;
      continue;
    }
    if (token === "--page" && next) {
      output.pageKey = next;
      index += 1;
    }
  }
  return output;
}

function normalizeViewportProfile(value) {
  return String(value || "pc").trim() || "pc";
}

function toTimestamp(value) {
  const time = new Date(String(value || "").trim()).getTime();
  return Number.isFinite(time) ? time : 0;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : `${text}${" ".repeat(width - text.length)}`;
}

function formatDate(value) {
  const text = String(value || "").trim();
  return text ? text.replace("T", " ").replace(".000Z", "Z") : "-";
}

function getWorkspaceKey(pageId, viewportProfile) {
  return `${pageId}:${normalizeViewportProfile(viewportProfile)}`;
}

function resolveUser({ loginId, userId }, usersPayload, workspacesPayload) {
  const users = Array.isArray(usersPayload?.users) ? usersPayload.users : [];
  const workspaces = Array.isArray(workspacesPayload?.workspaces) ? workspacesPayload.workspaces : [];
  if (userId) {
    const workspace = workspaces.find((item) => item.userId === userId) || null;
    const user = users.find((item) => item.userId === userId) || null;
    return { user, workspace };
  }
  const normalizedLoginId = String(loginId || "").trim().toLowerCase();
  const user = users.find((item) => String(item?.loginId || "").trim().toLowerCase() === normalizedLoginId) || null;
  if (user) {
    return {
      user,
      workspace: workspaces.find((item) => item.userId === user.userId) || null,
    };
  }
  const fallbackWorkspace = [...workspaces].sort((a, b) => {
    const aCount = Array.isArray(a?.requirementPlans) ? a.requirementPlans.length : 0;
    const bCount = Array.isArray(b?.requirementPlans) ? b.requirementPlans.length : 0;
    return bCount - aCount;
  })[0] || null;
  return { user: null, workspace: fallbackWorkspace };
}

function listEventsForPage(events, userId, pageId) {
  const allowedTypes = new Set([
    "workspace_page_identity_saved",
    "workspace_requirement_plan_saved",
    "llm_plan_created",
    "workspace_draft_build_saved",
    "llm_build_created",
    "workspace_saved_version_saved",
    "workspace_view_pinned",
  ]);
  return events
    .filter((event) => event?.userId === userId && allowedTypes.has(event?.type) && event?.detail?.pageId === pageId)
    .sort((a, b) => String(b?.recordedAt || "").localeCompare(String(a?.recordedAt || "")));
}

function pickLatestBy(items, keyFn) {
  return [...items].sort((a, b) => keyFn(b) - keyFn(a))[0] || null;
}

function buildPageReport(target, workspace, activityEvents) {
  const pageId = target.pageId;
  const viewportProfile = normalizeViewportProfile(target.viewportProfile);
  const workspaceKey = getWorkspaceKey(pageId, viewportProfile);
  const basePage = (workspace?.data?.pages || []).find((item) => item?.id === pageId) || null;
  const sectionCount = Array.isArray(basePage?.sections) ? basePage.sections.length : 0;
  const slotRegistry = workspace?.data?.slotRegistries?.[pageId] || null;
  const slotCount = slotRegistry && typeof slotRegistry === "object" ? Object.keys(slotRegistry).length : 0;
  const identityOverride = workspace?.pageIdentityOverrides?.[pageId] || null;
  const plans = (workspace?.requirementPlans || [])
    .filter((item) => item && typeof item === "object")
    .filter((item) => item.pageId === pageId && normalizeViewportProfile(item.viewportProfile) === viewportProfile);
  const latestPlan = pickLatestBy(plans, (item) => toTimestamp(item?.updatedAt || item?.createdAt));
  const requirementPlan = latestPlan?.output?.requirementPlan || {};
  const docsReady =
    String(requirementPlan.builderMarkdown || "").trim().length > 0 &&
    String(requirementPlan.layoutMockupMarkdown || "").trim().length > 0 &&
    String(requirementPlan.designSpecMarkdown || "").trim().length > 0 &&
    Array.isArray(requirementPlan.sectionBlueprints) &&
    requirementPlan.sectionBlueprints.length > 0;
  const drafts = (workspace?.draftBuilds || [])
    .filter((item) => item && typeof item === "object")
    .filter((item) => item.pageId === pageId && normalizeViewportProfile(item.viewportProfile) === viewportProfile);
  const latestDraft = pickLatestBy(drafts, (item) => toTimestamp(item?.updatedAt || item?.createdAt));
  const pairedDrafts = latestPlan ? drafts.filter((item) => String(item?.planId || "").trim() === latestPlan.id) : drafts;
  const latestPairedDraft = pickLatestBy(pairedDrafts, (item) => toTimestamp(item?.updatedAt || item?.createdAt));
  const versions = (workspace?.savedVersions || [])
    .filter((item) => item && typeof item === "object")
    .filter((item) => item.pageId === pageId && normalizeViewportProfile(item.viewportProfile) === viewportProfile);
  const pairedVersions = latestPlan ? versions.filter((item) => String(item?.planId || "").trim() === latestPlan.id) : versions;
  const latestPairedVersion = pickLatestBy(pairedVersions, (item) => toTimestamp(item?.updatedAt || item?.createdAt));
  const pinnedViews = workspace?.pinnedViewsByPage || {};
  const pinned = pinnedViews[workspaceKey] || pinnedViews[pageId] || null;
  const pinnedVersion = pinned?.versionId
    ? versions.find((item) => String(item?.id || "").trim() === String(pinned.versionId || "").trim()) || null
    : null;
  const pinnedMatchesLatestPlan = latestPlan
    ? String(pinnedVersion?.planId || "").trim() === latestPlan.id
    : Boolean(pinned?.versionId);
  const events = listEventsForPage(activityEvents, workspace?.userId, pageId);
  const lastEvent = events[0] || null;
  const hasLegacyDraft = Boolean(latestPlan && drafts.length > 0 && pairedDrafts.length === 0);
  const hasLegacyVersion = Boolean(latestPlan && versions.length > 0 && pairedVersions.length === 0);

  let stage = "base";
  if (pinned?.versionId && pinnedMatchesLatestPlan) stage = "pinned";
  else if (pairedVersions.length) stage = "versioned";
  else if (pairedDrafts.length) stage = "draft-built";
  else if (latestPlan) stage = "planned";
  else if (identityOverride) stage = "identity";

  return {
    label: target.label,
    key: workspaceKey,
    sectionCount,
    slotCount,
    identityReady: Boolean(identityOverride || basePage),
    docsReady,
    draftCount: drafts.length,
    versionCount: versions.length,
    pairedDraftCount: pairedDrafts.length,
    pairedVersionCount: pairedVersions.length,
    pairedDraftReady: Boolean(latestPairedDraft),
    pairedVersionReady: Boolean(latestPairedVersion),
    pinned: Boolean(pinned?.versionId && pinnedMatchesLatestPlan),
    pinnedAny: Boolean(pinned?.versionId),
    stage,
    legacyState: hasLegacyDraft || hasLegacyVersion ? "legacy-only" : "-",
    latestPlanOrigin: latestPlan ? `${latestPlan.originType || "unknown"}:${latestPlan.generatedBy || "-"}` : "-",
    latestPlanAt: latestPlan?.updatedAt || latestPlan?.createdAt || "",
    latestDraftAt: latestDraft?.updatedAt || latestDraft?.createdAt || "",
    latestPairedDraftAt: latestPairedDraft?.updatedAt || latestPairedDraft?.createdAt || "",
    latestEvent: lastEvent ? `${lastEvent.type}@${formatDate(lastEvent.recordedAt)}` : "-",
  };
}

function main() {
  const options = parseArgs(process.argv);
  const usersPayload = readJson(USERS_PATH, { users: [] });
  const workspacesPayload = readJson(WORKSPACES_PATH, { workspaces: [] });
  const activityPayload = readJson(ACTIVITY_PATH, { events: [] });
  const { user, workspace } = resolveUser(options, usersPayload, workspacesPayload);

  if (!workspace) {
    console.error("workspace_not_found");
    process.exit(1);
  }

  const reports = ADMIN_TARGETS
    .filter((target) => !options.pageKey || getWorkspaceKey(target.pageId, target.viewportProfile) === options.pageKey)
    .map((target) => buildPageReport(target, workspace, Array.isArray(activityPayload?.events) ? activityPayload.events : []));

  const docsReadyCount = reports.filter((item) => item.docsReady).length;
  const builtCount = reports.filter((item) => item.draftCount > 0).length;
  const pairedBuiltCount = reports.filter((item) => item.pairedDraftCount > 0).length;
  const versionedCount = reports.filter((item) => item.versionCount > 0).length;
  const pairedVersionedCount = reports.filter((item) => item.pairedVersionCount > 0).length;
  const pinnedCount = reports.filter((item) => item.pinned).length;
  const legacyOnlyCount = reports.filter((item) => item.legacyState === "legacy-only").length;

  console.log(`Execution Chain Report`);
  console.log(`userId: ${workspace.userId}`);
  console.log(`loginId: ${user?.loginId || options.loginId || "-"}`);
  console.log(`targets: ${reports.length}/${ADMIN_TARGETS.length}`);
  console.log(`docs-ready: ${docsReadyCount}/${reports.length}`);
  console.log(`draft-built: ${builtCount}/${reports.length}`);
  console.log(`paired-draft-built: ${pairedBuiltCount}/${reports.length}`);
  console.log(`versioned: ${versionedCount}/${reports.length}`);
  console.log(`paired-versioned: ${pairedVersionedCount}/${reports.length}`);
  console.log(`pinned: ${pinnedCount}/${reports.length}`);
  console.log(`legacy-only: ${legacyOnlyCount}/${reports.length}`);
  console.log("");
  console.log(
    [
      pad("page", 24),
      pad("sections", 8),
      pad("slots", 6),
      pad("docs", 6),
      pad("drafts", 6),
      pad("pair", 4),
      pad("vers", 4),
      pad("pin", 4),
      pad("stage", 12),
      pad("legacy", 11),
      pad("plan-origin", 30),
      "last-event",
    ].join(" | ")
  );
  console.log("-".repeat(150));
  reports.forEach((item) => {
    console.log(
      [
        pad(item.label, 24),
        pad(item.sectionCount, 8),
        pad(item.slotCount, 6),
        pad(yesNo(item.docsReady), 6),
        pad(item.draftCount, 6),
        pad(yesNo(item.pairedDraftReady), 4),
        pad(item.versionCount, 4),
        pad(yesNo(item.pinned), 4),
        pad(item.stage, 12),
        pad(item.legacyState, 11),
        pad(item.latestPlanOrigin, 30),
        item.latestEvent,
      ].join(" | ")
    );
  });
}

main();
