const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");
const { handleLlmChange, handleLlmChangeOnData, handleLlmPlan, handleLlmBuildOnData, normalizeEditableData, readEditableData, writeEditableData } = require("./llm");
const { analyzeReferenceUrls, buildGuardrailBundle } = require("./planner-tools");
const {
  getUserFromRequest,
  registerUser,
  loginUser,
  logoutUser,
  buildSessionCookie,
  buildLogoutCookie,
  getWorkspace,
  saveWorkspace,
  incrementLlmUsage,
  logEvent,
  readUserActivity,
  sanitizeUser,
  listRequirementPlans,
  saveRequirementPlan,
  listDraftBuilds,
  saveDraftBuild,
  listSavedVersions,
  saveSavedVersion,
  pinSavedVersion,
  getPinnedView,
} = require("./auth");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const STATIC_DIR = path.join(ROOT, "web");
const DATA_PATH = path.join(ROOT, "data", "normalized", "editable-prototype.json");
const ARCHIVE_INDEX_PATH = path.join(ROOT, "data", "raw", "archive-index.json");
const ASSET_DIR = path.join(ROOT, "data", "raw", "assets");
const ARCHIVE_PAGES_DIR = path.join(ROOT, "data", "raw", "pages");
const SLOT_SNAPSHOT_DIR = path.join(ROOT, "data", "normalized", "slot-snapshots");
const INTERACTION_SNAPSHOT_DIR = path.join(ROOT, "data", "normalized", "interaction-snapshots");
const WORKBENCH_TARGETS_PATH = path.join(ROOT, "data", "normalized", "workbench-targets", "index.json");
const VISUAL_DIR = path.join(ROOT, "data", "visual");
const VISUAL_BATCH_SUMMARY_PATH = path.join(VISUAL_DIR, "batch-summary.json");
const PLP_VISUAL_INDEX_PATH = path.join(VISUAL_DIR, "plp", "index.json");
const PDP_VISUAL_INDEX_PATH = path.join(VISUAL_DIR, "pdp", "index.json");
const SERVICE_PAGE_VISUAL_INDEX_PATH = path.join(VISUAL_DIR, "service-pages", "index.json");
const SERVICE_GROUPS_INDEX_PATH = path.join(ROOT, "data", "normalized", "service-groups", "index.json");
const PLP_GROUPS_INDEX_PATH = path.join(ROOT, "data", "normalized", "plp-groups", "index.json");
const PDP_GROUPS_INDEX_PATH = path.join(ROOT, "data", "normalized", "pdp-groups", "index.json");
const HOME_LINK_COVERAGE_REPORT_PATH = path.join(ROOT, "data", "reports", "home-link-coverage.json");
const REFERENCE_LIVE_DIR = path.join(ROOT, "data", "raw", "reference-live");
const REFERENCE_LIVE_FALLBACK_DIR = path.join(ROOT, "data", "reference-live");
const GNB_STATE_DIR = path.join(ROOT, "data", "debug", "gnb-state");
const CURRENT_LIVE_HOME_DOM_PATH = path.join(ROOT, "data", "debug", "live-home-current-dom.html");
const DEFAULT_CANVAS_WIDTH = 1460;
const DEFAULT_COMPARE_CANVAS_HEIGHT = 2600;
const LIVE_MEASUREMENTS = new Map();
const PAGE_COMPUTE_CACHE_TTL_MS = 15000;
const WORKING_COMPONENT_INVENTORY_CACHE = new Map();
const WORKING_EDITABILITY_CACHE = new Map();
const PRE_LLM_GAP_CACHE = new Map();
const ACCEPTANCE_RESULTS_CACHE = new Map();

function readCachedValue(cache, key, compute, ttlMs = PAGE_COMPUTE_CACHE_TTL_MS) {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at <= ttlMs) {
    return cached.value;
  }
  const value = compute();
  cache.set(key, { at: now, value });
  return value;
}

function buildWorkspacePageCacheKey(editableData, pageId, scope = "") {
  const registry = findSlotRegistry(editableData || {}, pageId);
  const slotState = (registry?.slots || []).map((slot) => `${slot.slotId}:${slot.activeSourceId || ""}`).join("|");
  const patchState = listComponentPatches(editableData || {}, pageId)
    .map((item) => `${item.componentId}:${item.sourceId || ""}:${item.updatedAt || ""}`)
    .join("|");
  const acceptanceState = Array.isArray(editableData?.acceptanceResults)
    ? editableData.acceptanceResults
        .filter((item) => !pageId || String(item.pageId || "").trim() === String(pageId || "").trim())
        .map((item) => `${item.bundleId}:${item.status}:${item.updatedAt || ""}`)
        .join("|")
    : "";
  return [scope, pageId, slotState, patchState, acceptanceState].join("::");
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function sendHtml(res, status, fileName) {
  const filePath = path.join(STATIC_DIR, fileName);
  try {
    const html = fs.readFileSync(filePath, "utf-8");
    res.writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end(html);
  } catch (error) {
    sendJson(res, 500, { error: "failed_to_read_html", detail: String(error) });
  }
}

function sendRawHtml(res, status, html) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(html);
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function requireAuthenticatedUser(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: "auth_required" });
    return null;
  }
  return user;
}

function readDataForRequest(req) {
  const user = getUserFromRequest(req);
  if (!user) {
    return { user: null, data: readEditableData(), workspace: null, source: "shared-default" };
  }
  const workspace = getWorkspace(user.userId);
  return {
    user,
    workspace,
    data: normalizeEditableData(JSON.parse(JSON.stringify(workspace.data || readEditableData()))),
    source: "user-workspace",
  };
}

function clonePlain(value, fallback) {
  if (typeof value === "undefined") return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function extractPageScopedSnapshot(editableData, pageId) {
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return null;
  const page = (editableData?.pages || []).find((item) => item.id === normalizedPageId) || null;
  const slotRegistry = (editableData?.slotRegistries || []).find((item) => item.pageId === normalizedPageId) || null;
  const componentPatches = (editableData?.componentPatches || []).filter((item) => String(item.pageId || "").trim() === normalizedPageId);
  return {
    pageId: normalizedPageId,
    page: clonePlain(page, null),
    slotRegistry: clonePlain(slotRegistry, null),
    componentPatches: clonePlain(componentPatches, []),
  };
}

function applyPageScopedSnapshot(editableData, snapshot, pageId) {
  const normalizedPageId = String(pageId || snapshot?.pageId || "").trim();
  if (!normalizedPageId || !snapshot || typeof snapshot !== "object") {
    return normalizeEditableData(clonePlain(editableData, {}));
  }
  const next = normalizeEditableData(clonePlain(editableData, {}));
  if (snapshot.page && typeof snapshot.page === "object") {
    const pageIndex = (next.pages || []).findIndex((item) => item.id === normalizedPageId);
    if (pageIndex >= 0) next.pages[pageIndex] = clonePlain(snapshot.page, next.pages[pageIndex]);
    else next.pages.push(clonePlain(snapshot.page, null));
  }
  if (snapshot.slotRegistry && typeof snapshot.slotRegistry === "object") {
    const registryIndex = (next.slotRegistries || []).findIndex((item) => item.pageId === normalizedPageId);
    if (registryIndex >= 0) next.slotRegistries[registryIndex] = clonePlain(snapshot.slotRegistry, next.slotRegistries[registryIndex]);
    else next.slotRegistries.push(clonePlain(snapshot.slotRegistry, null));
  }
  if (Array.isArray(snapshot.componentPatches)) {
    next.componentPatches = (next.componentPatches || []).filter((item) => String(item.pageId || "").trim() !== normalizedPageId);
    next.componentPatches.push(...clonePlain(snapshot.componentPatches, []));
  }
  return normalizeEditableData(next);
}

function resolvePinnedDataForPage(req, pageId) {
  const payload = readDataForRequest(req);
  const normalizedPageId = String(pageId || "").trim();
  if (!payload.user || !normalizedPageId) return payload;
  const pinned = getPinnedView(payload.user.userId, normalizedPageId);
  const pageSnapshot = pinned?.version?.snapshotData?.pageSnapshot || null;
  if (!pageSnapshot) {
    return {
      ...payload,
      pinnedView: pinned,
      effectiveSource: payload.source,
    };
  }
  return {
    ...payload,
    data: applyPageScopedSnapshot(payload.data, pageSnapshot, normalizedPageId),
    pinnedView: pinned,
    effectiveSource: `${payload.source}:pinned-view`,
  };
}

function readWorkspaceData(userId) {
  return normalizeEditableData(JSON.parse(JSON.stringify(getWorkspace(userId).data || readEditableData())));
}

function saveDataForUser(user, data, summary) {
  return saveWorkspace(user.userId, data, summary);
}

function buildWorkspaceMetaSummary(workspace) {
  if (!workspace) return null;
  return {
    updatedAt: workspace.updatedAt || null,
    llmUsageCount: Number(workspace.llmUsageCount || 0),
    workHistory: (workspace.workHistory || []).slice(0, 20),
    requirementPlanCount: Array.isArray(workspace.requirementPlans) ? workspace.requirementPlans.length : 0,
    draftBuildCount: Array.isArray(workspace.draftBuilds) ? workspace.draftBuilds.length : 0,
    savedVersionCount: Array.isArray(workspace.savedVersions) ? workspace.savedVersions.length : 0,
    pinnedViewPageCount: workspace.pinnedViewsByPage ? Object.keys(workspace.pinnedViewsByPage).length : 0,
    pinnedViewsByPage: workspace.pinnedViewsByPage || {},
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rememberMeasurement(payload) {
  const pageId = String(payload?.pageId || "").trim();
  const source = String(payload?.source || "").trim();
  if (!pageId || !source) return;
  LIVE_MEASUREMENTS.set(`${pageId}:${source}`, {
    ...payload,
    recordedAt: new Date().toISOString(),
  });
}

function readMeasurements(pageId) {
  const result = {};
  const normalized = String(pageId || "").trim();
  for (const [key, value] of LIVE_MEASUREMENTS.entries()) {
    if (!key.startsWith(`${normalized}:`)) continue;
    result[value.source] = value;
  }
  return result;
}

function slugFromUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  const pathname = parsed.pathname.replace(/^\/+|\/+$/g, "") || "root";
  const base = pathname.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 100);
  if (!parsed.search) return base;
  const digest = crypto.createHash("sha1").update(parsed.search).digest("hex").slice(0, 8);
  return `${base}-${digest}`;
}

function slugLoose(input) {
  return String(input || "")
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function safeArray(values, limit = 20) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean))).slice(
    0,
    limit
  );
}

function archiveSlugFromUrl(rawUrl) {
  const digest = crypto.createHash("sha1").update(rawUrl).digest("hex").slice(0, 12);
  const parsed = new URL(rawUrl);
  const pagePath = parsed.pathname.replace(/^\/+|\/+$/g, "") || "root";
  const normalized = pagePath.replace(/\//g, "__").slice(0, 80);
  return `${normalized}__${digest}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function readHomeVisualMetadata() {
  const metadataPath = path.join(VISUAL_DIR, "home", "metadata.json");
  if (!fs.existsSync(metadataPath)) return null;
  return readJsonFile(metadataPath);
}

function getGnbWorkbenchSourceUrls(pageId) {
  const baseline = resolveBaselineInfo(pageId);
  return {
    referenceUrl: baseline.structuralUrl || baseline.url,
    workingUrl: `http://localhost:${PORT}/clone-content/${encodeURIComponent(pageId)}`,
  };
}

function readGnbStateArtifact(rawUrl, menu) {
  const base = `${slugLoose(rawUrl)}__${slugLoose(menu)}`;
  const jsonPath = path.join(GNB_STATE_DIR, `${base}.json`);
  const defaultPngPath = path.join(GNB_STATE_DIR, `${base}.default.png`);
  const openPngPath = path.join(GNB_STATE_DIR, `${base}.open.png`);
  if (!fs.existsSync(jsonPath)) return null;
  return {
    base,
    json: readJsonFile(jsonPath),
    jsonUrl: `/debug/gnb-state/${encodeURIComponent(`${base}.json`)}`,
    defaultImageUrl: fs.existsSync(defaultPngPath)
      ? `/debug/gnb-state/${encodeURIComponent(`${base}.default.png`)}`
      : null,
    openImageUrl: fs.existsSync(openPngPath)
      ? `/debug/gnb-state/${encodeURIComponent(`${base}.open.png`)}`
      : null,
  };
}

function summarizeGnbStateArtifact(artifact) {
  const payload = artifact?.json || {};
  const before = payload.beforeSummary?.matched || null;
  const after = payload.afterSummary?.matched || null;
  const diff = payload.diff || {};
  const activeDepth2 = (after?.depth2 || []).find((item) => String(item.classes || "").includes("active")) || null;
  const visiblePanels = (after?.depth3Panels || []).filter((item) => {
    const display = item?.style?.display;
    const width = item?.rect?.width || 0;
    const height = item?.rect?.height || 0;
    return display !== "none" && width > 0 && height > 0;
  });
  return {
    url: payload.url || "",
    menu: payload.menu || "",
    hoverResult: payload.hoverResult || "unknown",
    openStateValid: payload.openStateValid !== false,
    before: before
      ? {
          ariaExpanded: before.ariaExpanded || "",
          panelRect: before.panelRect || null,
          topStripRect: before.topStripRect || null,
          panelStyle: before.panelStyle || null,
          depth2Count: (before.depth2 || []).length,
          depth3Count: (before.depth3Panels || []).length,
          depth2Labels: (before.depth2 || []).map((item) => item.label).filter(Boolean),
        }
      : null,
    after: after
      ? {
          ariaExpanded: after.ariaExpanded || "",
          navItemClasses: after.navItemClasses || "",
          panelRect: after.panelRect || null,
          topStripRect: after.topStripRect || null,
          panelStyle: after.panelStyle || null,
          depth2Count: (after.depth2 || []).length,
          depth3Count: (after.depth3Panels || []).length,
          depth2Labels: (after.depth2 || []).map((item) => item.label).filter(Boolean),
          activeDepth2Label: activeDepth2?.label || null,
          visibleDepth3Count: visiblePanels.length,
        }
      : null,
    diff: {
      panelRectAfter: diff.panel?.rectAfter || null,
      panelStyleAfter: diff.panel?.styleAfter || null,
      depth2CountAfter: diff.depth2?.countAfter ?? null,
      depth3CountAfter: diff.depth3Panels?.countAfter ?? null,
    },
  };
}

function normalizeLgeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    return new URL(value, "https://www.lge.co.kr").toString();
  } catch (_) {
    return value;
  }
}

let cachedGnbBannerCatalog = null;
function readReferenceGnbBannerCatalog() {
  if (cachedGnbBannerCatalog) return cachedGnbBannerCatalog;
  const catalog = {};
  const artifactPath = path.join(GNB_STATE_DIR, "www-lge-co-kr-home__제품-소모품.open.cdp.json");
  if (!fs.existsSync(artifactPath)) {
    cachedGnbBannerCatalog = catalog;
    return catalog;
  }
  try {
    const payload = readJsonFile(artifactPath);
    const strings = Array.isArray(payload?.strings) ? payload.strings : [];
    const isDisplayAsset = (value) =>
      /^https:\/\/www\.lge\.co\.kr\/kr\/upload\/admin\/display\/displayObject\//.test(String(value || ""));
    const bannerStarts = [];
    strings.forEach((value, index) => {
      if (value === "CommonPcGnb_banner_list__am9D6") bannerStarts.push(index);
    });
    const isBannerKey = (value) => {
      const text = String(value || "").trim();
      return (
        text &&
        text.includes("-") &&
        !text.startsWith("/") &&
        !text.startsWith("http") &&
        !text.includes("__") &&
        !text.includes("display:") &&
        !text.includes("search=")
      );
    };
    const isBannerHref = (value) => {
      const text = String(value || "").trim();
      if (!text) return false;
      if (isDisplayAsset(text)) return false;
      return text.startsWith("/") || text.startsWith("https://www.lge.co.kr/");
    };
    bannerStarts.forEach((start, index) => {
      const nextBannerStart = bannerStarts[index + 1] ?? strings.length;
      const nextPanelStart = strings.findIndex((value, candidateIndex) => candidateIndex > start && value === "CommonPcGnb_nav_cate_list__BYpir");
      const end = nextPanelStart === -1 ? nextBannerStart : Math.min(nextBannerStart, nextPanelStart);
      for (let cursor = start + 1; cursor < end - 2; cursor += 1) {
        const key = String(strings[cursor] || "").trim();
        const href = String(strings[cursor + 1] || "").trim();
        if (!isBannerKey(key) || !isBannerHref(href)) continue;
        let imageUrl = "";
        for (let lookahead = cursor + 2; lookahead < Math.min(end, cursor + 12); lookahead += 1) {
          const candidate = String(strings[lookahead] || "").trim();
          if (isDisplayAsset(candidate)) {
            imageUrl = candidate;
            break;
          }
        }
        if (!imageUrl) continue;
        catalog[key] = {
          key,
          href: normalizeLgeUrl(href),
          imageUrl,
          kind: /300x300/.test(imageUrl) ? "featured" : "thumb",
        };
      }
    });
    if (Object.keys(catalog).length === 0) {
      cachedGnbBannerCatalog = {};
      return cachedGnbBannerCatalog;
    }
  } catch (_) {
    cachedGnbBannerCatalog = {};
    return cachedGnbBannerCatalog;
  }
  cachedGnbBannerCatalog = catalog;
  return catalog;
}

function buildGnbWorkbench(pageId, menu) {
  const normalizedPageId = String(pageId || "home").trim() || "home";
  const normalizedMenu = String(menu || "제품/소모품").trim() || "제품/소모품";
  const { referenceUrl, workingUrl } = getGnbWorkbenchSourceUrls(normalizedPageId);
  const reference = readGnbStateArtifact(referenceUrl, normalizedMenu);
  const working = readGnbStateArtifact(workingUrl, normalizedMenu);
  const referenceSummary = summarizeGnbStateArtifact(reference);
  const workingSummary = summarizeGnbStateArtifact(working);
  const refRect = referenceSummary.after?.panelRect || null;
  const workRect = workingSummary.after?.panelRect || null;
  const checks = [];
  if (!reference) checks.push({ id: "reference-artifact", status: "missing", detail: `missing ${referenceUrl}` });
  if (!working) checks.push({ id: "working-artifact", status: "missing", detail: `missing ${workingUrl}` });
  if (reference) {
    checks.push({
      id: "reference-open-state",
      status: referenceSummary.openStateValid ? "pass" : "fail",
      detail: referenceSummary.openStateValid ? "reference open snapshot valid" : "reference open snapshot did not actually open",
    });
  }
  if (working) {
    checks.push({
      id: "working-open-state",
      status: workingSummary.openStateValid ? "pass" : "fail",
      detail: workingSummary.openStateValid ? "working open snapshot valid" : "working open snapshot did not actually open",
    });
  }
  if (refRect && workRect) {
    checks.push({
      id: "panel-rect",
      status:
        refRect.x === workRect.x &&
        refRect.y === workRect.y &&
        refRect.width === workRect.width &&
        refRect.height === workRect.height
          ? "pass"
          : "fail",
      detail:
        `reference x=${refRect.x} y=${refRect.y} w=${refRect.width} h=${refRect.height} | ` +
        `working x=${workRect.x} y=${workRect.y} w=${workRect.width} h=${workRect.height}`,
    });
  }
  if (referenceSummary.after && workingSummary.after) {
    checks.push({
      id: "depth2-count",
      status: referenceSummary.after.depth2Count === workingSummary.after.depth2Count ? "pass" : "fail",
      detail: `reference=${referenceSummary.after.depth2Count} working=${workingSummary.after.depth2Count}`,
    });
    checks.push({
      id: "depth3-visible-count",
      status: referenceSummary.after.visibleDepth3Count === workingSummary.after.visibleDepth3Count ? "pass" : "fail",
      detail: `reference=${referenceSummary.after.visibleDepth3Count} working=${workingSummary.after.visibleDepth3Count}`,
    });
    checks.push({
      id: "active-depth2",
      status: referenceSummary.after.activeDepth2Label === workingSummary.after.activeDepth2Label ? "pass" : "fail",
      detail: `reference=${referenceSummary.after.activeDepth2Label || "n/a"} working=${workingSummary.after.activeDepth2Label || "n/a"}`,
    });
  }
  const menuType = (summary) => ((summary?.after?.depth2Count || 0) > 0 ? "with-depth2" : "simple-panel");
  const rectMetrics = (a, b) => {
    if (!a || !b) return null;
    const dx = Math.abs((a.x || 0) - (b.x || 0));
    const dy = Math.abs((a.y || 0) - (b.y || 0));
    const dw = Math.abs((a.width || 0) - (b.width || 0));
    const dh = Math.abs((a.height || 0) - (b.height || 0));
    return { dx, dy, dw, dh, worst: Math.max(dx, dy, dw, dh) };
  };
  const gnbGroupChecks = [];
  if (reference) {
    gnbGroupChecks.push({
      id: "gnb-open-state-reference",
      groupId: "openState",
      checkType: "valid",
      status: referenceSummary.openStateValid ? "pass" : "fail",
      detail: referenceSummary.openStateValid ? "reference open snapshot valid" : "reference open snapshot invalid",
    });
  }
  if (working) {
    gnbGroupChecks.push({
      id: "gnb-open-state-working",
      groupId: "openState",
      checkType: "valid",
      status: workingSummary.openStateValid ? "pass" : "fail",
      detail: workingSummary.openStateValid ? "working open snapshot valid" : "working open snapshot invalid",
    });
  }
  if (referenceSummary.after && workingSummary.after) {
    const typeRef = menuType(referenceSummary);
    const typeWork = menuType(workingSummary);
    gnbGroupChecks.push({
      id: "gnb-menu-type",
      groupId: "menuType",
      checkType: "value",
      status: typeRef === typeWork ? "pass" : "fail",
      detail: `reference=${typeRef} working=${typeWork}`,
    });
    const panelMetrics = rectMetrics(referenceSummary.after.panelRect, workingSummary.after.panelRect);
    if (panelMetrics) {
      gnbGroupChecks.push({
        id: "gnb-panel-rect",
        groupId: "panel",
        checkType: "rect",
        status: panelMetrics.worst > 4 ? "fail" : panelMetrics.worst > 2 ? "warning" : "pass",
        detail: `dx=${panelMetrics.dx} dy=${panelMetrics.dy} dw=${panelMetrics.dw} dh=${panelMetrics.dh}`,
        metrics: panelMetrics,
      });
    } else {
      gnbGroupChecks.push({
        id: "gnb-panel-rect",
        groupId: "panel",
        checkType: "rect",
        status: "warning",
        detail: `reference=${referenceSummary.after.panelRect ? "present" : "missing"} working=${workingSummary.after.panelRect ? "present" : "missing"}`,
      });
    }
    const stripMetrics = rectMetrics(referenceSummary.after.topStripRect, workingSummary.after.topStripRect);
    if (stripMetrics) {
      gnbGroupChecks.push({
        id: "gnb-top-strip-rect",
        groupId: "topStrip",
        checkType: "rect",
        status: stripMetrics.worst > 4 ? "fail" : stripMetrics.worst > 2 ? "warning" : "pass",
        detail: `dx=${stripMetrics.dx} dy=${stripMetrics.dy} dw=${stripMetrics.dw} dh=${stripMetrics.dh}`,
        metrics: stripMetrics,
      });
    }
    gnbGroupChecks.push({
      id: "gnb-depth2-count",
      groupId: "depth2",
      checkType: "count",
      status: referenceSummary.after.depth2Count === workingSummary.after.depth2Count ? "pass" : "fail",
      detail: `reference=${referenceSummary.after.depth2Count} working=${workingSummary.after.depth2Count}`,
    });
    gnbGroupChecks.push({
      id: "gnb-visible-depth3-count",
      groupId: "visibleDepth3",
      checkType: "count",
      status: referenceSummary.after.visibleDepth3Count === workingSummary.after.visibleDepth3Count ? "pass" : "fail",
      detail: `reference=${referenceSummary.after.visibleDepth3Count} working=${workingSummary.after.visibleDepth3Count}`,
    });
    const refLabels = referenceSummary.after.depth2Labels || [];
    const workLabels = workingSummary.after.depth2Labels || [];
    gnbGroupChecks.push({
      id: "gnb-depth2-labels",
      groupId: "depth2",
      checkType: "labels",
      status: JSON.stringify(refLabels) === JSON.stringify(workLabels) ? "pass" : "warning",
      detail: `reference=${refLabels.join(" | ") || "n/a"} working=${workLabels.join(" | ") || "n/a"}`,
    });
    gnbGroupChecks.push({
      id: "gnb-active-depth2",
      groupId: "activeDepth2",
      checkType: "value",
      status: referenceSummary.after.activeDepth2Label === workingSummary.after.activeDepth2Label ? "pass" : "fail",
      detail: `reference=${referenceSummary.after.activeDepth2Label || "n/a"} working=${workingSummary.after.activeDepth2Label || "n/a"}`,
    });
  }
  const groupSummary = buildPdpCaptureCheckSummary(gnbGroupChecks);
  return {
    pageId: normalizedPageId,
    menu: normalizedMenu,
    referenceUrl,
    workingUrl,
    reference,
    working,
    referenceSummary,
    workingSummary,
    checks,
    groupChecks: gnbGroupChecks,
    groupSummary,
  };
}

function buildPdpWorkbench(pageId, viewportProfile) {
  const targets = readWorkbenchTargets();
  const normalizedPageId = String(pageId || "category-tvs").trim() || "category-tvs";
  const normalizedViewportProfile = String(viewportProfile || "pc").trim() || "pc";
  const pdpContext = resolvePdpRuntimeContext(normalizedPageId);
  const workbenchPageId = pdpContext?.runtimePageId || normalizedPageId;
  const pdpTarget = (targets.pdpTargets || []).find(
    (item) => item.pageId === workbenchPageId && item.viewportProfile === normalizedViewportProfile
  ) || null;
  const plpTarget = (targets.plpTargets || []).find(
    (item) => item.pageId === workbenchPageId && item.viewportProfile === normalizedViewportProfile
  ) || null;
  const checks = [];
  if (!pdpTarget) {
    checks.push({ id: "target-exists", status: "fail", detail: "pdp target not found" });
  } else {
    checks.push({
      id: "target-exists",
      status: "pass",
      detail: `representativeCount=${pdpTarget.representativeCount}`,
    });
    checks.push({
      id: "representative-count",
      status: pdpTarget.representativeCount > 0 ? "pass" : "fail",
      detail: String(pdpTarget.representativeCount || 0),
    });
    checks.push({
      id: "fallback-used",
      status: pdpTarget.fallbackUsed ? "warning" : "pass",
      detail: pdpTarget.fallbackUsed ? "using fallback representative set" : "direct representative set",
    });
  }
  const representativeProducts = pdpContext
    ? [
        {
          href: pdpContext.href,
          pathname: pdpContext.route,
          text: pdpContext.title,
        },
      ]
    : (pdpTarget?.representativeProducts || []);
  const captures = representativeProducts.map((item) => {
    const matched = findPdpVisualCapture(workbenchPageId, normalizedViewportProfile, item.href, "reference");
    const working = findPdpVisualCapture(workbenchPageId, normalizedViewportProfile, item.href, "working");
    const referenceGroups = findPdpGroupEntry(workbenchPageId, normalizedViewportProfile, item.href, "reference");
    const workingGroups = findPdpGroupEntry(workbenchPageId, normalizedViewportProfile, item.href, "working");
    const groupChecks = buildPdpGroupChecks(referenceGroups?.groups, workingGroups?.groups);
    return {
      ...item,
      referenceCapture: matched
        ? {
            imageUrl: toVisualUrl(matched.artifact?.screenshotPath),
            htmlUrl: toVisualUrl(matched.artifact?.htmlPath),
            metadataUrl: toVisualUrl(matched.artifact?.metadataPath),
            capturedAt: matched.capturedAt,
            capturedUrl: matched.capturedUrl,
            title: matched.title || "",
          }
        : null,
      referenceGroups,
      workingCapture: working
        ? {
            imageUrl: toVisualUrl(working.artifact?.screenshotPath),
            htmlUrl: toVisualUrl(working.artifact?.htmlPath),
            metadataUrl: toVisualUrl(working.artifact?.metadataPath),
            capturedAt: working.capturedAt,
            capturedUrl: working.capturedUrl,
            title: working.title || "",
          }
        : null,
      workingGroups,
      groupChecks,
      groupSummary: buildPdpCaptureCheckSummary(groupChecks),
    };
  });
  if (captures.length > 0) {
    const capturedCount = captures.filter((item) => item.referenceCapture?.imageUrl).length;
    checks.push({
      id: "reference-capture-count",
      status: capturedCount === captures.length ? "pass" : capturedCount > 0 ? "warning" : "fail",
      detail: `${capturedCount}/${captures.length}`,
    });
    const workingCount = captures.filter((item) => item.workingCapture?.imageUrl).length;
    checks.push({
      id: "working-capture-count",
      status: workingCount === captures.length ? "pass" : workingCount > 0 ? "warning" : "fail",
      detail: `${workingCount}/${captures.length}`,
    });
    const referenceGroupCount = captures.filter((item) => item.referenceGroups?.groups?.summary || item.referenceGroups?.groups?.gallery).length;
    checks.push({
      id: "reference-group-count",
      status: referenceGroupCount === captures.length ? "pass" : referenceGroupCount > 0 ? "warning" : "fail",
      detail: `${referenceGroupCount}/${captures.length}`,
    });
    const workingGroupCount = captures.filter((item) => item.workingGroups?.groups?.summary || item.workingGroups?.groups?.gallery).length;
    checks.push({
      id: "working-group-count",
      status: workingGroupCount === captures.length ? "pass" : workingGroupCount > 0 ? "warning" : "fail",
      detail: `${workingGroupCount}/${captures.length}`,
    });
  }
  return {
    pageId: normalizedPageId,
    runtimePageId: workbenchPageId,
    viewportProfile: normalizedViewportProfile,
    generatedAt: targets.generatedAt || null,
    pdpTarget,
    plpTarget,
    captures,
    checks,
    groupSummary: buildPdpWorkbenchGroupSummary(captures),
  };
}

function buildPlpWorkbench(pageId, viewportProfile) {
  const targets = readWorkbenchTargets();
  const normalizedPageId = String(pageId || "category-tvs").trim() || "category-tvs";
  const normalizedViewportProfile = String(viewportProfile || "pc").trim() || "pc";
  const plpTarget = (targets.plpTargets || []).find(
    (item) => item.pageId === normalizedPageId && item.viewportProfile === normalizedViewportProfile
  ) || null;
  const checks = [];
  if (!plpTarget) {
    checks.push({ id: "target-exists", status: "fail", detail: "plp target not found" });
  } else {
    checks.push({ id: "target-exists", status: "pass", detail: `representativeCount=${plpTarget.representativeCount}` });
    checks.push({
      id: "representative-count",
      status: plpTarget.representativeCount > 0 ? "pass" : "fail",
      detail: String(plpTarget.representativeCount || 0),
    });
    checks.push({
      id: "fallback-used",
      status: plpTarget.fallbackFromViewportProfile ? "warning" : "pass",
      detail: plpTarget.fallbackFromViewportProfile
        ? `using fallback representative set from ${plpTarget.fallbackFromViewportProfile}`
        : "direct representative set",
    });
  }
  const referenceCapture = findPlpVisualCapture(normalizedPageId, normalizedViewportProfile, "reference");
  const workingCapture = findPlpVisualCapture(normalizedPageId, normalizedViewportProfile, "working");
  const referenceGroups = findPlpGroupEntry(normalizedPageId, normalizedViewportProfile, "reference");
  const workingGroups = findPlpGroupEntry(normalizedPageId, normalizedViewportProfile, "working");
  const groupChecks = buildPlpGroupChecks(referenceGroups, workingGroups);
  checks.push({
    id: "reference-capture",
    status: referenceCapture?.artifact?.screenshotPath ? "pass" : "fail",
    detail: referenceCapture?.artifact?.screenshotPath ? "available" : "missing",
  });
  checks.push({
    id: "working-capture",
    status: workingCapture?.artifact?.screenshotPath ? "pass" : "fail",
    detail: workingCapture?.artifact?.screenshotPath ? "available" : "missing",
  });
  checks.push({
    id: "reference-group-entry",
    status: referenceGroups?.groups ? "pass" : "fail",
    detail: referenceGroups?.groups ? "available" : "missing",
  });
  checks.push({
    id: "working-group-entry",
    status: workingGroups?.groups ? "pass" : "fail",
    detail: workingGroups?.groups ? "available" : "missing",
  });
  return {
    pageId: normalizedPageId,
    viewportProfile: normalizedViewportProfile,
    generatedAt: targets.generatedAt || null,
    plpTarget,
    referenceGroups,
    workingGroups,
    groupChecks,
    groupSummary: buildPdpCaptureCheckSummary(groupChecks),
    referenceCapture: referenceCapture
      ? {
          imageUrl: toVisualUrl(referenceCapture.artifact?.screenshotPath),
          htmlUrl: toVisualUrl(referenceCapture.artifact?.htmlPath),
          metadataUrl: toVisualUrl(referenceCapture.artifact?.metadataPath),
          capturedAt: referenceCapture.capturedAt,
          capturedUrl: referenceCapture.capturedUrl,
          title: referenceCapture.title || "",
        }
      : null,
    workingCapture: workingCapture
      ? {
          imageUrl: toVisualUrl(workingCapture.artifact?.screenshotPath),
          htmlUrl: toVisualUrl(workingCapture.artifact?.htmlPath),
          metadataUrl: toVisualUrl(workingCapture.artifact?.metadataPath),
          capturedAt: workingCapture.capturedAt,
          capturedUrl: workingCapture.capturedUrl,
          title: workingCapture.title || "",
        }
      : null,
    checks,
  };
}

function buildServicePageWorkbench(pageId, viewportProfile) {
  const normalizedPageId = String(pageId || "support").trim() || "support";
  const normalizedViewportProfile = String(viewportProfile || "pc").trim() || "pc";
  const sourceUrlMap = {
    support: "https://www.lge.co.kr/support",
    bestshop: "https://www.lge.co.kr/bestshop",
    "care-solutions": "https://www.lge.co.kr/care-solutions",
  };
  const sourceUrl = sourceUrlMap[normalizedPageId] || null;
  const referenceCapture = findServicePageVisualCapture(normalizedPageId, normalizedViewportProfile, "reference");
  const workingCapture = findServicePageVisualCapture(normalizedPageId, normalizedViewportProfile, "working");
  const referenceGroups = findServiceGroupEntry(normalizedPageId, normalizedViewportProfile, "reference");
  const workingGroups = findServiceGroupEntry(normalizedPageId, normalizedViewportProfile, "working");
  const normalizedReferenceGroups = normalizeGroupMap(referenceGroups?.groups);
  const normalizedWorkingGroups = normalizeGroupMap(workingGroups?.groups);
  const groupIdsByPage = {
    support: ["mainService", "notice", "tipsBanner", "bestcare"],
    bestshop: ["hero", "shortcut", "review", "brandBanner"],
    "care-solutions": ["hero", "ranking", "benefit", "tabs", "careBanner"],
  };
  const groupChecks = buildGroupChecks(normalizedReferenceGroups, normalizedWorkingGroups, groupIdsByPage[normalizedPageId] || []);
  const checks = [
    {
      id: "source-url",
      status: sourceUrl ? "pass" : "fail",
      detail: sourceUrl || "unknown service page",
    },
    {
      id: "reference-capture",
      status: referenceCapture?.artifact?.screenshotPath ? "pass" : "fail",
      detail: referenceCapture?.artifact?.screenshotPath ? "available" : "missing",
    },
    {
      id: "working-capture",
      status: workingCapture?.artifact?.screenshotPath ? "pass" : "fail",
      detail: workingCapture?.artifact?.screenshotPath ? "available" : "missing",
    },
    {
      id: "title-match",
      status:
        referenceCapture?.title && workingCapture?.title
          ? referenceCapture.title === workingCapture.title ? "pass" : "warning"
          : "warning",
      detail: `reference=${referenceCapture?.title || ""} working=${workingCapture?.title || ""}`,
    },
    {
      id: "reference-groups",
      status: referenceGroups?.groups ? "pass" : "fail",
      detail: referenceGroups?.groups ? "available" : "missing",
    },
    {
      id: "working-groups",
      status: workingGroups?.groups ? "pass" : "fail",
      detail: workingGroups?.groups ? "available" : "missing",
    },
  ];
  return {
    pageId: normalizedPageId,
    viewportProfile: normalizedViewportProfile,
    generatedAt: readServicePageVisualIndex().generatedAt || null,
    sourceUrl,
    referenceGroups: referenceGroups ? { ...referenceGroups, groups: normalizedReferenceGroups } : null,
    workingGroups: workingGroups ? { ...workingGroups, groups: normalizedWorkingGroups } : null,
    groupChecks,
    groupSummary: buildPdpCaptureCheckSummary(groupChecks),
    referenceCapture: referenceCapture
      ? {
          imageUrl: toVisualUrl(referenceCapture.artifact?.screenshotPath),
          htmlUrl: toVisualUrl(referenceCapture.artifact?.htmlPath),
          metadataUrl: toVisualUrl(referenceCapture.artifact?.metadataPath),
          capturedAt: referenceCapture.capturedAt,
          capturedUrl: referenceCapture.capturedUrl,
          title: referenceCapture.title || "",
        }
      : null,
    workingCapture: workingCapture
      ? {
          imageUrl: toVisualUrl(workingCapture.artifact?.screenshotPath),
          htmlUrl: toVisualUrl(workingCapture.artifact?.htmlPath),
          metadataUrl: toVisualUrl(workingCapture.artifact?.metadataPath),
          capturedAt: workingCapture.capturedAt,
          capturedUrl: workingCapture.capturedUrl,
          title: workingCapture.title || "",
        }
      : null,
    checks,
  };
}

function sendGnbWorkbench(res, pageId, menu) {
  const payload = buildGnbWorkbench(pageId, menu);
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GNB Workbench | ${payload.pageId}</title>
    <style>
      html, body { margin: 0; background: #0f172a; color: #e5e7eb; font-family: Arial, sans-serif; }
      .wb { min-height: 100vh; display: grid; grid-template-rows: 56px auto auto; }
      .toolbar {
        display:flex; align-items:center; justify-content:space-between;
        padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,0.12); background:#111827;
      }
      .toolbar strong { font-size: 14px; }
      .toolbar a { color:#fff; text-decoration:none; font-size:13px; margin-left:12px; }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap:2px; background:rgba(255,255,255,0.08); }
      .pane { background:#fff; color:#111827; display:grid; grid-template-rows: 40px auto auto; }
      .label { display:flex; align-items:center; padding:0 14px; font:700 12px/1 Arial,sans-serif; border-bottom:1px solid #e5e7eb; }
      .shots { display:grid; grid-template-columns: 1fr; gap:12px; padding:12px; background:#cbd5e1; }
      .shot { background:#fff; border:1px solid #cbd5e1; }
      .shot strong { display:block; padding:8px 10px; font-size:12px; border-bottom:1px solid #e5e7eb; }
      .shot img { display:block; width:100%; height:auto; background:#fff; }
      .meta, .checks { white-space:pre-wrap; overflow:auto; padding:12px; font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
      .meta { background:#f8fafc; border-top:1px solid #e5e7eb; }
      .checks { background:#eef2ff; border-top:1px solid #c7d2fe; }
    </style>
  </head>
  <body>
    <div class="wb">
      <div class="toolbar">
        <strong>GNB Workbench · ${payload.pageId} · ${payload.menu}</strong>
        <div>
          <a href="/clone/${encodeURIComponent(payload.pageId)}">clone</a>
          <a href="/compare/${encodeURIComponent(payload.pageId)}">compare</a>
          <a href="/api/gnb-workbench?pageId=${encodeURIComponent(payload.pageId)}&menu=${encodeURIComponent(payload.menu)}">api</a>
        </div>
      </div>
      <div class="grid">
        <section class="pane">
          <div class="label">Reference · ${payload.referenceUrl}</div>
          <div class="shots">
            ${payload.reference?.defaultImageUrl ? `<div class="shot"><strong>default</strong><img src="${payload.reference.defaultImageUrl}?v=${Date.now()}" alt="reference default" /></div>` : ""}
            ${payload.reference?.openImageUrl ? `<div class="shot"><strong>open</strong><img src="${payload.reference.openImageUrl}?v=${Date.now()}" alt="reference open" /></div>` : ""}
          </div>
          <pre class="meta">${escapeHtml(JSON.stringify(payload.referenceSummary, null, 2))}</pre>
        </section>
        <section class="pane">
          <div class="label">Working · ${payload.workingUrl}</div>
          <div class="shots">
            ${payload.working?.defaultImageUrl ? `<div class="shot"><strong>default</strong><img src="${payload.working.defaultImageUrl}?v=${Date.now()}" alt="working default" /></div>` : ""}
            ${payload.working?.openImageUrl ? `<div class="shot"><strong>open</strong><img src="${payload.working.openImageUrl}?v=${Date.now()}" alt="working open" /></div>` : ""}
          </div>
          <pre class="meta">${escapeHtml(JSON.stringify(payload.workingSummary, null, 2))}</pre>
        </section>
      </div>
      <pre class="checks">${escapeHtml(JSON.stringify({ checks: payload.checks, groupSummary: payload.groupSummary, groupChecks: payload.groupChecks }, null, 2))}</pre>
    </div>
  </body>
</html>`;
  return sendRawHtml(res, 200, html);
}

function sendPdpWorkbench(res, pageId, viewportProfile) {
  const payload = buildPdpWorkbench(pageId, viewportProfile);
  const products = payload.captures || [];
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PDP Workbench | ${payload.pageId}</title>
    <style>
      html, body { margin: 0; background: #0f172a; color: #e5e7eb; font-family: Arial, sans-serif; }
      .wb { min-height: 100vh; display: grid; grid-template-rows: 56px auto auto; }
      .toolbar { display:flex; align-items:center; justify-content:space-between; padding:0 16px; border-bottom:1px solid rgba(255,255,255,0.12); background:#111827; }
      .toolbar strong { font-size:14px; }
      .toolbar a { color:#fff; text-decoration:none; font-size:13px; margin-left:12px; }
      .layout { display:grid; grid-template-columns: 380px 1fr; gap:2px; background:rgba(255,255,255,0.08); }
      .pane { background:#fff; color:#111827; min-height: 320px; }
      .label { display:flex; align-items:center; padding:0 14px; height:40px; font:700 12px/1 Arial,sans-serif; border-bottom:1px solid #e5e7eb; }
      .meta, .checks { white-space:pre-wrap; overflow:auto; padding:12px; font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
      .meta { background:#f8fafc; }
      .checks { background:#eef2ff; border-top:1px solid #c7d2fe; }
      .cards { display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:12px; padding:12px; background:#e2e8f0; }
      .card { background:#fff; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; display:grid; grid-template-rows:auto 1fr auto; }
      .card-top { padding:10px 12px; border-bottom:1px solid #e5e7eb; font:700 12px/1 Arial,sans-serif; display:flex; justify-content:space-between; gap:8px; }
      .badge { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:11px; background:#eef2ff; color:#312e81; }
      .badge.warn { background:#fff7ed; color:#9a3412; }
      .shot-grid { display:grid; grid-template-columns: 1fr 1fr; gap:1px; background:#e5e7eb; border-bottom:1px solid #e5e7eb; }
      .shot { background:#f8fafc; }
      .shot strong { display:block; padding:8px 10px; font-size:11px; border-bottom:1px solid #e5e7eb; color:#475569; background:#fff; }
      .shot img { display:block; width:100%; height:auto; background:#fff; }
      .shot-empty { padding:28px 12px; text-align:center; font-size:12px; color:#64748b; }
      .card-body { padding:12px; display:grid; gap:8px; }
      .card-body .path { color:#475569; font-size:12px; word-break:break-all; }
      .card-body .text { color:#0f172a; font-size:13px; line-height:1.5; }
      .card-actions { padding:12px; border-top:1px solid #e5e7eb; display:flex; gap:8px; flex-wrap:wrap; }
      .card-actions a { text-decoration:none; color:#fff; background:#111827; padding:7px 10px; border-radius:8px; font-size:12px; }
      .card-actions a.alt { background:#475569; }
      .group-meta { padding:12px; border-top:1px solid #e5e7eb; background:#f8fafc; font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#334155; white-space:pre-wrap; overflow:auto; }
      @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="wb">
      <div class="toolbar">
        <strong>PDP Workbench · ${payload.pageId} · ${payload.viewportProfile}</strong>
        <div>
          <a href="/api/pdp-workbench?pageId=${encodeURIComponent(payload.pageId)}&viewportProfile=${encodeURIComponent(payload.viewportProfile)}">api</a>
          <a href="/api/workbench-targets?targetType=pdp&pageId=${encodeURIComponent(payload.pageId)}&viewportProfile=${encodeURIComponent(payload.viewportProfile)}">targets</a>
        </div>
      </div>
      <div class="layout">
        <section class="pane">
          <div class="label">Meta</div>
          <pre class="meta">${escapeHtml(JSON.stringify({
            generatedAt: payload.generatedAt,
            pageId: payload.pageId,
            viewportProfile: payload.viewportProfile,
            plpTarget: payload.plpTarget ? {
              sourceUrl: payload.plpTarget.sourceUrl,
              representativeCount: payload.plpTarget.representativeCount,
              fallbackFromViewportProfile: payload.plpTarget.fallbackFromViewportProfile || null,
            } : null,
            pdpTarget: payload.pdpTarget ? {
              representativeCount: payload.pdpTarget.representativeCount,
              fallbackUsed: payload.pdpTarget.fallbackUsed || false,
            } : null,
          }, null, 2))}</pre>
        </section>
        <section class="pane">
          <div class="label">Representative PDPs</div>
          <div class="cards">
            ${products.map((item) => `
              <article class="card">
                <div class="card-top">
                  <span>#${item.order}</span>
                  ${item.fallbackFromViewportProfile ? `<span class="badge warn">fallback ${escapeHtml(item.fallbackFromViewportProfile)}</span>` : `<span class="badge">${escapeHtml(item.family || "unknown")}</span>`}
                </div>
                <div class="shot-grid">
                  <div class="shot">
                    <strong>reference</strong>
                    ${item.referenceCapture?.imageUrl
                      ? `<img src="${item.referenceCapture.imageUrl}?v=${Date.now()}" alt="reference ${escapeHtml(item.pathname || item.href || "")}" />`
                      : `<div class="shot-empty">reference capture pending</div>`}
                  </div>
                  <div class="shot">
                    <strong>working</strong>
                    ${item.workingCapture?.imageUrl
                      ? `<img src="${item.workingCapture.imageUrl}?v=${Date.now()}" alt="working ${escapeHtml(item.pathname || item.href || "")}" />`
                      : `<div class="shot-empty">working capture pending</div>`}
                  </div>
                </div>
                <div class="card-body">
                  <div class="path">${escapeHtml(item.pathname || item.href || "")}</div>
                  ${item.referenceCapture?.title ? `<div class="path">${escapeHtml(item.referenceCapture.title)}</div>` : ""}
                  <div class="text">${escapeHtml(item.text || "")}</div>
                </div>
                <div class="card-actions">
                  <a href="${escapeHtml(item.href)}" target="_blank" rel="noopener">reference</a>
                  ${item.referenceCapture?.metadataUrl ? `<a class="alt" href="${item.referenceCapture.metadataUrl}" target="_blank" rel="noopener">meta</a>` : ""}
                  <a class="alt" href="/clone-product?pageId=${encodeURIComponent(payload.pageId)}&viewportProfile=${encodeURIComponent(payload.viewportProfile)}&href=${encodeURIComponent(item.href)}&title=${encodeURIComponent(item.pathname || item.href)}" target="_blank" rel="noopener">working</a>
                  ${item.workingCapture?.metadataUrl ? `<a class="alt" href="${item.workingCapture.metadataUrl}" target="_blank" rel="noopener">working meta</a>` : ""}
                  <a class="alt" href="/api/workbench-targets?targetType=pdp&pageId=${encodeURIComponent(payload.pageId)}&viewportProfile=${encodeURIComponent(payload.viewportProfile)}">registry</a>
                </div>
                <pre class="group-meta">${escapeHtml(JSON.stringify({
                  groupSummary: item.groupSummary || null,
                }, null, 2))}</pre>
                <pre class="group-meta">${escapeHtml(JSON.stringify({
                  referenceGroups: item.referenceGroups?.groups || null,
                  workingGroups: item.workingGroups?.groups || null,
                  groupChecks: item.groupChecks || [],
                }, null, 2))}</pre>
              </article>
            `).join("") || `<div class="card"><div class="card-body"><div class="text">No representative PDPs</div></div></div>`}
          </div>
        </section>
      </div>
      <pre class="checks">${escapeHtml(JSON.stringify({ checks: payload.checks, groupSummary: payload.groupSummary }, null, 2))}</pre>
    </div>
  </body>
</html>`;
  return sendRawHtml(res, 200, html);
}

function sendPlpWorkbench(res, pageId, viewportProfile) {
  const payload = buildPlpWorkbench(pageId, viewportProfile);
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PLP Workbench | ${payload.pageId}</title>
    <style>
      html, body { margin: 0; background: #0f172a; color: #e5e7eb; font-family: Arial, sans-serif; }
      .wb { min-height: 100vh; display: grid; grid-template-rows: 56px auto auto; }
      .toolbar { display:flex; align-items:center; justify-content:space-between; padding:0 16px; border-bottom:1px solid rgba(255,255,255,0.12); background:#111827; }
      .toolbar strong { font-size:14px; }
      .toolbar a { color:#fff; text-decoration:none; font-size:13px; margin-left:12px; }
      .layout { display:grid; grid-template-columns: 380px 1fr; gap:2px; background:rgba(255,255,255,0.08); }
      .pane { background:#fff; color:#111827; min-height: 320px; }
      .label { display:flex; align-items:center; padding:0 14px; height:40px; font:700 12px/1 Arial,sans-serif; border-bottom:1px solid #e5e7eb; }
      .meta, .checks { white-space:pre-wrap; overflow:auto; padding:12px; font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
      .meta { background:#f8fafc; }
      .checks { background:#eef2ff; border-top:1px solid #c7d2fe; }
      .cards { display:grid; grid-template-columns: 1fr 1fr; gap:1px; background:#e5e7eb; padding:12px; }
      .card { background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; }
      .card strong { display:block; padding:8px 10px; font-size:11px; border-bottom:1px solid #e5e7eb; color:#475569; background:#fff; }
      .card img { display:block; width:100%; height:auto; background:#fff; }
      .shot-empty { padding:28px 12px; text-align:center; font-size:12px; color:#64748b; }
      .row-products { padding:12px; border-top:1px solid #e5e7eb; background:#fff; font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre-wrap; overflow:auto; }
      @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .cards { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="wb">
      <div class="toolbar">
        <strong>PLP Workbench · ${payload.pageId} · ${payload.viewportProfile}</strong>
        <div>
          <a href="/api/plp-workbench?pageId=${encodeURIComponent(payload.pageId)}&viewportProfile=${encodeURIComponent(payload.viewportProfile)}">api</a>
          <a href="/api/workbench-targets?targetType=plp&pageId=${encodeURIComponent(payload.pageId)}&viewportProfile=${encodeURIComponent(payload.viewportProfile)}">targets</a>
        </div>
      </div>
      <div class="layout">
        <section class="pane">
          <div class="label">Meta</div>
          <pre class="meta">${escapeHtml(JSON.stringify({
            generatedAt: payload.generatedAt,
            pageId: payload.pageId,
            viewportProfile: payload.viewportProfile,
            plpTarget: payload.plpTarget ? {
              sourceUrl: payload.plpTarget.sourceUrl,
              representativeCount: payload.plpTarget.representativeCount,
              fallbackFromViewportProfile: payload.plpTarget.fallbackFromViewportProfile || null,
            } : null,
          }, null, 2))}</pre>
        </section>
        <section class="pane">
          <div class="label">Representative PLP</div>
          <div class="cards">
            <article class="card">
              <strong>reference</strong>
              ${payload.referenceCapture?.imageUrl
                ? `<img src="${payload.referenceCapture.imageUrl}?v=${Date.now()}" alt="reference ${escapeHtml(payload.pageId)}" />`
                : `<div class="shot-empty">reference capture pending</div>`}
            </article>
            <article class="card">
              <strong>working</strong>
              ${payload.workingCapture?.imageUrl
                ? `<img src="${payload.workingCapture.imageUrl}?v=${Date.now()}" alt="working ${escapeHtml(payload.pageId)}" />`
                : `<div class="shot-empty">working capture pending</div>`}
            </article>
          </div>
          <pre class="row-products">${escapeHtml(JSON.stringify({
            representativeProducts: payload.plpTarget?.representativeProducts || [],
            referenceCapture: payload.referenceCapture || null,
            workingCapture: payload.workingCapture || null,
            groupSummary: payload.groupSummary || null,
            referenceGroups: payload.referenceGroups?.groups || null,
            workingGroups: payload.workingGroups?.groups || null,
            groupChecks: payload.groupChecks || [],
          }, null, 2))}</pre>
        </section>
      </div>
      <pre class="checks">${escapeHtml(JSON.stringify({ checks: payload.checks }, null, 2))}</pre>
    </div>
  </body>
</html>`;
  return sendRawHtml(res, 200, html);
}

function sendServicePageWorkbench(res, pageId, viewportProfile) {
  const payload = buildServicePageWorkbench(pageId, viewportProfile);
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Service Workbench | ${payload.pageId}</title>
    <style>
      html, body { margin: 0; background: #0f172a; color: #e5e7eb; font-family: Arial, sans-serif; }
      .wb { min-height: 100vh; display: grid; grid-template-rows: 56px auto auto; }
      .toolbar { display:flex; align-items:center; justify-content:space-between; padding:0 16px; border-bottom:1px solid rgba(255,255,255,0.12); background:#111827; }
      .toolbar strong { font-size:14px; }
      .toolbar a { color:#fff; text-decoration:none; font-size:13px; margin-left:12px; }
      .layout { display:grid; grid-template-columns: 380px 1fr; gap:2px; background:rgba(255,255,255,0.08); }
      .pane { background:#fff; color:#111827; min-height: 320px; }
      .label { display:flex; align-items:center; padding:0 14px; height:40px; font:700 12px/1 Arial,sans-serif; border-bottom:1px solid #e5e7eb; }
      .meta, .checks { white-space:pre-wrap; overflow:auto; padding:12px; font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
      .meta { background:#f8fafc; }
      .checks { background:#eef2ff; border-top:1px solid #c7d2fe; }
      .cards { display:grid; grid-template-columns: 1fr 1fr; gap:1px; background:#e5e7eb; padding:12px; }
      .card { background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; }
      .card strong { display:block; padding:8px 10px; font-size:11px; border-bottom:1px solid #e5e7eb; color:#475569; background:#fff; }
      .card img { display:block; width:100%; height:auto; background:#fff; }
      .shot-empty { padding:28px 12px; text-align:center; font-size:12px; color:#64748b; }
      .links { padding:10px 12px; border-top:1px solid #e5e7eb; background:#fff; display:flex; gap:12px; flex-wrap:wrap; }
      .links a { color:#2563eb; text-decoration:none; font-size:12px; }
      @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .cards { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="wb">
      <div class="toolbar">
        <strong>Service Workbench · ${payload.pageId} · ${payload.viewportProfile}</strong>
        <div>
          <a href="/api/service-workbench?pageId=${encodeURIComponent(payload.pageId)}&viewportProfile=${encodeURIComponent(payload.viewportProfile)}">api</a>
          <a href="/clone/${encodeURIComponent(payload.pageId)}">clone</a>
        </div>
      </div>
      <div class="layout">
        <section class="pane">
          <div class="label">Meta</div>
          <pre class="meta">${escapeHtml(JSON.stringify({
            generatedAt: payload.generatedAt,
            pageId: payload.pageId,
            viewportProfile: payload.viewportProfile,
            sourceUrl: payload.sourceUrl,
            referenceCapture: payload.referenceCapture,
            workingCapture: payload.workingCapture,
            groupSummary: payload.groupSummary,
          }, null, 2))}</pre>
        </section>
        <section class="pane">
          <div class="label">Reference / Working</div>
          <div class="cards">
            <article class="card">
              <strong>reference</strong>
              ${payload.referenceCapture?.imageUrl
                ? `<img src="${payload.referenceCapture.imageUrl}?v=${Date.now()}" alt="reference ${escapeHtml(payload.pageId)}" />`
                : `<div class="shot-empty">reference capture pending</div>`}
              <div class="links">
                ${payload.referenceCapture?.metadataUrl ? `<a href="${payload.referenceCapture.metadataUrl}" target="_blank" rel="noopener">meta</a>` : ""}
                ${payload.referenceCapture?.htmlUrl ? `<a href="${payload.referenceCapture.htmlUrl}" target="_blank" rel="noopener">html</a>` : ""}
              </div>
            </article>
            <article class="card">
              <strong>working</strong>
              ${payload.workingCapture?.imageUrl
                ? `<img src="${payload.workingCapture.imageUrl}?v=${Date.now()}" alt="working ${escapeHtml(payload.pageId)}" />`
                : `<div class="shot-empty">working capture pending</div>`}
              <div class="links">
                ${payload.workingCapture?.metadataUrl ? `<a href="${payload.workingCapture.metadataUrl}" target="_blank" rel="noopener">meta</a>` : ""}
                ${payload.workingCapture?.htmlUrl ? `<a href="${payload.workingCapture.htmlUrl}" target="_blank" rel="noopener">html</a>` : ""}
              </div>
            </article>
          </div>
        </section>
      </div>
      <pre class="checks">${escapeHtml(JSON.stringify({ checks: payload.checks, groupSummary: payload.groupSummary, groupChecks: payload.groupChecks, referenceGroups: payload.referenceGroups?.groups || null, workingGroups: payload.workingGroups?.groups || null }, null, 2))}</pre>
    </div>
  </body>
</html>`;
  return sendRawHtml(res, 200, html);
}

function summarizeStatusFromChecks(checks = [], fallbackStatus = "pass") {
  const statuses = (checks || []).map((item) => item?.status).filter(Boolean);
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warning")) return "warning";
  return fallbackStatus;
}

function buildBooleanCheckItems(checks = {}, options = {}) {
  const labels = options.labels || {};
  return Object.entries(checks || {}).map(([id, passed]) => ({
    id,
    label: labels[id] || id,
    status: passed ? "pass" : "fail",
    detail: passed ? "matched" : "mismatch",
  }));
}

function summarizeBooleanChecks(checkItems = [], fallbackStatus = "pass") {
  return {
    status: summarizeStatusFromChecks(checkItems, fallbackStatus),
    checks: checkItems,
  };
}

function getHomeMeasurementPair(liveMeasurements, slotId) {
  const measurements = liveMeasurements?.measurements || {};
  const ref = (measurements["reference-content"]?.slots || []).find((slot) => slot.slotId === slotId) || null;
  const working = (measurements["clone-content"]?.slots || []).find((slot) => slot.slotId === slotId) || null;
  return { reference: ref, working };
}

function buildHomeMeasurementChecks(liveMeasurements, slotId, options = {}) {
  if (options.disableMeasurementComparison) {
    return {
      status: "warning",
      checks: [
        {
          id: "measurementSourceConflict",
          status: "warning",
          detail: options.disableReason || "measurement comparison disabled for this slot",
        },
      ],
      referenceRect: null,
      workingRect: null,
    };
  }
  const pair = getHomeMeasurementPair(liveMeasurements, slotId);
  if (!pair.reference || !pair.working) {
    return {
      status: "warning",
      checks: [
        {
          id: "measurementPresent",
          status: "warning",
          detail: "reference-content or clone-content measurement missing",
        },
      ],
      referenceRect: pair.reference || null,
      workingRect: pair.working || null,
    };
  }

  const dx = Math.abs((pair.reference.x || 0) - (pair.working.x || 0));
  const dy = Math.abs((pair.reference.y || 0) - (pair.working.y || 0));
  const dw = Math.abs((pair.reference.width || 0) - (pair.working.width || 0));
  const dh = Math.abs((pair.reference.height || 0) - (pair.working.height || 0));
  const rowGroupDiff = Math.abs((pair.reference.rowGroups || []).length - (pair.working.rowGroups || []).length);
  const itemDiff = Math.abs((pair.reference.items || []).length - (pair.working.items || []).length);
  const makeCheck = (id, detail, ok, warningThreshold = false) => ({
    id,
    status: ok ? "pass" : warningThreshold ? "warning" : "fail",
    detail,
  });
  const checks = [
    makeCheck("rectX", `dx=${dx}`, dx <= 2, dx <= 8),
    makeCheck("rectY", `dy=${dy}`, dy <= 2, dy <= 8),
    makeCheck("rectWidth", `dw=${dw}`, dw <= 2, dw <= 8),
    makeCheck("rectHeight", `dh=${dh}`, dh <= 2, dh <= 8),
    makeCheck("rowGroupCount", `reference=${(pair.reference.rowGroups || []).length}, working=${(pair.working.rowGroups || []).length}`, rowGroupDiff === 0, rowGroupDiff <= 1),
    makeCheck("itemCount", `reference=${(pair.reference.items || []).length}, working=${(pair.working.items || []).length}`, itemDiff === 0, itemDiff <= 1),
  ];
  return {
    status: summarizeStatusFromChecks(checks, "pass"),
    checks,
    referenceRect: pair.reference,
    workingRect: pair.working,
  };
}

function buildHomeGroupSummary(slotDiff, gnbWorkbench, liveMeasurements) {
  const slots = new Map((slotDiff?.slots || []).map((slot) => [slot.slotId, slot]));
  const booleanLabels = {
    containerModeMatch: "container mode",
    itemCountMatch: "item count",
    expectedRowsMatch: "expected rows",
    mainMenuCountMatch: "main menu count",
    brandTabCountMatch: "brand tab count",
  };
  const buildSlotGroup = (slotId, opts = {}) => {
    const slot = slots.get(slotId);
    const measurementSummary = buildHomeMeasurementChecks(liveMeasurements, slotId, {
      disableMeasurementComparison: opts.disableMeasurementComparison,
      disableReason: opts.disableMeasurementReason,
    });
    if (!slot) {
      return {
        groupId: slotId,
        status: "warning",
        note: "slot diff missing",
        checks: [
          {
            id: "slotDiffPresent",
            status: "warning",
            detail: "slot diff missing",
          },
        ],
      };
    }
    const summary = summarizeBooleanChecks(buildBooleanCheckItems(slot.checks, { labels: booleanLabels }));
    const checks = [...summary.checks, ...measurementSummary.checks];
    const derivedStatus = summarizeStatusFromChecks(checks, summary.status);
    const status = opts.forceStatus || derivedStatus;
    if (opts.extraChecks) checks.push(...opts.extraChecks);
    return {
      groupId: slotId,
      status,
      note: opts.note || null,
      checks,
      referenceLayout: slot.reference?.layout || null,
      workingLayout: slot.working?.layout || null,
      referenceRect: measurementSummary.referenceRect || null,
      workingRect: measurementSummary.workingRect || null,
    };
  };

  const buildMeasurementOnlyGroup = (groupId, opts = {}) => {
    const measurementSummary = buildHomeMeasurementChecks(liveMeasurements, groupId, {
      disableMeasurementComparison: opts.disableMeasurementComparison,
      disableReason: opts.disableMeasurementReason,
    });
    const checks = [...measurementSummary.checks, ...(opts.extraChecks || [])];
    return {
      groupId,
      status: opts.forceStatus || summarizeStatusFromChecks(checks, measurementSummary.status || "warning"),
      note: opts.note || null,
      checks,
      referenceRect: measurementSummary.referenceRect || null,
      workingRect: measurementSummary.workingRect || null,
    };
  };

  const gnbChecks = [];
  const gnbGroupSummary = gnbWorkbench?.groupSummary || null;
  if (gnbGroupSummary?.groups?.length) {
    for (const group of gnbGroupSummary.groups) {
      gnbChecks.push({
        id: group.groupId,
        status: group.status,
        detail: `gnb group ${group.groupId}`,
      });
    }
  } else {
    gnbChecks.push({
      id: "gnbWorkbenchPresent",
      status: "warning",
      detail: "gnb workbench summary missing",
    });
  }

  const groups = [
    buildSlotGroup("header-top"),
    buildSlotGroup("header-bottom"),
    buildSlotGroup("hero", {
      forceStatus: "warning",
      note: "hero는 slide/indicator interaction 기준이 아직 닫히지 않았습니다.",
      extraChecks: [
        {
          id: "visualInteractionPending",
          status: "warning",
          detail: "hero interaction baseline pending",
        },
      ],
    }),
    {
      groupId: "gnb-open-state",
      status: gnbGroupSummary?.status || "warning",
      note: "모든 1depth open-state는 GNB workbench 기준으로 확인합니다.",
      checks: gnbChecks,
    },
    buildSlotGroup("quickmenu", {
      forceStatus: "warning",
      note: "quickmenu는 구조는 맞지만 visual/token fidelity는 아직 별도 보정이 필요합니다.",
      disableMeasurementComparison: true,
      disableMeasurementReason:
        "home quickmenu는 hybrid 규칙상 mo visual truth를 따라야 하므로 reference-content(pc) rect와 직접 비교하지 않습니다.",
      extraChecks: [
        {
          id: "visualTokenPending",
          status: "warning",
          detail: "icon/outline/banner fidelity pending",
        },
      ],
    }),
    buildMeasurementOnlyGroup("md-choice", {
      forceStatus: "warning",
      note: "MD's CHOICE는 하단 카드 폭/이미지/리듬을 live reference 기준으로 추가 보정합니다.",
      extraChecks: [
        {
          id: "visualCardPending",
          status: "warning",
          detail: "card/image/title alignment pending",
        },
      ],
    }),
    buildMeasurementOnlyGroup("timedeal", {
      forceStatus: "warning",
      note: "타임딜은 카드/이미지/하단 상태바 rect를 live reference 기준으로 맞추는 중입니다.",
      extraChecks: [
        {
          id: "visualCardPending",
          status: "warning",
          detail: "card/image/bottom bar alignment pending",
        },
      ],
    }),
    {
      groupId: "quickmenu-below",
      status: "warning",
      note: "timedeal/MD/첫 하단 블록은 actual content로 교체됐지만 slide/rhythm 보정이 남아 있습니다.",
      checks: [
        {
          id: "actualContentPresent",
          status: "pass",
          detail: "timedeal and md replacement present",
        },
        {
          id: "sliderStatePending",
          status: "warning",
          detail: "item width / active slide pending",
        },
      ],
    },
    {
      groupId: "lower-content",
      status: "warning",
      note: "lower content는 section order와 rhythm 기준으로 아직 추가 분해가 필요합니다.",
      checks: [
        {
          id: "skeletonRemoved",
          status: "pass",
          detail: "home skeleton removed",
        },
        {
          id: "sectionOrderPending",
          status: "warning",
          detail: "section order / rhythm pending",
        },
      ],
    },
  ];

  const status = summarizeStatusFromChecks(groups.map((group) => ({ status: group.status })), "pass");
  return { status, groups };
}

function extractNonPassGroupIds(groupSummary) {
  return (groupSummary?.groups || [])
    .filter((group) => group?.status && group.status !== "pass")
    .map((group) => `${group.groupId}:${group.status}`);
}

function buildAcceptanceSummary() {
  const homeGnb = buildGnbWorkbench("home", "제품/소모품");
  const tvPlpPc = buildPlpWorkbench("category-tvs", "pc");
  const tvPlpMo = buildPlpWorkbench("category-tvs", "mo");
  const tvPdpPc = buildPdpWorkbench("category-tvs", "pc");
  const tvPdpMo = buildPdpWorkbench("category-tvs", "mo");
  const supportPc = buildServicePageWorkbench("support", "pc");
  const supportMo = buildServicePageWorkbench("support", "mo");

  const items = [
    {
      id: "home",
      label: "Home",
      kind: "manual-acceptance",
      backendStatus: homeGnb.groupSummary?.status || summarizeStatusFromChecks(homeGnb.checks || []),
      visualStatus: "needs-review",
      acceptancePriority: "high",
      note: "home은 현재 backend GNB 기준만 pass입니다. 전체 화면 visual acceptance는 아직 별도이며 header/hero/quickmenu/content를 직접 봐야 합니다.",
      focus: ["header", "hero", "quickmenu", "gnb-open-state"],
      links: {
        homeWorkbench: `/workbench/home`,
        clone: `/clone/home`,
        compare: `/compare/home`,
        gnbWorkbench: `/workbench/gnb?pageId=home&menu=${encodeURIComponent("제품/소모품")}`,
        gnbApi: `/api/gnb-workbench?pageId=home&menu=${encodeURIComponent("제품/소모품")}`,
      },
      backendSummary: {
        nonPassGroups: extractNonPassGroupIds(homeGnb.groupSummary),
      },
    },
    {
      id: "tv-plp-pc",
      label: "TV PLP PC",
      kind: "workbench-acceptance",
      backendStatus: tvPlpPc.groupSummary?.status || summarizeStatusFromChecks(tvPlpPc.checks || []),
      visualStatus: "likely-pass",
      acceptancePriority: "high",
      note: "filter/sort는 양쪽 모두 missing이라 warning입니다. 핵심 acceptance는 productGrid/firstRow/firstProduct/banner입니다.",
      focus: ["productGrid", "firstRow", "firstProduct", "banner"],
      links: {
        workbench: "/workbench/plp?pageId=category-tvs&viewportProfile=pc",
        api: "/api/plp-workbench?pageId=category-tvs&viewportProfile=pc",
        clone: "/clone/category-tvs",
      },
      backendSummary: {
        nonPassGroups: extractNonPassGroupIds(tvPlpPc.groupSummary),
      },
    },
    {
      id: "tv-plp-mo",
      label: "TV PLP MO",
      kind: "workbench-acceptance",
      backendStatus: tvPlpMo.groupSummary?.status || summarizeStatusFromChecks(tvPlpMo.checks || []),
      visualStatus: "likely-pass",
      acceptancePriority: "high",
      note: "mobile PLP도 core group은 정렬됐고, filter/sort missing warning만 남습니다.",
      focus: ["productGrid", "firstRow", "firstProduct", "banner"],
      links: {
        workbench: "/workbench/plp?pageId=category-tvs&viewportProfile=mo",
        api: "/api/plp-workbench?pageId=category-tvs&viewportProfile=mo",
        clone: "/clone/category-tvs",
      },
      backendSummary: {
        nonPassGroups: extractNonPassGroupIds(tvPlpMo.groupSummary),
      },
    },
    {
      id: "tv-pdp-pc",
      label: "TV PDP PC",
      kind: "workbench-acceptance",
      backendStatus: tvPdpPc.groupSummary?.status || summarizeStatusFromChecks(tvPdpPc.checks || []),
      visualStatus: "needs-fix",
      acceptancePriority: "high",
      note: "PDP는 review/qna longform과 일부 summary/option drift가 남아 있습니다. visual acceptance 전에 이 차이를 먼저 인지해야 합니다.",
      focus: ["gallery", "summary", "price", "option", "review", "qna", "sticky"],
      links: {
        workbench: "/workbench/pdp?pageId=category-tvs&viewportProfile=pc",
        api: "/api/pdp-workbench?pageId=category-tvs&viewportProfile=pc",
      },
      backendSummary: {
        nonPassGroups: extractNonPassGroupIds(tvPdpPc.groupSummary),
      },
    },
    {
      id: "tv-pdp-mo",
      label: "TV PDP MO",
      kind: "workbench-acceptance",
      backendStatus: tvPdpMo.groupSummary?.status || summarizeStatusFromChecks(tvPdpMo.checks || []),
      visualStatus: "needs-fix",
      acceptancePriority: "high",
      note: "mobile PDP는 review/qna longform 차이가 남습니다. summary/price/option/gallery는 현재 안정적인 쪽입니다.",
      focus: ["gallery", "summary", "price", "option", "review", "qna", "sticky"],
      links: {
        workbench: "/workbench/pdp?pageId=category-tvs&viewportProfile=mo",
        api: "/api/pdp-workbench?pageId=category-tvs&viewportProfile=mo",
      },
      backendSummary: {
        nonPassGroups: extractNonPassGroupIds(tvPdpMo.groupSummary),
      },
    },
    {
      id: "support-pc",
      label: "Support PC",
      kind: "workbench-acceptance",
      backendStatus: supportPc.groupSummary?.status || summarizeStatusFromChecks(supportPc.checks || []),
      visualStatus: "likely-pass",
      acceptancePriority: "medium",
      note: "support PC는 backend 기준 pass입니다. visual acceptance에서 실제 인지 품질만 보면 됩니다.",
      focus: ["mainService", "notice", "tipsBanner", "bestcare"],
      links: {
        workbench: "/workbench/service?pageId=support&viewportProfile=pc",
        api: "/api/service-workbench?pageId=support&viewportProfile=pc",
        clone: "/clone/support",
      },
      backendSummary: {
        nonPassGroups: extractNonPassGroupIds(supportPc.groupSummary),
      },
    },
    {
      id: "support-mo",
      label: "Support MO",
      kind: "workbench-acceptance",
      backendStatus: supportMo.groupSummary?.status || summarizeStatusFromChecks(supportMo.checks || []),
      visualStatus: "likely-pass",
      acceptancePriority: "medium",
      note: "support MO도 backend 기준 pass입니다. visual acceptance 체크만 남았습니다.",
      focus: ["mainService", "notice", "tipsBanner", "bestcare"],
      links: {
        workbench: "/workbench/service?pageId=support&viewportProfile=mo",
        api: "/api/service-workbench?pageId=support&viewportProfile=mo",
        clone: "/clone/support",
      },
      backendSummary: {
        nonPassGroups: extractNonPassGroupIds(supportMo.groupSummary),
      },
    },
  ];

  const counts = items.reduce(
    (acc, item) => {
      acc[item.backendStatus] = Number(acc[item.backendStatus] || 0) + 1;
      return acc;
    },
    { pass: 0, warning: 0, fail: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    items,
    counts,
  };
}

function sendAcceptanceWorkbench(res) {
  const payload = buildAcceptanceSummary();
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Visual Acceptance</title>
    <style>
      html, body { margin: 0; background: #0f172a; color: #e5e7eb; font-family: Arial, sans-serif; }
      .page { min-height: 100vh; display: grid; grid-template-rows: 56px auto; }
      .toolbar { display:flex; align-items:center; justify-content:space-between; padding:0 16px; border-bottom:1px solid rgba(255,255,255,0.12); background:#111827; }
      .toolbar strong { font-size:14px; }
      .toolbar a { color:#fff; text-decoration:none; font-size:13px; margin-left:12px; }
      .summary { padding: 16px; display:flex; gap:12px; flex-wrap:wrap; background:#111827; border-bottom:1px solid rgba(255,255,255,0.08); }
      .chip { padding:8px 10px; border-radius:999px; font-size:12px; background:#1f2937; }
      .grid { padding:16px; display:grid; gap:16px; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); }
      .card { background:#fff; color:#111827; border:1px solid #cbd5e1; border-radius:14px; overflow:hidden; display:grid; grid-template-rows:auto auto 1fr auto; }
      .card-top { padding:12px 14px; border-bottom:1px solid #e5e7eb; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .card-top strong { font-size:14px; }
      .badge { display:inline-flex; align-items:center; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:700; }
      .badge.pass { background:#dcfce7; color:#166534; }
      .badge.warning { background:#fff7ed; color:#9a3412; }
      .badge.fail { background:#fee2e2; color:#991b1b; }
      .badge.needs-review { background:#e0f2fe; color:#075985; }
      .badge.likely-pass { background:#ecfccb; color:#3f6212; }
      .badge.needs-fix { background:#fee2e2; color:#991b1b; }
      .badges { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
      .body { padding:14px; display:grid; gap:10px; }
      .meta { font-size:12px; color:#475569; line-height:1.5; }
      .focus { display:flex; gap:6px; flex-wrap:wrap; }
      .focus span { background:#eef2ff; color:#312e81; border-radius:999px; padding:4px 8px; font-size:11px; }
      .links { padding:12px 14px; border-top:1px solid #e5e7eb; display:flex; gap:8px; flex-wrap:wrap; }
      .links a { text-decoration:none; color:#fff; background:#111827; padding:7px 10px; border-radius:8px; font-size:12px; }
      .links a.alt { background:#475569; }
      .json { border-top:1px solid #e5e7eb; background:#f8fafc; padding:12px; white-space:pre-wrap; overflow:auto; font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#334155; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="toolbar">
        <strong>Visual Acceptance Summary</strong>
        <div>
          <a href="/api/acceptance-summary">api</a>
          <a href="/admin">admin</a>
        </div>
      </div>
      <div>
        <div class="summary">
          <span class="chip">pass ${payload.counts.pass}</span>
          <span class="chip">warning ${payload.counts.warning}</span>
          <span class="chip">fail ${payload.counts.fail}</span>
          <span class="chip">generated ${escapeHtml(payload.generatedAt)}</span>
        </div>
        <div class="grid">
          ${payload.items.map((item) => `
            <article class="card">
              <div class="card-top">
                <strong>${escapeHtml(item.label)}</strong>
                <div class="badges">
                  <span class="badge ${escapeHtml(item.backendStatus)}">backend ${escapeHtml(item.backendStatus)}</span>
                  <span class="badge ${escapeHtml(item.visualStatus)}">visual ${escapeHtml(item.visualStatus)}</span>
                </div>
              </div>
              <div class="body">
                <div class="meta">${escapeHtml(item.note || "")}</div>
                <div class="meta">acceptancePriority: ${escapeHtml(item.acceptancePriority || "medium")}</div>
                <div class="focus">${(item.focus || []).map((focus) => `<span>${escapeHtml(focus)}</span>`).join("")}</div>
              </div>
              <div class="links">
                ${Object.entries(item.links || {}).map(([key, href]) => `<a class="${key === "api" ? "alt" : ""}" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(key)}</a>`).join("")}
              </div>
              <pre class="json">${escapeHtml(JSON.stringify(item.backendSummary || {}, null, 2))}</pre>
            </article>
          `).join("")}
        </div>
      </div>
    </div>
  </body>
</html>`;
  return sendRawHtml(res, 200, html);
}

function buildHomeWorkbench() {
  const metadata = readHomeVisualMetadata();
  const coverage = buildCoverageModel("home");
  const shots = metadata?.screenshots || {};
  const slotDiff = metadata?.slotDiff || null;
  const liveMeasurements = metadata?.liveMeasurements || null;
  const gnbWorkbench = buildGnbWorkbench("home", "제품/소모품");
  const groupSummary = buildHomeGroupSummary(slotDiff, gnbWorkbench, liveMeasurements);
  const screenshotSummary = Object.fromEntries(
    Object.entries(shots).map(([key, value]) => [
      key,
      {
        url: value?.url || null,
        imageUrl: toVisualUrl(value?.path),
      },
    ])
  );
  return {
    generatedAt: new Date().toISOString(),
    pageId: "home",
    baseline: coverage.baseline,
    pageStatus: coverage.pageStatus,
    screenshots: screenshotSummary,
    slotDiff,
    liveMeasurements,
    groupSummary,
    coverage: {
      pageStatus: coverage.pageStatus,
      slotStatus: (coverage.slots || []).map((slot) => ({
        slotId: slot.slotId,
        status: slot.status,
        hasReference: slot.hasReference,
        hasWorking: slot.hasWorking,
        hasMeasurement: slot.hasMeasurement,
      })),
      stateStatus: (coverage.states || []).map((state) => ({
        stateId: state.stateId,
        status: state.status,
      })),
      interactionStatus: coverage.interactionStatus,
    },
    focus: [
      "header-top",
      "header-bottom",
      "hero",
      "quickmenu",
      "quickmenu-below-content",
      "gnb-open-state",
    ],
    note:
      "home은 backend GNB 기준과 slot diff는 어느 정도 정리됐지만, 전체 visual acceptance는 아직 수동 확인이 필요합니다. compare/clone/workbench 이미지를 같이 봐야 합니다.",
  };
}

function sendHomeWorkbench(res) {
  const payload = buildHomeWorkbench();
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Home Workbench</title>
    <style>
      html, body { margin: 0; background: #0f172a; color: #e5e7eb; font-family: Arial, sans-serif; }
      .page { min-height: 100vh; display: grid; grid-template-rows: 56px auto auto; }
      .toolbar { display:flex; align-items:center; justify-content:space-between; padding:0 16px; border-bottom:1px solid rgba(255,255,255,0.12); background:#111827; }
      .toolbar strong { font-size:14px; }
      .toolbar a { color:#fff; text-decoration:none; font-size:13px; margin-left:12px; }
      .summary { padding:16px; background:#111827; border-bottom:1px solid rgba(255,255,255,0.08); display:grid; gap:8px; }
      .summary .meta { font-size:12px; color:#cbd5e1; }
      .focus { display:flex; gap:6px; flex-wrap:wrap; }
      .focus span { background:#1e293b; padding:4px 8px; border-radius:999px; font-size:11px; }
      .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap:12px; padding:16px; }
      .card { background:#fff; color:#111827; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; }
      .card strong { display:block; padding:10px 12px; border-bottom:1px solid #e5e7eb; font-size:12px; }
      .card img { display:block; width:100%; height:auto; background:#fff; }
      .empty { padding:24px 12px; color:#64748b; font-size:12px; text-align:center; }
      .json { background:#f8fafc; padding:12px; white-space:pre-wrap; overflow:auto; font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#334155; border-top:1px solid #e5e7eb; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="toolbar">
        <strong>Home Workbench</strong>
        <div>
          <a href="/clone/home">clone</a>
          <a href="/compare/home">compare</a>
          <a href="/workbench/gnb?pageId=home&menu=${encodeURIComponent("제품/소모품")}">gnb</a>
          <a href="/api/home-workbench">api</a>
        </div>
      </div>
      <div class="summary">
        <div class="meta">pageStatus: ${escapeHtml(payload.pageStatus || "unknown")}</div>
        <div class="meta">groupSummary: ${escapeHtml(payload.groupSummary?.status || "unknown")}</div>
        <div class="meta">${escapeHtml(payload.note || "")}</div>
        <div class="focus">${(payload.focus || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <div class="grid">
        ${["live-reference", "reference-replay", "working", "compare"].map((key) => `
          <article class="card">
            <strong>${escapeHtml(key)}</strong>
            ${payload.screenshots?.[key]?.imageUrl
              ? `<img src="${payload.screenshots[key].imageUrl}?v=${Date.now()}" alt="${escapeHtml(key)}" />`
              : `<div class="empty">missing screenshot</div>`}
          </article>
        `).join("")}
      </div>
      <div class="grid">
        <article class="card">
          <strong>Home Group Summary</strong>
          <pre class="json">${escapeHtml(JSON.stringify(payload.groupSummary || null, null, 2))}</pre>
        </article>
        <article class="card">
          <strong>Coverage</strong>
          <pre class="json">${escapeHtml(JSON.stringify(payload.coverage, null, 2))}</pre>
        </article>
        <article class="card">
          <strong>Slot Diff</strong>
          <pre class="json">${escapeHtml(JSON.stringify(payload.slotDiff?.slots || null, null, 2))}</pre>
        </article>
        <article class="card">
          <strong>Live Measurements</strong>
          <pre class="json">${escapeHtml(JSON.stringify(payload.liveMeasurements || null, null, 2))}</pre>
        </article>
      </div>
    </div>
  </body>
</html>`;
  return sendRawHtml(res, 200, html);
}

function readArchiveIndex() {
  try {
    const raw = fs.readFileSync(ARCHIVE_INDEX_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function findPage(data, pageId) {
  return (data.pages || []).find((page) => page.id === pageId) || null;
}

function findSlotRegistry(data, pageId) {
  return (data.slotRegistries || []).find((item) => item.pageId === pageId) || null;
}

function findSlotConfig(data, pageId, slotId) {
  const registry = findSlotRegistry(data, pageId);
  return (registry?.slots || []).find((slot) => slot.slotId === slotId) || null;
}

function listComponentPatches(data, pageId = "") {
  const patches = Array.isArray(data?.componentPatches) ? data.componentPatches : [];
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return patches;
  return patches.filter((entry) => String(entry.pageId || "").trim() === normalizedPageId);
}

function findComponentPatch(data, pageId, componentId, sourceId = "") {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  const patches = listComponentPatches(data, normalizedPageId);
  if (!normalizedComponentId) return null;
  const exact =
    patches.find(
      (entry) =>
        String(entry.componentId || "").trim() === normalizedComponentId &&
        String(entry.sourceId || "").trim() === normalizedSourceId
    ) || null;
  if (exact) return exact;
  return (
    patches.find(
      (entry) =>
        String(entry.componentId || "").trim() === normalizedComponentId &&
        !String(entry.sourceId || "").trim()
    ) || null
  );
}

function upsertComponentPatch(data, pageId, componentId, sourceId, patch) {
  const nextData = JSON.parse(JSON.stringify(data || {}));
  nextData.componentPatches = Array.isArray(nextData.componentPatches) ? nextData.componentPatches : [];
  const normalizedPageId = String(pageId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  const nextPatch = patch && typeof patch === "object" ? JSON.parse(JSON.stringify(patch)) : {};
  const existingIndex = nextData.componentPatches.findIndex(
    (entry) =>
      String(entry.pageId || "").trim() === normalizedPageId &&
      String(entry.componentId || "").trim() === normalizedComponentId &&
      String(entry.sourceId || "").trim() === normalizedSourceId
  );
  const record = {
    pageId: normalizedPageId,
    componentId: normalizedComponentId,
    sourceId: normalizedSourceId,
    patch: nextPatch,
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) nextData.componentPatches[existingIndex] = record;
  else nextData.componentPatches.push(record);
  return nextData;
}

function listAcceptanceResults(data, pageId = "") {
  const items = Array.isArray(data?.acceptanceResults) ? data.acceptanceResults : [];
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return items;
  return items.filter((entry) => String(entry.pageId || "").trim() === normalizedPageId);
}

function findAcceptanceResult(data, bundleId) {
  const normalizedBundleId = String(bundleId || "").trim();
  if (!normalizedBundleId) return null;
  return listAcceptanceResults(data).find((entry) => String(entry.bundleId || "").trim() === normalizedBundleId) || null;
}

function upsertAcceptanceResult(data, bundle, status, note = "") {
  const nextData = JSON.parse(JSON.stringify(data || {}));
  nextData.acceptanceResults = Array.isArray(nextData.acceptanceResults) ? nextData.acceptanceResults : [];
  const normalizedBundleId = String(bundle?.bundleId || "").trim();
  const normalizedStatus = ["pass", "fail", "pending"].includes(String(status || "").trim()) ? String(status || "").trim() : "pending";
  const existingIndex = nextData.acceptanceResults.findIndex(
    (entry) => String(entry.bundleId || "").trim() === normalizedBundleId
  );
  const record = {
    bundleId: normalizedBundleId,
    pageId: String(bundle?.pageId || "").trim(),
    title: String(bundle?.title || normalizedBundleId).trim(),
    status: normalizedStatus,
    note: String(note || "").trim(),
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) nextData.acceptanceResults[existingIndex] = record;
  else nextData.acceptanceResults.push(record);
  return nextData;
}

function getActiveSourceConfig(data, pageId, slotId) {
  const slot = findSlotConfig(data, pageId, slotId);
  if (!slot) return null;
  return (slot.sources || []).find((source) => source.sourceId === slot.activeSourceId) || null;
}

function getActiveSourceId(data, pageId, slotId, fallback = "") {
  const slot = findSlotConfig(data, pageId, slotId);
  if (!slot || typeof slot.activeSourceId !== "string" || !slot.activeSourceId.trim()) return fallback;
  return slot.activeSourceId.trim();
}

function inferSourceTypeFromId(sourceId = "") {
  const normalized = String(sourceId || "").trim();
  if (!normalized) return null;
  if (normalized.startsWith("figma-")) return "figma-derived";
  if (normalized.startsWith("custom-") || normalized === "custom-renderer") return "custom";
  if (normalized.startsWith("captured-")) return "captured";
  if (normalized === "mobile-derived") return "mobile-derived";
  if (normalized === "pc-like") return "pc-like";
  return null;
}

function resolveComponentSourceResolution(pageId, slotId, activeSourceId = "", data = null) {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedSlotId = String(slotId || "").trim();
  const normalizedSourceId = String(activeSourceId || "").trim();
  const activeSourceConfig =
    data && normalizedPageId && normalizedSlotId
      ? getActiveSourceConfig(data, normalizedPageId, normalizedSlotId)
      : null;
  const activeSourceType = activeSourceConfig?.sourceType || inferSourceTypeFromId(normalizedSourceId);
  const direct = (resolvedRenderSourceId, detail = "") => ({
    activeSourceId: normalizedSourceId || null,
    activeSourceType: activeSourceType || null,
    sourceResolution: "direct",
    renderMode: "direct",
    resolvedRenderSourceId: resolvedRenderSourceId || normalizedSourceId || null,
    resolvedRenderSourceType: inferSourceTypeFromId(resolvedRenderSourceId || normalizedSourceId) || activeSourceType || null,
    detail: detail || null,
  });
  const fallback = (resolvedRenderSourceId, sourceResolution, detail = "") => ({
    activeSourceId: normalizedSourceId || null,
    activeSourceType: activeSourceType || null,
    sourceResolution,
    renderMode: "fallback",
    resolvedRenderSourceId: resolvedRenderSourceId || null,
    resolvedRenderSourceType: inferSourceTypeFromId(resolvedRenderSourceId) || null,
    detail: detail || null,
  });

  if (!normalizedSourceId) {
    return {
      activeSourceId: null,
      activeSourceType: null,
      sourceResolution: "missing",
      renderMode: "missing",
      resolvedRenderSourceId: null,
      resolvedRenderSourceType: null,
      detail: "missing activeSourceId",
    };
  }

  if (normalizedPageId !== "home") {
    return direct(
      normalizedSourceId,
      activeSourceType === "figma-derived" || activeSourceType === "custom"
        ? "non-home generic render uses active source metadata"
        : "direct render path"
    );
  }

  if (normalizedSlotId === "hero" || normalizedSlotId === "best-ranking") {
    return direct(normalizedSourceId, "explicit renderer path is implemented");
  }

  if (normalizedSlotId === "brand-showroom") {
    if (normalizedSourceId === "custom-home-brand-showroom-v1") {
      return direct(normalizedSourceId, "custom renderer is implemented");
    }
    if (normalizedSourceId === "mobile-derived") {
      return direct(normalizedSourceId, "mobile-derived renderer is active");
    }
    return fallback("mobile-derived", "fallback-mobile-derived", "active source falls back to mobile-derived renderer");
  }

  if (normalizedSlotId === "latest-product-news") {
    if (normalizedSourceId === "custom-home-latest-product-news-v1") {
      return direct(normalizedSourceId, "custom renderer is implemented");
    }
    if (normalizedSourceId === "mobile-derived") {
      return direct(normalizedSourceId, "mobile-derived renderer is active");
    }
    return fallback("mobile-derived", "fallback-mobile-derived", "active source falls back to mobile-derived renderer");
  }

  if (["space-renewal", "subscription", "smart-life", "summary-banner-2", "missed-benefits", "lg-best-care", "bestshop-guide"].includes(normalizedSlotId)) {
    if (normalizedSourceId === "mobile-derived") {
      return direct(normalizedSourceId, "mobile-derived renderer is active");
    }
    return fallback("mobile-derived", "fallback-mobile-derived", "active source falls back to mobile-derived renderer");
  }

  if (normalizedSlotId === "quickmenu") {
    if (normalizedSourceId === "captured-home-quickmenu") {
      return direct(normalizedSourceId, "captured quickmenu renderer is active");
    }
    return fallback("mobile-derived", "fallback-mobile-derived", "active source falls back to quickmenu mobile-derived renderer");
  }

  if (normalizedSlotId === "md-choice" || normalizedSlotId === "timedeal") {
    if (normalizedSourceId.startsWith("captured-home-")) {
      return direct(normalizedSourceId, "captured product section renderer is active");
    }
    return fallback("mobile-derived", "fallback-mobile-derived", "active source falls back to mobile-derived renderer");
  }

  if (normalizedSlotId === "header-top" || normalizedSlotId === "header-bottom") {
    if (normalizedSourceId.startsWith("captured-home-")) {
      return direct(normalizedSourceId, "captured header renderer is active");
    }
    return fallback("pc-like", "fallback-pc-like", "active source falls back to pc-like header shell");
  }

  return direct(normalizedSourceId, "direct render path");
}

function isCapturedSourceActive(data, pageId, slotId) {
  const active = getActiveSourceConfig(data, pageId, slotId);
  return active?.sourceType === "captured";
}

function updatePageSections(page, mutate) {
  const nextPage = JSON.parse(JSON.stringify(page));
  mutate(nextPage);
  nextPage.sections = (nextPage.sections || []).sort((a, b) => a.order - b.order);
  return nextPage;
}

function persistPage(nextPage) {
  const data = readEditableData();
  const nextData = {
    ...data,
    pages: (data.pages || []).map((page) => (page.id === nextPage.id ? nextPage : page)),
  };
  writeEditableData(nextData);
  return nextData;
}

function buildArchivePageMap() {
  const archive = readArchiveIndex();
  const map = {};
  for (const row of archive) {
    try {
      map[slugFromUrl(row.url)] = row;
    } catch {
      // ignore malformed urls
    }
  }
  return map;
}

function getArchiveRowByPageId(pageId) {
  const archiveMap = buildArchivePageMap();
  return archiveMap[pageId] || null;
}

function readArchiveHtmlByPageId(pageId) {
  const archive = getArchiveRowByPageId(pageId);
  if (archive) {
    const archiveSlug = archiveSlugFromUrl(archive.url);
    const htmlPath = path.join(ARCHIVE_PAGES_DIR, `${archiveSlug}.html`);
    if (fs.existsSync(htmlPath)) return fs.readFileSync(htmlPath, "utf-8");
  }
  const normalized = String(pageId || "").trim();
  if (!normalized) return null;
  try {
    const match = fs
      .readdirSync(ARCHIVE_PAGES_DIR)
      .find((name) => name.startsWith(`${normalized}__`) && name.endsWith(".html"));
    if (!match) return null;
    return fs.readFileSync(path.join(ARCHIVE_PAGES_DIR, match), "utf-8");
  } catch {
    return null;
  }
}

function readReferenceLiveHtml(fileName) {
  const filePath = path.join(REFERENCE_LIVE_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

function readReferenceLiveFallbackHtml(fileName) {
  const filePath = path.join(REFERENCE_LIVE_FALLBACK_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

function readHomeDesktopHtml() {
  return readReferenceLiveHtml("home.desktop.html") || readArchiveHtmlByPageId("home");
}

function readHomeMobileHtml() {
  return (
    readReferenceLiveFallbackHtml("home.mobile.html") ||
    readReferenceLiveHtml("home.mobile.html") ||
    readArchiveHtmlByPageId("home")
  );
}

function extractStylesheetHrefs(rawHtml) {
  if (!rawHtml) return [];
  return Array.from(rawHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/gi)).map((match) => match[1]);
}

function extractMissingStylesheetLinks(targetHtml, sourceHtml) {
  const existing = new Set(extractStylesheetHrefs(targetHtml));
  if (!sourceHtml) return [];
  return Array.from(
    sourceHtml.matchAll(/(<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>)/gi)
  )
    .filter((match) => !existing.has(match[2]))
    .map((match) => match[1]);
}

function injectExtraHeadLinks(html, links) {
  if (!links.length) return html;
  return html.replace("</head>", `${links.join("")}</head>`);
}

function readReferenceSourceHtmlByPageId(pageId) {
  const baseline = resolveBaselineInfo(pageId);
  if (baseline.mode === "hybrid" && pageId === "home") {
    return readHomeDesktopHtml();
  }
  return readArchiveHtmlByPageId(pageId);
}

function readPlpReferenceHtml(pageId, viewportProfile = "pc") {
  const profile = viewportProfile === "mo" ? "mo" : "pc";
  const filePath = path.join(ROOT, "data", "visual", "plp", pageId, profile, "reference.html");
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

function readCloneSourceHtmlByPageId(pageId, viewportProfile = "pc") {
  if (pageId === "home") {
    return readHomeDesktopHtml();
  }
  if (String(pageId || "").startsWith("category-")) {
    return readPlpReferenceHtml(pageId, viewportProfile);
  }
  return readArchiveHtmlByPageId(pageId);
}

const PDP_CASE_PAGE_CONFIG = {
  "pdp-tv-general": {
    runtimePageId: "category-tvs",
    href: "https://www.lge.co.kr/tvs/32lq635bkna-stand",
    title: "PDP - TV 일반형",
  },
  "pdp-tv-premium": {
    runtimePageId: "category-tvs",
    href: "https://www.lge.co.kr/tvs/oled97g5kna-stand",
    title: "PDP - TV 프리미엄형",
  },
  "pdp-refrigerator-general": {
    runtimePageId: "category-refrigerators",
    href: "https://www.lge.co.kr/refrigerators/t873mee111",
    title: "PDP - 냉장고 일반형",
  },
  "pdp-refrigerator-knockon": {
    runtimePageId: "category-refrigerators",
    href: "https://www.lge.co.kr/refrigerators/t875mee412",
    title: "PDP - 냉장고 노크온형",
  },
  "pdp-refrigerator-glass": {
    runtimePageId: "category-refrigerators",
    href: "https://www.lge.co.kr/refrigerators/h875gbb111",
    title: "PDP - 냉장고 글라스형",
  },
};

function isPdpCasePageId(pageId) {
  return Boolean(PDP_CASE_PAGE_CONFIG[String(pageId || "").trim()]);
}

function resolvePdpRuntimeContext(pageId, href = "") {
  const normalizedPageId = String(pageId || "").trim();
  const config = PDP_CASE_PAGE_CONFIG[normalizedPageId];
  if (!config) return null;
  const resolvedHref = String(href || config.href || "").trim() || String(config.href || "").trim();
  let route = "/";
  try {
    route = new URL(resolvedHref).pathname || "/";
  } catch {
    route = "/";
  }
  return {
    workspacePageId: normalizedPageId,
    runtimePageId: String(config.runtimePageId || "").trim(),
    href: resolvedHref,
    route,
    title: String(config.title || normalizedPageId).trim(),
  };
}

function resolveBaselineInfo(pageId) {
  const normalized = String(pageId || "home").trim() || "home";
  if (normalized === "home") {
    return {
      pageId: normalized,
      url: "https://www.lge.co.kr/m/home",
      route: "/m/home",
      mode: "hybrid",
      source: "rule:hybrid-home",
      visualUrl: "https://www.lge.co.kr/m/home",
      visualRoute: "/m/home",
      structuralUrl: "https://www.lge.co.kr/home",
      structuralRoute: "/home",
      zones: [
        {
          zoneId: "header-zone",
          mode: "desktop-like",
          sourceUrl: "https://www.lge.co.kr/home",
          sourceRoute: "/home",
          slotIds: ["header-top", "header-bottom"],
        },
        {
          zoneId: "hero-zone",
          mode: "desktop-like",
          sourceUrl: "https://www.lge.co.kr/home",
          sourceRoute: "/home",
          slotIds: ["hero"],
        },
        {
          zoneId: "content-zone",
          mode: "mobile-like",
          sourceUrl: "https://www.lge.co.kr/m/home",
          sourceRoute: "/m/home",
          slotIds: ["quickmenu"],
        },
      ],
    };
  }
  if (normalized.startsWith("category-")) {
    const slug = normalized.slice("category-".length).trim();
    if (slug) {
      return {
        pageId: normalized,
        url: `https://www.lge.co.kr/m/category/${slug}`,
        route: `/m/category/${slug}`,
        mode: "mobile",
        source: "rule:mobile-category",
      };
    }
  }
  const pdpContext = resolvePdpRuntimeContext(normalized);
  if (pdpContext) {
    return {
      pageId: normalized,
      url: pdpContext.href,
      route: pdpContext.route,
      mode: "product-detail",
      source: "rule:pdp-case",
      runtimePageId: pdpContext.runtimePageId,
    };
  }
  const archive = getArchiveRowByPageId(normalized);
  if (archive?.url) {
    const parsed = new URL(archive.url);
    return {
      pageId: normalized,
      url: archive.url,
      route: `${parsed.pathname}${parsed.search || ""}`,
      mode: "desktop",
      source: "archive",
    };
  }
  return {
    pageId: normalized,
    url: `https://www.lge.co.kr/${normalized}`,
    route: `/${normalized}`,
    mode: "desktop",
    source: "fallback",
  };
}

function snapshotMatchesBaseline(snapshot, baseline) {
  if (!snapshot || !baseline) return false;
  if (baseline.mode === "hybrid" && baseline.pageId === "home") {
    return (
      snapshot.mode === "hybrid" ||
      snapshot.visualUrl === baseline.visualUrl ||
      snapshot.structuralUrl === baseline.structuralUrl ||
      snapshot.url === baseline.url
    );
  }
  return snapshot.url === baseline.url;
}

function readSlotSnapshot(pageId, source = "reference") {
  const safePageId = String(pageId || "").trim();
  const safeSource = String(source || "reference").trim();
  if (!safePageId) return null;
  const filePath = path.join(SLOT_SNAPSHOT_DIR, `${safeSource}.${safePageId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readInteractionSnapshot(pageId, source = "reference") {
  const safePageId = String(pageId || "").trim();
  const safeSource = String(source || "reference").trim();
  if (!safePageId) return null;
  const filePath = path.join(INTERACTION_SNAPSHOT_DIR, `${safeSource}.${safePageId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readWorkbenchTargets() {
  if (!fs.existsSync(WORKBENCH_TARGETS_PATH)) {
    return { generatedAt: null, plpTargets: [], pdpTargets: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(WORKBENCH_TARGETS_PATH, "utf-8"));
  } catch {
    return { generatedAt: null, plpTargets: [], pdpTargets: [] };
  }
}

function readPdpVisualIndex() {
  if (!fs.existsSync(PDP_VISUAL_INDEX_PATH)) {
    return { generatedAt: null, captures: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PDP_VISUAL_INDEX_PATH, "utf-8"));
  } catch {
    return { generatedAt: null, captures: [] };
  }
}

function normalizeLgeAbsoluteUrl(rawHref) {
  try {
    return new URL(String(rawHref || "").trim(), "https://www.lge.co.kr").toString();
  } catch {
    return String(rawHref || "").trim();
  }
}

function buildPdpCapturePageMap(viewportProfile = "pc") {
  const visualIndex = readPdpVisualIndex();
  const map = {};
  for (const capture of visualIndex.captures || []) {
    if (String(capture.sourceType || "reference") !== "reference") continue;
    if (viewportProfile && capture.viewportProfile !== viewportProfile) continue;
    const href = normalizeLgeAbsoluteUrl(capture.href || "");
    if (!href || !capture.pageId) continue;
    if (!map[href]) {
      map[href] = {
        pageId: capture.pageId,
        viewportProfile: capture.viewportProfile || viewportProfile || "pc",
      };
    }
  }
  return map;
}

function readPlpVisualIndex() {
  if (!fs.existsSync(PLP_VISUAL_INDEX_PATH)) {
    return { generatedAt: null, captures: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PLP_VISUAL_INDEX_PATH, "utf-8"));
  } catch {
    return { generatedAt: null, captures: [] };
  }
}

function readServicePageVisualIndex() {
  if (!fs.existsSync(SERVICE_PAGE_VISUAL_INDEX_PATH)) {
    return { generatedAt: null, captures: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(SERVICE_PAGE_VISUAL_INDEX_PATH, "utf-8"));
  } catch {
    return { generatedAt: null, captures: [] };
  }
}

function readHomeLinkCoverageReport() {
  if (!fs.existsSync(HOME_LINK_COVERAGE_REPORT_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(HOME_LINK_COVERAGE_REPORT_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function readVisualBatchSummary() {
  if (!fs.existsSync(VISUAL_BATCH_SUMMARY_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(VISUAL_BATCH_SUMMARY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function readServiceGroupIndex() {
  if (!fs.existsSync(SERVICE_GROUPS_INDEX_PATH)) {
    return { generatedAt: null, entries: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(SERVICE_GROUPS_INDEX_PATH, "utf-8"));
  } catch {
    return { generatedAt: null, entries: [] };
  }
}

function readPdpGroupIndex() {
  if (!fs.existsSync(PDP_GROUPS_INDEX_PATH)) {
    return { generatedAt: null, entries: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PDP_GROUPS_INDEX_PATH, "utf-8"));
  } catch {
    return { generatedAt: null, entries: [] };
  }
}

function readPlpGroupIndex() {
  if (!fs.existsSync(PLP_GROUPS_INDEX_PATH)) {
    return { generatedAt: null, entries: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PLP_GROUPS_INDEX_PATH, "utf-8"));
  } catch {
    return { generatedAt: null, entries: [] };
  }
}

function findPdpVisualCapture(pageId, viewportProfile, href, sourceType = "reference") {
  const visualIndex = readPdpVisualIndex();
  return (
    (visualIndex.captures || []).find(
      (capture) =>
        capture.pageId === pageId &&
        capture.viewportProfile === viewportProfile &&
        capture.href === href &&
        String(capture.sourceType || "reference") === sourceType
    ) || null
  );
}

function findPlpVisualCapture(pageId, viewportProfile, sourceType = "reference") {
  const visualIndex = readPlpVisualIndex();
  return (
    (visualIndex.captures || []).find(
      (capture) =>
        capture.pageId === pageId &&
        capture.viewportProfile === viewportProfile &&
        String(capture.sourceType || "reference") === sourceType
    ) || null
  );
}

function findServicePageVisualCapture(pageId, viewportProfile, sourceType = "reference") {
  const visualIndex = readServicePageVisualIndex();
  return (
    (visualIndex.captures || []).find(
      (capture) =>
        capture.pageId === pageId &&
        capture.viewportProfile === viewportProfile &&
        String(capture.sourceType || "reference") === sourceType
    ) || null
  );
}

function findServiceGroupEntry(pageId, viewportProfile, sourceType = "reference") {
  const groupIndex = readServiceGroupIndex();
  return (
    (groupIndex.entries || []).find(
      (entry) =>
        entry.pageId === pageId &&
        entry.viewportProfile === viewportProfile &&
        String(entry.sourceType || "reference") === sourceType
    ) || null
  );
}

function normalizeGroupMap(groups) {
  const source = groups && typeof groups === "object" ? groups : {};
  return Object.fromEntries(
    Object.entries(source).map(([groupId, value]) => [
      groupId,
      {
        ...value,
        found:
          typeof value?.found === "boolean"
            ? value.found
            : Boolean(value?.matchCount > 0 || value?.rect || value?.selector),
      },
    ])
  );
}

function findPlpGroupEntry(pageId, viewportProfile, sourceType = "reference") {
  const groupIndex = readPlpGroupIndex();
  return (
    (groupIndex.entries || []).find(
      (entry) =>
        entry.pageId === pageId &&
        entry.viewportProfile === viewportProfile &&
        String(entry.sourceType || "reference") === sourceType
    ) || null
  );
}

function findPdpGroupEntry(pageId, viewportProfile, href, sourceType = "reference") {
  const groupIndex = readPdpGroupIndex();
  return (
    (groupIndex.entries || []).find(
      (entry) =>
        entry.pageId === pageId &&
        entry.viewportProfile === viewportProfile &&
        entry.href === href &&
        String(entry.sourceType || "reference") === sourceType
    ) || null
  );
}

function buildGroupChecks(referenceGroups, workingGroups, groupIds) {
  const checks = [];
  for (const groupId of groupIds) {
    const reference = referenceGroups?.[groupId] || null;
    const working = workingGroups?.[groupId] || null;
    checks.push({
      id: `group-${groupId}-presence`,
      groupId,
      checkType: "presence",
      status:
        reference?.found && working?.found
          ? "pass"
          : !reference?.found && !working?.found
            ? "warning"
            : "fail",
      detail: `reference=${reference?.found ? "found" : "missing"} working=${working?.found ? "found" : "missing"}`,
    });
    if (reference?.found && working?.found && (!reference?.rect || !working?.rect)) {
      checks.push({
        id: `group-${groupId}-rect`,
        groupId,
        checkType: "rect",
        status: "warning",
        detail: `incomplete-rect reference=${reference?.rect ? "present" : "missing"} working=${working?.rect ? "present" : "missing"}`,
      });
    } else if (reference?.rect && working?.rect) {
      const dx = Math.abs((reference.rect.x || 0) - (working.rect.x || 0));
      const dy = Math.abs((reference.rect.y || 0) - (working.rect.y || 0));
      const dw = Math.abs((reference.rect.width || 0) - (working.rect.width || 0));
      const dh = Math.abs((reference.rect.height || 0) - (working.rect.height || 0));
      const worst = Math.max(dx, dy, dw, dh);
      checks.push({
        id: `group-${groupId}-rect`,
        groupId,
        checkType: "rect",
        status: worst > 4 ? "fail" : worst > 2 ? "warning" : "pass",
        detail: `dx=${dx} dy=${dy} dw=${dw} dh=${dh}`,
        metrics: { dx, dy, dw, dh, worst },
      });
    }
  }
  return checks;
}

function summarizeStatusCounts(items) {
  const counts = { pass: 0, warning: 0, fail: 0 };
  for (const item of items || []) {
    if (item?.status === "fail") counts.fail += 1;
    else if (item?.status === "warning") counts.warning += 1;
    else if (item?.status === "pass") counts.pass += 1;
  }
  return counts;
}

function buildPdpCaptureCheckSummary(groupChecks) {
  const checks = Array.isArray(groupChecks) ? groupChecks : [];
  const grouped = new Map();
  for (const check of checks) {
    const groupId = check.groupId || "unknown";
    if (!grouped.has(groupId)) grouped.set(groupId, []);
    grouped.get(groupId).push(check);
  }
  const groups = Array.from(grouped.entries()).map(([groupId, items]) => {
    const counts = summarizeStatusCounts(items);
    return {
      groupId,
      status: counts.fail > 0 ? "fail" : counts.warning > 0 ? "warning" : "pass",
      counts,
      checks: items,
    };
  });
  groups.sort((a, b) => {
    const rank = { fail: 0, warning: 1, pass: 2 };
    return (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.groupId.localeCompare(b.groupId);
  });
  const counts = summarizeStatusCounts(groups);
  return {
    status: counts.fail > 0 ? "fail" : counts.warning > 0 ? "warning" : "pass",
    counts,
    groups,
  };
}

function buildPdpWorkbenchGroupSummary(captures) {
  const summaryByGroup = new Map();
  for (const capture of captures || []) {
    for (const group of capture.groupSummary?.groups || []) {
      if (!summaryByGroup.has(group.groupId)) {
        summaryByGroup.set(group.groupId, {
          groupId: group.groupId,
          pass: 0,
          warning: 0,
          fail: 0,
          samples: [],
        });
      }
      const item = summaryByGroup.get(group.groupId);
      item[group.status] += 1;
      if (group.status !== "pass" && item.samples.length < 3) {
        item.samples.push({
          href: capture.href,
          pathname: capture.pathname || capture.href,
          status: group.status,
          checks: group.checks.map((check) => ({
            id: check.id,
            status: check.status,
            detail: check.detail,
            metrics: check.metrics || null,
          })),
        });
      }
    }
  }
  const groups = Array.from(summaryByGroup.values()).map((item) => ({
    ...item,
    status: item.fail > 0 ? "fail" : item.warning > 0 ? "warning" : "pass",
  }));
  groups.sort((a, b) => {
    const rank = { fail: 0, warning: 1, pass: 2 };
    return (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.groupId.localeCompare(b.groupId);
  });
  return {
    status: groups.some((item) => item.status === "fail")
      ? "fail"
      : groups.some((item) => item.status === "warning")
        ? "warning"
        : "pass",
    groups,
  };
}

function buildPlpGroupChecks(referenceEntry, workingEntry) {
  const groupIds = ["filter", "sort", "productGrid", "firstRow", "firstProduct", "banner"];
  const checks = buildGroupChecks(referenceEntry?.groups, workingEntry?.groups, groupIds);
  const fallbackWarning =
    referenceEntry?.fallbackFromViewportProfile ||
    workingEntry?.fallbackFromViewportProfile ||
    null;
  if (!fallbackWarning) return checks;
  const fallbackSensitive = new Set(["productGrid", "firstRow", "firstProduct"]);
  for (const group of checks.groups || []) {
    if (!fallbackSensitive.has(group.groupId)) continue;
    group.checks = (group.checks || []).map((check) => {
      if (check.checkType !== "presence") return check;
      const refMatched = Number(referenceEntry?.matchedProductCount || 0);
      const workMatched = Number(workingEntry?.matchedProductCount || 0);
      if ((refMatched === 0 || workMatched === 0) && check.status === "fail") {
        return {
          ...check,
          status: "warning",
          detail: `${check.detail} fallback=${fallbackWarning}`
        };
      }
      return check;
    });
    const statuses = (group.checks || []).map((item) => item.status);
    group.counts = {
      pass: statuses.filter((s) => s === "pass").length,
      warning: statuses.filter((s) => s === "warning").length,
      fail: statuses.filter((s) => s === "fail").length,
    };
    group.status = group.counts.fail
      ? "fail"
      : group.counts.warning
        ? "warning"
        : "pass";
  }
  checks.status = (checks.groups || []).some((item) => item.status === "fail")
    ? "fail"
    : (checks.groups || []).some((item) => item.status === "warning")
      ? "warning"
      : "pass";
  return checks;
}

function buildPdpGroupChecks(referenceGroups, workingGroups) {
  const groupIds = ["gallery", "summary", "price", "option", "sticky", "review", "qna"];
  return buildGroupChecks(referenceGroups, workingGroups, groupIds);
}

function toVisualUrl(filePath) {
  if (!filePath) return null;
  const normalized = path.normalize(filePath);
  const visualRoot = path.normalize(VISUAL_DIR + path.sep);
  const normalizedFolded = normalized.toLowerCase();
  const visualRootFolded = visualRoot.toLowerCase();
  if (!normalizedFolded.startsWith(visualRootFolded)) return null;
  const relativePath = normalized.slice(visualRoot.length).replace(/\\/g, "/");
  return `/visual/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function buildWorkingInteractionSnapshot(pageId) {
  const baseline = resolveBaselineInfo(pageId);
  if (baseline.mode === "hybrid" && pageId === "home") {
    const mobileHtml = readHomeMobileHtml() || "";
    const rawHtml = readCloneSourceHtmlByPageId(pageId) || "";
    const desktopHeroSlides = extractHomeHeroSlides(mobileHtml);
    const mobileQuickMenus = extractMobileQuickMenuItems(mobileHtml);
    const homeEnhancements = parseHomeEnhancements(rawHtml, mobileHtml, {});
    const lowerSectionInteractions = [
      ["home.md-choice.cards", "md-choice", "card-set", homeEnhancements.mdChoiceProducts?.length || 0],
      ["home.subscription.section", "subscription", "product-tabs", homeEnhancements.subscriptionProducts?.length || 0],
      ["home.space-renewal.section", "space-renewal", "banner-grid", buildSpaceRenewalProducts(homeEnhancements.spaceRenewalData).length || 0],
      ["home.brand-showroom.section", "brand-showroom", "feature-grid", homeEnhancements.brandShowroomProducts?.length || 0],
      ["home.latest-product-news.section", "latest-product-news", "news-grid", homeEnhancements.latestProductNewsProducts?.length || 0],
      ["home.smart-life.section", "smart-life", "story-list", homeEnhancements.smartLifeProducts?.length || 0],
      ["home.summary-banner-2.section", "summary-banner-2", "banner", homeEnhancements.lowerPromotionProducts?.length || 0],
      ["home.missed-benefits.section", "missed-benefits", "benefit-list", homeEnhancements.missedBenefitsProducts?.length || 0],
      ["home.lg-best-care.section", "lg-best-care", "service-list", homeEnhancements.lgBestCareProducts?.length || 0],
      ["home.bestshop-guide.section", "bestshop-guide", "guide-list", homeEnhancements.bestshopGuideProducts?.length || (homeEnhancements.bestshopGuideSection ? 1 : 0)],
    ]
      .filter(([, , , itemCount]) => itemCount > 0)
      .map(([interactionId, slotId, kind, itemCount]) => ({
        interactionId,
        kind,
        slotId,
        trigger: {
          type: "section-default",
          target: slotId,
        },
        result: {
          itemCount,
        },
      }));
    return {
      pageId,
      source: "working",
      url: baseline.url,
      visualUrl: baseline.visualUrl,
      structuralUrl: baseline.structuralUrl,
      mode: baseline.mode,
      interactions: [
        {
          interactionId: "logo-home-nav",
          kind: "navigation",
          slotId: "header-top",
          trigger: {
            type: "click",
            target: "logo",
          },
          result: {
            targetKey: "home",
            targetUrl: "/clone/home",
          },
        },
        {
          interactionId: "header-search-open",
          kind: "search-open",
          slotId: "header-top",
          trigger: {
            type: "click",
            target: "search-button",
          },
          result: {
            overlay: "search",
          },
        },
        {
          interactionId: "header-cart-nav",
          kind: "navigation",
          slotId: "header-top",
          trigger: {
            type: "click",
            target: "cart-link",
          },
          result: {
            targetKey: "cart",
            targetUrl: "/shop/cart/index",
          },
        },
        ...[
          ["gnb-product-open", "제품/소모품"],
          ["gnb-care-open", "가전 구독"],
          ["gnb-support-open", "고객지원"],
          ["gnb-benefits-open", "혜택/이벤트"],
          ["gnb-story-open", "스토리"],
          ["gnb-bestshop-open", "베스트샵"],
          ["gnb-lgai-open", "LG AI"],
        ].map(([interactionId, label]) => ({
          interactionId,
          kind: "gnb-open",
          slotId: "header-bottom",
          trigger: {
            type: "hover-or-click",
            target: label,
          },
          result: {
            menuLabel: label,
          },
        })),
        {
          interactionId: "home.gnb.open",
          kind: "overlay-menu",
          slotId: "header-bottom",
          trigger: {
            type: "hover-or-click",
            target: "gnb-root",
          },
          result: {
            menuCount: 7,
            mode: "overlay",
            openLabels: ["제품/소모품", "가전 구독", "고객지원", "혜택/이벤트", "스토리", "베스트샵", "LG AI"],
          },
        },
        {
          interactionId: "quickmenu-default",
          kind: "quickmenu-default",
          slotId: "quickmenu",
          trigger: {
            type: "default",
            target: "quickmenu",
          },
          result: {
            itemCount: mobileQuickMenus.length,
            rowCount: mobileQuickMenus.length >= 10 ? 2 : 1,
            columnCount: mobileQuickMenus.length >= 10 ? 5 : Math.max(1, Math.min(5, mobileQuickMenus.length || 1)),
          },
        },
        {
          interactionId: "home.quickmenu.nav",
          kind: "navigation-grid",
          slotId: "quickmenu",
          trigger: {
            type: "click",
            target: "quickmenu-grid",
          },
          result: {
            itemCount: mobileQuickMenus.length,
            rowCount: mobileQuickMenus.length >= 10 ? 2 : 1,
            columnCount: mobileQuickMenus.length >= 10 ? 5 : Math.max(1, Math.min(5, mobileQuickMenus.length || 1)),
          },
        },
        ...desktopHeroSlides.map((slide, index) => ({
          interactionId: `hero-slide-${index + 1}`,
          kind: "hero-slide",
          slotId: "hero",
          trigger: {
            type: "swipe-or-pagination",
            target: "hero-carousel",
          },
          result: {
            slideIndex: index + 1,
            headline: slide.headline || "",
            targetUrl: slide.href || "",
          },
        })),
        {
          interactionId: "home.hero.carousel",
          kind: "carousel",
          slotId: "hero",
          trigger: {
            type: "auto-or-prev-next",
            target: "hero-carousel",
          },
          result: {
            defaultSlideIndex: Math.min(2, Math.max(1, desktopHeroSlides.length || 1)),
            slideCount: desktopHeroSlides.length,
            autoplay: true,
            intervalMs: 5500,
            pauseOnHover: true,
            pauseOnFocus: true,
          },
        },
        {
          interactionId: "home.best-ranking.tabs",
          kind: "tab-switch",
          slotId: "best-ranking",
          trigger: {
            type: "click-or-arrow",
            target: "best-ranking-tabs",
          },
          result: {
            tabCount: HOME_BEST_RANKING_TABS.length,
            defaultCategoryId: HOME_BEST_RANKING_TABS.find((item) => item.active)?.categoryId || HOME_BEST_RANKING_TABS[0]?.categoryId || "",
          },
        },
        {
          interactionId: "home.timedeal.cards",
          kind: "card-set",
          slotId: "timedeal",
          trigger: {
            type: "default",
            target: "timedeal-cards",
          },
          result: {
            visibleCardCount: 2,
            sourceMode: "mobile-derived-two-card",
          },
        },
        ...lowerSectionInteractions,
        ...mobileQuickMenus.map((item, index) => ({
          interactionId: `quickmenu-nav-${index + 1}`,
          kind: "navigation",
          slotId: "quickmenu",
          trigger: {
            type: "click",
            target: `quickmenu-item-${index + 1}`,
            label: item.title || "",
          },
          result: {
            targetUrl: item.href || "",
          },
        })),
      ],
    };
  }

  if (isPdpCasePageId(pageId)) {
    return {
      pageId,
      source: "working",
      url: baseline.url,
      mode: baseline.mode,
      interactions: [
        {
          interactionId: "pdp.gallery.carousel",
          kind: "carousel",
          slotId: "gallery",
          trigger: { type: "swipe-or-click", target: "gallery-main" },
          result: { area: "gallery", viewportProfiles: ["pc", "mo"] },
        },
        {
          interactionId: "pdp.summary.default",
          kind: "summary-default",
          slotId: "summary",
          trigger: { type: "default", target: "product-summary" },
          result: { section: "summary" },
        },
        {
          interactionId: "pdp.price.default",
          kind: "price-default",
          slotId: "price",
          trigger: { type: "default", target: "price-box" },
          result: { section: "price" },
        },
        {
          interactionId: "pdp.gallery.thumbnail.sync",
          kind: "thumbnail-sync",
          slotId: "gallery",
          trigger: { type: "click", target: "gallery-thumbnail" },
          result: { area: "gallery", viewportProfiles: ["pc"] },
        },
        {
          interactionId: "pdp.option.select",
          kind: "select",
          slotId: "option",
          trigger: { type: "click-or-change", target: "option-selector" },
          result: { affects: ["summary", "price", "option"] },
        },
        {
          interactionId: "pdp.sticky.buybox",
          kind: "sticky-buybox",
          slotId: "sticky",
          trigger: { type: "scroll", target: "buybox-sticky" },
          result: { section: "sticky" },
        },
        {
          interactionId: "pdp.review.expand",
          kind: "expand",
          slotId: "review",
          trigger: { type: "click", target: "review-more" },
          result: { section: "review" },
        },
        {
          interactionId: "pdp.qna.expand",
          kind: "expand",
          slotId: "qna",
          trigger: { type: "click", target: "qna-more" },
          result: { section: "qna" },
        },
      ],
    };
  }

  if (String(pageId || "").startsWith("category-")) {
    return {
      pageId,
      source: "working",
      url: baseline.url,
      mode: baseline.mode,
      interactions: [
        {
          interactionId: "plp.filter.open",
          kind: "drawer-open",
          slotId: "filter",
          trigger: { type: "click", target: "filter-button" },
          result: { overlay: "filter" },
        },
        {
          interactionId: "plp.sort.open",
          kind: "dropdown-open",
          slotId: "sort",
          trigger: { type: "click", target: "sort-button" },
          result: { overlay: "sort" },
        },
        {
          interactionId: "plp.product-card.hover",
          kind: "hover-state",
          slotId: "firstProduct",
          trigger: { type: "hover", target: "product-card" },
          result: { visualState: "hover" },
        },
      ],
    };
  }

  if (["support", "bestshop", "care-solutions"].includes(String(pageId || ""))) {
    const interactions = [];
    if (pageId === "support") {
      interactions.push(
        {
          interactionId: "support.tab.switch",
          kind: "tab-switch",
          slotId: "mainService",
          trigger: { type: "click", target: "support-tab" },
          result: { section: "mainService" },
        },
        {
          interactionId: "support.accordion.open",
          kind: "accordion-open",
          slotId: "notice",
          trigger: { type: "click", target: "accordion-item" },
          result: { section: "notice" },
        }
      );
    }
    if (pageId === "care-solutions") {
      interactions.push({
        interactionId: "support.tab.switch",
        kind: "tab-switch",
        slotId: "tabs",
        trigger: { type: "click", target: "care-tab" },
        result: { section: "tabs" },
      });
    }
    if (pageId === "bestshop") {
      interactions.push({
        interactionId: "bestshop.shortcut.nav",
        kind: "navigation-grid",
        slotId: "shortcut",
        trigger: { type: "click", target: "shortcut-item" },
        result: { section: "shortcut" },
      });
    }
    return {
      pageId,
      source: "working",
      url: baseline.url,
      mode: baseline.mode,
      interactions,
    };
  }

  return {
    pageId,
    source: "working",
    url: baseline.url,
    mode: baseline.mode,
    interactions: [],
  };
}

function buildWorkingComponentInventory(pageId, options = {}) {
  const editableData = options.editableData || null;
  const cacheKey = buildWorkspacePageCacheKey(editableData || {}, pageId, "component-inventory");
  return readCachedValue(WORKING_COMPONENT_INVENTORY_CACHE, cacheKey, () => {
    const slotsSnapshot = buildWorkingSlotSnapshot(pageId);
    const interactionsSnapshot = buildWorkingInteractionSnapshot(pageId);
    const interactions = interactionsSnapshot?.interactions || [];
    const slots = (slotsSnapshot?.slots || []).length
      ? slotsSnapshot.slots
      : buildDerivedWorkingSlots(pageId, interactions);
    const sourceMode = resolveBaselineInfo(pageId).mode === "mobile" ? "mobile-derived" : "pc-like";
    const activeSourceOverrides = new Map(
      ((findSlotRegistry(editableData || {}, pageId)?.slots) || [])
        .filter((slot) => String(slot.slotId || "").trim() && String(slot.activeSourceId || "").trim())
        .map((slot) => [String(slot.slotId).trim(), String(slot.activeSourceId).trim()])
    );
    const normalizedSlots = slots.map((slot) => {
      const fallbackSourceId = slot.sourceId || slot.layout?.sourceId || sourceMode;
      const overriddenSourceId = activeSourceOverrides.get(String(slot.slotId || "").trim()) || fallbackSourceId;
      return {
        ...slot,
        sourceId: overriddenSourceId,
        layout: slot.layout ? { ...slot.layout, sourceId: overriddenSourceId } : slot.layout,
      };
    });
    const components = normalizedSlots.map((slot) => {
      const slotId = String(slot.slotId || "").trim();
      const componentId = pageId === "home" ? `home.${slotId}` : `${pageId}.${slotId}`;
      const activeSourceId = slot.sourceId || slot.layout?.sourceId || null;
      const sourceResolution = resolveComponentSourceResolution(pageId, slotId, activeSourceId, editableData || {});
      const componentPatch = findComponentPatch(editableData || {}, pageId, componentId, activeSourceId)?.patch || null;
      return {
        componentId,
        pageId,
        slotId,
        activeSourceId,
        activeSourceType: sourceResolution.activeSourceType || null,
        sourceResolution: sourceResolution.sourceResolution || "missing",
        renderMode: sourceResolution.renderMode || "missing",
        resolvedRenderSourceId: sourceResolution.resolvedRenderSourceId || null,
        resolvedRenderSourceType: sourceResolution.resolvedRenderSourceType || null,
        sourceResolutionDetail: sourceResolution.detail || null,
        containerMode: slot.containerMode || null,
        kind: slot.kind || null,
        itemCount: typeof slot.itemCount === "number" ? slot.itemCount : null,
        hasPatch: Boolean(componentPatch && typeof componentPatch === "object" && Object.keys(componentPatch).length),
        patchKeys: componentPatch && typeof componentPatch === "object" ? Object.keys(componentPatch) : [],
        interactionIds: interactions
          .filter((interaction) => String(interaction.slotId || "") === slotId)
          .map((interaction) => interaction.interactionId),
      };
    });
    return {
      pageId,
      source: "working",
      components,
    };
  });
}

function buildDerivedWorkingSlots(pageId, interactions = []) {
  const baseline = resolveBaselineInfo(pageId);
  const sourceId = baseline.mode === "mobile" ? "mobile-derived" : "pc-like";
  const slotMap = new Map();
  const addSlot = (slotId, patch = {}) => {
    const key = String(slotId || "").trim();
    if (!key) return;
    if (!slotMap.has(key)) {
      slotMap.set(key, {
        slotId: key,
        sourceId,
        containerMode: "narrow",
        kind: "section",
        itemCount: null,
        ...patch,
      });
      return;
    }
    slotMap.set(key, { ...slotMap.get(key), ...patch });
  };

  if (isPdpCasePageId(pageId)) {
    const pdpContext = resolvePdpRuntimeContext(pageId);
    const groups =
      (
        findPdpGroupEntry(pdpContext?.runtimePageId || "", "pc", pdpContext?.href || "", "reference") ||
        findPdpGroupEntry(pdpContext?.runtimePageId || "", "mo", pdpContext?.href || "", "reference")
      )?.groups || {};
    for (const [groupId, group] of Object.entries(groups)) {
      if (!group?.found) continue;
      addSlot(groupId, {
        containerMode: groupId === "gallery" ? "full" : "narrow",
        kind:
          groupId === "gallery"
            ? "gallery"
            : groupId === "option"
              ? "controls"
              : groupId === "review" || groupId === "qna"
                ? "content"
                : "section",
      });
    }
  } else if (String(pageId || "").startsWith("category-")) {
    const viewportProfile = baseline.mode === "mobile" ? "mo" : "pc";
    const workbench = buildPlpWorkbench(pageId, viewportProfile);
    const groups = workbench?.workingGroups?.groups || {};
    for (const [groupId, group] of Object.entries(groups)) {
      if (!group?.found && !["filter", "sort"].includes(groupId)) continue;
      addSlot(groupId, {
        containerMode: groupId === "banner" || groupId === "productGrid" ? "full" : "narrow",
        kind:
          groupId === "banner"
            ? "banner"
            : groupId === "productGrid" || groupId === "firstRow" || groupId === "firstProduct"
              ? "product-list"
              : "controls",
      });
    }
  } else if (["support", "bestshop", "care-solutions"].includes(String(pageId || ""))) {
    const viewportProfile = baseline.mode === "mobile" ? "mo" : "pc";
    const workbench = buildServicePageWorkbench(pageId, viewportProfile);
    const groups = workbench?.workingGroups?.groups || {};
    for (const [groupId, group] of Object.entries(groups)) {
      if (!group?.found && groupId !== "brandBanner") continue;
      addSlot(groupId, {
        containerMode: groupId === "hero" || groupId === "mainService" || groupId === "notice" ? "full" : "narrow",
        kind:
          groupId === "hero"
            ? "hero"
            : groupId === "shortcut" || groupId === "mainService"
              ? "navigation"
              : "section",
      });
    }
  }

  for (const interaction of interactions || []) {
    const slotId = String(interaction.slotId || "").trim();
    if (!slotId) continue;
    let kind = "section";
    if (slotId === "filter" || slotId === "sort" || slotId === "option" || slotId === "tabs") kind = "controls";
    else if (slotId === "gallery") kind = "gallery";
    else if (slotId === "review" || slotId === "qna" || slotId === "notice") kind = "content";
    else if (slotId === "shortcut" || slotId === "mainService") kind = "navigation";
    addSlot(slotId, { kind });
  }

  return Array.from(slotMap.values());
}

function buildWorkingEditableComponentCatalog(pageId, options = {}) {
  const editableData = options.editableData || null;
  const cacheKey = buildWorkspacePageCacheKey(editableData || {}, pageId, "component-editability");
  return readCachedValue(WORKING_EDITABILITY_CACHE, cacheKey, () => {
    const componentInventory = buildWorkingComponentInventory(pageId, options);
    const catalog = (componentInventory.components || []).map((component) => {
      const slotId = component.slotId;
      const base = {
        componentId: component.componentId,
      pageId,
      slotId,
      activeSourceId: component.activeSourceId,
      editableProps: [],
      editableStyles: [],
      editableInteractions: component.interactionIds || [],
      patchSchema: getGenericPatchSchema(pageId, slotId),
    };
    if (pageId === "home") {
      if (slotId === "header-top") {
        base.editableProps = ["logoHref", "utilityLinks", "visibility"];
        base.editableStyles = ["spacing", "iconOrder", "alignment"];
      } else if (slotId === "header-bottom") {
        base.editableProps = ["mainMenus", "brandTabs", "visibility"];
        base.editableStyles = ["menuSpacing", "tabSpacing", "underlineStyle"];
      } else if (slotId === "hero") {
        base.editableProps = ["slides", "headline", "description", "badge", "image", "ctaHref"];
        base.editableStyles = ["height", "copyPosition", "indicatorStyle"];
        base.patchSchema = {
          rootKeys: ["badge", "headline", "description", "ctaHref", "ctaLabel", "visibility"],
          styleKeys: [
            "background",
            "radius",
            "height",
            "minHeight",
            "borderColor",
            "borderWidth",
            "borderStyle",
            "boxShadow",
            "padding",
            "opacity",
            "titleColor",
            "subtitleColor",
            "titleWeight",
            "subtitleWeight",
            "titleSize",
            "subtitleSize",
            "textAlign",
          ],
        };
      } else if (slotId === "quickmenu") {
        base.editableProps = ["items", "title", "icon", "href"];
        base.editableStyles = ["gridColumns", "iconSize", "labelStyle"];
      } else if (slotId === "best-ranking") {
        base.editableProps = ["tabs", "items", "badges", "rankVisual", "moreLink"];
        base.editableStyles = ["cardRadius", "rankPosition", "badgeStyle", "priceStyle"];
        base.patchSchema = {
          rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
          styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
        };
      } else if (slotId === "summary-banner-2") {
        base.editableProps = ["items", "image", "href", "alt"];
        base.editableStyles = ["width", "radius", "background"];
      } else {
        base.editableProps = ["items", "title", "subtitle", "image", "href", "visibility"];
        base.editableStyles = ["width", "gap", "titleStyle", "cardStyle"];
      }
    } else if (String(pageId || "").startsWith("category-") || isPdpCasePageId(pageId)) {
      if (slotId === "filter" || slotId === "sort") {
        base.editableProps = ["filters", "sortOptions", "visibility"];
        base.editableStyles = ["panelStyle", "chipStyle", "spacing"];
      } else if (slotId === "banner") {
        base.editableProps = ["headline", "image", "href", "visibility"];
        base.editableStyles = ["height", "background", "spacing"];
      } else if (slotId === "gallery") {
        base.editableProps = ["images", "thumbnailOrder", "visibility"];
        base.editableStyles = ["aspectRatio", "thumbnailStyle", "spacing"];
      } else if (slotId === "summary") {
        base.editableProps = ["title", "subtitle", "badges", "visibility"];
        base.editableStyles = ["background", "radius", "titleStyle", "spacing"];
      } else if (slotId === "price") {
        base.editableProps = ["title", "subtitle", "visibility"];
        base.editableStyles = ["background", "radius", "titleStyle", "spacing"];
      } else if (slotId === "option") {
        base.editableProps = ["options", "selectedOption", "visibility"];
        base.editableStyles = ["selectorStyle", "spacing"];
      } else if (slotId === "sticky") {
        base.editableProps = ["title", "subtitle", "visibility"];
        base.editableStyles = ["background", "radius", "spacing"];
      } else if (slotId === "review" || slotId === "qna") {
        base.editableProps = ["title", "subtitle", "items", "visibility"];
        base.editableStyles = ["background", "radius", "spacing", "titleStyle"];
      } else {
        base.editableProps = ["items", "badges", "href", "visibility"];
        base.editableStyles = ["gridColumns", "cardStyle", "spacing"];
      }
    } else if (["support", "bestshop", "care-solutions"].includes(String(pageId || ""))) {
      if (slotId === "hero") {
        base.editableProps = ["headline", "image", "href", "visibility"];
        base.editableStyles = ["height", "copyPosition", "background"];
      } else if (slotId === "shortcut" || slotId === "mainService" || slotId === "tabs") {
        base.editableProps = ["items", "href", "visibility"];
        base.editableStyles = ["gridColumns", "iconStyle", "spacing"];
      } else {
        base.editableProps = ["items", "title", "subtitle", "href", "visibility"];
        base.editableStyles = ["cardStyle", "spacing", "titleStyle"];
      }
    }
      return base;
    });
    return {
      pageId,
      source: "working",
      components: catalog,
    };
  });
}

function sanitizeComponentPatch(inputPatch, patchSchema = {}) {
  const source = inputPatch && typeof inputPatch === "object" ? inputPatch : {};
  const rootKeys = new Set(Array.isArray(patchSchema.rootKeys) ? patchSchema.rootKeys : []);
  const styleKeys = new Set(Array.isArray(patchSchema.styleKeys) ? patchSchema.styleKeys : []);
  const next = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "styles" && value && typeof value === "object" && styleKeys.size) {
      const stylePatch = {};
      for (const [styleKey, styleValue] of Object.entries(value)) {
        if (!styleKeys.has(styleKey)) continue;
        stylePatch[styleKey] = styleValue;
      }
      if (Object.keys(stylePatch).length) next.styles = stylePatch;
      continue;
    }
    if (!rootKeys.has(key)) continue;
    next[key] = value;
  }
  return next;
}

const GENERIC_PATCH_ROOT_KEYS = [
  "title",
  "subtitle",
  "description",
  "badge",
  "ctaLabel",
  "ctaHref",
  "moreLabel",
  "visibility",
];

const GENERIC_PATCH_STYLE_KEYS = [
  "background",
  "radius",
  "height",
  "minHeight",
  "borderColor",
  "borderWidth",
  "borderStyle",
  "boxShadow",
  "padding",
  "opacity",
  "titleColor",
  "subtitleColor",
  "titleWeight",
  "subtitleWeight",
  "titleSize",
  "subtitleSize",
  "textAlign",
];

function getGenericPatchSchema(pageId, slotId) {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedSlotId = String(slotId || "").trim();
  const empty = { rootKeys: [], styleKeys: [] };
  if (!normalizedPageId || !normalizedSlotId) return empty;

  if (normalizedPageId === "home") {
    return {
      rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
      styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
    };
  }

  if (normalizedPageId === "support") {
    const slotSchemas = {
      mainService: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      notice: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      tipsBanner: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      bestcare: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
    };
    return slotSchemas[normalizedSlotId] || empty;
  }

  if (normalizedPageId === "bestshop") {
    const slotSchemas = {
      hero: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      review: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
    };
    return slotSchemas[normalizedSlotId] || empty;
  }

  if (normalizedPageId === "care-solutions") {
    const slotSchemas = {
      hero: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      ranking: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      benefit: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      tabs: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      careBanner: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
    };
    return slotSchemas[normalizedSlotId] || empty;
  }

  if (normalizedPageId.startsWith("category-") || isPdpCasePageId(normalizedPageId)) {
    const slotSchemas = {
      banner: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      summary: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      price: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      option: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      sticky: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      review: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
      qna: {
        rootKeys: [...GENERIC_PATCH_ROOT_KEYS],
        styleKeys: [...GENERIC_PATCH_STYLE_KEYS],
      },
    };
    return slotSchemas[normalizedSlotId] || empty;
  }

  return empty;
}

function buildWorkingRollbackCatalog(pageId, options = {}) {
  const componentInventory = buildWorkingComponentInventory(pageId, options);
  return {
    pageId,
    source: "working",
    components: (componentInventory.components || []).map((component) => ({
      componentId: component.componentId,
      slotId: component.slotId,
      rollbackRule: {
        mode: "rerender-from-active-source",
        sourceId: component.activeSourceId || null,
        scope: "component",
      },
    })),
  };
}

function buildWorkingInteractionVerificationCatalog(pageId) {
  const snapshot = buildWorkingInteractionSnapshot(pageId);
  return {
    pageId,
    source: "working",
    interactions: (snapshot.interactions || []).map((interaction) => {
      const verification = {
        visibleProof: ["dom-state"],
        checks: [],
      };
      if (String(interaction.interactionId || "").startsWith("home.hero")) {
        verification.checks = ["active-slide", "indicator-sync", "slide-count"];
      } else if (String(interaction.interactionId || "").startsWith("home.gnb")) {
        verification.checks = ["open-state", "active-menu", "visible-panel"];
      } else if (String(interaction.interactionId || "").startsWith("home.quickmenu")) {
        verification.checks = ["item-count", "row-count", "column-count"];
      } else if (String(interaction.interactionId || "").startsWith("home.timedeal")) {
        verification.checks = ["visible-card-count"];
      } else if (String(interaction.interactionId || "").startsWith("pdp.")) {
        verification.checks = ["state-change", "target-visibility"];
      } else if (String(interaction.interactionId || "").startsWith("support.")) {
        verification.checks = ["expanded-state", "target-visibility"];
      } else {
        verification.checks = ["target-visibility"];
      }
      return {
        interactionId: interaction.interactionId,
        slotId: interaction.slotId,
        verification,
      };
    }),
  };
}

function buildLlmReadinessReport(pageId, options = {}) {
  const componentInventory = buildWorkingComponentInventory(pageId, options);
  const editableCatalog = buildWorkingEditableComponentCatalog(pageId, options);
  const rollbackCatalog = buildWorkingRollbackCatalog(pageId, options);
  const verificationCatalog = buildWorkingInteractionVerificationCatalog(pageId);
  const editableMap = new Map((editableCatalog.components || []).map((component) => [component.componentId, component]));
  const rollbackMap = new Map((rollbackCatalog.components || []).map((component) => [component.componentId, component]));
  const verificationMap = new Map((verificationCatalog.interactions || []).map((interaction) => [interaction.interactionId, interaction]));
  const components = componentInventory.components || [];
  const reportItems = components.map((component) => {
    const editable = editableMap.get(component.componentId) || null;
    const rollback = rollbackMap.get(component.componentId) || null;
    const interactionIds = component.interactionIds || [];
    const requiresInteraction =
      ["controls", "navigation", "gallery", "quickmenu"].includes(String(component.kind || "")) ||
      ["header-top", "header-bottom", "best-ranking", "timedeal", "md-choice"].includes(String(component.slotId || "")) ||
      String(component.componentId || "") === "home.hero";
    const hasVerification = interactionIds.every((interactionId) => verificationMap.has(interactionId));
    const checks = [
      {
        id: "component-id",
        status: component.componentId ? "pass" : "fail",
        detail: component.componentId || "missing componentId",
      },
      {
        id: "source-id",
        status: component.activeSourceId ? "pass" : "fail",
        detail: component.activeSourceId || "missing activeSourceId",
      },
      {
        id: "interaction-links",
        status: interactionIds.length > 0 ? "pass" : requiresInteraction ? "warning" : "pass",
        detail: interactionIds.length > 0 ? `${interactionIds.length} interaction ids` : requiresInteraction ? "0 interaction ids" : "interaction not required",
      },
      {
        id: "editable-schema",
        status: editable && (editable.editableProps || []).length > 0 ? "pass" : "warning",
        detail: editable && (editable.editableProps || []).length > 0
          ? `${editable.editableProps.length} editable props`
          : "editableProps / patch schema not defined yet",
      },
      {
        id: "rollback-rule",
        status: rollback?.rollbackRule ? "pass" : "warning",
        detail: rollback?.rollbackRule
          ? `${rollback.rollbackRule.mode}:${rollback.rollbackRule.sourceId || "n/a"}`
          : "component-level rollback rule not defined yet",
      },
      {
        id: "interaction-verification",
        status: interactionIds.length === 0 || hasVerification ? "pass" : "warning",
        detail: interactionIds.length === 0 ? "verification not required" : hasVerification ? "verification schema linked" : "interaction verification schema incomplete",
      },
    ];
    const advisories = [];
    if (component.sourceResolution && component.sourceResolution !== "direct") {
      advisories.push({
        id: "source-resolution",
        status: "warning",
        detail:
          component.sourceResolutionDetail ||
          `${component.activeSourceId || "unknown"} -> ${component.resolvedRenderSourceId || "unknown"}`,
      });
    }
    const status = checks.some((check) => check.status === "fail")
      ? "fail"
      : checks.some((check) => check.status === "warning")
        ? "warning"
        : "pass";
    return {
      ...component,
      editableProps: editable?.editableProps || [],
      editableStyles: editable?.editableStyles || [],
      status,
      checks,
      advisories,
    };
  });
  const globalGaps = [];
  let linkCoverage = null;
  if (pageId === "home") {
    const report = readHomeLinkCoverageReport();
    if (!report) {
      globalGaps.push("link coverage needs browser-state verification");
    } else {
      const coverage = Array.isArray(report.coverage) ? report.coverage : [];
      const missingSlots = coverage.filter((item) => !item.present).map((item) => item.slotId);
      const totals = coverage.reduce(
        (acc, item) => {
          const counts = item && item.counts ? item.counts : {};
          acc.cloneProduct += Number(counts["clone-product"] || 0);
          acc.clonePage += Number(counts["clone-page"] || 0);
          acc.blocked += Number(counts.blocked || 0);
          acc.external += Number(counts.external || 0);
          acc.hash += Number(counts.hash || 0);
          return acc;
        },
        { cloneProduct: 0, clonePage: 0, blocked: 0, external: 0, hash: 0 }
      );
      const targets = [];
      const seenTargets = new Set();
      for (const item of coverage) {
        for (const sample of item.samples || []) {
          const href = String(sample.href || "").trim();
          const linkType = String(sample.linkType || "").trim();
          if (!href || !linkType) continue;
          if (!["clone-page", "clone-product", "external"].includes(linkType)) continue;
          const key = `${linkType}:${href}`;
          if (seenTargets.has(key)) continue;
          seenTargets.add(key);
          targets.push({
            slotId: item.slotId,
            linkType,
            href,
            originHref: sample.originHref || "",
          });
        }
      }
      linkCoverage = {
        generatedAt: report.generatedAt || null,
        verifiedSlotCount: coverage.filter((item) => item.present).length,
        missingSlots,
        totals,
        targets: targets.slice(0, 20),
      };
      if (missingSlots.length) {
        globalGaps.push(`link coverage report missing slots: ${missingSlots.join(", ")}`);
      }
    }
  }
  return {
    pageId,
    source: "working",
    overallStatus: reportItems.some((item) => item.status === "fail")
      ? "fail"
      : reportItems.some((item) => item.status === "warning")
        ? "warning"
        : "pass",
    components: reportItems,
    globalGaps,
    linkCoverage,
  };
}

function buildPreLlmGapReport(pageId, options = {}) {
  const editableData = options.editableData || null;
  const cacheKey = buildWorkspacePageCacheKey(editableData || {}, pageId, "pre-llm-gap");
  return readCachedValue(PRE_LLM_GAP_CACHE, cacheKey, () => {
    const readiness = buildLlmReadinessReport(pageId, options);
    const components = Array.isArray(readiness.components) ? readiness.components : [];
    const componentGaps = components
      .filter((component) => component.status !== "pass")
      .map((component) => ({
        componentId: component.componentId,
        slotId: component.slotId,
        status: component.status,
        missing: (component.checks || [])
          .filter((check) => check.status !== "pass")
          .map((check) => ({
            id: check.id,
            status: check.status,
            detail: check.detail,
          })),
      }));
    return {
      pageId,
      source: "working",
      overallStatus: readiness.overallStatus,
      globalGaps: readiness.globalGaps || [],
      componentGapCount: componentGaps.length,
      componentGaps,
      advisoryComponentCount: components.filter((component) => Array.isArray(component.advisories) && component.advisories.length > 0).length,
      fallbackComponentCount: components.filter((component) => component.sourceResolution && component.sourceResolution !== "direct").length,
      fallbackComponents: components
        .filter((component) => component.sourceResolution && component.sourceResolution !== "direct")
        .map((component) => ({
          componentId: component.componentId,
          slotId: component.slotId,
          activeSourceId: component.activeSourceId,
          sourceResolution: component.sourceResolution,
          resolvedRenderSourceId: component.resolvedRenderSourceId,
          detail: component.sourceResolutionDetail || null,
        })),
      linkCoverage: readiness.linkCoverage || null,
    };
  });
}

function buildVisualReviewManifest() {
  const batch = readVisualBatchSummary();
  const homeLowerSlots = [
    "brand-showroom",
    "latest-product-news",
    "space-renewal",
    "subscription",
    "smart-life",
    "missed-benefits",
    "lg-best-care",
    "bestshop-guide",
    "summary-banner-2",
  ];
  const homeLower = homeLowerSlots.map((slotId) => {
    const dir = path.join(VISUAL_DIR, "home-lower", slotId);
    return {
      slotId,
      liveReference: toVisualUrl(path.join(dir, "live-reference.png")),
      working: toVisualUrl(path.join(dir, "working.png")),
      metadata: toVisualUrl(path.join(dir, "metadata.json")),
    };
  });

  const servicePages = ["support", "bestshop", "care-solutions"].map((pageId) => {
    const referencePc = findServicePageVisualCapture(pageId, "pc", "reference");
    const workingPc = findServicePageVisualCapture(pageId, "pc", "working");
    const referenceMo = findServicePageVisualCapture(pageId, "mo", "reference");
    const workingMo = findServicePageVisualCapture(pageId, "mo", "working");
    return {
      pageId,
      compareUrl: `/compare/${encodeURIComponent(pageId)}`,
      pc: {
        reference: toVisualUrl(referencePc?.artifact?.screenshotPath),
        working: toVisualUrl(workingPc?.artifact?.screenshotPath),
      },
      mo: {
        reference: toVisualUrl(referenceMo?.artifact?.screenshotPath),
        working: toVisualUrl(workingMo?.artifact?.screenshotPath),
      },
    };
  });

  const plpPages = ["category-tvs", "category-refrigerators"].map((pageId) => {
    const referencePc = findPlpVisualCapture(pageId, "pc", "reference");
    const workingPc = findPlpVisualCapture(pageId, "pc", "working");
    const referenceMo = findPlpVisualCapture(pageId, "mo", "reference");
    const workingMo = findPlpVisualCapture(pageId, "mo", "working");
    return {
      pageId,
      compareUrl: `/compare/${encodeURIComponent(pageId)}`,
      pc: {
        reference: toVisualUrl(referencePc?.artifact?.screenshotPath),
        working: toVisualUrl(workingPc?.artifact?.screenshotPath),
      },
      mo: {
        reference: toVisualUrl(referenceMo?.artifact?.screenshotPath),
        working: toVisualUrl(workingMo?.artifact?.screenshotPath),
      },
    };
  });

  return {
    generatedAt: batch?.generatedAt || null,
    batchStatus: batch?.overallStatus || "pending",
    home: {
      compareUrl: "/compare/home",
      liveReference: toVisualUrl(path.join(VISUAL_DIR, "home", "live-reference.png")),
      working: toVisualUrl(path.join(VISUAL_DIR, "home", "working.png")),
      compareImage: toVisualUrl(path.join(VISUAL_DIR, "home", "compare.png")),
    },
    homeLower,
    servicePages,
    plpPages,
  };
}

function buildFinalAcceptanceBundles() {
  const review = buildVisualReviewManifest();
  const homeLowerMap = new Map((review.homeLower || []).map((item) => [item.slotId, item]));
  const serviceMap = new Map((review.servicePages || []).map((item) => [item.pageId, item]));
  const plpMap = new Map((review.plpPages || []).map((item) => [item.pageId, item]));

  return {
    generatedAt: review.generatedAt || null,
    batchStatus: review.batchStatus || "pending",
    bundles: [
      {
        bundleId: "home-core",
        title: "Home Core",
        pageId: "home",
        items: ["header-top", "header-bottom", "hero", "quickmenu", "md-choice", "timedeal", "best-ranking"],
        review: review.home,
      },
      {
        bundleId: "home-lower-primary",
        title: "Home Lower Primary",
        pageId: "home",
        items: ["space-renewal", "subscription", "brand-showroom", "latest-product-news", "smart-life"],
        review: {
          compareUrl: "/compare/home",
          sections: ["space-renewal", "subscription", "brand-showroom", "latest-product-news", "smart-life"].map((slotId) => homeLowerMap.get(slotId)).filter(Boolean),
        },
      },
      {
        bundleId: "home-lower-secondary",
        title: "Home Lower Secondary",
        pageId: "home",
        items: ["summary-banner-2", "missed-benefits", "lg-best-care", "bestshop-guide"],
        review: {
          compareUrl: "/compare/home",
          sections: ["summary-banner-2", "missed-benefits", "lg-best-care", "bestshop-guide"].map((slotId) => homeLowerMap.get(slotId)).filter(Boolean),
        },
      },
      {
        bundleId: "support-pcmo",
        title: "Support PC/MO",
        pageId: "support",
        items: ["mainService", "notice", "tipsBanner", "bestcare"],
        review: serviceMap.get("support") || null,
      },
      {
        bundleId: "bestshop-pcmo",
        title: "Bestshop PC/MO",
        pageId: "bestshop",
        items: ["hero", "shortcut", "review"],
        review: serviceMap.get("bestshop") || null,
      },
      {
        bundleId: "care-solutions-pcmo",
        title: "Care Solutions PC/MO",
        pageId: "care-solutions",
        items: ["hero", "ranking", "benefit", "tabs", "careBanner"],
        review: serviceMap.get("care-solutions") || null,
      },
      {
        bundleId: "category-tvs-pcmo",
        title: "Category TVs PC/MO",
        pageId: "category-tvs",
        items: ["banner", "filter", "sort", "productGrid"],
        review: plpMap.get("category-tvs") || null,
      },
      {
        bundleId: "category-refrigerators-pcmo",
        title: "Category Refrigerators PC/MO",
        pageId: "category-refrigerators",
        items: ["banner", "filter", "sort", "productGrid"],
        review: plpMap.get("category-refrigerators") || null,
      },
    ],
  };
}

function buildAcceptanceResultsReport(options = {}) {
  const editableData = options.editableData || {};
  const pageIdFilter = String(options.pageId || "").trim();
  const cacheKey = buildWorkspacePageCacheKey(editableData || {}, pageIdFilter || "all", `acceptance-results:${pageIdFilter || "all"}`);
  return readCachedValue(ACCEPTANCE_RESULTS_CACHE, cacheKey, () => {
    const bundlesPayload = buildFinalAcceptanceBundles();
    const bundles = Array.isArray(bundlesPayload.bundles) ? bundlesPayload.bundles : [];
    const targetBundles = pageIdFilter ? bundles.filter((bundle) => bundle.pageId === pageIdFilter) : bundles;
    const pageAdvisories = buildPageOperationalAdvisories();
    const advisoryMetaMap = buildPageAdvisoryMetaMap();
    const pageGapMap = new Map();
    for (const pageId of new Set(targetBundles.map((bundle) => String(bundle.pageId || "").trim()).filter(Boolean))) {
      pageGapMap.set(pageId, buildPreLlmGapReport(pageId, { editableData }));
    }
    const allItems = targetBundles.map((bundle) => {
      const result = findAcceptanceResult(editableData, bundle.bundleId);
      const pageGap = pageGapMap.get(bundle.pageId) || { componentGaps: [], fallbackComponents: [] };
      const itemSlotIds = new Set((bundle.items || []).map((item) => String(item || "").trim()).filter(Boolean));
      const componentGaps = (pageGap.componentGaps || []).filter((item) => {
        const itemSlotId = String(item.slotId || "").trim();
        return itemSlotIds.has(itemSlotId);
      });
      const fallbackComponents = (pageGap.fallbackComponents || []).filter((item) => itemSlotIds.has(String(item.slotId || "").trim()));
      const pageAdvisoryItems = Array.isArray(pageAdvisories?.[bundle.pageId]) ? pageAdvisories[bundle.pageId] : [];
      const pageAdvisoryMeta = advisoryMetaMap?.[bundle.pageId] || { count: 0, highestSeverity: "none", advisoryRiskScore: 0 };
      const componentGapCount = componentGaps.length;
      const fallbackComponentCount = fallbackComponents.length;
      const reviewPriority =
        componentGapCount > 0 ? "high" : fallbackComponentCount > 0 || pageAdvisoryMeta.advisoryRiskScore > 0 ? "medium" : "normal";
      const riskScore = componentGapCount * 100 + fallbackComponentCount * 10 + Number(pageAdvisoryMeta.advisoryRiskScore || 0);
      return {
        bundleId: bundle.bundleId,
        pageId: bundle.pageId,
        title: bundle.title,
        items: bundle.items || [],
        status: result?.status || "pending",
        note: result?.note || "",
        updatedAt: result?.updatedAt || null,
        review: bundle.review || null,
        bundleContext: {
          componentGapCount,
          fallbackComponentCount,
          pageAdvisoryCount: pageAdvisoryMeta.count,
          pageAdvisorySeverity: pageAdvisoryMeta.highestSeverity,
          reviewPriority,
          riskScore,
          componentGaps,
          fallbackComponents,
          pageAdvisories: pageAdvisoryItems,
        },
      };
    });
    const pageSummaries = Array.from(
      allItems.reduce((map, item) => {
        const current = map.get(item.pageId) || { pageId: item.pageId, total: 0, pass: 0, fail: 0, pending: 0, componentGapCount: 0, fallbackComponentCount: 0, pageAdvisoryCount: 0, pageAdvisorySeverity: "none", maxRiskScore: 0 };
        current.total += 1;
        current[item.status] += 1;
        current.componentGapCount += Number(item.bundleContext?.componentGapCount || 0);
        current.fallbackComponentCount += Number(item.bundleContext?.fallbackComponentCount || 0);
        current.pageAdvisoryCount = Math.max(Number(current.pageAdvisoryCount || 0), Number(item.bundleContext?.pageAdvisoryCount || 0));
        const severityRank = { none: 0, info: 1, warning: 2, error: 3 };
        const nextSeverity = String(item.bundleContext?.pageAdvisorySeverity || "none");
        if ((severityRank[nextSeverity] || 0) > (severityRank[current.pageAdvisorySeverity] || 0)) {
          current.pageAdvisorySeverity = nextSeverity;
        }
        current.maxRiskScore = Math.max(Number(current.maxRiskScore || 0), Number(item.bundleContext?.riskScore || 0));
        map.set(item.pageId, current);
        return map;
      }, new Map()).values()
    );
    const nextPendingBundle =
      allItems
        .filter((item) => item.status === "pending")
        .sort((a, b) => {
          const ar = Number(a.bundleContext?.riskScore || 0);
          const br = Number(b.bundleContext?.riskScore || 0);
          if (ar !== br) return br - ar;
          return 0;
        })[0] || null;
    const counts = {
      total: allItems.length,
      pass: allItems.filter((item) => item.status === "pass").length,
      fail: allItems.filter((item) => item.status === "fail").length,
      pending: allItems.filter((item) => item.status === "pending").length,
    };
    return {
      pageId: pageIdFilter || null,
      generatedAt: new Date().toISOString(),
      counts,
      overallStatus: counts.total > 0 && counts.pass === counts.total ? "accepted" : counts.fail > 0 ? "needs-review" : "in-progress",
      nextPendingBundle,
      pageSummaries,
      items: allItems,
    };
  });
}

function buildAcceptanceQueueReport(options = {}) {
  const acceptance = buildAcceptanceResultsReport(options);
  const items = Array.isArray(acceptance.items) ? acceptance.items : [];
  const queue = items
    .filter((item) => item.status === "pending" || item.status === "fail")
    .sort((a, b) => {
      const statusRank = { fail: 0, pending: 1, pass: 2 };
      const ar = statusRank[a.status] ?? 9;
      const br = statusRank[b.status] ?? 9;
      if (ar !== br) return ar - br;
      const riskDiff = Number(b.bundleContext?.riskScore || 0) - Number(a.bundleContext?.riskScore || 0);
      if (riskDiff !== 0) return riskDiff;
      return String(a.bundleId || "").localeCompare(String(b.bundleId || ""), "ko");
    });
  return {
    pageId: acceptance.pageId,
    generatedAt: acceptance.generatedAt,
    queueCount: queue.length,
    queue,
    next: queue[0] || null,
  };
}

function buildLlmEditableList(pageId, options = {}) {
  const editableCatalog = buildWorkingEditableComponentCatalog(pageId, options);
  const inventory = buildWorkingComponentInventory(pageId, options);
  const inventoryMap = new Map((inventory.components || []).map((component) => [component.componentId, component]));
  const components = (editableCatalog.components || [])
    .filter((component) => {
      const patchSchema = component.patchSchema || { rootKeys: [], styleKeys: [] };
      return (
        (component.editableProps || []).length > 0 ||
        (component.editableStyles || []).length > 0 ||
        (patchSchema.rootKeys || []).length > 0 ||
        (patchSchema.styleKeys || []).length > 0
      );
    })
    .map((component) => {
      const inventoryItem = inventoryMap.get(component.componentId) || {};
      return {
        componentId: component.componentId,
        slotId: component.slotId,
        kind: inventoryItem.kind || component.kind || "section",
        activeSourceId: inventoryItem.activeSourceId || component.activeSourceId || null,
        editableProps: component.editableProps || [],
        editableStyles: component.editableStyles || [],
        patchSchema: component.patchSchema || { rootKeys: [], styleKeys: [] },
        interactionIds: inventoryItem.interactionIds || [],
      };
    });
  return {
    pageId,
    source: "working",
    componentCount: components.length,
    components,
  };
}

function mergeReferenceSlotMatches(referenceAnalyses = []) {
  const slotMap = new Map();
  for (const analysis of referenceAnalyses || []) {
    for (const match of analysis?.slotMatches || []) {
      const slotId = String(match?.slotId || "").trim();
      if (!slotId) continue;
      const score = Number(match?.score || 0);
      const current = slotMap.get(slotId);
      if (!current || score > Number(current.score || 0)) {
        slotMap.set(slotId, {
          slotId,
          confidence: String(match?.confidence || "low"),
          score,
          reasons: Array.isArray(match?.reasons) ? match.reasons.slice(0, 3) : [],
          referenceUrl: analysis?.requestedUrl || analysis?.finalUrl || null,
        });
      }
    }
  }
  return Array.from(slotMap.values()).sort(
    (a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.slotId).localeCompare(String(b.slotId), "ko")
  );
}

function buildPlannerPageContext(pageId, viewportProfile, editableData) {
  const normalizedPageId = String(pageId || "").trim();
  const page = findPage(editableData || {}, normalizedPageId);
  const pdpContext = resolvePdpRuntimeContext(normalizedPageId);
  return {
    workspacePageId: normalizedPageId,
    runtimePageId: pdpContext?.runtimePageId || normalizedPageId,
    pageLabel: pdpContext?.title || page?.title || normalizedPageId,
    pageGroup: String(page?.pageGroup || (pdpContext ? "product-detail" : "other")).trim() || "other",
    viewportProfile: String(viewportProfile || "pc").trim() || "pc",
  };
}

function buildPlannerWorkspaceContext(userId, pageId) {
  const pinned = getPinnedView(userId, pageId);
  const recentVersions = listSavedVersions(userId, { pageId, limit: 10 });
  return {
    currentWorkingVersionId: recentVersions[0]?.id || null,
    currentViewVersionId: pinned?.versionId || null,
    recentVersionCount: recentVersions.length,
  };
}

function normalizeDesignChangeLevel(value, fallback = "medium") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return fallback;
}

function buildPlannerPageSummary(pageId, editableData, options = {}) {
  const editableList = buildLlmEditableList(pageId, { editableData });
  const targetScope = String(options.targetScope || "page").trim() || "page";
  const targetComponents = safeArray(options.targetComponents || [], 50)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const targetComponentSet = new Set(targetComponents);
  const filteredComponents =
    targetScope === "components" && targetComponentSet.size
      ? (editableList.components || []).filter((item) => targetComponentSet.has(String(item.componentId || "").trim()))
      : (editableList.components || []);
  const patches = listComponentPatches(editableData || {}, pageId).map((item) => ({
    componentId: item.componentId,
    sourceId: item.sourceId || null,
    patchedKeys: item.patch && typeof item.patch === "object" ? Object.keys(item.patch) : [],
    updatedAt: item.updatedAt || null,
  })).filter((item) => {
    if (targetScope !== "components" || !targetComponentSet.size) return true;
    return targetComponentSet.has(String(item.componentId || "").trim());
  });
  return {
    editableSlots: filteredComponents.map((item) => item.slotId),
    existingComponents: filteredComponents.map((item) => item.componentId),
    currentPatchSummary: patches.slice(0, 20),
    targeting: {
      scope: targetScope,
      componentIds: targetComponents,
    },
  };
}

function buildBuilderDesignGuidance(pageId, editableComponents = [], options = {}) {
  const normalizedPageId = String(pageId || "").trim();
  const targetScope = String(options.targetScope || "page").trim() || "page";
  const designChangeLevel = normalizeDesignChangeLevel(options.designChangeLevel, "medium");
  const slotIds = Array.from(
    new Set((editableComponents || []).map((item) => String(item?.slotId || "").trim()).filter(Boolean))
  );
  const isPdp = isPdpCasePageId(normalizedPageId);
  const isPlp = normalizedPageId.startsWith("category-");
  const pageType = isPdp ? "pdp" : isPlp ? "plp" : normalizedPageId === "home" ? "home" : "generic";
  const visualFocusByType = {
    home: [
      "첫 인상과 브랜드 톤을 우선한다.",
      "상단 주요 메시지와 하단 큐레이션 섹션의 연결감을 맞춘다.",
      "완성형 구현보다 고객 프리뷰로서 설득력 있는 화면 인상을 만든다.",
    ],
    plp: [
      "상품 탐색성이 흔들리지 않게 필터/정렬/그리드의 가독성을 우선한다.",
      "프로모션 톤은 주되 상품 비교 흐름을 방해하지 않는다.",
      "카드 밀도와 정보 위계를 정리해 스캔이 쉬운 화면을 만든다.",
    ],
    pdp: [
      "상품 요약, 가격, 구매 유도 영역의 신뢰감과 명료함을 우선한다.",
      "핵심 메시지는 갤러리/요약/고정 구매 영역에 집중한다.",
      "사양, 가격, 옵션 정보는 보존하고 톤과 카피 정리 중심으로 접근한다.",
    ],
    generic: [
      "현재 페이지의 핵심 사용자 흐름을 유지한다.",
      "수정 범위 안에서 가장 체감이 큰 시각 변화를 우선한다.",
    ],
  };
  const changeProfiles = {
    low: {
      label: "하",
      layoutShift: "minimal",
      copyShift: "light",
      sourceSwap: "minimal",
      motionLevel: "minimal",
      emphasisLevel: "soft",
      guidance: [
        "현재 화면 인상을 유지하면서 카피, 톤, 강조점만 가볍게 정리한다.",
        "기존 source와 구조를 최대한 유지한다.",
      ],
    },
    medium: {
      label: "중",
      layoutShift: "controlled",
      copyShift: "noticeable",
      sourceSwap: "selective",
      motionLevel: "subtle",
      emphasisLevel: "moderate",
      guidance: [
        "현재 구조를 유지하되 섹션 인상과 시각 위계를 체감되게 조정한다.",
        "필요한 슬롯에서는 source 교체와 patch를 함께 쓸 수 있다.",
      ],
    },
    high: {
      label: "상",
      layoutShift: "assertive-within-baseline",
      copyShift: "strong",
      sourceSwap: "active",
      motionLevel: "meaningful",
      emphasisLevel: "strong",
      guidance: [
        "브랜드 baseline을 유지한 채 핵심 슬롯의 인상 변화가 분명하게 느껴지도록 만든다.",
        "hero, summary, gallery, sticky 같은 핵심 슬롯에서 시각 체감을 적극적으로 만든다.",
      ],
    },
  };
  return {
    pageType,
    targetScope,
    designChangeLevel,
    designChangeProfile: changeProfiles[designChangeLevel] || changeProfiles.medium,
    targetSlotIds: slotIds,
    targetComponentCount: Array.isArray(editableComponents) ? editableComponents.length : 0,
    visualFocus: visualFocusByType[pageType] || visualFocusByType.generic,
    visualRules: [
      "고객 프리뷰용 시안이므로 브랜드 디자인 우선으로 설득력 있는 방향성을 만든다.",
      "지원된 slot/source/patch 범위 안에서만 변경하되, 변화율이 허용하는 탐색 폭은 적극 활용한다.",
      "사실 정보와 실제 상품 데이터는 왜곡하지 않는다.",
    ],
    changeLevelGuidance: Object.fromEntries(
      Object.entries(changeProfiles).map(([key, value]) => [key, value.guidance])
    ),
  };
}

function buildBuilderSystemContext(pageId, editableData, options = {}) {
  const slotRegistry = findSlotRegistry(editableData || {}, pageId) || { pageId, slots: [] };
  const editableComponentsPayload = buildLlmEditableList(pageId, { editableData });
  const targetScope = String(options.targetScope || "page").trim() || "page";
  const targetComponents = safeArray(options.targetComponents || [], 50)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const designChangeLevel = normalizeDesignChangeLevel(options.designChangeLevel, "medium");
  const targetComponentSet = new Set(targetComponents);
  const editableComponents =
    targetScope === "components" && targetComponentSet.size
      ? (editableComponentsPayload.components || []).filter((item) => targetComponentSet.has(String(item.componentId || "").trim()))
      : (editableComponentsPayload.components || []);
  const allowedSlotIds = new Set(editableComponents.map((item) => String(item.slotId || "").trim()).filter(Boolean));
  const currentPatches = listComponentPatches(editableData || {}, pageId)
    .filter((item) => {
      if (targetScope !== "components" || !targetComponentSet.size) return true;
      return targetComponentSet.has(String(item.componentId || "").trim());
    })
    .map((item) => ({
    componentId: item.componentId,
    sourceId: item.sourceId || null,
    updatedAt: item.updatedAt || null,
    patch: item.patch && typeof item.patch === "object" ? item.patch : {},
  }));
  const patchSchemaMap = Object.fromEntries(
    editableComponents.map((item) => [item.componentId, item.patchSchema || { rootKeys: [], styleKeys: [] }])
  );
  return {
    slotRegistry: {
      ...slotRegistry,
      slots:
        targetScope === "components" && allowedSlotIds.size
          ? (slotRegistry.slots || []).filter((item) => allowedSlotIds.has(String(item.slotId || "").trim()))
          : (slotRegistry.slots || []),
    },
    editableComponents,
    patchSchemaMap,
    currentPatches,
    targeting: {
      scope: targetScope,
      componentIds: targetComponents,
    },
    designToolContext: {
      designChangeLevel,
      availableTools: [
        {
          id: "slot_source_switch",
          category: "editing",
          whenToUse: "기존 캡처/커스텀/피그마 파생 소스 중 시안 방향에 더 맞는 소스로 바꿀 때",
        },
        {
          id: "component_patch",
          category: "editing",
          whenToUse: "허용된 patch schema 안에서 제목/부제/설명/스타일을 미세 조정할 때",
        },
        {
          id: "preview_render",
          category: "preview",
          whenToUse: "변경 결과를 clone 미리보기에서 바로 확인할 때",
        },
        {
          id: "version_save",
          category: "versioning",
          whenToUse: "현재 draft를 저장 가능한 시안 버전으로 확정할 때",
        },
        {
          id: "view_pin",
          category: "versioning",
          whenToUse: "저장된 버전을 clone에 실제로 노출할 대표 View로 고정할 때",
        },
      ],
      workflowOrder: [
        "approved_plan_review",
        "slot_source_switch",
        "component_patch",
        "preview_render",
        "version_save",
        "view_pin",
      ],
      patchStrategy: [
        "브랜드 인상을 살리는 방향이라면 변화율이 허용하는 범위에서 source switch와 component patch를 적극 사용할 수 있다.",
        "허용된 rootKeys/styleKeys 밖의 필드는 만들지 않는다.",
        "targetScope가 components이면 해당 범위 바깥 slot은 건드리지 않는다.",
      ],
      designSurfaces: [
        {
          id: "copy_tone",
          whenToUse: "제목/부제/설명 카피의 톤과 강도를 조절할 때",
        },
        {
          id: "content_hierarchy",
          whenToUse: "요약/강조 문구의 노출 우선순위를 조정할 때",
        },
        {
          id: "visual_emphasis",
          whenToUse: "hero, summary, gallery, sticky 등 핵심 슬롯의 인상을 조절할 때",
        },
        {
          id: "source_choice",
          whenToUse: "같은 슬롯 안에서 더 적합한 캡처/커스텀 소스를 선택할 때",
        },
        {
          id: "local_style_patch",
          whenToUse: "허용된 style patch로 분위기와 밀도를 미세 조정할 때",
        },
      ],
      brandSafetyRules: [
        "현재 페이지 baseline을 기준으로 움직이고 외부 레퍼런스는 분위기 참고용으로만 사용한다.",
        "브랜드 디자인을 우선하되 변화율이 허용하는 탐색 폭은 제한하지 않는다.",
        "브랜드 정체성을 벗어나는 과한 실험적 패턴만 금지한다.",
        "가격/스펙/상품 사실 정보는 바꾸지 않는다.",
      ],
      visualPrinciples: buildBuilderDesignGuidance(pageId, editableComponents, {
        targetScope,
        designChangeLevel,
      }),
    },
  };
}

function buildPreviewUrlForWorkspacePage(pageId) {
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return "/admin";
  if (isPdpCasePageId(normalizedPageId)) {
    const pdpContext = resolvePdpRuntimeContext(normalizedPageId);
    const params = new URLSearchParams();
    params.set("pageId", normalizedPageId);
    if (pdpContext?.href) params.set("href", pdpContext.href);
    if (pdpContext?.route) params.set("title", pdpContext.route);
    return `/clone-product?${params.toString()}`;
  }
  return `/clone/${encodeURIComponent(normalizedPageId)}`;
}

function buildBuilderInputPayload({
  editableData,
  pageId,
  viewportProfile,
  approvedPlan,
  intensity,
  versionLabelHint,
  designChangeLevel,
  targetScope,
  targetComponents,
}) {
  const pageContext = buildPlannerPageContext(pageId, viewportProfile, editableData);
  const normalizedDesignChangeLevel = normalizeDesignChangeLevel(
    designChangeLevel || approvedPlan?.designChangeLevel,
    "medium"
  );
  return {
    pageContext,
    approvedPlan,
    systemContext: buildBuilderSystemContext(pageId, editableData, {
      designChangeLevel: normalizedDesignChangeLevel,
      targetScope,
      targetComponents,
    }),
    generationOptions: {
      intensity: String(intensity || "balanced").trim() || "balanced",
      createNewVersion: true,
      versionLabelHint: String(versionLabelHint || "").trim(),
      designChangeLevel: normalizedDesignChangeLevel,
      targetScope: String(targetScope || "page").trim() || "page",
      targetComponents: safeArray(targetComponents || [], 50),
    },
  };
}

async function buildPlannerInputPayload({
  user,
  editableData,
  pageId,
  viewportProfile,
  mode,
  requestText,
  keyMessage,
  preferredDirection,
  avoidDirection,
  toneAndMood,
  referenceUrls,
  designChangeLevel,
  targetScope,
  targetComponents,
}) {
  const pageContext = buildPlannerPageContext(pageId, viewportProfile, editableData);
  const normalizedTargetScope = String(targetScope || "page").trim() || "page";
  const normalizedDesignChangeLevel = normalizeDesignChangeLevel(designChangeLevel, "medium");
  const normalizedTargetComponents = safeArray(targetComponents || [], 50)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const pageSummary = buildPlannerPageSummary(pageId, editableData, {
    targetScope: normalizedTargetScope,
    targetComponents: normalizedTargetComponents,
  });
  const referenceAnalyses = await analyzeReferenceUrls(referenceUrls, {
    pageId,
    pageGroup: pageContext.pageGroup,
    viewportProfile,
    editableSlots: pageSummary.editableSlots,
  });
  const guardrailBundle = buildGuardrailBundle({
    pageId,
    pageGroup: pageContext.pageGroup,
    editableSlots: pageSummary.editableSlots,
    referenceAnalyses,
  });
  return {
    mode: String(mode || "direct").trim() || "direct",
    pageContext,
    workspaceContext: buildPlannerWorkspaceContext(user.userId, pageId),
    userInput: {
      requestText: String(requestText || "").trim(),
      keyMessage: String(keyMessage || "").trim(),
      preferredDirection: String(preferredDirection || "").trim(),
      avoidDirection: String(avoidDirection || "").trim(),
      toneAndMood: String(toneAndMood || "").trim(),
      referenceUrls: safeArray(referenceUrls || [], 5),
      designChangeLevel: normalizedDesignChangeLevel,
      targetScope: normalizedTargetScope,
      targetComponents: normalizedTargetComponents,
    },
    pageSummary,
    referenceSummary: {
      analyses: referenceAnalyses,
      mergedSlotMatches: mergeReferenceSlotMatches(referenceAnalyses),
    },
    guardrailBundle,
  };
}

function buildFinalReadinessReport(options = {}) {
  const acceptedPageIds = [
    "home",
    "support",
    "bestshop",
    "care-solutions",
    "category-tvs",
    "category-refrigerators",
  ];
  const batch = readVisualBatchSummary();
  const bundles = buildFinalAcceptanceBundles();
  const acceptance = buildAcceptanceResultsReport({ editableData: options.editableData });
  const acceptanceQueue = buildAcceptanceQueueReport({ editableData: options.editableData });
  const advisoryMetaMap = buildPageAdvisoryMetaMap();
  const pageNextBundleMap = new Map();
  for (const item of acceptance.items || []) {
    if (item.status !== "fail" && item.status !== "pending") continue;
    const current = pageNextBundleMap.get(item.pageId);
    if (!current) {
      pageNextBundleMap.set(item.pageId, item);
      continue;
    }
    const currentStatusRank = current.status === "fail" ? 0 : 1;
    const nextStatusRank = item.status === "fail" ? 0 : 1;
    if (nextStatusRank < currentStatusRank) {
      pageNextBundleMap.set(item.pageId, item);
      continue;
    }
    const currentRisk = Number(current.bundleContext?.riskScore || 0);
    const nextRisk = Number(item.bundleContext?.riskScore || 0);
    if (nextStatusRank === currentStatusRank && nextRisk > currentRisk) {
      pageNextBundleMap.set(item.pageId, item);
      continue;
    }
    if (nextStatusRank === currentStatusRank && nextRisk === currentRisk) {
      const currentId = String(current.bundleId || "");
      const nextId = String(item.bundleId || "");
      if (nextId.localeCompare(currentId, "ko") < 0) {
        pageNextBundleMap.set(item.pageId, item);
      }
    }
  }
  const acceptedBundleCount = acceptance.counts.total > 0 && acceptance.counts.pass === acceptance.counts.total;
  const pages = acceptedPageIds.map((pageId) => {
    const gaps = buildPreLlmGapReport(pageId, options);
    const editable = buildLlmEditableList(pageId, options);
    const acceptancePage = (acceptance.pageSummaries || []).find((item) => item.pageId === pageId) || null;
    const nextBundle = pageNextBundleMap.get(pageId) || null;
    const advisoryMeta = advisoryMetaMap[pageId] || { count: 0, highestSeverity: "none", advisoryRiskScore: 0 };
    return {
      pageId,
      preLlmStatus: gaps.overallStatus,
      componentGapCount: gaps.componentGapCount,
      advisoryComponentCount: gaps.advisoryComponentCount || 0,
      fallbackComponentCount: gaps.fallbackComponentCount || 0,
      pageAdvisoryCount: advisoryMeta.count,
      highestAdvisorySeverity: advisoryMeta.highestSeverity,
      advisoryRiskScore: advisoryMeta.advisoryRiskScore,
      maxRiskScore: Number(acceptancePage?.maxRiskScore || 0),
      editableComponentCount: editable.componentCount,
      nextBundleId: nextBundle?.bundleId || null,
      nextBundleStatus: nextBundle?.status || null,
      nextBundleRiskScore: Number(nextBundle?.bundleContext?.riskScore || 0),
      nextBundleCompareUrl: nextBundle?.review?.compareUrl || null,
      acceptanceStatus:
        acceptancePage && acceptancePage.total > 0 && acceptancePage.pass === acceptancePage.total
          ? "accepted"
          : acceptancePage && acceptancePage.fail > 0
            ? "needs-review"
            : "in-progress",
      acceptanceCounts: acceptancePage || { pageId, total: 0, pass: 0, fail: 0, pending: 0 },
    };
  });
  const failingPages = pages.filter((page) => page.preLlmStatus !== "pass");
  const actionablePages = pages
    .filter((page) => page.acceptanceStatus === "needs-review" || page.acceptanceStatus === "in-progress")
    .sort((a, b) => {
      const acceptanceRank = { "needs-review": 0, "in-progress": 1, accepted: 2 };
      const ar = acceptanceRank[a.acceptanceStatus] ?? 9;
      const br = acceptanceRank[b.acceptanceStatus] ?? 9;
      if (ar !== br) return ar - br;
      const riskDiff = Number(b.maxRiskScore || 0) - Number(a.maxRiskScore || 0);
      if (riskDiff !== 0) return riskDiff;
      const fallbackDiff = Number(b.fallbackComponentCount || 0) - Number(a.fallbackComponentCount || 0);
      if (fallbackDiff !== 0) return fallbackDiff;
      const advisoryDiff = Number(b.advisoryRiskScore || 0) - Number(a.advisoryRiskScore || 0);
      if (advisoryDiff !== 0) return advisoryDiff;
      const pendingDiff = Number(b.acceptanceCounts?.pending || 0) - Number(a.acceptanceCounts?.pending || 0);
      if (pendingDiff !== 0) return pendingDiff;
      return String(a.pageId || "").localeCompare(String(b.pageId || ""), "ko");
    });
  const nextActionablePageId =
    actionablePages[0]?.pageId || null;
  const llmGateStatus =
    (batch?.overallStatus || "pending") === "pass" && failingPages.length === 0 && acceptedBundleCount
      ? "ready-for-llm"
      : "blocked-by-acceptance";
  return {
    generatedAt: new Date().toISOString(),
    visualBatchStatus: batch?.overallStatus || "pending",
    acceptanceBundleCount: (bundles.bundles || []).length,
    acceptance: acceptance.counts,
    fallbackComponentCount: pages.reduce((sum, page) => sum + Number(page.fallbackComponentCount || 0), 0),
    advisoryComponentCount: pages.reduce((sum, page) => sum + Number(page.advisoryComponentCount || 0), 0),
    pageAdvisoryCount: pages.reduce((sum, page) => sum + Number(page.pageAdvisoryCount || 0), 0),
    warningPageCount: pages.filter((page) => page.highestAdvisorySeverity === "warning").length,
    errorPageCount: pages.filter((page) => page.highestAdvisorySeverity === "error").length,
    nextActionablePageId,
    nextAcceptanceTarget: acceptanceQueue.next || acceptance.nextPendingBundle || null,
    acceptanceQueuePreview: (acceptanceQueue.queue || []).slice(0, 5),
    llmGateStatus,
    overallStatus:
      (batch?.overallStatus || "pending") === "pass" &&
      failingPages.length === 0 &&
      acceptance.counts.total > 0 &&
      acceptance.counts.pass === acceptance.counts.total
        ? "accepted"
        : (batch?.overallStatus || "pending") === "pass" && failingPages.length === 0
          ? "ready-for-acceptance"
          : "needs-review",
    pages,
    failingPages: failingPages.map((page) => page.pageId),
  };
}

function buildWorkingSlotSnapshot(pageId) {
  const baseline = resolveBaselineInfo(pageId);
  const archiveRow = getArchiveRowByPageId(pageId);
  if (!archiveRow) return null;
  const rawHtml = readCloneSourceHtmlByPageId(pageId) || "";
  const shellGnb = buildShellGnbData();
  const quickMenus = pageId === "home" ? extractQuickMenuSlides(rawHtml) : [];
  const desktopHeroSlides = pageId === "home" ? extractHomeHeroSlides(rawHtml) : [];
  const defaultDesktopHeroSlide = desktopHeroSlides[1] || desktopHeroSlides[0] || null;
  const heroAsset = selectHeroAsset(archiveRow.assets || []);
  const menuStateMap = {
    "제품/소모품": "gnb-product-open",
    "가전 구독": "gnb-care-open",
    "고객지원": "gnb-support-open",
    "혜택/이벤트": "gnb-benefits-open",
    "스토리": "gnb-story-open",
    "베스트샵": "gnb-bestshop-open",
    "LG AI": "gnb-lgai-open",
  };

  if (baseline.mode === "hybrid" && pageId === "home") {
    const mobileHtml = readHomeMobileHtml() || "";
    const mobileHeroSlides = extractHomeHeroSlides(mobileHtml || rawHtml);
    const mobileQuickMenus = extractMobileQuickMenuItems(mobileHtml);
    const homeEnhancements = parseHomeEnhancements(rawHtml, mobileHtml, {});
    const lowerItemCountMap = {
      "md-choice": homeEnhancements.mdChoiceProducts?.length || 0,
      timedeal: homeEnhancements.timedealProducts?.length || 0,
      "best-ranking": HOME_BEST_RANKING_SAMPLE_ITEMS.length,
      "space-renewal": buildSpaceRenewalProducts(homeEnhancements.spaceRenewalData).length || 0,
      subscription: homeEnhancements.subscriptionProducts?.length || 0,
      "brand-showroom": homeEnhancements.brandShowroomProducts?.length || 0,
      "latest-product-news": homeEnhancements.latestProductNewsProducts?.length || 0,
      "smart-life": homeEnhancements.smartLifeProducts?.length || 0,
      "summary-banner-2": homeEnhancements.lowerPromotionProducts?.length || 0,
      "missed-benefits": homeEnhancements.missedBenefitsProducts?.length || 0,
      "lg-best-care": homeEnhancements.lgBestCareProducts?.length || 0,
      "bestshop-guide": homeEnhancements.bestshopGuideProducts?.length || (homeEnhancements.bestshopGuideSection ? 1 : 0),
    };
    const lowerSlots = getHomeLowerSlotRegistry()
      .filter((entry) => entry.enabled(homeEnhancements, {}))
      .map((entry) => ({
        slotId: entry.id,
        kind: "home-lower",
        containerMode: entry.id === "summary-banner-2" ? "full" : "narrow",
        layout: {
          containerRule: entry.id === "summary-banner-2" ? "lower-full-banner" : "lower-mobile-derived",
          rowCountDesktop: 1,
          mobileLike: true,
          sourceId: entry.activeSourceId,
        },
        itemCount: lowerItemCountMap[entry.id] || 0,
        sourceId: entry.activeSourceId,
      }));
    return {
      pageId,
      source: "working",
      url: baseline.url,
      visualUrl: baseline.visualUrl,
      structuralUrl: baseline.structuralUrl,
      mode: baseline.mode,
      viewport: {
        width: 1460,
        height: null,
      },
      zones: baseline.zones || [],
      slots: [
        {
          slotId: "header-top",
          kind: "header",
          structure: "two-tier-header",
          containerMode: "full",
          sourceId: "pc-like",
          layout: {
            tier: 1,
            containerRule: "full-bleed",
            rowCountDesktop: 1,
            align: "baseline",
            density: "compact",
          },
          logoHref: "/clone/home",
          utilityItems: [
            { kind: "search" },
            { kind: "mp" },
            { kind: "cart" },
          ],
          utilityLinks: shellGnb.utilityLinks || [],
        },
        {
          slotId: "header-bottom",
          kind: "header",
          containerMode: "full",
          sourceId: "pc-like",
          layout: {
            tier: 2,
            containerRule: "full-bleed",
            rowCountDesktop: 1,
            align: "center",
            density: "compact",
            containsBrandTabs: true,
            containsHomeStyle: true,
          },
          mainMenus: (shellGnb.topLinks || []).map((item) => item.label),
          brandTabs: (shellGnb.brandTabs || []).map((item) => item.label),
          hasNavArrow: true,
        },
        {
          slotId: "hero",
          kind: "hero",
          containerMode: "full",
          sourceId: "pc-like",
          layout: {
            containerRule: "full-bleed",
            rowCountDesktop: 1,
            contentMode: "split-copy-visual",
            horizontalPadding: 0,
            slideCount: mobileHeroSlides.length,
          },
          imageSrc: mobileHeroSlides[1]?.imageSrc || mobileHeroSlides[0]?.imageSrc || heroAsset?.src || "",
          headline: mobileHeroSlides[1]?.headline || mobileHeroSlides[0]?.headline || "",
          description: mobileHeroSlides[1]?.description || mobileHeroSlides[0]?.description || "",
          badge: mobileHeroSlides[1]?.badge || mobileHeroSlides[0]?.badge || "",
          slides: mobileHeroSlides,
        },
        {
          slotId: "quickmenu",
          kind: "quickmenu",
          containerMode: "narrow",
          sourceId: "mobile-derived",
          layout: {
            containerRule: "narrow-after-hero",
            rowCountDesktop: mobileQuickMenus.length >= 10 ? 2 : 1,
            columnCountDesktop: mobileQuickMenus.length >= 10 ? 5 : Math.max(1, Math.min(5, mobileQuickMenus.length || 1)),
            iconShape: "circle",
            density: "compact",
            mobileLike: true,
          },
          itemCount: mobileQuickMenus.length,
          expectedColumnsDesktop: mobileQuickMenus.length >= 10 ? 5 : Math.max(1, Math.min(5, mobileQuickMenus.length || 1)),
          expectedRowsDesktop: mobileQuickMenus.length >= 10 ? 2 : 1,
          items: mobileQuickMenus,
        },
        ...lowerSlots,
      ],
      states: [
        ...Object.entries(shellGnb.dropdownMenus || {}).map(([menuId, menu]) => ({
          stateId: menuStateMap[menuId] || `gnb-${menuId}`,
          kind: "gnb-open",
          slotId: "header-bottom",
          menuId,
          tabCount: (menu.tabs || []).length,
          panelCount: (menu.panels || []).length,
          tabs: (menu.tabs || []).map((tab) => ({
            id: tab.id,
            label: tab.label,
          })),
          panels: (menu.panels || []).map((panel) => ({
            id: panel.id,
            columns: panel.columns,
          })),
        })),
        ...desktopHeroSlides.map((slide, index) => ({
          stateId: `hero-slide-${index + 1}`,
          kind: "hero-slide",
          slotId: "hero",
          slideIndex: index + 1,
          headline: slide.headline || "",
          description: slide.description || "",
          href: slide.href || "",
        })),
      ],
    };
  }

  return {
    pageId,
    source: "working",
    url: archiveRow.url,
    viewport: {
      width: pageId === "home" ? 1460 : null,
      height: null,
    },
    slots: [
      {
        slotId: "header-top",
        kind: "header",
        structure: "two-tier-header",
        containerMode: "full",
        layout: {
          tier: 1,
          containerRule: "full-bleed",
          rowCountDesktop: 1,
          align: "baseline",
          density: "compact",
        },
        logoHref: "/clone/home",
        utilityItems: [
          { kind: "search" },
          { kind: "mp" },
          { kind: "cart" },
        ],
        utilityLinks: shellGnb.utilityLinks || [],
      },
      {
        slotId: "header-bottom",
        kind: "header",
        containerMode: "full",
        layout: {
          tier: 2,
          containerRule: "full-bleed",
          rowCountDesktop: 1,
          align: "center",
          density: "compact",
          containsBrandTabs: true,
          containsHomeStyle: true,
        },
        mainMenus: (shellGnb.topLinks || []).map((item) => item.label),
        brandTabs: (shellGnb.brandTabs || []).map((item) => item.label),
        hasNavArrow: true,
      },
      {
        slotId: "hero",
        kind: "hero",
        containerMode: "full",
        layout: {
          containerRule: "full-bleed",
          rowCountDesktop: 1,
          contentMode: "split-copy-visual",
          horizontalPadding: 0,
        },
        imageSrc: heroAsset?.src || "",
        headline: "",
        description: "",
        badge: "",
      },
      {
        slotId: "quickmenu",
        kind: "quickmenu",
        containerMode: "narrow",
        layout: {
          containerRule: "narrow-after-hero",
          rowCountDesktop: quickMenus.length >= 10 ? 2 : 1,
          columnCountDesktop: quickMenus.length >= 10 ? 5 : Math.max(1, Math.min(5, quickMenus.length || 1)),
          iconShape: "circle",
          density: "compact",
        },
        itemCount: quickMenus.length,
        expectedColumnsDesktop: quickMenus.length >= 10 ? 5 : Math.max(1, Math.min(5, quickMenus.length || 1)),
        expectedRowsDesktop: quickMenus.length >= 10 ? 2 : 1,
        items: quickMenus.map((item) => ({
          href: item.href,
          title: item.title,
          imageSrc: item.image,
        })),
      },
    ],
    states: Object.entries(shellGnb.dropdownMenus || {}).map(([menuId, menu]) => ({
      stateId: menuStateMap[menuId] || `gnb-${menuId}`,
      kind: "gnb-open",
      slotId: "header-bottom",
      menuId,
      tabCount: (menu.tabs || []).length,
      panelCount: (menu.panels || []).length,
      tabs: (menu.tabs || []).map((tab) => ({
        id: tab.id,
        label: tab.label,
      })),
      panels: (menu.panels || []).map((panel) => ({
        id: panel.id,
        columns: panel.columns,
      })),
    })),
  };
}

function extractMobileHeroSlides(rawHtml) {
  const slides = [];
  const heroMatch = rawHtml.match(/<section class="HomeMoBannerHero_banner_hero__[^"]*"[\s\S]*?<\/section>/);
  const heroHtml = heroMatch ? heroMatch[0] : "";
  const slidePattern = /<div class="swiper-slide">[\s\S]*?<a class="HomeMoBannerHero_banner_hero_item__[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/div>/g;
  let match;
  while ((match = slidePattern.exec(heroHtml))) {
    const inner = match[2];
    slides.push({
      href: match[1],
      badge: stripHtml((inner.match(/<span class="HomeMoBannerHero_banner_hero_badge__[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || ""),
      headline: stripHtml((inner.match(/<strong class="HomeMoBannerHero_banner_hero_headline__[^"]*"[^>]*>([\s\S]*?)<\/strong>/) || [])[1] || ""),
      description: stripHtml((inner.match(/<p class="HomeMoBannerHero_banner_hero_description__[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || ""),
      imageSrc: ((inner.match(/<img[^>]*src="([^"]+)"/) || [])[1] || ""),
    });
  }
  return slides;
}

function extractMobileQuickMenuItems(rawHtml) {
  const items = [];
  const quickMatch = rawHtml.match(/<section class="HomeMoQuickmenu_quickmenu__[^"]*"[\s\S]*?<\/section>/);
  const quickHtml = quickMatch ? quickMatch[0] : "";
  const itemPattern = /<li><a href="([^"]+)">([\s\S]*?)<\/a><\/li>/g;
  let match;
  while ((match = itemPattern.exec(quickHtml))) {
    const inner = match[2];
    items.push({
      href: match[1],
      title: stripHtml((inner.match(/<strong class="HomeMoQuickmenu_quickmenu_title__[^"]*"[^>]*>([\s\S]*?)<\/strong>/) || [])[1] || ""),
      image: ((inner.match(/<img[^>]*src="([^"]+)"/) || [])[1] || ""),
      alt: ((inner.match(/<img[^>]*alt="([^"]*)"/) || [])[1] || ""),
    });
  }
  return items;
}

function extractMobileQuickMenuSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoQuickmenu_quickmenu__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function readCurrentLiveHomeDom() {
  try {
    return fs.readFileSync(CURRENT_LIVE_HOME_DOM_PATH, "utf-8");
  } catch (_error) {
    return "";
  }
}

function extractCurrentLiveHomeSectionByClass(classFragment, dataArea = "") {
  const source = readCurrentLiveHomeDom();
  if (!source || !classFragment) return "";
  const matcher = new RegExp(
    `<section[^>]+class="[^"]*${escapeRegExp(classFragment)}[^"]*"[^>]*>[\\s\\S]*?<\\/section>`,
    "g"
  );
  const matches = source.match(matcher) || [];
  if (!matches.length) return "";
  if (!dataArea) return matches[0];
  return matches.find((entry) => entry.includes(`data-area="${dataArea}"`)) || "";
}

function markHomeLiveCustomSection(sectionHtml, slotId = "", sourceId = "") {
  if (!sectionHtml) return "";
  const resolution = resolveComponentSourceResolution("home", slotId, sourceId);
  const attrs = [
    slotId ? `data-codex-slot="${escapeHtml(slotId)}"` : "",
    sourceId ? `data-codex-source="${escapeHtml(sourceId)}"` : "",
    slotId ? `data-codex-component-id="home.${escapeHtml(slotId)}"` : "",
    sourceId ? `data-codex-active-source-id="${escapeHtml(sourceId)}"` : "",
    resolution.sourceResolution ? `data-codex-source-resolution="${escapeHtml(resolution.sourceResolution)}"` : "",
    resolution.resolvedRenderSourceId ? `data-codex-resolved-render-source-id="${escapeHtml(resolution.resolvedRenderSourceId)}"` : "",
    resolution.renderMode ? `data-codex-render-mode="${escapeHtml(resolution.renderMode)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return String(sectionHtml).replace(/<section\b/, `<section ${attrs}`);
}

function renderCurrentLiveHomeSection(slotId, activeSourceId, componentPatch, classFragment, dataArea = "") {
  const sectionHtml = extractCurrentLiveHomeSectionByClass(classFragment, dataArea);
  if (!sectionHtml) return "";
  return applyHomeLowerSectionPatch(
    markHomeLiveCustomSection(sectionHtml, slotId, activeSourceId),
    slotId,
    activeSourceId,
    componentPatch
  );
}

function extractMobilePromotionSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoBannerPromotion_banner_promotion__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileLowerPromotionSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoBannerPromotion_banner_promotion__[^"]*" data-area="메인 하단 배너 영역"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileTimedealSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoTimedeal_timedeal__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileMdChoiceSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListHorizontype_list_horizontype__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileSubscriptionSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListTabsBannertype_list_tabs_bannertype__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileSpaceRenewalSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListBannertype_list_bannertype__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileBrandShowroomSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListSquaretypeSmall_list_squaretype__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileLatestProductNewsSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListSquaretypeBig_list_squaretype_big__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileSmartLifeSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListVerticaltype_list_verticaltype__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileMissedBenefitsSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListRectangletype_list_rectangle__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileLgBestCareSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListVerticaltypeFill_list_verticaltype_fill__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractMobileBestshopGuideSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractFooterSection(rawHtml) {
  const match = String(rawHtml || "").match(/<footer\b[\s\S]*?<\/footer>/i);
  return match ? match[0] : "";
}

function extractHomeDesktopHeaderSections(rawHtml) {
  const source = String(rawHtml || "");
  const topMatch = source.match(/<section class="CommonPcGnb_top__[^"]*"[\s\S]*?<\/section>/i);
  const bottomMatch = source.match(/<section class="CommonPcGnb_bottom__[^"]*"[\s\S]*?<\/section>/i);
  return {
    top: topMatch ? topMatch[0] : "",
    bottom: bottomMatch ? bottomMatch[0] : "",
  };
}

function extractInlineObjectAtMarker(rawHtml, marker) {
  const source = String(rawHtml || "");
  const idx = source.indexOf(marker);
  if (idx === -1) return null;
  const start = source.lastIndexOf("{", idx);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractMobileSpaceRenewalData(rawHtml) {
  const decoded = decodeNextString(String(rawHtml || ""));
  const rawObject = extractInlineObjectAtMarker(decoded, '"title":"LG 가전으로 완성하는 공간의 리뉴얼"');
  return safeJsonParse(rawObject || "");
}

function buildSpaceRenewalProducts(data) {
  const products = Array.isArray(data?.productList) ? data.productList : [];
  return products.slice(0, 3).map((item) => {
    const heroCandidate = toLgeAbsoluteUrl(item.additionalMobileImageUrl || "");
    const productCandidate = toLgeAbsoluteUrl(item.productImgUrl || "");
    const heroUsable = heroCandidate && !/\/noimage\.svg$/i.test(heroCandidate);
    return {
      image: heroUsable ? heroCandidate : productCandidate,
      title: item.productName || "",
      alt: heroUsable ? item.additionalMobileImageAlt || item.productName || "" : item.productImgAlt || item.productName || "",
    };
  });
}

const HOME_BEST_RANKING_TABS = [
  {
    label: "전체",
    categoryId: "ALL",
    image: "https://www.lge.co.kr/kr/images/BRK/img_BestRanking_all_tab.png",
    alt: "전체 카테고리 이미지",
    active: true,
  },
  {
    label: "에어컨",
    categoryId: "CT50000131",
    image: "https://www.lge.co.kr/kr/upload/admin/display/displayObject/에어컨_20250812_160203.png",
    alt: "에어컨 카테고리 이미지",
  },
  {
    label: "냉장고",
    categoryId: "CT50000065",
    image: "https://www.lge.co.kr/kr/upload/admin/display/displayObject/냉장고_20250812_160542.png",
    alt: "냉장고 카테고리 이미지",
  },
  {
    label: "김치냉장고",
    categoryId: "CT50000072",
    image: "https://www.lge.co.kr/kr/upload/admin/display/displayObject/김치냉장고_20250812_160732.png",
    alt: "김치냉장고 카테고리 이미지",
  },
  {
    label: "컨버터블 패키지",
    categoryId: "CT50073000",
    image: "https://www.lge.co.kr/kr/upload/admin/display/displayObject/컨버터블패키지_20250812_161018.png",
    alt: "컨버터블 패키지 카테고리 이미지",
  },
  {
    label: "TV",
    categoryId: "CT50000025",
    image: "https://www.lge.co.kr/kr/upload/admin/display/displayObject/TV_20250812_160130.png",
    alt: "TV 카테고리 이미지",
  },
  {
    label: "세탁기",
    categoryId: "CT50000101",
    image: "https://www.lge.co.kr/kr/upload/admin/display/displayObject/세탁기_20250812_160219.png",
    alt: "세탁기 카테고리 이미지",
  },
  {
    label: "워시타워",
    categoryId: "CT50000110",
    image: "https://www.lge.co.kr/kr/upload/admin/display/displayObject/워시타워_20250812_160629.png",
    alt: "워시타워 카테고리 이미지",
  },
];

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("ko-KR");
}

function toLgeAbsoluteUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (String(value).startsWith("/")) return `https://www.lge.co.kr${value}`;
  return value;
}

const HOME_BEST_RANKING_SAMPLE_ITEMS = [
  {
    rank: 1,
    name: "LG 트롬 AI 오브제컬렉션 워시타워",
    url: "/wash-tower/wa2525ymzf",
    image: "/kr/images/wash-tower/md10576829/md10576829-350x350.jpg",
    rankImage: "/kr/images/BRK/new/icon_ranking_view_num1.png",
    sku: "WA2525YMZF",
    price: 4473300,
    badges: ["다품목할인"],
    category: "생활가전 · 워시타워",
    release: "",
  },
  {
    rank: 2,
    name: "LG 디오스 오브제컬렉션 냉장고 Fit & Max",
    url: "/refrigerators/m626gbb032",
    image: "/kr/images/refrigerators/md10590836/md10590836-350x350.jpg",
    rankImage: "/kr/images/BRK/new/icon_ranking_view_num2.png",
    sku: "M626GBB032",
    price: 3227100,
    badges: ["다품목할인"],
    category: "주방가전 · 냉장고",
    release: "",
  },
  {
    rank: 3,
    name: "LG 디오스 오브제컬렉션 식기세척기",
    url: "/dishwashers/due6bge",
    image: "/kr/images/dishwashers/md10491826/md10491826-350x350.jpg",
    rankImage: "/kr/images/BRK/new/icon_ranking_view_num3.png",
    sku: "DUE6BGE",
    price: 1925100,
    badges: ["다품목할인"],
    category: "주방가전 · 식기세척기",
    release: "",
  },
  {
    rank: 4,
    name: "LG 디오스 AI 오브제컬렉션 냉장고 (더블매직스페이스)",
    url: "/refrigerators/m876gbb231",
    image: "/kr/images/refrigerators/md10604870/md10604870-350x350.jpg",
    rankImage: "/kr/images/BRK/new/icon_ranking_view_num4.png",
    sku: "M876GBB231",
    price: 3924600,
    badges: ["다품목할인"],
    category: "주방가전 · 냉장고",
    release: "",
  },
  {
    rank: 5,
    name: "LG 올레드 evo AI (벽걸이형)",
    url: "/tvs/oled97g6kna-wall",
    image: "/kr/images/tvs/md10770827/md10770827-350x350.jpg",
    rankImage: "/kr/images/BRK/new/icon_ranking_view_num5.png",
    sku: "OLED97G6KNA",
    price: 39720000,
    badges: ["다품목할인"],
    category: "TV/오디오 · TV",
    release: "2026년 출시",
  },
];

const HOME_MARKETING_AREA_ITEMS = [
  {
    badge: "홈스타일링",
    title: "취향을 발견하는<br>홈스타일 콘텐츠",
    description: "나만의 취향 탐색, 스타일 큐레이션",
    href: "https://homestyle.lge.co.kr/collection",
    image:
      "https://www.lge.co.kr/kr/upload/admin/display/displayObject/1_homemain_bn_20251215_161443.png",
    alt: "밝은 우드 톤의 미니멀한 다이닝 공간에 원형 테이블과 의자 네 개, 둥근 조명이 배치되어 있다.",
  },
  {
    badge: "결합할인",
    title: "함께 사면<br>더 커지는 혜택",
    description: "가전+가구/조명 조합으로 최대 10%",
    href: "https://homestyle.lge.co.kr/exhibition/detail?exhibitionId=2510000167",
    image:
      "https://www.lge.co.kr/kr/upload/admin/display/displayObject/2_homemain_bn_20251215_161530.png",
    alt: "큰 창으로 자연광이 들어오는 밝은 거실에 소파와 플로어 스탠드, 우드 수납장과 식물이 배치된 아늑한 공간이다.",
  },
  {
    badge: "브랜드스토리",
    title: "프리미엄을 완성하는<br>브랜드 철학",
    description: "LG전자가 선택한 고감도 브랜드이야기",
    href: "https://homestyle.lge.co.kr/brand-story",
    image:
      "https://www.lge.co.kr/kr/upload/admin/display/displayObject/3_homemain_bn_20251215_165644.png",
    alt: "도시 건물이 보이는 큰 창 앞에 베이지 톤 소파와 사이드 테이블, 화분이 배치된 밝고 모던한 거실이다.",
  },
  {
    badge: "인테리어",
    title: "공간을 바꾸는<br>인테리어 커뮤니티",
    description: "예산과 평형에 맞는 시공사례 보기",
    href: "https://homestyle.lge.co.kr/interior",
    image:
      "https://www.lge.co.kr/kr/upload/admin/display/displayObject/4_homemain_bn_20251215_161809.png",
    alt: "화이트 톤의 미니멀한 주방에 싱크대와 수납장, 벽 선반과 주방 도구가 깔끔하게 정리되어 있다.",
  },
  {
    badge: "Style&Tip",
    title: "전문가의<br>홈스타일링 Tip",
    description: "우리 집에 적용하는 전문가의 인사이트",
    href: "https://homestyle.lge.co.kr/interior?tab=STYLE_TIP",
    image:
      "https://www.lge.co.kr/kr/upload/admin/display/displayObject/5_Style_Tip_20251215_161912.png",
    alt: "화이트와 우드 톤이 어우러진 주방에 아일랜드 테이블과 펜던트 조명, 식물이 배치된 밝고 깔끔한 공간이다.",
  },
];

const HOME_BRAND_SHOWROOM_ITEMS = [
  {
    title: "D5 플래그십 스토어",
    url: "https://bestshop.lge.co.kr/counselReserve/main/MC11569000?inflow=lgekor",
    image: "https://www.lge.co.kr/kr/bestshop/images/img_sns_share.png",
  },
  {
    title: "LG SIGNATURE",
    url: "https://www.lge.co.kr/lg-signature/info",
    image: "https://www.lge.co.kr/lg5-common/images/common/share/share-default.jpg",
  },
  {
    title: "오브제컬렉션 체험관",
    url: "https://www.lge.co.kr/objet-collection",
    image: "https://www.lge.co.kr/lg5-common/images/common/share/share-default.jpg",
  },
  {
    title: "LG ThinQ",
    url: "https://www.lge.co.kr/lg-thinq",
    image: "https://www.lge.co.kr/lg5-common/images/common/share/share-default.jpg",
  },
  {
    title: "Smart Cottage",
    url: "https://thesmartcottage.com/",
    image: "https://www.lge.co.kr/lg5-common/images/common/share/share-default.jpg",
  },
  {
    title: "렛츠 그램",
    url: "https://brand.lge.co.kr/gram",
    image: "https://www.lge.co.kr/lg5-common/images/common/share/share-default.jpg",
  },
];

const HOME_LATEST_PRODUCT_NEWS_ITEMS = [
  {
    title: "LG Micro RGB evo AI",
    url: "https://www.lge.co.kr/tvs/100mrgb96bk-wall",
    image: "https://www.lge.co.kr/kr/images/tvs/md10794842/gallery/medium01.jpg",
  },
  {
    title: "LG 올레드 evo AI",
    url: "https://www.lge.co.kr/tvs/oled77g6kna-wall",
    image: "https://www.lge.co.kr/kr/images/tvs/md10770833/gallery/medium01.jpg",
  },
  {
    title: "LG 시스템 아이어닝",
    url: "https://www.lge.co.kr/system-ironing/iy15ct80",
    image: "https://www.lge.co.kr/kr/images/lg-styler/md10694826/gallery/medium08.jpg",
  },
  {
    title: "LG 퓨리케어 AI 오브제컬렉션 360˚ 공기청정기 M7",
    url: "https://www.lge.co.kr/air-purifier/as356nsma",
    image: "https://www.lge.co.kr/kr/images/air-purifier/md10736826/gallery/medium01.jpg",
  },
  {
    title: "LG 휘센 AI 오브제컬렉션 타워I 에어컨 2in1",
    url: "https://www.lge.co.kr/air-conditioners/fq25gn9be2",
    image: "https://www.lge.co.kr/kr/images/air-conditioners/md10738836/gallery/medium01.jpg",
  },
  {
    title: "LG 그램 Pro AI 2026",
    url: "https://www.lge.co.kr/notebook/16z95u-gu7bk",
    image: "https://www.lge.co.kr/kr/images/notebook/md10743827/gallery/medium03.jpg",
  },
  {
    title: "LG 스타일러 오브제컬렉션 (2026 NEW)",
    url: "https://www.lge.co.kr/lg-styler/sc5gmr80s",
    image: "https://www.lge.co.kr/kr/images/lg-styler/md10747827/gallery/medium19.jpg",
  },
  {
    title: "LG 퓨리케어 오브제컬렉션 하이드로에센셜",
    url: "https://www.lge.co.kr/humidifiers/hy505rwlah",
    image: "https://www.lge.co.kr/kr/images/humidifiers/md10704826/gallery/medium01.jpg",
  },
  {
    title: "LG 휘센 오브제컬렉션 쿨 사계절에어컨",
    url: "https://www.lge.co.kr/air-conditioners/fw16fc1eu2",
    image: "https://www.lge.co.kr/kr/images/air-conditioners/md10658826/gallery/medium01.jpg",
  },
  {
    title: "LG Easy TV AI",
    url: "https://www.lge.co.kr/tvs/65qned85aks-wall",
    image: "https://www.lge.co.kr/kr/images/tvs/md10684834/gallery/medium03.jpg",
  },
];

const HOME_SMART_LIFE_ITEMS = [
  {
    subtitle: "사용가이드",
    title: "사계절 매일 쓰는 스타일러 일상",
    url: "https://www.lge.co.kr/story/user-guide/lg-styler-4season-course",
    image: "https://www.lge.co.kr/kr/upload/admin/storyThumbnail/lg-styler-4season-thumb-266x200_20250528_152225.jpg",
  },
  {
    subtitle: "가전인사이트",
    title: "나만 몰랐던 스탠바이미 2 활용 꿀팁",
    url: "https://www.lge.co.kr/story/tech-insight/smartway-stan-by-me-2",
    image: "https://www.lge.co.kr/kr/upload/admin/storyThumbnail/smartway-stan-by-me-2-thumb-266x200_20260115_131019.jpg",
  },
  {
    subtitle: "가전인사이트",
    title: "주방 인테리어의 새로운 기준, Fit & Max",
    url: "https://www.lge.co.kr/story/tech-insight/designlg-fit-and-max",
    image: "https://www.lge.co.kr/kr/upload/admin/storyThumbnail/MainThumbnail_MO_%EA%B0%80%EC%A0%84%EB%AF%B8%ED%95%99_ep.01_20251210_162623.jpg",
  },
  {
    subtitle: "리뷰",
    title: "TV와 모니터가 하나로 합쳐진 제가 찾던 모니터예요!",
    url: "https://www.lge.co.kr/story/hands-on-reviews/lglife-in-smart-monitor-15",
    image: "https://www.lge.co.kr/kr/upload/admin/storyThumbnail/lglife-in-smart-monitor-15-thumb-266x200_20250227_153943.jpg",
  },
];

const HOME_MISSED_BENEFITS_ITEMS = [
  {
    title: "혜택으로 우리 집 리뉴얼, ALL NEW 세일",
    url: "/benefits/exhibitions/detail-PE00895007",
    image: "https://www.lge.co.kr/kr/upload/admin/eventPlan/List_thumb_656x469_260330_20260330_135032.png",
  },
  {
    title: "4월의 출석체크 EVENT",
    url: "/benefits/event/detail-EV00008991",
    image: "https://www.lge.co.kr/kr/upload/admin/eventMgt/list_banner_656x469_20260326_092525.png",
  },
  {
    title: "카카오톡 웰컴 쿠폰 혜택",
    url: "/benefits/event/detail-EV00008791",
    image: "https://www.lge.co.kr/kr/upload/admin/eventMgt/list banner_656x469_20251219_090529.png",
  },
];

const HOME_LG_BEST_CARE_ITEMS = [
  {
    title: "가전세척 서비스",
    url: "/lg-best-care/home-appliance-cleaning",
    image: "",
  },
  {
    title: "이전설치 서비스",
    url: "/lg-best-care/service-installation-removal",
    image: "",
  },
];

const HOME_SUMMARY_BANNER_2_ITEMS = [
  {
    title: "쓸수록 새로워지는 LG UP 가전을 만나보세요",
    image:
      "https://www.lge.co.kr/kr/upload/admin/display/displayObject/homemain_mo_OBJ_270x220_v2_20260402_182144.png",
  },
];

function renderSpaceRenewalSection(data = {}, activeSourceId = "custom-renderer", componentPatch = {}) {
  if (!data || !Array.isArray(data.productList) || !data.productList.length) return "";
  const resolution = resolveComponentSourceResolution("home", "space-renewal", activeSourceId);
  const products = data.productList.slice(0, 3);
  const styles = componentPatch.styles && typeof componentPatch.styles === "object" ? componentPatch.styles : {};
  const title = String(componentPatch.title || data.title || "");
  const subTitle = String(componentPatch.subtitle || data.subTitle || "");
  const titleStyle = buildTextPatchStyleText({
    ...styles,
    titleColor: styles.titleColor || data.titleRgb || "#111111",
  }, "title");
  const subtitleStyle = buildTextPatchStyleText({
    ...styles,
    subtitleColor: styles.subtitleColor || data.subTitleRgb || "#727780",
  }, "subtitle");
  const sectionStyle = buildSectionPatchStyleText(styles, { hidden: componentPatch.visibility === false });
  const hero = toLgeAbsoluteUrl(products[0]?.additionalMobileImageUrl || "");
  const heroAlt = products[0]?.additionalMobileImageAlt || title || "";
  return `
    <section data-codex-slot="space-renewal" data-codex-source="custom-renderer" data-codex-component-id="home.space-renewal" data-codex-active-source-id="${escapeHtml(activeSourceId)}" data-codex-source-resolution="${escapeHtml(resolution.sourceResolution)}" data-codex-resolved-render-source-id="${escapeHtml(resolution.resolvedRenderSourceId || activeSourceId)}" data-codex-render-mode="${escapeHtml(resolution.renderMode)}" class="codex-home-space-renewal codex-home-space-renewal--workspace-variant" ${sectionStyle ? `style="${escapeHtml(sectionStyle)}"` : ""}>
      <div class="codex-home-space-renewal-head">
        <div class="title-home_title-home__Jw_7z">
          <h2 class="title-home_title-home_tit__tE_5M" ${titleStyle ? `style="${escapeHtml(titleStyle)}"` : ""}>${escapeHtml(title)}</h2>
          ${subTitle ? `<span class="title-home_title-home_sub_tit__ivkxK" ${subtitleStyle ? `style="${escapeHtml(subtitleStyle)}"` : ""}>${escapeHtml(subTitle)}</span>` : ""}
        </div>
        ${data.moreText && data.moreTextLink ? `<a class="codex-home-space-renewal-more" href="${data.moreTextLink}">${data.moreText}</a>` : ""}
      </div>
      <div class="codex-home-space-renewal-hero">
        ${hero ? `<img src="${hero}" alt="${heroAlt}" loading="lazy"/>` : `<span class="codex-home-space-renewal-hero-fallback"></span>`}
      </div>
      <div class="codex-home-space-renewal-grid">
        ${products
          .map((item) => {
            const image = toLgeAbsoluteUrl(item.productImgUrl || "");
            const title = item.productName || "";
            const meta = [item.optionText1, item.optionText2].filter(Boolean).join(" · ");
            const price = item.currentPrice || "";
            return `
              <a class="codex-home-space-renewal-card" href="${item.productLink || "#"}">
                <div class="codex-home-space-renewal-card-media">
                  ${image ? `<img src="${image}" alt="${item.productImgAlt || title}" loading="lazy"/>` : `<span class="codex-home-space-renewal-card-fallback"></span>`}
                </div>
                <div class="codex-home-space-renewal-card-body">
                  <strong class="codex-home-space-renewal-card-title">${title}</strong>
                  ${meta ? `<span class="codex-home-space-renewal-card-meta">${meta}</span>` : ""}
                  ${item.sku ? `<span class="codex-home-space-renewal-card-sku">${item.sku}</span>` : ""}
                  ${price ? `<span class="codex-home-space-renewal-card-price">${item.priceText || "최대혜택가"} ${price}원</span>` : ""}
                </div>
              </a>`;
          })
          .join("")}
      </div>
    </section>`;
}

function renderBrandShowroomCustomSection(items = [], activeSourceId = "custom-renderer", componentPatch = {}) {
  if (!items.length) return "";
  const resolution = resolveComponentSourceResolution("home", "brand-showroom", activeSourceId);
  const title = String(componentPatch.title || "브랜드 쇼룸");
  const styles = componentPatch.styles && typeof componentPatch.styles === "object" ? componentPatch.styles : {};
  const titleStyle = buildTextPatchStyleText({
    ...styles,
    titleColor: styles.titleColor || "#111111",
  }, "title");
  const inlineStyle = buildSectionPatchStyleText(styles, { hidden: componentPatch.visibility === false });
  return `
    <section data-codex-slot="brand-showroom" data-codex-source="custom-renderer" data-codex-component-id="home.brand-showroom" data-codex-active-source-id="${escapeHtml(activeSourceId)}" data-codex-source-resolution="${escapeHtml(resolution.sourceResolution)}" data-codex-resolved-render-source-id="${escapeHtml(resolution.resolvedRenderSourceId || activeSourceId)}" data-codex-render-mode="${escapeHtml(resolution.renderMode)}" class="codex-home-brand-showroom codex-home-brand-showroom--workspace-variant" ${inlineStyle ? `style="${escapeHtml(inlineStyle)}"` : ""}>
      <div class="codex-home-brand-showroom-head">
        <div class="title-home_title-home__Jw_7z">
          <h2 class="title-home_title-home_tit__tE_5M" ${titleStyle ? `style="${escapeHtml(titleStyle)}"` : ""}>${escapeHtml(title)}</h2>
        </div>
      </div>
      <div class="codex-home-brand-showroom-grid">
        ${items
          .map((item) => {
            const image = toLgeAbsoluteUrl(item.image || "");
            const useFallback =
              !image || image.includes("share-default.jpg") || image.includes("img_side_banner.png");
            return `
              <a class="codex-home-brand-showroom-card${useFallback ? " is-fallback" : ""}" href="${item.url}">
                <div class="codex-home-brand-showroom-card-media">
                  ${
                    useFallback
                      ? `<span class="codex-home-brand-showroom-fallback">${item.title}</span>`
                      : `<img src="${image}" alt="${item.title}" loading="lazy" />`
                  }
                </div>
                <strong class="codex-home-brand-showroom-card-title">${item.title}</strong>
              </a>`;
          })
          .join("")}
      </div>
    </section>`;
}

function renderLatestProductNewsCustomSection(items = [], activeSourceId = "custom-renderer", componentPatch = {}) {
  if (!items.length) return "";
  const resolution = resolveComponentSourceResolution("home", "latest-product-news", activeSourceId);
  const visibleItems = items.slice(0, 6);
  const title = String(componentPatch.title || "최신 제품 소식");
  const styles = componentPatch.styles && typeof componentPatch.styles === "object" ? componentPatch.styles : {};
  const titleStyle = buildTextPatchStyleText({
    ...styles,
    titleColor: styles.titleColor || "#111111",
  }, "title");
  const inlineStyle = buildSectionPatchStyleText(styles, { hidden: componentPatch.visibility === false });
  return `
    <section data-codex-slot="latest-product-news" data-codex-source="custom-renderer" data-codex-component-id="home.latest-product-news" data-codex-active-source-id="${escapeHtml(activeSourceId)}" data-codex-source-resolution="${escapeHtml(resolution.sourceResolution)}" data-codex-resolved-render-source-id="${escapeHtml(resolution.resolvedRenderSourceId || activeSourceId)}" data-codex-render-mode="${escapeHtml(resolution.renderMode)}" class="codex-home-latest-news codex-home-latest-news--workspace-variant" ${inlineStyle ? `style="${escapeHtml(inlineStyle)}"` : ""}>
      <div class="codex-home-latest-news-head">
        <div class="title-home_title-home__Jw_7z">
          <h2 class="title-home_title-home_tit__tE_5M" ${titleStyle ? `style="${escapeHtml(titleStyle)}"` : ""}>${escapeHtml(title)}</h2>
        </div>
      </div>
      <div class="codex-home-latest-news-grid">
        ${visibleItems
          .map((item) => {
            const image = toLgeAbsoluteUrl(item.image || "");
            return `
              <a class="codex-home-latest-news-card" href="${item.url}">
                <div class="codex-home-latest-news-card-media">
                  <span class="codex-home-latest-news-card-media-bg" aria-hidden="true"></span>
                  ${image ? `<img src="${image}" alt="${item.title}" loading="lazy" />` : `<span class="codex-home-latest-news-fallback"></span>`}
                </div>
                <strong class="codex-home-latest-news-card-title">${item.title}</strong>
              </a>`;
          })
          .join("")}
      </div>
    </section>`;
}

function injectProductImagesIntoSection(sectionHtml, products) {
  if (!sectionHtml) return "";
  let imageIndex = 0;
  return sectionHtml.replace(/<img\b([^>]*?)src=""([^>]*)>/g, (match, before, after) => {
    const imageUrl = products[imageIndex]?.image || "";
    imageIndex += 1;
    return `<img${before}src="${imageUrl}"${after}>`.replace(/visibility:hidden/g, "visibility:visible");
  });
}

function injectTemplateImagesIntoSection(sectionHtml, products) {
  if (!sectionHtml) return "";
  let imageIndex = 0;
  return sectionHtml.replace(
    /<!--\$!--><template[^>]*><\/template><!--\/\$-->/g,
    () => {
      const imageUrl = toLgeAbsoluteUrl(products[imageIndex]?.image || "");
      const alt = products[imageIndex]?.title || "";
      imageIndex += 1;
      if (!imageUrl) {
        return `<span class="codex-home-template-fallback" aria-hidden="true"></span>`;
      }
      return `<img src="${imageUrl}" alt="${alt}" loading="lazy" class="codex-home-template-image"/>`;
    }
  );
}

function syncHomeStoryListSection(sectionHtml, items = []) {
  if (!sectionHtml || !Array.isArray(items) || !items.length) return sectionHtml || "";
  let itemIndex = 0;
  return String(sectionHtml).replace(
    /<li class="HomeMoListVerticaltype_list_verticaltype_item__[^"]*">[\s\S]*?<\/li>/g,
    (itemHtml) => {
      const item = items[itemIndex];
      itemIndex += 1;
      if (!item) return itemHtml;
      let next = String(itemHtml);
      if (item.url) {
        next = next.replace(/<a href="[^"]+"/, `<a href="${escapeHtml(item.url)}"`);
      }
      if (item.subtitle) {
        next = next.replace(
          /<span class="HomeMoListVerticaltype_sub_title__[^"]*">[\s\S]*?<\/span>/,
          `<span class="HomeMoListVerticaltype_sub_title__UF_nM">${escapeHtml(item.subtitle)}</span>`
        );
      }
      if (item.title) {
        next = next.replace(
          /<strong class="HomeMoListVerticaltype_title__[^"]*">[\s\S]*?<\/strong>/,
          `<strong class="HomeMoListVerticaltype_title__6mBcs">${escapeHtml(item.title)}</strong>`
        );
      }
      return next;
    }
  );
}

function markHomeLowerReplay(sectionHtml, slotId = "", sourceId = "") {
  if (!sectionHtml) return "";
  const slotAttr = slotId ? ` data-codex-slot="${slotId}"` : "";
  const sourceAttr = sourceId ? ` data-codex-source="${sourceId}"` : "";
  const componentAttr = slotId ? ` data-codex-component-id="home.${slotId}"` : "";
  const activeSourceAttr = sourceId ? ` data-codex-active-source-id="${sourceId}"` : "";
  const resolution = resolveComponentSourceResolution("home", slotId, sourceId);
  const resolutionAttr = resolution.sourceResolution ? ` data-codex-source-resolution="${escapeHtml(resolution.sourceResolution)}"` : "";
  const resolvedSourceAttr = resolution.resolvedRenderSourceId
    ? ` data-codex-resolved-render-source-id="${escapeHtml(resolution.resolvedRenderSourceId)}"`
    : "";
  const renderModeAttr = resolution.renderMode ? ` data-codex-render-mode="${escapeHtml(resolution.renderMode)}"` : "";
  return sectionHtml.replace(
    /<section class="/,
    `<section${slotAttr}${sourceAttr}${componentAttr}${activeSourceAttr}${resolutionAttr}${resolvedSourceAttr}${renderModeAttr} class="codex-home-lower-replay `
  );
}

function replaceFirstMatch(input, pattern, replacementFactory) {
  const source = String(input || "");
  const match = source.match(pattern);
  if (!match || typeof match.index !== "number") return source;
  const start = match.index;
  const end = start + match[0].length;
  const replacement = typeof replacementFactory === "function" ? replacementFactory(match) : String(replacementFactory || "");
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function applyHomeHeroPatch(sectionHtml, activeSourceId = "", componentPatch = {}) {
  if (!sectionHtml) return "";
  let next = String(sectionHtml);
  const patch = componentPatch && typeof componentPatch === "object" ? componentPatch : {};
  const styles = patch.styles && typeof patch.styles === "object" ? patch.styles : {};
  next = next.replace(/<section([^>]*)>/, (match) => {
    const styleMatch = match.match(/\sstyle="([^"]*)"/);
    const inlineStyle = [styleMatch ? styleMatch[1] : "", buildSectionPatchStyleText(styles, { includeHeight: true, hidden: patch.visibility === false })]
      .filter(Boolean)
      .join(";");
    const cleaned = match.replace(/\sstyle="[^"]*"/, "");
    return cleaned.replace(/>$/, `${inlineStyle ? ` style="${escapeHtml(inlineStyle)}"` : ""}>`);
  });
  if (patch.badge) {
    next = replaceFirstMatch(
      next,
      /<span class="(?:HomePcBannerHero_banner_hero_badge__|HomeTaBannerHero_banner_hero_badge__|HomeMoBannerHero_banner_hero_badge__)[^"]*"[^>]*>[\s\S]*?<\/span>/,
      (match) => match[0].replace(/>[\s\S]*?</, `>${escapeHtml(patch.badge)}<`)
    );
  }
  if (patch.headline) {
    next = replaceFirstMatch(
      next,
      /<strong class="(?:HomePcBannerHero_banner_hero_headline__|HomeTaBannerHero_banner_hero_headline__|HomeMoBannerHero_banner_hero_headline__)[^"]*"[^>]*>[\s\S]*?<\/strong>/,
      (match) => match[0].replace(/>[\s\S]*?</, `>${escapeHtml(patch.headline)}<`)
    );
  }
  if (patch.description) {
    next = replaceFirstMatch(
      next,
      /<p class="(?:HomePcBannerHero_banner_hero_description__|HomeTaBannerHero_banner_hero_description__|HomeMoBannerHero_banner_hero_description__)[^"]*"[^>]*>[\s\S]*?<\/p>/,
      (match) => match[0].replace(/>[\s\S]*?</, `>${escapeHtml(patch.description)}<`)
    );
  }
  if (patch.ctaHref) {
    next = replaceFirstMatch(
      next,
      /<a class="(?:HomePcBannerHero_banner_hero_item__|HomeTaBannerHero_banner_hero_item__|HomeMoBannerHero_banner_hero_item__)[^"]*"[^>]*href="[^"]*"[^>]*>/,
      (match) => match[0].replace(/href="[^"]*"/, `href="${escapeHtml(patch.ctaHref)}"`)
    );
  }
  if (patch.ctaLabel) {
    next = replaceFirstMatch(
      next,
      /<a class="(?:HomePcBannerHero_banner_hero_item__|HomeTaBannerHero_banner_hero_item__|HomeMoBannerHero_banner_hero_item__)[^"]*"[^>]*>[\s\S]*?<\/a>/,
      (match) => match[0].replace(/>[\s\S]*?</, `>${escapeHtml(patch.ctaLabel)}<`)
    );
  }
  const titleStyleText = buildTextPatchStyleText(styles, "title");
  const subtitleStyleText = buildTextPatchStyleText(styles, "subtitle") || titleStyleText;
  if (titleStyleText) {
    next = next.replace(
      /<(strong)( class="(?:HomePcBannerHero_banner_hero_headline__|HomeTaBannerHero_banner_hero_headline__|HomeMoBannerHero_banner_hero_headline__)[^"]*")([^>]*)>/g,
      (match, tag, classes, rest) => {
        if (/style="/.test(rest)) {
          return `<${tag}${classes}${rest.replace(/style="([^"]*)"/, (_, value) => ` style="${escapeHtml(`${value};${titleStyleText}`)}"`)}>`;
        }
        return `<${tag}${classes}${rest} style="${escapeHtml(titleStyleText)}">`;
      }
    );
  }
  if (subtitleStyleText) {
    next = next.replace(
      /<(p)( class="(?:HomePcBannerHero_banner_hero_description__|HomeTaBannerHero_banner_hero_description__|HomeMoBannerHero_banner_hero_description__)[^"]*")([^>]*)>/g,
      (match, tag, classes, rest) => {
        if (/style="/.test(rest)) {
          return `<${tag}${classes}${rest.replace(/style="([^"]*)"/, (_, value) => ` style="${escapeHtml(`${value};${subtitleStyleText}`)}"`)}>`;
        }
        return `<${tag}${classes}${rest} style="${escapeHtml(subtitleStyleText)}">`;
      }
    );
  }
  if (activeSourceId === "figma-home-hero-v1") {
    next = next.replace(/data-codex-active-source-id="[^"]*"/, `data-codex-active-source-id="${escapeHtml(activeSourceId)}" data-codex-hero-variant="figma"`);
  }
  return next;
}

function applyHomeLowerSectionPatch(sectionHtml, slotId = "", activeSourceId = "", componentPatch = {}) {
  if (!sectionHtml) return "";
  const patch = componentPatch && typeof componentPatch === "object" ? componentPatch : {};
  const styles = patch.styles && typeof patch.styles === "object" ? patch.styles : {};
  let next = String(sectionHtml);
  next = next.replace(
    /<section([^>]*)>/,
    (match) => {
      const styleMatch = match.match(/\sstyle="([^"]*)"/);
      const inlineStyle = [styleMatch ? styleMatch[1] : "", buildSectionPatchStyleText(styles, { hidden: patch.visibility === false })]
        .filter(Boolean)
        .join(";");
      const cleaned = match.replace(/\sstyle="[^"]*"/, "");
      return cleaned.replace(/>$/, `${inlineStyle ? ` style="${escapeHtml(inlineStyle)}"` : ""}>`);
    }
  );
  if (patch.title) {
    next = replaceFirstMatch(
      next,
      /<h2 class="[^"]*title-home_title-home_tit__[^"]*"[^>]*>[\s\S]*?<\/h2>/,
      (match) => match[0].replace(/>[\s\S]*?</, `>${escapeHtml(patch.title)}<`)
    );
  }
  if (patch.subtitle) {
    next = replaceFirstMatch(
      next,
      /<span class="[^"]*title-home_title-home_sub_tit__[^"]*"[^>]*>[\s\S]*?<\/span>/,
      (match) => match[0].replace(/>[\s\S]*?</, `>${escapeHtml(patch.subtitle)}<`)
    );
  }
  if (patch.moreLabel) {
    next = replaceFirstTextMatch(
      next,
      [
        /<(?:a|button)\b[^>]*class="[^"]*(?:more|btn-more)[^"]*"[^>]*>[\s\S]*?<\/(?:a|button)>/i,
        /<span\b[^>]*class="[^"]*(?:more)[^"]*"[^>]*>[\s\S]*?<\/span>/i,
      ],
      patch.moreLabel
    );
  }
  const titleStyleText = buildTextPatchStyleText(styles, "title");
  const subtitleStyleText = buildTextPatchStyleText(styles, "subtitle");
  if (titleStyleText) {
    next = next.replace(
      /<h2 class="([^"]*title-home_title-home_tit__[^"]*)"([^>]*)>/g,
      (match, classes, rest) => {
        if (/style="/.test(rest)) {
          return `<h2 class="${classes}"${rest.replace(/style="([^"]*)"/, (_, value) => ` style="${escapeHtml(`${value};${titleStyleText}`)}"`)}>`;
        }
        return `<h2 class="${classes}"${rest} style="${escapeHtml(titleStyleText)}">`;
      }
    );
  }
  if (subtitleStyleText) {
    next = next.replace(
      /<span class="([^"]*title-home_title-home_sub_tit__[^"]*)"([^>]*)>/g,
      (match, classes, rest) => {
        if (/style="/.test(rest)) {
          return `<span class="${classes}"${rest.replace(/style="([^"]*)"/, (_, value) => ` style="${escapeHtml(`${value};${subtitleStyleText}`)}"`)}>`;
        }
        return `<span class="${classes}"${rest} style="${escapeHtml(subtitleStyleText)}">`;
      }
    );
  }
  if (slotId) {
    next = rewriteSectionHrefsForClone(next, "home", "pc");
  }
  if (slotId) {
    next = next.replace(/<section([^>]*)>/, `<section$1 data-codex-patched="true">`);
  }
  return next;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSelectorMatcher(selector) {
  const normalized = String(selector || "").trim();
  if (!normalized) return null;
  if (normalized.startsWith(".")) {
    const classNames = normalized
      .split(".")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!classNames.length) return null;
    return (attrs) => {
      const classMatch = String(attrs || "").match(/\bclass="([^"]*)"/i);
      const classes = new Set(String(classMatch?.[1] || "").split(/\s+/).filter(Boolean));
      return classNames.every((className) => classes.has(className));
    };
  }
  const dataAreaContains = normalized.match(/^\[data-area\*="([^"]+)"\]$/);
  if (dataAreaContains) {
    const needle = dataAreaContains[1];
    return (attrs) => String(attrs || "").includes(`data-area="`) && String(attrs || "").includes(needle);
  }
  return null;
}

function findFirstSelectorNodeRange(html, selector) {
  const matcher = parseSelectorMatcher(selector);
  if (!matcher) return null;
  const source = String(html || "");
  const pattern = /<([a-zA-Z][\w:-]*)([^>]*)>/g;
  let match;
  while ((match = pattern.exec(source))) {
    const [openingTag, tagName, attrs] = match;
    if (openingTag.startsWith("</") || openingTag.startsWith("<!") || openingTag.startsWith("<?")) continue;
    if (!matcher(attrs)) continue;
    return {
      start: match.index,
      end: pattern.lastIndex,
      tagName,
      openingTag,
      attrs,
    };
  }
  return null;
}

function findMatchingClosingTagRange(html, startIndex, tagName) {
  const source = String(html || "");
  const pattern = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  pattern.lastIndex = startIndex;
  let depth = 1;
  let match;
  while ((match = pattern.exec(source))) {
    if (match[0].startsWith(`</${tagName}`)) {
      depth -= 1;
      if (depth === 0) {
        return {
          start: match.index,
          end: pattern.lastIndex,
        };
      }
      continue;
    }
    depth += 1;
  }
  return null;
}

function normalizeCssSizeValue(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return `${raw}px`;
  return raw;
}

function buildSectionPatchStyleText(styles = {}, options = {}) {
  const nextStyles = styles && typeof styles === "object" ? styles : {};
  const styleParts = [];
  if (nextStyles.background) styleParts.push(`background:${nextStyles.background}`);
  const radius = normalizeCssSizeValue(nextStyles.radius);
  if (radius) styleParts.push(`border-radius:${radius}`);
  if (options.includeHeight) {
    const height = normalizeCssSizeValue(nextStyles.height);
    if (height) styleParts.push(`min-height:${height}`);
  }
  const minHeight = normalizeCssSizeValue(nextStyles.minHeight);
  if (minHeight) styleParts.push(`min-height:${minHeight}`);
  const borderWidth = normalizeCssSizeValue(nextStyles.borderWidth);
  const borderStyle = String(nextStyles.borderStyle || "").trim();
  const borderColor = String(nextStyles.borderColor || "").trim();
  if (borderWidth) styleParts.push(`border-width:${borderWidth}`);
  if (borderStyle) styleParts.push(`border-style:${borderStyle}`);
  if (borderColor) styleParts.push(`border-color:${borderColor}`);
  if ((borderWidth || borderColor) && !borderStyle) styleParts.push("border-style:solid");
  if (nextStyles.boxShadow) styleParts.push(`box-shadow:${nextStyles.boxShadow}`);
  if (nextStyles.padding) styleParts.push(`padding:${nextStyles.padding}`);
  if (nextStyles.opacity !== undefined && nextStyles.opacity !== null && String(nextStyles.opacity).trim() !== "") {
    const opacity = Number(nextStyles.opacity);
    if (Number.isFinite(opacity)) styleParts.push(`opacity:${opacity}`);
  }
  if (nextStyles.textAlign) styleParts.push(`text-align:${nextStyles.textAlign}`);
  if (options.hidden) styleParts.push("display:none");
  return styleParts.filter(Boolean).join(";");
}

function buildTextPatchStyleText(styles = {}, kind = "title") {
  const nextStyles = styles && typeof styles === "object" ? styles : {};
  const colorKey = kind === "subtitle" ? "subtitleColor" : "titleColor";
  const weightKey = kind === "subtitle" ? "subtitleWeight" : "titleWeight";
  const sizeKey = kind === "subtitle" ? "subtitleSize" : "titleSize";
  const styleParts = [];
  if (nextStyles[colorKey]) styleParts.push(`color:${nextStyles[colorKey]}`);
  if (nextStyles[weightKey]) styleParts.push(`font-weight:${nextStyles[weightKey]}`);
  const size = normalizeCssSizeValue(nextStyles[sizeKey]);
  if (size) styleParts.push(`font-size:${size}`);
  if (nextStyles.textAlign) styleParts.push(`text-align:${nextStyles.textAlign}`);
  return styleParts.filter(Boolean).join(";");
}

function upsertOpeningTagAttribute(openingTag, name, value) {
  const safeName = String(name || "").trim();
  if (!safeName) return openingTag;
  const escapedValue = escapeHtml(value);
  const attrPattern = new RegExp(`\\s${escapeRegExp(safeName)}="[^"]*"`, "i");
  if (attrPattern.test(openingTag)) {
    return openingTag.replace(attrPattern, ` ${safeName}="${escapedValue}"`);
  }
  return openingTag.replace(/>$/, ` ${safeName}="${escapedValue}">`);
}

function appendOpeningTagStyle(openingTag, styleText) {
  const nextStyle = String(styleText || "").trim();
  if (!nextStyle) return openingTag;
  const styleMatch = openingTag.match(/\sstyle="([^"]*)"/i);
  if (styleMatch) {
    const merged = [styleMatch[1], nextStyle].filter(Boolean).join(";");
    return openingTag.replace(/\sstyle="([^"]*)"/i, ` style="${escapeHtml(merged)}"`);
  }
  return openingTag.replace(/>$/, ` style="${escapeHtml(nextStyle)}">`);
}

function styleFirstPattern(blockHtml, patterns, styleText) {
  let next = String(blockHtml || "");
  const targetStyle = String(styleText || "").trim();
  if (!targetStyle) return next;
  for (const pattern of patterns) {
    const match = next.match(pattern);
    if (!match) continue;
    const openingTag = match[0];
    const styledTag = /style="/i.test(openingTag)
      ? openingTag.replace(/style="([^"]*)"/i, (_, value) => `style="${escapeHtml(`${value};${targetStyle}`)}"`)
      : openingTag.replace(/>$/, ` style="${escapeHtml(targetStyle)}">`);
    next = next.replace(openingTag, styledTag);
    return next;
  }
  return next;
}

function replaceFirstTextMatch(blockHtml, patterns, value) {
  let next = String(blockHtml || "");
  const target = escapeHtml(value);
  for (const pattern of patterns) {
    if (!pattern.test(next)) continue;
    next = next.replace(pattern, (match) => match.replace(/>[\s\S]*?</, `>${target}<`));
    return next;
  }
  return next;
}

function applyGenericWorkspaceSectionPatch(sectionHtml, componentPatch = {}) {
  if (!sectionHtml) return "";
  const patch = componentPatch && typeof componentPatch === "object" ? componentPatch : {};
  const styles = patch.styles && typeof patch.styles === "object" ? patch.styles : {};
  let next = String(sectionHtml);
  next = next.replace(/<([a-zA-Z][\w:-]*)([^>]*)>/, (match) => {
    let openingTag = match;
    openingTag = appendOpeningTagStyle(
      openingTag,
      buildSectionPatchStyleText(styles, { includeHeight: true, hidden: patch.visibility === false })
    );
    if (Object.keys(patch).length) {
      openingTag = upsertOpeningTagAttribute(openingTag, "data-codex-patched", "true");
    }
    return openingTag;
  });
  if (patch.title) {
    next = replaceFirstTextMatch(
      next,
      [
        /<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/i,
        /<div\b class="[^"]*(?:section-title|section__title|bestcare-title)[^"]*"[^>]*>[\s\S]*?<\/div>/i,
        /<strong\b class="[^"]*(?:tit|title)[^"]*"[^>]*>[\s\S]*?<\/strong>/i,
      ],
      patch.title
    );
  }
  if (patch.subtitle) {
    next = replaceFirstTextMatch(
      next,
      [
        /<p\b[^>]*>[\s\S]*?<\/p>/i,
        /<div\b class="[^"]*(?:bestcare-description)[^"]*"[^>]*>[\s\S]*?<\/div>/i,
        /<span\b class="[^"]*(?:desc|description)[^"]*"[^>]*>[\s\S]*?<\/span>/i,
      ],
      patch.subtitle
    );
  }
  if (patch.description) {
    next = replaceFirstTextMatch(
      next,
      [
        /<p\b[^>]*>[\s\S]*?<\/p>/i,
        /<div\b class="[^"]*(?:bestcare-description|desc|description)[^"]*"[^>]*>[\s\S]*?<\/div>/i,
        /<span\b class="[^"]*(?:desc|description)[^"]*"[^>]*>[\s\S]*?<\/span>/i,
      ],
      patch.description
    );
  }
  if (patch.badge) {
    next = replaceFirstTextMatch(
      next,
      [
        /<span\b class="[^"]*(?:badge)[^"]*"[^>]*>[\s\S]*?<\/span>/i,
        /<div\b class="[^"]*(?:badge)[^"]*"[^>]*>[\s\S]*?<\/div>/i,
      ],
      patch.badge
    );
  }
  if (patch.moreLabel) {
    next = replaceFirstTextMatch(
      next,
      [
        /<(?:a|button)\b[^>]*class="[^"]*(?:more|btn-more)[^"]*"[^>]*>[\s\S]*?<\/(?:a|button)>/i,
        /<span\b[^>]*class="[^"]*(?:more)[^"]*"[^>]*>[\s\S]*?<\/span>/i,
      ],
      patch.moreLabel
    );
  }
  if (patch.ctaLabel) {
    next = replaceFirstTextMatch(
      next,
      [/<(?:a|button)\b[^>]*>[\s\S]*?<\/(?:a|button)>/i],
      patch.ctaLabel
    );
  }
  if (patch.ctaHref) {
    next = replaceFirstMatch(
      next,
      /<a\b[^>]*href="[^"]*"[^>]*>/i,
      (match) => match[0].replace(/href="[^"]*"/, `href="${escapeHtml(patch.ctaHref)}"`)
    );
  }
  const titleStyleText = buildTextPatchStyleText(styles, "title");
  const subtitleStyleText = buildTextPatchStyleText(styles, "subtitle");
  if (titleStyleText) {
    next = styleFirstPattern(
      next,
      [
        /<((?:h[1-6])\b[^>]*)([^>]*)>/i,
        /<((?:div|strong)\b[^>]*class="[^"]*(?:section-title|section__title|bestcare-title|banner-tit|tit|title)[^"]*"[^>]*)([^>]*)>/i,
      ],
      titleStyleText
    );
  }
  if (subtitleStyleText) {
    next = styleFirstPattern(
      next,
      [
        /<((?:p)\b[^>]*)([^>]*)>/i,
        /<((?:div|span)\b[^>]*class="[^"]*(?:bestcare-description|desc|description)[^"]*"[^>]*)([^>]*)>/i,
      ],
      subtitleStyleText
    );
  }
  return next;
}

function getWorkspaceSlotSourceMeta(data, pageId, slotId) {
  const fallbackSourceId = `captured-${pageId}-${slotId}`;
  const slot = findSlotConfig(data, pageId, slotId);
  const sourceId = getActiveSourceId(data, pageId, slotId, fallbackSourceId);
  const sourceType =
    (slot?.sources || []).find((source) => source.sourceId === sourceId)?.sourceType ||
    (sourceId.startsWith("figma-") ? "figma-derived" : sourceId.startsWith("custom-") ? "custom" : "captured");
  return { sourceId, sourceType };
}

function transformFirstSelectorBlock(html, selector, transform) {
  const source = String(html || "");
  const opening = findFirstSelectorNodeRange(source, selector);
  if (!opening) return source;
  const closing = findMatchingClosingTagRange(source, opening.end, opening.tagName);
  if (!closing) return source;
  const block = source.slice(opening.start, closing.end);
  const nextBlock = typeof transform === "function" ? transform(block, opening) : block;
  return `${source.slice(0, opening.start)}${nextBlock}${source.slice(closing.end)}`;
}

function applyWorkspacePageVariants(html, pageId, viewportProfile, editableData) {
  let next = String(html || "");
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId || normalizedPageId === "home") return next;

  const annotateSlot = (slotId, selector) => {
    const sourceMeta = getWorkspaceSlotSourceMeta(editableData || {}, normalizedPageId, slotId);
    const componentId = `${normalizedPageId}.${slotId}`;
    const patchSchema = getGenericPatchSchema(normalizedPageId, slotId);
    const hasPatchSupport = (patchSchema.rootKeys || []).length > 0 || (patchSchema.styleKeys || []).length > 0;
    const patch = hasPatchSupport
      ? findComponentPatch(editableData || {}, normalizedPageId, componentId, sourceMeta.sourceId)?.patch || null
      : null;
    next = transformFirstSelectorBlock(next, selector, (block) => {
      let patched = String(block || "");
      patched = patched.replace(/<([a-zA-Z][\w:-]*)([^>]*)>/, (openingTag) => {
        let result = openingTag;
        result = upsertOpeningTagAttribute(result, "data-codex-slot", slotId);
        result = upsertOpeningTagAttribute(result, "data-codex-source", sourceMeta.sourceType);
        result = upsertOpeningTagAttribute(result, "data-codex-component-id", componentId);
        result = upsertOpeningTagAttribute(result, "data-codex-active-source-id", sourceMeta.sourceId);
        return result;
      });
      if (patch && hasPatchSupport) {
        patched = applyGenericWorkspaceSectionPatch(patched, patch);
      }
      return patched;
    });
  };

  if (["support", "bestshop", "care-solutions"].includes(normalizedPageId)) {
    const entry = findServiceGroupEntry(normalizedPageId, viewportProfile, "working");
    const groups = normalizeGroupMap(entry?.groups);
    for (const [slotId, group] of Object.entries(groups || {})) {
      if (!group?.found || !group?.selector) continue;
      annotateSlot(slotId, group.selector);
    }
    return next;
  }

  if (normalizedPageId.startsWith("category-")) {
    const entry = findPlpGroupEntry(normalizedPageId, viewportProfile, "working");
    const groups = normalizeGroupMap(entry?.groups);
    for (const [slotId, group] of Object.entries(groups || {})) {
      if (!group?.found || !group?.selector) continue;
      if (!String(group.selector).startsWith(".") && !String(group.selector).startsWith("[")) continue;
      annotateSlot(slotId, group.selector);
    }
  }

  return next;
}

function applyWorkspaceProductVariants(html, pageId, viewportProfile, href, editableData) {
  let next = String(html || "");
  const normalizedPageId = String(pageId || "").trim();
  const normalizedViewportProfile = String(viewportProfile || "pc").trim() || "pc";
  const normalizedHref = String(href || "").trim();
  if (!normalizedPageId || !normalizedHref) return next;

  const pdpContext = resolvePdpRuntimeContext(normalizedPageId, normalizedHref);
  const capturePageId = pdpContext?.runtimePageId || normalizedPageId;
  const captureHref = pdpContext?.href || normalizedHref;
  const entry =
    findPdpGroupEntry(capturePageId, normalizedViewportProfile, captureHref, "reference") ||
    findPdpGroupEntry(capturePageId, normalizedViewportProfile === "pc" ? "mo" : "pc", captureHref, "reference");
  const groups = normalizeGroupMap(entry?.groups);
  if (!Object.keys(groups || {}).length) return next;

  const annotateSlot = (slotId, selector) => {
    if (!selector) return;
    const sourceMeta = getWorkspaceSlotSourceMeta(editableData || {}, normalizedPageId, slotId);
    const componentId = `${normalizedPageId}.${slotId}`;
    const patchSchema = getGenericPatchSchema(normalizedPageId, slotId);
    const hasPatchSupport = (patchSchema.rootKeys || []).length > 0 || (patchSchema.styleKeys || []).length > 0;
    const patch = hasPatchSupport
      ? findComponentPatch(editableData || {}, normalizedPageId, componentId, sourceMeta.sourceId)?.patch || null
      : null;
    next = transformFirstSelectorBlock(next, selector, (block) => {
      let patched = String(block || "");
      patched = patched.replace(/<([a-zA-Z][\w:-]*)([^>]*)>/, (openingTag) => {
        let result = openingTag;
        result = upsertOpeningTagAttribute(result, "data-codex-slot", slotId);
        result = upsertOpeningTagAttribute(result, "data-codex-source", sourceMeta.sourceType);
        result = upsertOpeningTagAttribute(result, "data-codex-component-id", componentId);
        result = upsertOpeningTagAttribute(result, "data-codex-active-source-id", sourceMeta.sourceId);
        return result;
      });
      if (patch && hasPatchSupport) {
        patched = applyGenericWorkspaceSectionPatch(patched, patch);
      }
      return patched;
    });
  };

  for (const [slotId, group] of Object.entries(groups || {})) {
    if (!group?.found || !group?.selector) continue;
    annotateSlot(slotId, group.selector);
  }
  return next;
}

function extractImageQueueAroundMarker(rawHtml, marker, imageField = "mediumImageAddr", windowSize = 60000) {
  const source = String(rawHtml || "");
  const idx = source.indexOf(marker);
  if (idx === -1) return [];
  const snippet = source.slice(idx, Math.min(source.length, idx + windowSize));
  const pattern = new RegExp(`"${imageField}":"([^"]+)"`, "g");
  const queue = [];
  let match;
  while ((match = pattern.exec(snippet))) {
    if (match[1]) {
      queue.push({ image: match[1] });
    }
  }
  return queue;
}

function mergeImageQueues(...queues) {
  return queues.flat().filter((item) => item && item.image);
}

function extractMobileHeroSection(rawHtml) {
  const match = rawHtml.match(/<section class="HomeTaBannerHero_banner_hero__[^"]*"[\s\S]*?<\/section>/);
  return match ? match[0] : "";
}

function extractHomeHeroSlides(rawHtml) {
  const slides = [];
  const heroMatch =
    rawHtml.match(/<section class="HomePcBannerHero_banner_hero__[^"]*"[\s\S]*?<\/section>/) ||
    rawHtml.match(/<section class="HomeTaBannerHero_banner_hero__[^"]*"[\s\S]*?<\/section>/);
  const heroHtml = heroMatch ? heroMatch[0] : "";
  const slidePattern =
    /<div class="swiper-slide">[\s\S]*?<a class="(?:HomePcBannerHero_banner_hero_item__|HomeTaBannerHero_banner_hero_item__)[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/div>/g;
  let match;
  while ((match = slidePattern.exec(heroHtml))) {
    const inner = match[2];
    slides.push({
      href: match[1],
      badge: stripHtml(
        (
          inner.match(/<span class="(?:HomePcBannerHero_banner_hero_badge__|HomeTaBannerHero_banner_hero_badge__)[^"]*"[^>]*>([\s\S]*?)<\/span>/) ||
          [])[1] || ""
      ),
      headline: stripHtml(
        (
          inner.match(/<strong class="(?:HomePcBannerHero_banner_hero_headline__|HomeTaBannerHero_banner_hero_headline__)[^"]*"[^>]*>([\s\S]*?)<\/strong>/) ||
          [])[1] || ""
      ),
      description: stripHtml(
        (
          inner.match(/<p class="(?:HomePcBannerHero_banner_hero_description__|HomeTaBannerHero_banner_hero_description__)[^"]*"[^>]*>([\s\S]*?)<\/p>/) ||
          [])[1] || ""
      ),
      imageSrc: ((inner.match(/<img[^>]*src="([^"]+)"/) || [])[1] || ""),
    });
  }
  return slides;
}

function buildHomeHeroRuntimeCss() {
  return `
      .HomePcBannerHero_banner_hero__NwE3D .swiper,
      .HomeTaBannerHero_banner_hero__GobEJ .swiper {
        position: relative !important;
        overflow: hidden !important;
      }
      .HomePcBannerHero_banner_hero__NwE3D .swiper-wrapper,
      .HomeTaBannerHero_banner_hero__GobEJ .swiper-wrapper {
        transform: none !important;
        position: relative !important;
        display: block !important;
        height: 100% !important;
      }
      .HomePcBannerHero_banner_hero__NwE3D .swiper-slide,
      .HomeTaBannerHero_banner_hero__GobEJ .swiper-slide {
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      .HomePcBannerHero_banner_hero__NwE3D .swiper-slide.codex-hero-active,
      .HomeTaBannerHero_banner_hero__GobEJ .swiper-slide.codex-hero-active {
        position: relative !important;
        z-index: 1 !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }
      .HomePcBannerHero_banner_hero__NwE3D .codex-hero-controls,
      .HomeTaBannerHero_banner_hero__GobEJ .codex-hero-controls {
        position: absolute;
        right: 42px;
        bottom: 24px;
        z-index: 4;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(17, 24, 39, 0.62);
        backdrop-filter: blur(10px);
      }
      .HomePcBannerHero_banner_hero__NwE3D .codex-hero-nav,
      .HomeTaBannerHero_banner_hero__GobEJ .codex-hero-nav {
        width: 24px;
        height: 24px;
        border: 0;
        padding: 0;
        border-radius: 999px;
        background: transparent;
        color: #fff;
        font: 700 18px/1 Arial, sans-serif;
        cursor: pointer;
      }
      .HomePcBannerHero_banner_hero__NwE3D .codex-hero-nav:hover,
      .HomeTaBannerHero_banner_hero__GobEJ .codex-hero-nav:hover {
        background: rgba(255,255,255,0.08);
      }
      .HomePcBannerHero_banner_hero__NwE3D .codex-hero-indicator,
      .HomeTaBannerHero_banner_hero__GobEJ .codex-hero-indicator {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        min-width: 66px;
        justify-content: center;
        color: #fff;
        font-family: Arial, sans-serif;
      }
      .HomePcBannerHero_banner_hero__NwE3D .codex-hero-current,
      .HomeTaBannerHero_banner_hero__GobEJ .codex-hero-current {
        font-size: 15px;
        font-weight: 700;
        line-height: 1;
      }
      .HomePcBannerHero_banner_hero__NwE3D .codex-hero-divider,
      .HomePcBannerHero_banner_hero__NwE3D .codex-hero-total,
      .HomeTaBannerHero_banner_hero__GobEJ .codex-hero-divider,
      .HomeTaBannerHero_banner_hero__GobEJ .codex-hero-total {
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        opacity: 0.82;
      }
  `;
}

function buildHomeHeroRuntimeScript() {
  return `
        function initCodexHomeHeroRuntime(root = document) {
          const hero = root.querySelector('.HomePcBannerHero_banner_hero__NwE3D, .HomeTaBannerHero_banner_hero__GobEJ');
          if (!hero || hero.dataset.codexHeroInit === 'true') return;
          hero.setAttribute('data-codex-interaction-id', 'home.hero.carousel');
          const swiper = hero.querySelector('.swiper');
          const slides = Array.from(hero.querySelectorAll('.swiper-slide'));
          if (!swiper || !slides.length) return;
          hero.dataset.codexHeroInit = 'true';
          let activeIndex = Math.min(1, slides.length - 1);
          const controls = document.createElement('div');
          controls.className = 'codex-hero-controls';
          controls.innerHTML =
            '<button type="button" class="codex-hero-nav prev" aria-label="이전 슬라이드">‹</button>' +
            '<div class="codex-hero-indicator"><span class="codex-hero-current"></span><span class="codex-hero-divider">/</span><span class="codex-hero-total"></span></div>' +
            '<button type="button" class="codex-hero-nav next" aria-label="다음 슬라이드">›</button>';
          swiper.appendChild(controls);
          const currentNode = controls.querySelector('.codex-hero-current');
          const totalNode = controls.querySelector('.codex-hero-total');
          let timer = null;

          function applySlide(nextIndex) {
            activeIndex = (nextIndex + slides.length) % slides.length;
            slides.forEach((slide, index) => {
              const isActive = index === activeIndex;
              slide.classList.toggle('codex-hero-active', isActive);
              slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
              if (!isActive) {
                slide.querySelectorAll('a, button').forEach((node) => node.setAttribute('tabindex', '-1'));
              } else {
                slide.querySelectorAll('a, button').forEach((node) => node.removeAttribute('tabindex'));
              }
            });
            hero.setAttribute('data-codex-active-hero-slide', String(activeIndex + 1));
            if (currentNode) currentNode.textContent = String(activeIndex + 1).padStart(2, '0');
            if (totalNode) totalNode.textContent = String(slides.length).padStart(2, '0');
          }

          function stopAuto() {
            if (timer) {
              window.clearInterval(timer);
              timer = null;
            }
          }

          function startAuto() {
            stopAuto();
            timer = window.setInterval(() => applySlide(activeIndex + 1), 5500);
          }

          controls.querySelector('.codex-hero-nav.prev')?.addEventListener('click', () => {
            applySlide(activeIndex - 1);
          });
          controls.querySelector('.codex-hero-nav.next')?.addEventListener('click', () => {
            applySlide(activeIndex + 1);
          });

          hero.addEventListener('mouseenter', stopAuto);
          hero.addEventListener('mouseleave', startAuto);
          hero.addEventListener('focusin', stopAuto);
          hero.addEventListener('focusout', () => {
            window.setTimeout(() => {
              if (!hero.contains(document.activeElement)) startAuto();
            }, 0);
          });
          document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopAuto();
            else startAuto();
          });

          applySlide(activeIndex);
          startAuto();
        }

        function initCodexBestRankingRuntime(root = document) {
          const slot = root.querySelector('[data-codex-slot="best-ranking"]');
          if (!slot || slot.dataset.codexBestRankingInit === 'true') return;
          slot.setAttribute('data-codex-interaction-id', 'home.best-ranking.tabs');
          const tabs = Array.from(slot.querySelectorAll('.codex-home-best-ranking-tab'));
          const panel = slot.querySelector('[role="tabpanel"]');
          if (!tabs.length || !panel) return;
          slot.dataset.codexBestRankingInit = 'true';

          function activate(tab) {
            const categoryId = tab?.getAttribute('data-category-id') || '';
            tabs.forEach((candidate) => {
              const isActive = candidate === tab;
              candidate.classList.toggle('is-active', isActive);
              candidate.setAttribute('aria-selected', isActive ? 'true' : 'false');
              candidate.setAttribute('tabindex', isActive ? '0' : '-1');
            });
            if (categoryId) {
              slot.setAttribute('data-codex-active-category-id', categoryId);
            }
          }

          tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activate(tab));
            tab.addEventListener('keydown', (event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const nextIndex =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : (index - 1 + tabs.length) % tabs.length;
              const nextTab = tabs[nextIndex];
              activate(nextTab);
              nextTab?.focus();
            });
          });

          activate(tabs.find((tab) => tab.classList.contains('is-active')) || tabs[0]);
        }
  `;
}

function buildSlotDiff(pageId) {
  const reference = readSlotSnapshot(pageId, "reference");
  const working = buildWorkingSlotSnapshot(pageId);
  if (!reference || !working) return null;

  const refMap = Object.fromEntries((reference.slots || []).map((slot) => [slot.slotId, slot]));
  const workMap = Object.fromEntries((working.slots || []).map((slot) => [slot.slotId, slot]));
  const slotIds = Array.from(new Set([...Object.keys(refMap), ...Object.keys(workMap)]));

  const slots = slotIds.map((slotId) => {
    const ref = refMap[slotId] || null;
    const work = workMap[slotId] || null;
    return {
      slotId,
      reference: ref,
      working: work,
      checks: {
        containerModeMatch: (ref?.containerMode || null) === (work?.containerMode || null),
        itemCountMatch: (ref?.itemCount || 0) === (work?.itemCount || 0),
        expectedRowsMatch: (ref?.expectedRowsDesktop || 0) === (work?.expectedRowsDesktop || 0),
        mainMenuCountMatch: (ref?.mainMenus || []).length === (work?.mainMenus || []).length,
        brandTabCountMatch: (ref?.brandTabs || []).length === (work?.brandTabs || []).length,
      },
    };
  });

  const refStates = Object.fromEntries((reference.states || []).map((state) => [state.stateId, state]));
  const workStates = Object.fromEntries((working.states || []).map((state) => [state.stateId, state]));
  const stateIds = Array.from(new Set([...Object.keys(refStates), ...Object.keys(workStates)]));
  const states = stateIds.map((stateId) => {
    const ref = refStates[stateId] || null;
    const work = workStates[stateId] || null;
    return {
      stateId,
      reference: ref,
      working: work,
      checks: {
        tabCountMatch: (ref?.tabCount || 0) === (work?.tabCount || 0),
        panelCountMatch: (ref?.panelCount || 0) === (work?.panelCount || 0),
      },
    };
  });

  return {
    pageId,
    sources: ["reference", "working"],
    slots,
    states,
  };
}

function buildBaselineAudit(pageId) {
  const baseline = resolveBaselineInfo(pageId);
  const coverage = buildCoverageModel(pageId);
  const measurements = readMeasurements(pageId);
  const referenceMeasurement = measurements["reference-content"] || null;
  const workingShellMeasurement = measurements["clone-shell"] || null;
  const workingContentMeasurement = measurements["clone-content"] || null;

  const result = {
    pageId,
    baseline,
    pageStatus: coverage.pageStatus,
    interactionStatus: coverage.interactionStatus,
    checks: [],
    slots: [],
    overallStatus: "pass",
  };

  const pushCheck = (id, status, detail) => {
    result.checks.push({ id, status, detail });
    if (status === "fail") result.overallStatus = "fail";
  };

  pushCheck(
    "baseline-route",
    coverage.referenceMatchesBaseline ? "pass" : "fail",
    coverage.referenceMatchesBaseline
      ? `baseline aligned: ${baseline.route}`
      : `reference mismatch: expected ${baseline.url}, got ${coverage.referenceUrl || "n/a"}`
  );

  if (!referenceMeasurement) {
    pushCheck("reference-measurement", "fail", "reference-content measurement missing");
  } else {
    pushCheck("reference-measurement", "pass", `reference-content viewport ${referenceMeasurement.viewport?.width || "n/a"}x${referenceMeasurement.viewport?.height || "n/a"}`);
  }

  if (!workingShellMeasurement && !workingContentMeasurement) {
    pushCheck("working-measurement", "fail", "working measurement missing");
  } else {
    const sources = [workingShellMeasurement, workingContentMeasurement].filter(Boolean);
    pushCheck(
      "working-measurement",
      "pass",
      sources
        .map((item) => `${item.source} viewport ${item.viewport?.width || "n/a"}x${item.viewport?.height || "n/a"}`)
        .join(", ")
    );
  }

  const refSlots = Object.fromEntries(((referenceMeasurement?.slots) || []).map((slot) => [slot.slotId, slot]));
  const workShellSlots = Object.fromEntries(((workingShellMeasurement?.slots) || []).map((slot) => [slot.slotId, slot]));
  const workContentSlots = Object.fromEntries(((workingContentMeasurement?.slots) || []).map((slot) => [slot.slotId, slot]));
  const slotIds = Array.from(new Set([...Object.keys(refSlots), ...Object.keys(workShellSlots), ...Object.keys(workContentSlots)]));
  const tolerance = {
    x: 8,
    y: 8,
    width: 12,
    height: 12,
  };

  for (const slotId of slotIds) {
    const ref = refSlots[slotId] || null;
    const work =
      slotId === "header-top" || slotId === "header-bottom" || slotId === "gnb-open-panel"
        ? workShellSlots[slotId] || null
        : workContentSlots[slotId] || workShellSlots[slotId] || null;
    if (!ref || !work) {
      result.slots.push({
        slotId,
        status: "fail",
        reason: !ref ? "missing on reference" : "missing on working",
      });
      result.overallStatus = "fail";
      continue;
    }

    const dx = (work.x || 0) - (ref.x || 0);
    const dy = (work.y || 0) - (ref.y || 0);
    const dw = (work.width || 0) - (ref.width || 0);
    const dh = (work.height || 0) - (ref.height || 0);
    const pass =
      Math.abs(dx) <= tolerance.x &&
      Math.abs(dy) <= tolerance.y &&
      Math.abs(dw) <= tolerance.width &&
      Math.abs(dh) <= tolerance.height;
    const reasons = [];
    if (Math.abs(dx) > tolerance.x) reasons.push(`x mismatch ${ref.x} -> ${work.x}`);
    if (Math.abs(dy) > tolerance.y) reasons.push(`y mismatch ${ref.y} -> ${work.y}`);
    if (Math.abs(dw) > tolerance.width) reasons.push(`width mismatch ${ref.width} -> ${work.width}`);
    if (Math.abs(dh) > tolerance.height) reasons.push(`height mismatch ${ref.height} -> ${work.height}`);
    if (!pass) reasons.push("inspect baseline branch or hidden layout state");
    result.slots.push({
      slotId,
      status: pass ? "pass" : "fail",
      reference: { x: ref.x, y: ref.y, width: ref.width, height: ref.height },
      working: { x: work.x, y: work.y, width: work.width, height: work.height },
      reason: pass ? "within tolerance" : reasons.join("; "),
    });
    if (!pass) result.overallStatus = "fail";
  }

  return result;
}

function isSlotCoverageMatch(slotId, ref, work) {
  if (!ref || !work) return false;
  if ((ref.kind || "") !== (work.kind || "")) return false;
  if ((ref.containerMode || "") !== (work.containerMode || "")) return false;
  if (slotId === "header-top") {
    return (
      (ref.utilityItems || []).length === (work.utilityItems || []).length &&
      (ref.utilityLinks || []).length === (work.utilityLinks || []).length
    );
  }
  if (slotId === "header-bottom") {
    return (
      (ref.mainMenus || []).length === (work.mainMenus || []).length &&
      (ref.brandTabs || []).length === (work.brandTabs || []).length &&
      Boolean(ref.hasNavArrow) === Boolean(work.hasNavArrow)
    );
  }
  if (slotId === "hero") {
    const refSlides = Number(ref?.layout?.slideCount || 0);
    const workSlides = Number(work?.layout?.slideCount || 0);
    if (refSlides && workSlides) return refSlides === workSlides;
    return Boolean(ref.imageSrc) === Boolean(work.imageSrc || (work.slides || []).length);
  }
  if (slotId === "quickmenu") {
    return (
      Number(ref.itemCount || 0) === Number(work.itemCount || 0) &&
      Number(ref.expectedRowsDesktop || 0) === Number(work.expectedRowsDesktop || 0) &&
      Number(ref.expectedColumnsDesktop || 0) === Number(work.expectedColumnsDesktop || 0)
    );
  }
  return true;
}

function isStateCoverageMatch(ref, work) {
  if (!ref || !work) return false;
  if ((ref.kind || "") !== (work.kind || "")) return false;
  if ((ref.slotId || "") !== (work.slotId || "")) return false;
  if (ref.kind === "gnb-open") {
    return Number(ref.tabCount || 0) === Number(work.tabCount || 0) && Number(ref.panelCount || 0) === Number(work.panelCount || 0);
  }
  if (ref.kind === "hero-slide") {
    return Number(ref.slideIndex || 0) === Number(work.slideIndex || 0);
  }
  return true;
}

function isInteractionCoverageMatch(ref, work) {
  if (!ref || !work) return false;
  if ((ref.kind || "") !== (work.kind || "")) return false;
  if ((ref.slotId || "") !== (work.slotId || "")) return false;
  if (ref.kind === "hero-slide") {
    return Number(ref?.result?.slideIndex || 0) === Number(work?.result?.slideIndex || 0);
  }
  if (ref.kind === "quickmenu-default") {
    return (
      Number(ref?.result?.itemCount || 0) === Number(work?.result?.itemCount || 0) &&
      Number(ref?.result?.rowCount || 0) === Number(work?.result?.rowCount || 0) &&
      Number(ref?.result?.columnCount || 0) === Number(work?.result?.columnCount || 0)
    );
  }
  if (ref.kind === "navigation") {
    return (
      String(ref?.result?.targetKey || "") === String(work?.result?.targetKey || "") &&
      String(ref?.result?.targetUrl || "") === String(work?.result?.targetUrl || "")
    );
  }
  if (ref.kind === "search-open") {
    return String(ref?.result?.overlay || "") === String(work?.result?.overlay || "");
  }
  return true;
}

function decideCoverageStatus({ baseline, archive, reference, working, liveMeasurement, referenceMatchesBaseline, slots, states }) {
  if (!baseline) return "missing";
  const hasReference = Boolean(reference) && referenceMatchesBaseline;
  const hasWorking = Boolean(working);
  const hasArchive = Boolean(archive);
  const hasMeasurements = Boolean(liveMeasurement);
  const slotsCaptured = (slots || []).length > 0 && (slots || []).every((slot) => slot.status === "captured");
  const statesCaptured = (states || []).every((state) => state.status === "captured");
  if (hasReference && hasWorking && slotsCaptured && statesCaptured) return "captured";
  if (hasArchive || hasWorking || hasMeasurements) return "partial";
  return "missing";
}

function buildCoverageModel(pageId) {
  const baseline = resolveBaselineInfo(pageId);
  const archive = getArchiveRowByPageId(pageId);
  const reference = readSlotSnapshot(pageId, "reference");
  const working = buildWorkingSlotSnapshot(pageId);
  const measurements = readMeasurements(pageId);
  const measurementSource = measurements["clone-content"] || measurements["clone-shell"] || null;
  const referenceMatchesBaseline = snapshotMatchesBaseline(reference, baseline);
  const refSlots = Object.fromEntries((referenceMatchesBaseline ? (reference?.slots || []) : []).map((slot) => [slot.slotId, slot]));
  const workSlots = Object.fromEntries((working?.slots || []).map((slot) => [slot.slotId, slot]));
  const measuredSlots = Object.fromEntries(((measurementSource?.slots) || []).map((slot) => [slot.slotId, slot]));
  const slotIds = Array.from(new Set([...Object.keys(refSlots), ...Object.keys(workSlots), ...Object.keys(measuredSlots)]));
  const slots = slotIds.map((slotId) => {
    const ref = refSlots[slotId] || null;
    const work = workSlots[slotId] || null;
    const measured = measuredSlots[slotId] || null;
    let status = "missing";
    if (ref && work && isSlotCoverageMatch(slotId, ref, work)) status = "captured";
    else if (work || measured) status = "partial";
    const source = ref ? "captured" : work ? "working-only" : measured ? "measured-only" : "missing";
    return {
      slotId,
      status,
      source,
      hasReference: Boolean(ref) && referenceMatchesBaseline,
      hasWorking: Boolean(work),
      hasMeasurement: Boolean(measured),
      layout: ref?.layout || work?.layout || null,
    };
  });

  const refStates = Object.fromEntries((referenceMatchesBaseline ? (reference?.states || []) : []).map((state) => [state.stateId, state]));
  const workStates = Object.fromEntries((working?.states || []).map((state) => [state.stateId, state]));
  const stateIds = Array.from(new Set([...Object.keys(refStates), ...Object.keys(workStates)]));
  const states = stateIds.map((stateId) => {
    const ref = refStates[stateId] || null;
    const work = workStates[stateId] || null;
    return {
      stateId,
      status: ref && work && isStateCoverageMatch(ref, work) ? "captured" : work ? "partial" : "missing",
      hasReference: Boolean(ref) && referenceMatchesBaseline,
      hasWorking: Boolean(work),
    };
  });

  const referenceInteractions = readInteractionSnapshot(pageId, "reference");
  const workingInteractions = buildWorkingInteractionSnapshot(pageId);
  const referenceInteractionsMatchBaseline = snapshotMatchesBaseline(referenceInteractions, baseline);
  const refInteractions = Object.fromEntries(
    (referenceInteractionsMatchBaseline ? (referenceInteractions?.interactions || []) : []).map((interaction) => [interaction.interactionId, interaction])
  );
  const workInteractions = Object.fromEntries((workingInteractions?.interactions || []).map((interaction) => [interaction.interactionId, interaction]));
  const interactionIds = Array.from(new Set([...Object.keys(refInteractions), ...Object.keys(workInteractions)]));
  const interactions = interactionIds.map((interactionId) => {
    const ref = refInteractions[interactionId] || null;
    const work = workInteractions[interactionId] || null;
    return {
      interactionId,
      kind: ref?.kind || work?.kind || null,
      slotId: ref?.slotId || work?.slotId || null,
      status: ref && work && isInteractionCoverageMatch(ref, work) ? "captured" : work ? "partial" : "missing",
      hasReference: Boolean(ref) && referenceInteractionsMatchBaseline,
      hasWorking: Boolean(work),
    };
  });
  const interactionStatus =
    interactions.length > 0 && interactions.every((interaction) => interaction.status === "captured")
      ? "captured"
      : interactions.some((interaction) => interaction.status !== "missing")
        ? "partial"
        : "missing";

  const pageStatus = decideCoverageStatus({
    baseline,
    archive,
    reference,
    working,
    liveMeasurement: measurementSource,
    referenceMatchesBaseline,
    slots,
    states,
  });

  return {
    pageId,
    pageStatus,
    baseline,
    archiveStatus: archive ? "captured" : "missing",
    hasReference: Boolean(reference) && referenceMatchesBaseline,
    referenceUrl: reference?.url || null,
    referenceMatchesBaseline,
    hasWorking: Boolean(working),
    hasMeasurement: Boolean(measurementSource),
    slots,
    states,
    interactionStatus,
    interactions,
  };
}

function buildInternalCloneLinkMap() {
  const archive = readArchiveIndex();
  const map = {};
  for (const row of archive) {
    try {
      map[row.url] = `/clone/${slugFromUrl(row.url)}`;
    } catch {
      // ignore malformed urls
    }
  }
  map["https://www.lge.co.kr"] = "/clone/home";
  map["https://www.lge.co.kr/"] = "/clone/home";
  return map;
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMenuLabel(text) {
  return stripHtml(text).replace(/선택됨/g, "").replace(/\s+/g, " ").trim();
}

function toCloneHref(rawHref, internalLinkMap) {
  const href = String(rawHref || "").trim();
  if (!href) return "#";
  if (href.startsWith("/clone/")) return href;
  const normalizedHref = href.replace(/&amp;/g, "&");
  let absolute = normalizedHref;
  try {
    absolute = new URL(normalizedHref, "https://www.lge.co.kr").toString();
  } catch {
    absolute = normalizedHref;
  }
  if (internalLinkMap[normalizedHref]) return internalLinkMap[normalizedHref];
  if (internalLinkMap[absolute]) return internalLinkMap[absolute];
  if (absolute === "https://www.lge.co.kr" || absolute === "https://www.lge.co.kr/") return "/clone/home";
  return "#";
}

function toCloneOrLiveHref(rawHref, internalLinkMap, pdpCaptureMap = {}, pageId = "home", viewportProfile = "pc") {
  const href = String(rawHref || "").trim();
  if (!href) return "#";
  if (
    href.startsWith("#") ||
    href.startsWith("javascript:") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }
  if (href.startsWith("/clone/") || href.startsWith("/clone-product")) return href;
  const normalizedHref = href.replace(/&amp;/g, "&");
  let absolute = normalizedHref;
  try {
    absolute = new URL(normalizedHref, "https://www.lge.co.kr").toString();
  } catch {
    return href;
  }
  if (internalLinkMap[absolute]) return internalLinkMap[absolute];
  const pdpCapture = pdpCaptureMap && typeof pdpCaptureMap === "object" ? pdpCaptureMap[absolute] : null;
  if (pdpCapture && pdpCapture.pageId) {
    const pathname = (() => {
      try {
        return new URL(absolute).pathname || absolute;
      } catch {
        return absolute;
      }
    })();
    return (
      `/clone-product?pageId=${encodeURIComponent(pdpCapture.pageId)}` +
      `&viewportProfile=${encodeURIComponent(pdpCapture.viewportProfile || viewportProfile)}` +
      `&href=${encodeURIComponent(absolute)}` +
      `&title=${encodeURIComponent(pathname || absolute)}`
    );
  }
  let hostname = "";
  let pathname = "";
  try {
    const parsed = new URL(absolute);
    hostname = parsed.hostname || "";
    pathname = parsed.pathname || "";
  } catch {
    return absolute;
  }
  if (pathname.startsWith("/support")) return "/clone/support";
  if (pathname.startsWith("/best-ranking")) return "/clone/home";
  if (hostname === "bestshop.lge.co.kr" || pathname.startsWith("/bestshop")) return "/clone/bestshop";
  if (pathname.startsWith("/care-solutions") || pathname.startsWith("/category/care-solutions")) return "/clone/care-solutions";
  if (pathname.startsWith("/lg-best-care")) return "/clone/support";
  if (pathname.startsWith("/lg-signature")) return "/clone/lg-signature-info";
  if (pathname.startsWith("/objet-collection")) return "/clone/objet-collection-story";
  if (pathname.startsWith("/category/tvs")) return "/clone/category-tvs";
  if (pathname.startsWith("/category/refrigerators")) return "/clone/category-refrigerators";
  if (pathname.startsWith("/story") || pathname.startsWith("/benefits") || pathname.startsWith("/livecommerce")) return absolute;
  if (/^\/(tvs|refrigerators|kimchi-refrigerators|wash-tower|dishwashers|microwaves-and-ovens|air-purifier|air-conditioners|notebook|system-ironing)\//.test(pathname)) {
    const inferredPageId =
      pathname.startsWith("/refrigerators/") || pathname.startsWith("/kimchi-refrigerators/")
        ? "category-refrigerators"
        : "category-tvs";
    return (
      `/clone-product?pageId=${encodeURIComponent(inferredPageId)}` +
      `&viewportProfile=${encodeURIComponent(viewportProfile)}` +
      `&href=${encodeURIComponent(absolute)}` +
      `&title=${encodeURIComponent(pathname || absolute)}`
    );
  }
  if (hostname.endsWith("lge.co.kr")) return absolute;
  return absolute;
}

function rewriteSectionHrefsForClone(sectionHtml, pageId = "home", viewportProfile = "pc") {
  const html = String(sectionHtml || "");
  if (!html) return "";
  const internalLinkMap = buildInternalCloneLinkMap();
  const pdpCaptureMap = buildPdpCapturePageMap(viewportProfile);
  return html.replace(/href="([^"]+)"/gi, (_match, href) => {
    const nextHref = toCloneOrLiveHref(href, internalLinkMap, pdpCaptureMap, pageId, viewportProfile);
    return `href="${escapeHtml(nextHref)}"`;
  });
}

function extractLegacyProductMenu(rawHtml) {
  const start = rawHtml.indexOf('class="nav-category-layer"');
  if (start === -1) return null;
  const endMarker = rawHtml.indexOf('</div></li>', start);
  const snippet = rawHtml.slice(start, endMarker > start ? endMarker : start + 50000);

  const tabs = [];
  const tabRegex = /<div class="swiper-slide[^"]*"><a href="#([^"]+)">([\s\S]*?)<\/a><\/div>/g;
  let tabMatch;
  while ((tabMatch = tabRegex.exec(snippet)) && tabs.length < 12) {
    tabs.push({
      id: tabMatch[1],
      label: cleanMenuLabel(tabMatch[2]),
    });
  }

  const panels = [];
  const panelParts = snippet.split('<div class="nav-category-wrap');
  for (const part of panelParts.slice(1)) {
    const panelHtml = `<div class="nav-category-wrap${part}`;
    const idMatch = panelHtml.match(/id="([^"]+)"/);
    if (!idMatch) continue;
    const id = idMatch[1];
    const columns = [];
    const columnRegex = /<div class="column">([\s\S]*?)<\/div>/g;
    let columnMatch;
    while ((columnMatch = columnRegex.exec(panelHtml)) && columns.length < 4) {
      const columnHtml = columnMatch[1];
      const items = [];
      const categoryRegex = /<a href="([^"]+)" class="category-item"[^>]*>([\s\S]*?)<\/a>(?:<ul class="sub-category">([\s\S]*?)<\/ul>)?/g;
      let categoryMatch;
      while ((categoryMatch = categoryRegex.exec(columnHtml)) && items.length < 8) {
        const children = [];
        const subHtml = categoryMatch[3] || "";
        const subRegex = /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let subMatch;
        while ((subMatch = subRegex.exec(subHtml)) && children.length < 12) {
          children.push({
            href: subMatch[1],
            label: cleanMenuLabel(subMatch[2]),
          });
        }
        items.push({
          href: categoryMatch[1],
          label: cleanMenuLabel(categoryMatch[2]),
          children,
        });
      }
      if (items.length) columns.push(items);
    }
    panels.push({ id, columns });
  }

  return tabs.length && panels.length ? { tabs, panels } : null;
}

function extractCommonColumns(blockHtml) {
  const columns = [];
  const columnRegex = /<div class="CommonPcGnb_column__[^"]*">([\s\S]*?)<\/div>/g;
  let columnMatch;
  while ((columnMatch = columnRegex.exec(blockHtml)) && columns.length < 6) {
    const columnHtml = columnMatch[1];
    const items = [];
    const itemRegex =
      /<p class="CommonPcGnb_sub_cate_tit__[^"]*">(?:\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|([\s\S]*?))\s*<\/p>\s*(?:<ul class="CommonPcGnb_sub_cate_list__[^"]*">([\s\S]*?)<\/ul>)?/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(columnHtml)) && items.length < 16) {
      const children = [];
      const childRegex = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let childMatch;
      while ((childMatch = childRegex.exec(itemMatch[4] || "")) && children.length < 24) {
        children.push({
          href: childMatch[1],
          label: cleanMenuLabel(childMatch[2]),
        });
      }
      const href = itemMatch[1] || "#";
      const label = cleanMenuLabel(itemMatch[2] || itemMatch[3]);
      if (!label) continue;
      items.push({
        href,
        label,
        children,
      });
    }
    if (items.length) columns.push(items);
  }
  return columns;
}

function extractCommonMenuSection(rawHtml, sectionId) {
  const start = rawHtml.indexOf(`class="CommonPcGnb_nav_cate__KkLVL" id="${sectionId}"`);
  if (start === -1) return null;
  const endMarker = rawHtml.indexOf("</section>", start);
  const snippet = rawHtml.slice(start, endMarker > start ? endMarker : start + 80000);
  const titleMatch = snippet.match(/<h2 class="CommonPcGnb_nav_cate_tit__[^"]*">([\s\S]*?)<\/h2>/);
  const title = cleanMenuLabel(titleMatch ? titleMatch[1] : "") || sectionId;

  const tabs = [];
  const tabRegex =
    /<div aria-controls="([^"]+)" class="CommonPcGnb_scroll_item__[^"]*"><a[^>]*>([\s\S]*?)<\/a><\/div>/g;
  let tabMatch;
  while ((tabMatch = tabRegex.exec(snippet)) && tabs.length < 24) {
    tabs.push({
      id: tabMatch[1],
      label: cleanMenuLabel(tabMatch[2]),
    });
  }

  const panels = [];
  const panelRegex = /<div class="CommonPcGnb_nav_cate_list__[^"]*" id="([^"]+)">([\s\S]*?)<\/div>\s*<\/div>/g;
  let panelMatch;
  while ((panelMatch = panelRegex.exec(snippet)) && panels.length < 24) {
    const id = panelMatch[1];
    const columns = extractCommonColumns(panelMatch[2]);
    if (columns.length) panels.push({ id, columns });
  }

  if (!tabs.length) {
    const directColumns = extractCommonColumns(snippet);
    if (directColumns.length) {
      panels.push({ id: sectionId, columns: directColumns });
    }
  }

  return panels.length
    ? {
        id: sectionId,
        title,
        tabs,
        panels,
      }
    : null;
}

function buildShellGnbData() {
  const internalLinkMap = buildInternalCloneLinkMap();
  const rawHtml = readArchiveHtmlByPageId("home") || readArchiveHtmlByPageId("support") || readArchiveHtmlByPageId("care-solutions");
  const dropdownMenuIds = ["제품/소모품", "가전 구독", "고객지원", "혜택/이벤트", "스토리", "베스트샵", "LG AI"];
  const dropdownMenus = {};
  for (const menuId of dropdownMenuIds) {
    const parsed = rawHtml ? extractCommonMenuSection(rawHtml, menuId) : null;
    if (!parsed) continue;
    dropdownMenus[menuId] = {
      ...parsed,
      tabs: (parsed.tabs || []).map((tab) => ({
        ...tab,
        label: cleanMenuLabel(tab.label),
      })),
      panels: (parsed.panels || []).map((panel) => ({
        ...panel,
        columns: panel.columns.map((items) =>
          items.map((item) => ({
            ...item,
            href: toCloneHref(item.href, internalLinkMap),
            label: cleanMenuLabel(item.label),
            children: (item.children || []).map((child) => ({
              ...child,
              href: toCloneHref(child.href, internalLinkMap),
              label: cleanMenuLabel(child.label),
            })),
          }))
        ),
      })),
    };
  }
  return {
    topLinks: dropdownMenuIds.map((label) => ({
      label,
      href:
        label === "가전 구독"
          ? "/clone/care-solutions"
          : label === "고객지원"
            ? "/clone/support"
            : label === "베스트샵"
              ? "/clone/bestshop"
              : "#",
      kind: dropdownMenus[label] ? "dropdown" : "link",
      menuId: label,
    })),
    brandTabs: [
      { label: "LG SIGNATURE", href: "/clone/lg-signature-info" },
      { label: "LG Objet Collection", href: "/clone/objet-collection-story" },
      { label: "LG ThinQ", href: "#" },
      { label: "Let's gram", href: "#" },
    ],
    utilityLinks: [
      { label: "회사소개", href: "#" },
      { label: "사업자몰", href: "#" },
    ],
    dropdownMenus,
  };
}

function buildPageEnhancementMaps(data) {
  const archive = readArchiveIndex();
  const pageIds = new Set((data.pages || []).map((p) => p.id));
  const byPageId = {};
  for (const row of archive) {
    const pageId = slugFromUrl(row.url);
    byPageId[pageId] = row;
  }
  const linkMap = {};
  const heroMap = {};
  for (const pageId of pageIds) {
    const row = byPageId[pageId];
    if (!row) {
      linkMap[pageId] = [];
      heroMap[pageId] = null;
      continue;
    }
    const linked = [];
    const seen = new Set();
    for (const href of row.links || []) {
      try {
        const linkId = slugFromUrl(href);
        if (!pageIds.has(linkId)) continue;
        if (linkId === pageId || seen.has(linkId)) continue;
        seen.add(linkId);
        linked.push(linkId);
      } catch {
        // ignore malformed URL
      }
    }
    linkMap[pageId] = linked;
    const heroAsset = selectHeroAsset(row.assets || []);
    heroMap[pageId] = heroAsset ? `/assets/${path.basename(heroAsset.localPath)}` : null;
  }
  return { linkMap, heroMap };
}

function buildRuntimePageSummary(data) {
  const corePageIds = [
    "home",
    "support",
    "bestshop",
    "care-solutions",
    "category-tvs",
    "category-refrigerators",
  ];
  const infoPageIds = [
    "lg-signature-info",
    "objet-collection-story",
  ];
  const plpPageIds = [
    "category-tvs",
    "category-refrigerators",
  ];
  const pdpCasePageIds = Object.keys(PDP_CASE_PAGE_CONFIG);
  const existingPageIds = new Set((data.pages || []).map((page) => String(page.id || "").trim()).filter(Boolean));
  const corePages = corePageIds.filter((pageId) => existingPageIds.has(pageId));
  const infoPages = infoPageIds.filter((pageId) => existingPageIds.has(pageId));
  const plpPages = plpPageIds.filter((pageId) => existingPageIds.has(pageId));
  const pdpCasePages = pdpCasePageIds.filter((pageId) => existingPageIds.has(pageId));
  const routeCatalog = [
    ...corePages.map((pageId) => ({
      type: "core-page",
      id: pageId,
      route: `/clone/${pageId}`,
    })),
    ...infoPages.map((pageId) => ({
      type: "info-page",
      id: pageId,
      route: `/clone/${pageId}`,
    })),
    ...plpPages.map((pageId) => ({
      type: "plp-page",
      id: pageId,
      route: `/clone/${pageId}`,
    })),
    ...pdpCasePages.map((pageId) => ({
      type: "pdp-case-page",
      id: pageId,
      route: `/clone-product?pageId=${encodeURIComponent(pageId)}`,
    })),
    {
      type: "pdp-route",
      id: "clone-product",
      route: "/clone-product",
    },
  ];
  const uniqueRuntimePageCount = new Set([...corePages, ...infoPages, ...plpPages, ...pdpCasePages]).size;
  return {
    totalRuntimePages: uniqueRuntimePageCount + 1,
    corePages,
    infoPages,
    plpPages,
    pdpCasePages,
    pdpRoutes: ["/clone-product"],
    routeCatalog,
    counts: {
      corePages: corePages.length,
      infoPages: infoPages.length,
      plpPages: plpPages.length,
      pdpCasePages: pdpCasePages.length,
      pdpRoutes: 1,
    },
  };
}

function buildPageOperationalAdvisories() {
  return {
    home: [
      {
        id: "home-hybrid-shell",
        severity: "warning",
        title: "Home is hybrid",
        detail: "header/GNB/hero are pc-like while quickmenu below is largely mobile-derived. Visual acceptance must verify the combined shell.",
      },
    ],
    "care-solutions": [
      {
        id: "care-solutions-duplicate-gnb",
        severity: "warning",
        title: "Duplicate GNB under header",
        detail: "The clone shell must suppress the captured page header for `care-solutions` so only one GNB/header remains. Acceptance should verify that no second header block appears below the shell header.",
      },
    ],
    "category-tvs": [
      {
        id: "category-tvs-pdp-route-shared",
        severity: "info",
        title: "Shared PDP route",
        detail: "PDP is currently exposed through `/clone-product` rather than per-product static routes.",
      },
    ],
    "category-refrigerators": [
      {
        id: "category-refrigerators-pdp-route-shared",
        severity: "info",
        title: "Shared PDP route",
        detail: "PDP is currently exposed through `/clone-product` rather than per-product static routes.",
      },
    ],
    "pdp-tv-general": [
      {
        id: "pdp-tv-general-case-boundary",
        severity: "info",
        title: "Independent PDP case",
        detail: "This PDP case stores patches independently, while capture/group selectors are reused from `category-tvs` for rendering.",
      },
    ],
    "pdp-tv-premium": [
      {
        id: "pdp-tv-premium-case-boundary",
        severity: "info",
        title: "Independent PDP case",
        detail: "This PDP case stores patches independently, while capture/group selectors are reused from `category-tvs` for rendering.",
      },
    ],
    "pdp-refrigerator-general": [
      {
        id: "pdp-refrigerator-general-case-boundary",
        severity: "info",
        title: "Independent PDP case",
        detail: "This PDP case stores patches independently, while capture/group selectors are reused from `category-refrigerators` for rendering.",
      },
    ],
    "pdp-refrigerator-knockon": [
      {
        id: "pdp-refrigerator-knockon-case-boundary",
        severity: "info",
        title: "Independent PDP case",
        detail: "This PDP case stores patches independently, while capture/group selectors are reused from `category-refrigerators` for rendering.",
      },
    ],
    "pdp-refrigerator-glass": [
      {
        id: "pdp-refrigerator-glass-case-boundary",
        severity: "info",
        title: "Independent PDP case",
        detail: "This PDP case stores patches independently, while capture/group selectors are reused from `category-refrigerators` for rendering.",
      },
    ],
  };
}

function buildPageAdvisoryMetaMap() {
  const advisories = buildPageOperationalAdvisories();
  const severityRank = { error: 3, warning: 2, info: 1 };
  const severityScore = { error: 100, warning: 10, info: 1 };
  return Object.fromEntries(
    Object.entries(advisories).map(([pageId, items]) => {
      const normalizedItems = Array.isArray(items) ? items : [];
      const highestSeverity = normalizedItems.reduce((current, item) => {
        const nextSeverity = String(item?.severity || "info");
        return (severityRank[nextSeverity] || 0) > (severityRank[current] || 0) ? nextSeverity : current;
      }, "");
      return [
        pageId,
        {
          count: normalizedItems.length,
          highestSeverity: highestSeverity || "none",
          advisoryRiskScore: normalizedItems.reduce((sum, item) => sum + Number(severityScore[String(item?.severity || "info")] || 0), 0),
        },
      ];
    })
  );
}

function buildClonePagePayload(pageId, data) {
  const archiveMap = buildArchivePageMap();
  const page = (data.pages || []).find((item) => item.id === pageId);
  if (!page) return null;
  const archive = archiveMap[pageId] || null;
  const { linkMap, heroMap } = buildPageEnhancementMaps(data);
  const heroImage = heroMap[pageId] || null;

  const gallery = (archive?.assets || [])
    .filter((asset) => asset && asset.localPath)
    .filter((asset) => {
      const kind = String(asset.kind || "").toLowerCase();
      const src = String(asset.src || "").toLowerCase();
      const alt = String(asset.alt || "").toLowerCase();
      return (!kind || kind === "image") && !src.includes("logo") && !alt.includes("logo") && !alt.includes("로고");
    })
    .slice(0, 8)
    .map((asset) => ({
      src: `/assets/${path.basename(asset.localPath)}`,
      alt: asset.alt || page.title || page.id,
    }));

  const enhancementMaps = buildPageEnhancementMaps(data);
  const linkCards = (linkMap[pageId] || []).slice(0, 8).map((linkedId) => {
    const linkedPage = (data.pages || []).find((item) => item.id === linkedId);
    return {
      id: linkedId,
      title: linkedPage?.title || linkedId,
      pageGroup: linkedPage?.pageGroup || "other",
      heroImage: enhancementMaps.heroMap[linkedId] || null,
    };
  });

  const mappedLinks = [];
  const seenMapped = new Set();
  for (const href of archive?.links || []) {
    try {
      const linkedId = slugFromUrl(href);
      if (!seenMapped.has(linkedId) && (data.pages || []).some((item) => item.id === linkedId)) {
        seenMapped.add(linkedId);
        const linkedPage = (data.pages || []).find((item) => item.id === linkedId);
        mappedLinks.push({
          id: linkedId,
          href,
          title: linkedPage?.title || linkedId,
        });
      }
    } catch {
      // ignore malformed urls
    }
  }

  return {
    ...page,
    archiveTitle: archive?.title || page.title,
    sourceLinks: archive?.links || [],
    sourceHeadings: archive?.headings || [],
    heroImage,
    gallery,
    linkCards,
    mappedLinks,
  };
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function decodeNextString(raw) {
  return raw
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&");
}

function extractEmbeddedObject(rawHtml, marker, objectKey) {
  const idx = rawHtml.indexOf(marker);
  if (idx === -1) return null;
  const keyNeedle = `"${objectKey}":`;
  const keyIdx = rawHtml.indexOf(keyNeedle, idx);
  if (keyIdx === -1) return null;
  const start = keyIdx + keyNeedle.length;
  const firstChar = rawHtml[start];
  if (firstChar !== "{" && firstChar !== "[") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < rawHtml.length; i += 1) {
    const ch = rawHtml[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") depth += 1;
    if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return rawHtml.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractEmbeddedObjectAroundMarker(rawHtml, marker, objectKey) {
  const idx = rawHtml.indexOf(marker);
  if (idx === -1) return null;
  const keyNeedle = `"${objectKey}":`;
  const keyIdx = rawHtml.lastIndexOf(keyNeedle, idx);
  if (keyIdx === -1) return null;
  const start = keyIdx + keyNeedle.length;
  const firstChar = rawHtml[start];
  if (firstChar !== "{" && firstChar !== "[") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < rawHtml.length; i += 1) {
    const ch = rawHtml[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") depth += 1;
    if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return rawHtml.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractQuickMenuSlides(rawHtml) {
  const slides = [];
  const regex = /<div class="swiper-slide"><a href="([^"]+)"[\s\S]*?<strong class="HomePcQuickmenu_quickmenu_title__4c_jV"[^>]*>([^<]+)<\/strong>[\s\S]*?<img alt="([^"]*)"[^>]*src="([^"]+)"/g;
  let match;
  while ((match = regex.exec(rawHtml)) && slides.length < 10) {
    slides.push({
      href: match[1],
      title: match[2],
      alt: match[3],
      image: match[4],
    });
  }
  return slides;
}

function parseHomeEnhancements(rawHtml, mobileHtml = "", options = {}) {
  const normalizedRawHtml = String(rawHtml || "")
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&");
  const normalizedMobileHtml = String(mobileHtml || "")
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&");
  const quickMenuSection = mobileHtml ? extractMobileQuickMenuSection(mobileHtml) : "";
  const promotionSection = mobileHtml ? extractMobilePromotionSection(mobileHtml) : "";
  const lowerPromotionSection = mobileHtml ? extractMobileLowerPromotionSection(normalizedMobileHtml) : "";
  const timedealSection = mobileHtml ? extractMobileTimedealSection(mobileHtml) : "";
  const mdChoiceSection = mobileHtml ? extractMobileMdChoiceSection(normalizedMobileHtml) : "";
  const subscriptionSection =
    (!options.homeSandbox || options.homeSandbox === "subscription") && mobileHtml
      ? extractMobileSubscriptionSection(normalizedMobileHtml)
      : "";
  const spaceRenewalSection =
    (!options.homeSandbox || options.homeSandbox === "space-renewal") && mobileHtml
      ? extractMobileSpaceRenewalSection(normalizedMobileHtml)
      : "";
  const spaceRenewalData =
    (!options.homeSandbox || options.homeSandbox === "space-renewal") && mobileHtml
      ? extractMobileSpaceRenewalData(normalizedMobileHtml)
      : null;
  const brandShowroomSection =
    (!options.homeSandbox || options.homeSandbox === "brand-showroom") && mobileHtml
      ? extractMobileBrandShowroomSection(normalizedMobileHtml)
      : "";
  const latestProductNewsSection =
    (!options.homeSandbox || options.homeSandbox === "latest-product-news") && mobileHtml
      ? extractMobileLatestProductNewsSection(normalizedMobileHtml)
      : "";
  const smartLifeSection =
    (!options.homeSandbox || options.homeSandbox === "smart-life") && mobileHtml
      ? extractMobileSmartLifeSection(normalizedMobileHtml)
      : "";
  const missedBenefitsSection =
    (!options.homeSandbox || options.homeSandbox === "missed-benefits") && mobileHtml
      ? extractMobileMissedBenefitsSection(normalizedMobileHtml)
      : "";
  const lgBestCareSection =
    (!options.homeSandbox || options.homeSandbox === "lg-best-care") && mobileHtml
      ? extractMobileLgBestCareSection(normalizedMobileHtml)
      : "";
  const bestshopGuideSection =
    (!options.homeSandbox || options.homeSandbox === "bestshop-guide") && mobileHtml
      ? extractMobileBestshopGuideSection(normalizedMobileHtml)
      : "";
  const quickMenus = mobileHtml ? extractMobileQuickMenuItems(mobileHtml) : extractQuickMenuSlides(rawHtml);
  const timedealImages =
    extractImageQueueAroundMarker(normalizedMobileHtml, '"mainTitle":"LGE.COM 타임딜"').length
      ? extractImageQueueAroundMarker(normalizedMobileHtml, '"mainTitle":"LGE.COM 타임딜"')
      : extractImageQueueAroundMarker(normalizedRawHtml, '"mainTitle":"LGE.COM 타임딜"');
  const mdChoiceImages =
    extractImageQueueAroundMarker(normalizedMobileHtml, `"title":"MD's CHOICE"`).length
      ? extractImageQueueAroundMarker(normalizedMobileHtml, `"title":"MD's CHOICE"`)
      : extractImageQueueAroundMarker(normalizedRawHtml, `"title":"MD's CHOICE"`);
  const subscriptionImages =
    (!options.homeSandbox || options.homeSandbox === "subscription")
      ? mergeImageQueues(
          extractImageQueueAroundMarker(normalizedMobileHtml, '"dataContents":"가전 구독"', "mobileImageFilePath", 120000),
          extractImageQueueAroundMarker(normalizedMobileHtml, '"dataContents":"가전 구독"', "mediumImageAddr", 120000),
          extractImageQueueAroundMarker(normalizedRawHtml, '"dataContents":"가전 구독"', "mobileImageFilePath", 120000),
          extractImageQueueAroundMarker(normalizedRawHtml, '"dataContents":"가전 구독"', "mediumImageAddr", 120000)
        )
      : [];
  const brandShowroomImages =
    (!options.homeSandbox || options.homeSandbox === "brand-showroom")
      ? HOME_BRAND_SHOWROOM_ITEMS
      : [];
  const latestProductNewsImages =
    (!options.homeSandbox || options.homeSandbox === "latest-product-news")
      ? HOME_LATEST_PRODUCT_NEWS_ITEMS
      : [];
  const smartLifeImages =
    (!options.homeSandbox || options.homeSandbox === "smart-life")
      ? HOME_SMART_LIFE_ITEMS
      : [];
  const missedBenefitsImages =
    (!options.homeSandbox || options.homeSandbox === "missed-benefits")
      ? HOME_MISSED_BENEFITS_ITEMS
      : [];
  const lgBestCareImages =
    (!options.homeSandbox || options.homeSandbox === "lg-best-care")
      ? HOME_LG_BEST_CARE_ITEMS
      : [];
  return {
    quickMenuSection,
    promotionSection,
    lowerPromotionSection,
    timedealSection,
    mdChoiceSection,
    subscriptionSection,
    spaceRenewalSection,
    spaceRenewalData,
    brandShowroomSection,
    latestProductNewsSection,
    smartLifeSection,
    missedBenefitsSection,
    lgBestCareSection,
    bestshopGuideSection,
    quickMenus,
    timedealProducts: timedealImages,
    mdChoiceProducts: mdChoiceImages,
    subscriptionProducts: subscriptionImages,
    brandShowroomProducts: brandShowroomImages,
    latestProductNewsProducts: latestProductNewsImages,
    smartLifeProducts: smartLifeImages,
    missedBenefitsProducts: missedBenefitsImages,
    lgBestCareProducts: lgBestCareImages,
    lowerPromotionProducts: HOME_SUMMARY_BANNER_2_ITEMS,
  };
}

function renderPromoTiles(items) {
  if (!items.length) return "";
  return `
    <section class="codex-home-section codex-home-quickmenu">
      <div class="codex-home-shell codex-home-shell--narrow">
        <div class="codex-home-quickmenu-grid">
          ${items
            .map(
              (item) => `
            <a class="codex-home-quickmenu-card" href="${item.href}">
              <div class="codex-home-quickmenu-icon"><img src="${item.image}" alt="${item.alt || item.title}"></div>
              <strong>${item.title}</strong>
            </a>`
            )
            .join("")}
        </div>
      </div>
    </section>`;
}

function renderProductSection(title, subtitle, products) {
  if (!products.length) return "";
  return `
    <section class="codex-home-section codex-home-product-section">
      <div class="codex-home-shell codex-home-shell--narrow">
        <div class="codex-home-section-head">
          <div>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="codex-home-product-grid">
          ${products
            .map(
              (item) => `
            <a class="codex-home-product-card" href="${item.href}">
              <div class="codex-home-product-image-wrap">
                ${item.badge ? `<span class="codex-home-badge">${item.badge}</span>` : ""}
                <img class="codex-home-product-image" src="${item.image}" alt="${item.title}">
              </div>
              <div class="codex-home-product-body">
                <div class="codex-home-product-title">${item.title}</div>
                <div class="codex-home-product-meta">${item.meta || "&nbsp;"}</div>
                <div class="codex-home-product-price"><span>${item.priceText}</span> ${item.price}원</div>
              </div>
            </a>`
            )
            .join("")}
        </div>
      </div>
    </section>`;
}

function renderBestRankingSandboxSection(activeSourceId = "custom-renderer", componentPatch = {}) {
  const resolution = resolveComponentSourceResolution("home", "best-ranking", activeSourceId);
  const variantClass =
    activeSourceId === "figma-home-best-ranking-v1"
      ? " codex-home-best-ranking--figma"
      : activeSourceId === "custom-renderer"
        ? ""
        : " codex-home-best-ranking--workspace";
  const title = String(componentPatch.title || "베스트 랭킹");
  const subtitle = String(componentPatch.subtitle || "LGE.COM 인기 제품 추천");
  const moreLabel = String(componentPatch.moreLabel || "더보기");
  const styles = componentPatch.styles && typeof componentPatch.styles === "object" ? componentPatch.styles : {};
  const titleStyle = buildTextPatchStyleText({
    ...styles,
    titleColor: styles.titleColor || "#111111",
  }, "title");
  const subtitleStyle = buildTextPatchStyleText({
    ...styles,
    subtitleColor: styles.subtitleColor || "#727780",
  }, "subtitle");
  const sectionStyle = buildSectionPatchStyleText(styles, { hidden: componentPatch.visibility === false });
  return `
    <section data-codex-slot="best-ranking" data-codex-source="custom-renderer" data-codex-component-id="home.best-ranking" data-codex-active-source-id="${escapeHtml(activeSourceId)}" data-codex-source-resolution="${escapeHtml(resolution.sourceResolution)}" data-codex-resolved-render-source-id="${escapeHtml(resolution.resolvedRenderSourceId || activeSourceId)}" data-codex-render-mode="${escapeHtml(resolution.renderMode)}" class="codex-home-best-ranking${variantClass}" ${sectionStyle ? `style="${escapeHtml(sectionStyle)}"` : ""}>
      <div class="codex-home-best-ranking-inner">
        <div class="codex-home-best-ranking-headline">
          <div class="title-home_title-home__Jw_7z">
            <h2 class="title-home_title-home_tit__tE_5M" ${titleStyle ? `style="${escapeHtml(titleStyle)}"` : ""}>${escapeHtml(title)}</h2>
            <span class="title-home_title-home_sub_tit__ivkxK" ${subtitleStyle ? `style="${escapeHtml(subtitleStyle)}"` : ""}>${escapeHtml(subtitle)}</span>
          </div>
        </div>
        <div class="codex-home-best-ranking-content">
          <div class="codex-home-best-ranking-top">
            <div class="codex-home-best-ranking-tabs" role="tablist" aria-label="베스트 랭킹 카테고리">
              ${HOME_BEST_RANKING_TABS.map(
                (item, index) => `
                <button
                  class="codex-home-best-ranking-tab${item.active ? " is-active" : ""}"
                  type="button"
                  role="tab"
                  aria-selected="${item.active ? "true" : "false"}"
                  aria-controls="codex-best-ranking-panel-${index}"
                  id="codex-best-ranking-tab-${index}"
                  data-category-id="${item.categoryId}"
                >
                  <span class="codex-home-best-ranking-tab-image" style="background-image:url('${item.image}')" aria-hidden="true"></span>
                  <span class="codex-home-best-ranking-tab-text">${item.label}</span>
                </button>`
              ).join("")}
            </div>
          </div>
          <div class="codex-home-best-ranking-list-wrap">
            <ul class="codex-home-best-ranking-placeholder" id="codex-best-ranking-panel-0" role="tabpanel" aria-labelledby="codex-best-ranking-tab-0">
              ${HOME_BEST_RANKING_SAMPLE_ITEMS.map((item) => `
                <li class="codex-home-best-ranking-item">
                  <a class="codex-home-best-ranking-card" href="${item.url}">
                    <div class="codex-home-best-ranking-thumb-wrap">
                      <span class="codex-home-best-ranking-rank codex-home-best-ranking-rank--${item.rank}">
                        <img src="${toLgeAbsoluteUrl(item.rankImage)}" alt="랭킹 ${item.rank}" loading="lazy"/>
                      </span>
                      <img src="${toLgeAbsoluteUrl(item.image)}" alt="${item.name} 상품이미지" loading="lazy"/>
                    </div>
                    <div class="codex-home-best-ranking-body">
                      <span class="codex-home-best-ranking-badge-row">
                        ${item.badges
                          .map((badge) => {
                            const klass =
                              badge === "다품목할인"
                                ? "is-multi"
                                : badge === "닷컴 ONLY"
                                  ? "is-dotcom"
                                  : badge === "혜택가"
                                    ? "is-benefit"
                                    : "is-default";
                            return `<span class="codex-home-best-ranking-badge ${klass}">${badge}</span>`;
                          })
                          .join("")}
                        ${item.release ? `<span class="codex-home-best-ranking-badge codex-home-best-ranking-badge--release">${item.release}</span>` : ""}
                      </span>
                      <strong class="codex-home-best-ranking-name">${item.name}</strong>
                      <span class="codex-home-best-ranking-category">${item.category}</span>
                      <span class="codex-home-best-ranking-sku">${item.sku}</span>
                      <span class="codex-home-best-ranking-price">최대혜택가 ${formatPrice(item.price)}원</span>
                    </div>
                  </a>
                </li>`).join("")}
            </ul>
          </div>
          <div class="codex-home-best-ranking-more">
            <a class="codex-home-best-ranking-more-link" href="/best-ranking/todays" target="_self" title="베스트 랭킹">
              <span>${escapeHtml(moreLabel)}</span>
            </a>
          </div>
        </div>
      </div>
    </section>`;
}

function renderHomeMarketingAreaSection() {
  return `
    <section data-codex-slot="marketing-area" data-codex-source="custom-renderer" class="codex-home-marketing-area HomeMoListMarketingArea_list_marketing_area__lRqzR">
      <div class="HomeMoListMarketingArea_list_marketing_area_headline__xkOco">
        <div class="title-home_title-home__tf4br">
          <h2 class="title-home_title-home_tit__C6CDK">홈스타일 탐색하기</h2>
          <span class="title-home_title-home_sub_tit__PHTeI" style="color:#000000">가전과 공간을 연결하는 새로운 기준</span>
        </div>
      </div>
      <div class="HomeMoListMarketingArea_list_marketing_area_list__ea_vS">
        <ul class="HomeMoListMarketingArea_list_marketing_area_list_inner__q_GXF">
          ${HOME_MARKETING_AREA_ITEMS.map(
            (item) => `
              <li class="HomeMoListMarketingArea_list_marketing_area_item__33UOi">
                <a href="${item.href}">
                  <div class="HomeMoListMarketingArea_list_marketing_area_box__jtl6C">
                    <div class="badge_badge_wrap__pETj_">
                      <span class="badge_badge__A_1cT badge_square__nNiyc badge_black__I9EnC badge_size20__Pxksv badge_text_black__GzeBH" color="black"><span>${item.badge}</span></span>
                    </div>
                    <strong class="HomeMoListMarketingArea_list_marketing_area_title__8ME8z">${item.title}</strong>
                    <p class="HomeMoListMarketingArea_list_marketing_area_description__dMjda">${item.description}</p>
                  </div>
                  <div class="HomeMoListMarketingArea_list_marketing_area_image__YY2gD">
                    <img src="${item.image}" alt="${item.alt}" loading="lazy"/>
                  </div>
                </a>
              </li>`
          ).join("")}
        </ul>
      </div>
    </section>`;
}

function getHomeLowerSlotRegistry(editableData = null) {
  const resolveSlotSourceId = (slotId, fallback) => getActiveSourceId(editableData || readEditableData(), "home", slotId, fallback);
  const resolveComponentPatch = (slotId, sourceId) =>
    (findComponentPatch(editableData || {}, "home", `home.${slotId}`, sourceId)?.patch) || {};
  return [
    {
      id: "md-choice",
      activeSourceId: resolveSlotSourceId("md-choice", "mobile-derived"),
      enabled: (data) => Boolean(data.mdChoiceSection),
      render: (data, _options, slot) =>
        applyHomeLowerSectionPatch(
          markHomeLowerReplay(
            injectProductImagesIntoSection(data.mdChoiceSection, data.mdChoiceProducts),
            "md-choice",
            slot.activeSourceId
          ),
          "md-choice",
          slot.activeSourceId,
          resolveComponentPatch(slot.id, slot.activeSourceId)
        ),
    },
    {
      id: "timedeal",
      activeSourceId: resolveSlotSourceId("timedeal", "mobile-derived"),
      enabled: (data) => Boolean(data.timedealSection),
      render: (data, _options, slot) =>
        applyHomeLowerSectionPatch(
          markHomeLowerReplay(
            injectProductImagesIntoSection(data.timedealSection, data.timedealProducts),
            "timedeal",
            slot.activeSourceId
          ),
          "timedeal",
          slot.activeSourceId,
          resolveComponentPatch(slot.id, slot.activeSourceId)
        ),
    },
    {
      id: "best-ranking",
      activeSourceId: resolveSlotSourceId("best-ranking", "custom-live-current"),
      enabled: () => true,
      render: (_data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "custom-renderer" ? "custom-live-current" : slot.activeSourceId;
        return (
          renderCurrentLiveHomeSection(
            "best-ranking",
            effectiveSourceId,
            resolveComponentPatch(slot.id, effectiveSourceId),
            "HomeMoListTabstypeBestranking_list_tab_bestranking__"
          ) ||
          renderBestRankingSandboxSection(effectiveSourceId, resolveComponentPatch(slot.id, effectiveSourceId))
        );
      },
    },
    {
      id: "marketing-area",
      activeSourceId: "custom-renderer",
      enabled: (_data, options) => !options.homeSandbox,
      render: () => renderHomeMarketingAreaSection(),
    },
    {
      id: "subscription",
      activeSourceId: resolveSlotSourceId("subscription", "custom-live-current"),
      enabled: (data, options) =>
        (!options.homeSandbox || options.homeSandbox === "subscription") && Boolean(data.subscriptionSection),
      render: (data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "mobile-derived" ? "custom-live-current" : slot.activeSourceId;
        const componentPatch = resolveComponentPatch(slot.id, effectiveSourceId);
        if (effectiveSourceId === "custom-live-current") {
          return (
            renderCurrentLiveHomeSection(
              "subscription",
              effectiveSourceId,
              componentPatch,
              "HomeMoListTabsBannertype_list_tabs_bannertype__"
            ) ||
            applyHomeLowerSectionPatch(
              markHomeLowerReplay(
                injectProductImagesIntoSection(data.subscriptionSection, data.subscriptionProducts),
                "subscription",
                effectiveSourceId
              ),
              "subscription",
              effectiveSourceId,
              componentPatch
            )
          );
        }
        return applyHomeLowerSectionPatch(
          markHomeLowerReplay(
            injectProductImagesIntoSection(data.subscriptionSection, data.subscriptionProducts),
            "subscription",
            effectiveSourceId
          ),
          "subscription",
          effectiveSourceId,
          componentPatch
        );
      },
    },
    {
      id: "space-renewal",
      activeSourceId: resolveSlotSourceId("space-renewal", "hybrid-home-space-renewal-v1"),
      enabled: (data, options) =>
        (!options.homeSandbox || options.homeSandbox === "space-renewal") &&
        Boolean(data.spaceRenewalSection) &&
        Boolean(data.spaceRenewalData),
      render: (data, _options, slot) => {
        const effectiveSourceId =
          slot.activeSourceId === "mobile-derived" ? "hybrid-home-space-renewal-v1" : slot.activeSourceId;
        const componentPatch = resolveComponentPatch(slot.id, effectiveSourceId);
        return effectiveSourceId === "mobile-derived"
          ? applyHomeLowerSectionPatch(
              markHomeLowerReplay(
                injectProductImagesIntoSection(data.spaceRenewalSection, buildSpaceRenewalProducts(data.spaceRenewalData)),
                "space-renewal",
                effectiveSourceId
              ),
              "space-renewal",
              effectiveSourceId,
              componentPatch
            )
          : renderSpaceRenewalSection(data.spaceRenewalData, effectiveSourceId, componentPatch);
      },
    },
    {
      id: "brand-showroom",
      activeSourceId: resolveSlotSourceId("brand-showroom", "custom-live-current"),
      enabled: (data, options) =>
        (!options.homeSandbox || options.homeSandbox === "brand-showroom") && Boolean(data.brandShowroomSection),
      render: (data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "mobile-derived" ? "custom-live-current" : slot.activeSourceId;
        return effectiveSourceId === "custom-live-current"
          ? (
              renderCurrentLiveHomeSection(
                "brand-showroom",
                effectiveSourceId,
                resolveComponentPatch(slot.id, effectiveSourceId),
                "HomeMoListSquaretypeSmall_list_squaretype__"
              ) ||
              applyHomeLowerSectionPatch(
                markHomeLowerReplay(
                  injectTemplateImagesIntoSection(data.brandShowroomSection, data.brandShowroomProducts),
                  "brand-showroom",
                  effectiveSourceId
                ),
                "brand-showroom",
                effectiveSourceId,
                resolveComponentPatch(slot.id, effectiveSourceId)
              )
            )
          : effectiveSourceId === "custom-home-brand-showroom-v1"
          ? renderBrandShowroomCustomSection(data.brandShowroomProducts, effectiveSourceId, resolveComponentPatch(slot.id, effectiveSourceId))
          : applyHomeLowerSectionPatch(
              markHomeLowerReplay(
                injectTemplateImagesIntoSection(data.brandShowroomSection, data.brandShowroomProducts),
                "brand-showroom",
                effectiveSourceId
              ),
              "brand-showroom",
              effectiveSourceId,
              resolveComponentPatch(slot.id, effectiveSourceId)
            );
      },
    },
    {
      id: "latest-product-news",
      activeSourceId: resolveSlotSourceId("latest-product-news", "custom-live-current"),
      enabled: (data, options) =>
        (!options.homeSandbox || options.homeSandbox === "latest-product-news") &&
        Boolean(data.latestProductNewsSection),
      render: (data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "mobile-derived" ? "custom-live-current" : slot.activeSourceId;
        return effectiveSourceId === "custom-live-current"
          ? (
              renderCurrentLiveHomeSection(
                "latest-product-news",
                effectiveSourceId,
                resolveComponentPatch(slot.id, effectiveSourceId),
                "HomeMoListSquaretypeBig_list_squaretype_big__"
              ) ||
              applyHomeLowerSectionPatch(
                markHomeLowerReplay(
                  injectTemplateImagesIntoSection(data.latestProductNewsSection, data.latestProductNewsProducts),
                  "latest-product-news",
                  effectiveSourceId
                ),
                "latest-product-news",
                effectiveSourceId,
                resolveComponentPatch(slot.id, effectiveSourceId)
              )
            )
          : effectiveSourceId === "custom-home-latest-product-news-v1"
          ? renderLatestProductNewsCustomSection(data.latestProductNewsProducts, effectiveSourceId, resolveComponentPatch(slot.id, effectiveSourceId))
          : applyHomeLowerSectionPatch(
              markHomeLowerReplay(
                injectTemplateImagesIntoSection(data.latestProductNewsSection, data.latestProductNewsProducts),
                "latest-product-news",
                effectiveSourceId
              ),
              "latest-product-news",
              effectiveSourceId,
              resolveComponentPatch(slot.id, effectiveSourceId)
            );
      },
    },
    {
      id: "smart-life",
      activeSourceId: resolveSlotSourceId("smart-life", "custom-live-current"),
      enabled: (data, options) => (!options.homeSandbox || options.homeSandbox === "smart-life") && Boolean(data.smartLifeSection),
      render: (data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "mobile-derived" ? "custom-live-current" : slot.activeSourceId;
        const componentPatch = resolveComponentPatch(slot.id, effectiveSourceId);
        if (effectiveSourceId === "custom-live-current") {
          return (
            renderCurrentLiveHomeSection(
              "smart-life",
              effectiveSourceId,
              componentPatch,
              "HomeMoListVerticaltype_list_verticaltype__"
            ) ||
            applyHomeLowerSectionPatch(
              markHomeLowerReplay(
                injectTemplateImagesIntoSection(
                  syncHomeStoryListSection(data.smartLifeSection, data.smartLifeProducts),
                  data.smartLifeProducts
                ),
                "smart-life",
                effectiveSourceId
              ),
              "smart-life",
              effectiveSourceId,
              componentPatch
            )
          );
        }
        return applyHomeLowerSectionPatch(
          markHomeLowerReplay(
            injectTemplateImagesIntoSection(
              syncHomeStoryListSection(data.smartLifeSection, data.smartLifeProducts),
              data.smartLifeProducts
            ),
            "smart-life",
            effectiveSourceId
          ),
          "smart-life",
          effectiveSourceId,
          componentPatch
        );
      },
    },
    {
      id: "summary-banner-2",
      activeSourceId: resolveSlotSourceId("summary-banner-2", "custom-live-current"),
      enabled: (data, options) =>
        (!options.homeSandbox || options.homeSandbox === "summary-banner-2") && Boolean(data.lowerPromotionSection),
      render: (data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "mobile-derived" ? "custom-live-current" : slot.activeSourceId;
        const componentPatch = resolveComponentPatch(slot.id, effectiveSourceId);
        if (effectiveSourceId === "custom-live-current") {
          return (
            renderCurrentLiveHomeSection(
              "summary-banner-2",
              effectiveSourceId,
              componentPatch,
              "HomeMoBannerPromotion_banner_promotion__",
              "메인 상단 배너 영역"
            ) ||
            applyHomeLowerSectionPatch(
              markHomeLowerReplay(
                injectTemplateImagesIntoSection(data.lowerPromotionSection, data.lowerPromotionProducts),
                "summary-banner-2",
                effectiveSourceId
              ),
              "summary-banner-2",
              effectiveSourceId,
              componentPatch
            )
          );
        }
        return applyHomeLowerSectionPatch(
          markHomeLowerReplay(
            injectTemplateImagesIntoSection(data.lowerPromotionSection, data.lowerPromotionProducts),
            "summary-banner-2",
            effectiveSourceId
          ),
          "summary-banner-2",
          effectiveSourceId,
          componentPatch
        );
      },
    },
    {
      id: "missed-benefits",
      activeSourceId: resolveSlotSourceId("missed-benefits", "custom-live-current"),
      enabled: (data, options) =>
        (!options.homeSandbox || options.homeSandbox === "missed-benefits") && Boolean(data.missedBenefitsSection),
      render: (data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "mobile-derived" ? "custom-live-current" : slot.activeSourceId;
        const componentPatch = resolveComponentPatch(slot.id, effectiveSourceId);
        if (effectiveSourceId === "custom-live-current") {
          return (
            renderCurrentLiveHomeSection(
              "missed-benefits",
              effectiveSourceId,
              componentPatch,
              "HomeMoListRectangletype_list_rectangle__"
            ) ||
            applyHomeLowerSectionPatch(
              markHomeLowerReplay(
                injectTemplateImagesIntoSection(data.missedBenefitsSection, data.missedBenefitsProducts),
                "missed-benefits",
                effectiveSourceId
              ),
              "missed-benefits",
              effectiveSourceId,
              componentPatch
            )
          );
        }
        return applyHomeLowerSectionPatch(
          markHomeLowerReplay(
            injectTemplateImagesIntoSection(data.missedBenefitsSection, data.missedBenefitsProducts),
            "missed-benefits",
            effectiveSourceId
          ),
          "missed-benefits",
          effectiveSourceId,
          componentPatch
        );
      },
    },
    {
      id: "lg-best-care",
      activeSourceId: resolveSlotSourceId("lg-best-care", "custom-live-current"),
      enabled: (data, options) =>
        (!options.homeSandbox || options.homeSandbox === "lg-best-care") && Boolean(data.lgBestCareSection),
      render: (data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "mobile-derived" ? "custom-live-current" : slot.activeSourceId;
        const componentPatch = resolveComponentPatch(slot.id, effectiveSourceId);
        if (effectiveSourceId === "custom-live-current") {
          return (
            renderCurrentLiveHomeSection(
              "lg-best-care",
              effectiveSourceId,
              componentPatch,
              "HomeMoListVerticaltypeFill_list_verticaltype_fill__"
            ) ||
            applyHomeLowerSectionPatch(
              markHomeLowerReplay(
                injectTemplateImagesIntoSection(data.lgBestCareSection, data.lgBestCareProducts),
                "lg-best-care",
                effectiveSourceId
              ),
              "lg-best-care",
              effectiveSourceId,
              componentPatch
            )
          );
        }
        return applyHomeLowerSectionPatch(
          markHomeLowerReplay(
            injectTemplateImagesIntoSection(data.lgBestCareSection, data.lgBestCareProducts),
            "lg-best-care",
            effectiveSourceId
          ),
          "lg-best-care",
          effectiveSourceId,
          componentPatch
        );
      },
    },
    {
      id: "bestshop-guide",
      activeSourceId: resolveSlotSourceId("bestshop-guide", "custom-live-current"),
      enabled: (data, options) =>
        (!options.homeSandbox || options.homeSandbox === "bestshop-guide") && Boolean(data.bestshopGuideSection),
      render: (data, _options, slot) => {
        const effectiveSourceId = slot.activeSourceId === "mobile-derived" ? "custom-live-current" : slot.activeSourceId;
        const componentPatch = resolveComponentPatch(slot.id, effectiveSourceId);
        if (effectiveSourceId === "custom-live-current") {
          return (
            renderCurrentLiveHomeSection(
              "bestshop-guide",
              effectiveSourceId,
              componentPatch,
              "HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__"
            ) ||
            applyHomeLowerSectionPatch(
              markHomeLowerReplay(data.bestshopGuideSection, "bestshop-guide", effectiveSourceId),
              "bestshop-guide",
              effectiveSourceId,
              componentPatch
            )
          );
        }
        return applyHomeLowerSectionPatch(
          markHomeLowerReplay(data.bestshopGuideSection, "bestshop-guide", effectiveSourceId),
          "bestshop-guide",
          effectiveSourceId,
          componentPatch
        );
      },
    },
  ];
}

function renderHomeLowerSlots(data, options = {}) {
  return getHomeLowerSlotRegistry(options.editableData)
    .filter((slot) => slot.enabled(data, options))
    .map((slot) => slot.render(data, options, slot))
    .filter(Boolean)
    .join("\n");
}

function renderHomeEnhancements(rawHtml, mobileHtml = "", options = {}) {
  const data = parseHomeEnhancements(rawHtml, mobileHtml, options);
  if (
    !data.quickMenus.length &&
    !data.promotionSection &&
    !data.lowerPromotionSection &&
    !data.timedealSection &&
    !data.mdChoiceSection &&
    !data.subscriptionSection &&
    !data.spaceRenewalData &&
    !data.brandShowroomSection &&
    !data.latestProductNewsSection &&
    !data.smartLifeSection &&
    !data.missedBenefitsSection &&
    !data.lgBestCareSection &&
    !data.bestshopGuideSection
  ) return null;
  return `
    ${data.quickMenuSection || renderPromoTiles(data.quickMenus)}
    ${data.promotionSection || ""}
    ${renderHomeLowerSlots(data, options)}`;
}

function injectHomeReplacements(html, rawHtml, mobileHtml = "", options = {}) {
  const rebuilt = renderHomeEnhancements(rawHtml, mobileHtml, options);
  if (!rebuilt) return html;

  const heroSourceId = getActiveSourceId(options.editableData || {}, "home", "hero", "captured-home-hero");
  const heroPatch = findComponentPatch(options.editableData || {}, "home", "home.hero", heroSourceId)?.patch || {};
  const hero = mobileHtml ? applyHomeHeroPatch(extractMobileHeroSection(mobileHtml), heroSourceId, heroPatch) : "";
  const quickMenu =
    rebuilt.match(/<section class="HomeMoQuickmenu_quickmenu__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-section codex-home-quickmenu">[\s\S]*?<\/section>/)?.[0] ||
    "";
  const promotion =
    rebuilt.match(/<section class="HomeMoBannerPromotion_banner_promotion__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const lowerPromotion =
    rebuilt.match(/<section[^>]+data-codex-slot="summary-banner-2"[^>]*class="[^"]*HomeMoBannerPromotion_banner_promotion__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const mdChoice =
    rebuilt.match(/<section[^>]+data-codex-slot="md-choice"[^>]*class="[^"]*HomeMoListHorizontype_list_horizontype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListHorizontype_list_horizontype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListHorizontype_list_horizontype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const timedeal =
    rebuilt.match(/<section[^>]+data-codex-slot="timedeal"[^>]*class="[^"]*HomeMoTimedeal_timedeal__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoTimedeal_timedeal__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoTimedeal_timedeal__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const subscription =
    rebuilt.match(/<section[^>]+data-codex-slot="subscription"[^>]*class="[^"]*HomeMoListTabsBannertype_list_tabs_bannertype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListTabsBannertype_list_tabs_bannertype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListTabsBannertype_list_tabs_bannertype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const spaceRenewal =
    rebuilt.match(/<section[^>]+data-codex-slot="space-renewal"[^>]*class="[^"]*codex-home-space-renewal[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section[^>]+data-codex-slot="space-renewal"[^>]*class="[^"]*HomeMoListBannertype_list_bannertype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-space-renewal[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListBannertype_list_bannertype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListBannertype_list_bannertype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const bestRanking =
    rebuilt.match(/<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-best-ranking"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListTabstypeBestranking_list_tab_bestranking__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const marketingArea =
    rebuilt.match(/<section[^>]+data-codex-slot="marketing-area"[^>]*class="[^"]*HomeMoListMarketingArea_list_marketing_area__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-marketing-area[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListMarketingArea_list_marketing_area__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const brandShowroom =
    rebuilt.match(/<section[^>]+data-codex-slot="brand-showroom"[^>]*class="[^"]*codex-home-brand-showroom[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section[^>]+data-codex-slot="brand-showroom"[^>]*class="[^"]*HomeMoListSquaretypeSmall_list_squaretype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListSquaretypeSmall_list_squaretype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListSquaretypeSmall_list_squaretype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const latestProductNews =
    rebuilt.match(/<section[^>]+data-codex-slot="latest-product-news"[^>]*class="[^"]*codex-home-latest-news[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section[^>]+data-codex-slot="latest-product-news"[^>]*class="[^"]*HomeMoListSquaretypeBig_list_squaretype_big__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListSquaretypeBig_list_squaretype_big__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListSquaretypeBig_list_squaretype_big__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const smartLife =
    rebuilt.match(/<section[^>]+data-codex-slot="smart-life"[^>]*class="[^"]*HomeMoListVerticaltype_list_verticaltype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListVerticaltype_list_verticaltype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListVerticaltype_list_verticaltype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const missedBenefits =
    rebuilt.match(/<section[^>]+data-codex-slot="missed-benefits"[^>]*class="[^"]*HomeMoListRectangletype_list_rectangle__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListRectangletype_list_rectangle__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListRectangletype_list_rectangle__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const lgBestCare =
    rebuilt.match(/<section[^>]+data-codex-slot="lg-best-care"[^>]*class="[^"]*HomeMoListVerticaltypeFill_list_verticaltype_fill__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListVerticaltypeFill_list_verticaltype_fill__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListVerticaltypeFill_list_verticaltype_fill__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  const bestshopGuide =
    rebuilt.match(/<section[^>]+data-codex-slot="bestshop-guide"[^>]*class="[^"]*HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="codex-home-lower-replay HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    rebuilt.match(/<section class="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__[^"]*"[\s\S]*?<\/section>/)?.[0] ||
    "";
  if (hero) {
    html = html.replace(
      /<section class="HomePcBannerHero_banner_hero__[^"]*"[\s\S]*?(?=<section class="HomePcQuickmenu_quickmenu__)/,
      () => hero
    );
  }

  if (quickMenu) {
    html = html.replace(
      /<section class="HomePcQuickmenu_quickmenu__U0ECR"[\s\S]*?<\/section>/,
      quickMenu
    );
    html = html.replace(
      /<section class="HomeMoQuickmenu_quickmenu__[^"]*"[\s\S]*?<\/section>/,
      quickMenu
    );
  }

  if (promotion) {
    html = html.replace(
      /<section class="HomePcBannerPromotion_banner_promotion__[^"]*"[\s\S]*?<\/section>/,
      promotion
    );
  }

  if (lowerPromotion) {
    html = html.replace(
      /<section[^>]+data-area="메인 하단 배너 영역"[^>]*>[\s\S]*?<\/section>/,
      lowerPromotion
    );
  }

  if (mdChoice) {
    html = html.replace(
      /<section class="list_horizontype HomePcListHorizontypeSkeleton_skeleton__cEI_8"[\s\S]*?<\/section>/,
      mdChoice
    );
  }

  if (timedeal) {
    html = html.replace(
      /<section class="HomePcTimedealSkeleton_timedeal__SRvIo HomePcTimedealSkeleton_skeleton__VWRlL"[\s\S]*?<\/section>/,
      timedeal
    );
  }

  if (subscription) {
    html = html.replace(
      /<section class="HomePcListTabsBannertype_list_tabs_bannertype__KDksU"[\s\S]*?<\/section>/,
      subscription
    );
  }

  if (spaceRenewal) {
    html = html.replace(
      /(<section[^>]+data-area="메인 가전 구독 영역"[^>]*>)/,
      `${spaceRenewal}\n$1`
    );
    if (!html.includes('data-codex-slot="space-renewal"')) {
      html = html.replace(
        /(<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>)/,
        `$1\n${spaceRenewal}`
      );
    }
    if (!html.includes('data-codex-slot="space-renewal"')) {
      html = html.replace(/<\/footer>/i, `${spaceRenewal}\n</footer>`);
    }
  }

  if (bestRanking) {
    html = html.replace(
      /<section class="list_tab_bestranking HomePcListTabstypeBestrankingSkeleton_skeleton__[^"]*"[\s\S]*?<\/section>/,
      bestRanking
    );
    html = html.replace(
      /<section class="list_marketing_area HomePcListMarketingAreaSkeleton_skeleton__[^"]*"[\s\S]*?<\/section>/,
      ""
    );
  }

  if (marketingArea && bestRanking) {
    html = html.replace(
      /(<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>)/,
      `$1\n${marketingArea}`
    );
    if (!html.includes('data-codex-slot="marketing-area"')) {
      html = html.replace(/<\/footer>/i, `${marketingArea}\n</footer>`);
    }
  }

  if (brandShowroom) {
    html = html.replace(
      /<section[^>]+data-area="메인 브랜드 쇼룸 영역"[^>]*>[\s\S]*?<\/section>/,
      brandShowroom
    );
  }

  if (latestProductNews) {
    html = html.replace(
      /<section[^>]+data-area="메인 최신 제품 소식 영역"[^>]*>[\s\S]*?<\/section>/,
      latestProductNews
    );
  }

  if (smartLife) {
    html = html.replace(
      /<section[^>]+data-area="메인 슬기로운 가전생활 영역"[^>]*>[\s\S]*?<\/section>/,
      smartLife
    );
  }

  if (missedBenefits) {
    html = html.replace(
      /<section[^>]+data-area="메인 놓치면 아쉬운 혜택 영역"[^>]*>[\s\S]*?<\/section>/,
      missedBenefits
    );
  }

  if (lgBestCare) {
    html = html.replace(
      /<section[^>]+data-area="메인 베스트 케어 영역"[^>]*>[\s\S]*?<\/section>/,
      lgBestCare
    );
  }

  if (bestshopGuide) {
    html = html.replace(
      /<section[^>]+data-area="메인 베스트샵 이용안내 영역"[^>]*>[\s\S]*?<\/section>/,
      bestshopGuide
    );
  }

  html = html.replace(
    /(?:<div aria-hidden="true" class="gap_gap__[^"]+ gap_gap80__[^"]+"><\/div>\s*){2,}(?=(?:<!--\$\?--><template id="B:[^"]+"><\/template>\s*<div aria-hidden="true" class="gap_gap__[^"]+ gap_gap80__[^"]+"><\/div>\s*<!--\/\$-->\s*)?<section[^>]+data-codex-slot="(?:space-renewal|subscription|brand-showroom|latest-product-news|smart-life|summary-banner-2|missed-benefits|lg-best-care|bestshop-guide)")/g,
    `<div aria-hidden="true" class="gap_gap__hz8Kt gap_gap80__0DweN"></div>\n`
  );
  html = html.replace(
    /<!--\$\?--><template id="B:[^"]+"><\/template>\s*<div aria-hidden="true" class="gap_gap__[^"]+ gap_gap80__[^"]+"><\/div>\s*<!--\/\$-->(?=\s*<section[^>]+data-codex-slot="(?:space-renewal|subscription|brand-showroom|latest-product-news|smart-life|summary-banner-2|missed-benefits|lg-best-care|bestshop-guide)")/g,
    ""
  );
  html = html.replace(
    /<\/section>\s*<div aria-hidden="true" class="gap_gap__[^"]+ gap_gap80__[^"]+"><\/div>\s*<div aria-hidden="true" class="gap_gap__[^"]+ gap_gap80__[^"]+"><\/div>\s*<!--\$\?--><template id="B:[^"]+"><\/template><div aria-hidden="true" class="gap_gap__[^"]+ gap_gap80__[^"]+"><\/div><!--\/\$--><!--\$--><section([^>]+data-codex-slot="(?:space-renewal|subscription|brand-showroom|latest-product-news|smart-life|summary-banner-2|missed-benefits|lg-best-care|bestshop-guide)"[^>]*)>/g,
    `</section><div aria-hidden="true" class="gap_gap__hz8Kt gap_gap80__0DweN"></div><!--$--><section$1>`
  );
  html = html.replace(
    /(?:<div aria-hidden="true" class="gap_gap__[^"]+ gap_gap80__[^"]+"><\/div>\s*)+<!--\$\?--><template id="B:[^"]+"><\/template><div aria-hidden="true" class="gap_gap__[^"]+ gap_gap80__[^"]+"><\/div><!--\/\$--><!--\$-->(?=\s*<section data-codex-slot="space-renewal")/g,
    `<div aria-hidden="true" class="gap_gap__hz8Kt gap_gap80__0DweN"></div>`
  );

  if (options.homeSandbox === "brand-showroom" && brandShowroom && bestRanking) {
    html = html.replace(
      /(<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>)/,
      `$1\n${brandShowroom}`
    );
    if (!html.includes('data-codex-slot="brand-showroom"')) {
      html = html.replace(/<\/footer>/i, `${brandShowroom}\n</footer>`);
    }
  }

  if (options.homeSandbox === "latest-product-news" && latestProductNews && bestRanking) {
    html = html.replace(
      /(<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>)/,
      `$1\n${latestProductNews}`
    );
    if (!html.includes('data-codex-slot="latest-product-news"')) {
      html = html.replace(/<\/footer>/i, `${latestProductNews}\n</footer>`);
    }
  }

  if (options.homeSandbox === "smart-life" && smartLife && bestRanking) {
    html = html.replace(
      /(<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>)/,
      `$1\n${smartLife}`
    );
    if (!html.includes('data-codex-slot="smart-life"')) {
      html = html.replace(/<\/footer>/i, `${smartLife}\n</footer>`);
    }
  }

  if (options.homeSandbox === "missed-benefits" && missedBenefits && bestRanking) {
    html = html.replace(
      /(<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>)/,
      `$1\n${missedBenefits}`
    );
    if (!html.includes('data-codex-slot="missed-benefits"')) {
      html = html.replace(/<\/footer>/i, `${missedBenefits}\n</footer>`);
    }
  }

  if (options.homeSandbox === "lg-best-care" && lgBestCare && bestRanking) {
    html = html.replace(
      /(<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>)/,
      `$1\n${lgBestCare}`
    );
    if (!html.includes('data-codex-slot="lg-best-care"')) {
      html = html.replace(/<\/footer>/i, `${lgBestCare}\n</footer>`);
    }
  }

  if (options.homeSandbox === "bestshop-guide" && bestshopGuide && bestRanking) {
    html = html.replace(
      /(<section[^>]+data-codex-slot="best-ranking"[^>]*[\s\S]*?<\/section>)/,
      `$1\n${bestshopGuide}`
    );
    if (!html.includes('data-codex-slot="bestshop-guide"')) {
      html = html.replace(/<\/footer>/i, `${bestshopGuide}\n</footer>`);
    }
  }

  html = html.replace(
    /<section class="[^"]*HomePc[^"]*Skeleton_skeleton__[^"]*"[\s\S]*?<\/section>/g,
    ""
  );

  html = html.replace(/<template id="B:0"><\/template>/g, "");
  html = html.replace(/<template id="B:1"><\/template>/g, "");
  html = html.replace(/<div hidden id="S:\d+">[\s\S]*?<\/div>/g, "");
  html = html.replace(/<\/footer>[\s\S]*?(?=<\/body>)/i, "</footer>");
  return html;
}

function rewriteCloneHtml(rawHtml, pageId, viewportProfile = "pc", options = {}) {
  const editableData = options.editableData || readEditableData();
  const showEditorChrome = options.editorEnabled === true;
  const archiveMap = buildArchivePageMap();
  const archive = archiveMap[pageId];
  const pageTitle = archive?.title || pageId;
  const internalLinkMap = buildInternalCloneLinkMap();
  const pdpCaptureMap = buildPdpCapturePageMap(viewportProfile);
  const isHome = pageId === "home";
  const preservePageHeader = true;
  const useCapturedHomeHeader =
    isHome &&
    isCapturedSourceActive(editableData, "home", "header-top") &&
    isCapturedSourceActive(editableData, "home", "header-bottom");
  const useCapturedHomeQuickmenu = isHome && isCapturedSourceActive(editableData, "home", "quickmenu");
  const homeMobileHtml = isHome ? readHomeMobileHtml() : "";
  const headerTopSourceId = isHome ? getActiveSourceId(editableData, "home", "header-top", "captured-home-header-top") : "pc-like";
  const headerBottomSourceId = isHome ? getActiveSourceId(editableData, "home", "header-bottom", "captured-home-header-bottom") : "pc-like";
  const heroSourceId = isHome ? getActiveSourceId(editableData, "home", "hero", "captured-home-hero") : "pc-like";
  const quickmenuSourceId = isHome ? getActiveSourceId(editableData, "home", "quickmenu", "captured-home-quickmenu") : "mobile-derived";

  let html = rawHtml;
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<base[^>]+href=("|')[^"']+\1[^>]*>/gi, "");
  html = html.replace(/<link[^>]+as=("|')font\1[^>]*>/gi, "");
  html = html.replace(/<link[^>]+rel=("|')manifest\1[^>]*>/gi, "");
  html = html.replace(/\b(href|src|poster)=("|')\/(?!\/)/gi, `$1=$2https://www.lge.co.kr/`);
  html = html.replace(/url\((["']?)\/(?!\/)/gi, `url($1https://www.lge.co.kr/`);
  if (isHome) {
    html = injectHomeReplacements(html, rawHtml, homeMobileHtml, { ...options, editableData });
    if (viewportProfile === "pc") {
      const desktopFooter = extractFooterSection(readHomeDesktopHtml());
      if (desktopFooter) {
        html = html.replace(/<footer\b[\s\S]*?<\/footer>/i, desktopFooter);
      }
    }
  }
  html = applyWorkspacePageVariants(html, pageId, viewportProfile, editableData);
  if (
    isHome &&
    homeMobileHtml &&
    (
      isCapturedSourceActive(editableData, "home", "hero") ||
      useCapturedHomeQuickmenu ||
      isCapturedSourceActive(editableData, "home", "timedeal") ||
      isCapturedSourceActive(editableData, "home", "md-choice")
    )
  ) {
    const extraMobileStyles = extractMissingStylesheetLinks(html, homeMobileHtml);
    html = injectExtraHeadLinks(html, extraMobileStyles);
  }
  html = html.replace(/<section class="CommonPcGnb_top__([^"]*)"/, `<section data-codex-slot="header-top" data-codex-component-id="home.header-top" data-codex-active-source-id="${escapeHtml(headerTopSourceId)}" class="CommonPcGnb_top__$1"`);
  html = html.replace(/<section class="CommonPcGnb_bottom__([^"]*)"/, `<section data-codex-slot="header-bottom" data-codex-component-id="home.header-bottom" data-codex-active-source-id="${escapeHtml(headerBottomSourceId)}" class="CommonPcGnb_bottom__$1"`);
  html = html.replace(/<section class="HomePcBannerHero_banner_hero__([^"]*)"/, `<section data-codex-slot="hero" data-codex-component-id="home.hero" data-codex-active-source-id="${escapeHtml(heroSourceId)}" class="HomePcBannerHero_banner_hero__$1"`);
  html = html.replace(/<section class="HomeTaBannerHero_banner_hero__([^"]*)"/, `<section data-codex-slot="hero" data-codex-component-id="home.hero" data-codex-active-source-id="${escapeHtml(heroSourceId)}" class="HomeTaBannerHero_banner_hero__$1"`);
  html = html.replace(/<section class="HomePcQuickmenu_quickmenu__([^"]*)"/, `<section data-codex-slot="quickmenu" data-codex-component-id="home.quickmenu" data-codex-active-source-id="${escapeHtml(quickmenuSourceId)}" class="HomePcQuickmenu_quickmenu__$1"`);
  html = html.replace(/<section class="HomeMoQuickmenu_quickmenu__([^"]*)"/, `<section data-codex-slot="quickmenu" data-codex-component-id="home.quickmenu" data-codex-active-source-id="${escapeHtml(quickmenuSourceId)}" class="HomeMoQuickmenu_quickmenu__$1"`);
  html = html.replace(/<header class="CommonMoGnb_main__([^"]*)"/, `<header data-codex-slot="header-top" data-codex-component-id="home.header-top" data-codex-active-source-id="${escapeHtml(headerTopSourceId)}" class="CommonMoGnb_main__$1"`);
  html = html.replace(/<section class="HomeMoBannerHero_banner_hero__([^"]*)"/, `<section data-codex-slot="hero" data-codex-component-id="home.hero" data-codex-active-source-id="${escapeHtml(heroSourceId)}" class="HomeMoBannerHero_banner_hero__$1"`);
  html = html.replace(/<section class="HomeMoQuickmenu_quickmenu__([^"]*)"/, `<section data-codex-slot="quickmenu" data-codex-component-id="home.quickmenu" data-codex-active-source-id="${escapeHtml(quickmenuSourceId)}" class="HomeMoQuickmenu_quickmenu__$1"`);
  html = html.replace(/<section class="codex-home-section codex-home-quickmenu"/, `<section data-codex-slot="quickmenu" data-codex-component-id="home.quickmenu" data-codex-active-source-id="${escapeHtml(quickmenuSourceId)}" class="codex-home-section codex-home-quickmenu"`);
  const injectedHead = `
    <style>
      html, body { min-height: 100%; visibility: visible !important; opacity: 1 !important; }
      body { background: #fff; visibility: visible !important; opacity: 1 !important; }
      img[style*="visibility:hidden"][src]:not([src=""]) { visibility: visible !important; }
      img[style*="opacity:0"][src]:not([src=""]) { opacity: 1 !important; }
      ${pageId === "category-refrigerators" && viewportProfile === "mo"
        ? `
      .CommonMoBannerTopinfo_hello_bar__jV54K,
      .CommonMoBannerTopinfo_app__8C1kq {
        display: none !important;
      }`
        : ""}
      [hidden][data-codex-force-visible] { display: initial !important; }
      .skip_nav,
      .skip-nav {
        display: none !important;
      }
      ${isHome ? buildHomeHeroRuntimeCss() : ""}
      section[data-codex-slot="hero"][data-codex-active-source-id="custom-home-hero-v1"] .codex-hero-controls {
        right: 24px !important;
        bottom: 20px !important;
        background: rgba(17, 24, 39, 0.72) !important;
        border-radius: 999px !important;
        padding: 8px 10px !important;
      }
      section[data-codex-slot="hero"][data-codex-active-source-id="figma-home-hero-v1"] .codex-hero-controls {
        right: 28px !important;
        bottom: 26px !important;
        background: rgba(255, 255, 255, 0.92) !important;
        border-radius: 18px !important;
        border: 1px solid rgba(17, 24, 39, 0.08) !important;
        box-shadow: 0 12px 32px rgba(17, 24, 39, 0.14) !important;
        padding: 10px 12px !important;
      }
      section[data-codex-slot="hero"][data-codex-active-source-id="figma-home-hero-v1"] .codex-hero-current {
        color: #111 !important;
      }
      section[data-codex-slot="hero"][data-codex-active-source-id="figma-home-hero-v1"] .codex-hero-divider,
      section[data-codex-slot="hero"][data-codex-active-source-id="figma-home-hero-v1"] .codex-hero-total {
        color: #6b7280 !important;
      }
      .codex-home-best-ranking--figma .codex-home-best-ranking-inner {
        border-radius: 28px !important;
        box-shadow: 0 22px 56px rgba(17, 24, 39, 0.12) !important;
      }
      .codex-home-best-ranking--figma .codex-home-best-ranking-tab.is-active {
        border-color: #111 !important;
        background: #111 !important;
      }
      .codex-home-best-ranking--figma .codex-home-best-ranking-tab.is-active .codex-home-best-ranking-tab-text {
        color: #fff !important;
      }
      .codex-home-best-ranking--figma .codex-home-best-ranking-more-link {
        background: #111 !important;
        color: #fff !important;
      }
      ${useCapturedHomeHeader || preservePageHeader ? "" : `
      .CommonPcGnb_header__MMuNW,
      .header-wrap,
      .header-top {
        display: none !important;
      }`}
      .CommonPcGnb_nav_cate__KkLVL,
      .CommonPcGnb_about_company_layer__CU7eE,
      .CommonPcGnb_mp_layer__nehKN {
        display: none !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li > div {
        display: none !important;
        position: absolute !important;
        left: 0 !important;
        right: 0 !important;
        top: calc(100% - 1px) !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
        background: #fff !important;
        border-top: 1px solid rgba(17,24,39,0.06) !important;
        border-bottom: 1px solid rgba(17,24,39,0.08) !important;
        box-shadow: 0 18px 40px rgba(17,24,39,0.12) !important;
        z-index: 999980 !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div {
        display: block !important;
        background: #fff !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > div {
        display: block !important;
        background: #fff !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div > .CommonPcGnb_nav_cate__KkLVL {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 999980;
        background: #fff !important;
        min-height: 53px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > div > .CommonPcGnb_nav_cate__KkLVL {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 999980;
        background: #fff !important;
        min-height: 53px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_nav_cate_wrap__JlI94,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_nav_cate_super__TfeYX,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_scroll_content__No56N,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_super_category_wrap__1fxja,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_column__xtPmi,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_sub_cate__6uqk2,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_sub_cate_list__MNtPR,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_hashtag__DU2I_ {
        visibility: visible !important;
        opacity: 1 !important;
        background: #fff !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_nav_cate_list__BYpir {
        display: none !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: #fff !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_super_category_wrap__1fxja {
        display: flex !important;
        align-items: flex-start !important;
        position: static !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        background: #fff !important;
        visibility: visible !important;
        opacity: 1 !important;
        gap: initial !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_nav_cate_wrap__JlI94 {
        padding-top: 12px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_nav_cate_super__TfeYX,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_scroll_content__No56N {
        align-items: flex-end !important;
        padding-bottom: 8px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_nav_cate_list__BYpir {
        top: auto !important;
        left: auto !important;
        right: auto !important;
        padding-top: 0 !important;
        margin-top: 0 !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_nav_cate_list__BYpir.codex-active-panel {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: #fff !important;
        padding-top: 58px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div.codex-menu-products .CommonPcGnb_column__xtPmi.CommonPcGnb_banner__q3HSG,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > div.codex-menu-products .CommonPcGnb_column__xtPmi.CommonPcGnb_banner__q3HSG {
        display: none !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div.codex-menu-products .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > div.codex-menu-products .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div.codex-menu-products .codex-gnb-banner-thumb,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > div.codex-menu-products .codex-gnb-banner-thumb {
        display: none !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced {
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced > li:first-child {
        margin-bottom: 4px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced > li {
        width: 100% !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced .banner_link {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 12px !important;
        text-decoration: none !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced > li:first-child .banner_link {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 10px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .codex-gnb-banner-thumb {
        display: block;
        overflow: hidden;
        border-radius: 16px;
        background: #f4f5f7;
        width: 72px;
        min-width: 72px;
        height: 72px;
        aspect-ratio: auto;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced > li:first-child .codex-gnb-banner-thumb {
        width: 100%;
        min-width: 0;
        height: auto;
        aspect-ratio: 1 / 1;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .codex-gnb-banner-thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced > li:first-child .CommonPcGnb_tit__OxgXg {
        font-size: 17px !important;
        line-height: 24px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced .CommonPcGnb_tit__OxgXg {
        display: block !important;
        font-size: 14px !important;
        line-height: 20px !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_scroll_item__bXHY9.codex-active-trigger > a,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_scroll_item__bXHY9:hover > a {
        font-weight: 700 !important;
        color: #111111 !important;
        position: relative !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_scroll_item__bXHY9.codex-active-trigger > a::after,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > div .CommonPcGnb_scroll_item__bXHY9:hover > a::after {
        content: "" !important;
        position: absolute !important;
        left: 0 !important;
        right: 0 !important;
        bottom: -11px !important;
        height: 2px !important;
        border-radius: 999px !important;
        background: #111111 !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-simple-panel,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-simple-panel {
        min-height: auto !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-simple-panel .CommonPcGnb_nav_cate_wrap__JlI94,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-simple-panel .CommonPcGnb_nav_cate_wrap__JlI94 {
        padding-top: 24px !important;
        padding-bottom: 28px !important;
        background: #fff !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-simple-panel .CommonPcGnb_nav_cate_tit__UdAwS,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-simple-panel .CommonPcGnb_nav_cate_tit__UdAwS {
        display: block !important;
        margin: 0 0 18px !important;
        padding: 0 0 0 32px !important;
        height: auto !important;
        max-height: none !important;
        line-height: 1.2 !important;
        white-space: normal !important;
        overflow: visible !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-simple-panel .CommonPcGnb_nav_cate_list__BYpir,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-simple-panel .CommonPcGnb_nav_cate_list__BYpir {
        position: static !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        padding-top: 0 !important;
        margin-top: 0 !important;
        padding-left: 32px !important;
        box-sizing: border-box !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel {
        min-height: auto !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel .CommonPcGnb_nav_cate_wrap__JlI94,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel .CommonPcGnb_nav_cate_wrap__JlI94 {
        padding-top: 24px !important;
        padding-bottom: 28px !important;
        background: #fff !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel .CommonPcGnb_nav_cate_tit__UdAwS,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel .CommonPcGnb_nav_cate_tit__UdAwS {
        display: block !important;
        margin: 0 0 18px !important;
        padding: 0 0 0 32px !important;
        height: auto !important;
        max-height: none !important;
        line-height: 1.2 !important;
        white-space: normal !important;
        overflow: visible !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel .CommonPcGnb_nav_cate_list__BYpir,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel .CommonPcGnb_nav_cate_list__BYpir {
        position: static !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        padding-top: 0 !important;
        margin-top: 0 !important;
        padding-left: 32px !important;
        box-sizing: border-box !important;
      }
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.codex-active-li > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel .CommonPcGnb_nav_cate_list__BYpir > .CommonPcGnb_column__xtPmi.CommonPcGnb_banner__q3HSG,
      .CommonPcGnb_nav_inner__I7DAQ > ul > li.CommonPcGnb_active___XS51 > .CommonPcGnb_nav_cate__KkLVL.codex-menu-banner-panel .CommonPcGnb_nav_cate_list__BYpir > .CommonPcGnb_column__xtPmi.CommonPcGnb_banner__q3HSG {
        display: none !important;
      }
      .codex-gnb-overlay {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        z-index: 999990;
        display: none;
        background: #fff;
        border-top: 1px solid rgba(17,24,39,0.06);
        border-bottom: 1px solid rgba(17,24,39,0.08);
        box-shadow: 0 18px 40px rgba(17,24,39,0.12);
      }
      .codex-gnb-overlay.is-open { display: block; }
      .codex-gnb-overlay .CommonPcGnb_nav_cate__KkLVL {
        display: block !important;
        position: static !important;
        width: min(1440px, calc(100vw - 20px));
        margin: 0 auto;
        padding: 20px 18px 30px;
        background: #fff !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .codex-gnb-overlay .CommonPcGnb_nav_cate_wrap__JlI94 {
        min-height: 0;
        padding-top: 0 !important;
        overflow-x: auto;
        overflow-y: hidden;
      }
      .codex-gnb-overlay .CommonPcGnb_super_category_wrap__1fxja {
        display: block !important;
        width: 100%;
        margin-top: 24px;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .codex-gnb-overlay .CommonPcGnb_nav_cate_list__BYpir {
        display: none !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .codex-gnb-overlay .CommonPcGnb_nav_cate_list__BYpir.codex-active-panel {
        display: flex !important;
      }
      .codex-gnb-overlay .CommonPcGnb_scroll_item__bXHY9.codex-active-trigger > a,
      .codex-gnb-overlay .CommonPcGnb_scroll_item__bXHY9:hover > a {
        font-weight: 700 !important;
        color: #111111 !important;
      }
      .codex-gnb-overlay a,
      .codex-gnb-overlay p,
      .codex-gnb-overlay span,
      .codex-gnb-overlay li,
      .codex-gnb-overlay strong {
        color: #111111 !important;
      }
      .header-wrap .nav-wrap,
      .header-wrap .nav-inner,
      .header-wrap .nav > li {
        position: relative;
      }
      .header-wrap .nav > li > .nav-category-layer {
        display: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        z-index: 999980;
      }
      .header-wrap .nav > li.codex-legacy-open > .nav-category-layer,
      .header-wrap .nav > li:hover > .nav-category-layer,
      .header-wrap .nav > li:focus-within > .nav-category-layer {
        display: block !important;
      }
      .header-wrap .nav-category-layer .nav-category-wrap {
        display: none !important;
      }
      .header-wrap .nav-category-layer .nav-category-wrap.codex-active-panel,
      .header-wrap .nav-category-layer .nav-category-wrap.on {
        display: block !important;
      }
      .header-wrap .nav-category-layer .swiper-slide.codex-active-trigger > a,
      .header-wrap .nav-category-layer .swiper-slide.on > a {
        font-weight: 700 !important;
        color: #111 !important;
      }
      .codex-home-shell {
        width: min(1180px, calc(100vw - 96px));
        margin: 0 auto;
      }
      .codex-home-shell--narrow {
        width: min(920px, calc(100vw - 160px));
      }
      .codex-home-section + .codex-home-section {
        margin-top: 26px;
      }
      .codex-home-quickmenu {
        width: 100vw;
        margin-top: 39px;
        padding-top: 0;
      }
      .codex-home-quickmenu-grid {
        display: grid;
        grid-template-columns: repeat(5, 90px);
        justify-content: center;
        column-gap: 0;
        row-gap: 0;
        padding: 0;
      }
      .codex-home-quickmenu-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 0;
        width: 90px;
        height: 82px;
        text-decoration: none;
        color: #111;
      }
      .codex-home-quickmenu-icon {
        width: 44px;
        height: 44px;
        border: 1px solid #e8ebf0;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        margin-bottom: 8px;
      }
      .codex-home-quickmenu-icon img {
        max-width: 26px;
        max-height: 26px;
        object-fit: contain;
      }
      .codex-home-quickmenu-card strong {
        font-size: 13px;
        line-height: 18px;
        font-weight: 600;
        letter-spacing: -0.02em;
        text-align: center;
        white-space: nowrap;
      }
      .codex-home-section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 18px;
      }
      .codex-home-section-head h2 {
        margin: 0;
        font-size: 34px;
        line-height: 40px;
        font-weight: 700;
        color: #111;
      }
      .codex-home-section-head p {
        margin: 6px 0 0;
        color: #6b7280;
        font-size: 16px;
      }
      :root {
        --codex-home-lower-width: min(767px, 52.5342466vw);
        --codex-home-lower-media-size: clamp(112px, 17.21%, 132px);
      }
      .codex-home-lower-replay {
        width: var(--codex-home-lower-width);
        margin-left: auto;
        margin-right: auto;
      }
      .codex-home-lower-replay[class*="HomePcListHorizontype_list_horizontype__"],
      .codex-home-lower-replay[class*="HomePcTimedeal_timedeal__"],
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] {
        max-width: var(--codex-home-lower-width);
      }
      .codex-home-lower-replay .product-card-image_image img {
        visibility: visible !important;
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] {
        width: var(--codex-home-lower-width) !important;
        max-width: var(--codex-home-lower-width);
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeSmall_list_squaretype__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeBig_list_squaretype_big__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltype_list_verticaltype__"],
      .codex-home-lower-replay[class*="HomeMoBannerPromotion_banner_promotion__"],
      .codex-home-lower-replay[class*="HomeMoListRectangletype_list_rectangle__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeFill_list_verticaltype_fill__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__"] {
        width: var(--codex-home-lower-width) !important;
        max-width: var(--codex-home-lower-width) !important;
        margin-left: auto !important;
        margin-right: auto !important;
        box-sizing: border-box;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] [class*="HomeMoListTabsBannertype_list_tabs_bannertype_content__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltype_list_verticaltype__"] [class*="HomeMoListVerticaltype_content__"],
      .codex-home-lower-replay[class*="HomeMoBannerPromotion_banner_promotion__"] [class*="HomeMoBannerPromotion_content__"],
      .codex-home-lower-replay[class*="HomeMoListRectangletype_list_rectangle__"] [class*="HomeMoListRectangletype_content__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeFill_list_verticaltype_fill__"] [class*="HomeMoListVerticaltypeFill_content__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__"] [class*="HomeMoListVerticaltypeBgtype_content__"] {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        box-sizing: border-box;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] [class*="HomeMoListTabsBannertype_list_tabs_bannertype_headline__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeSmall_list_squaretype__"] [class*="HomeMoListSquaretypeSmall_title_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeBig_list_squaretype_big__"] [class*="HomeMoListSquaretypeBig_title_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltype_list_verticaltype__"] [class*="HomeMoListVerticaltype_title_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListRectangletype_list_rectangle__"] [class*="HomeMoListRectangletype_title_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeFill_list_verticaltype_fill__"] [class*="HomeMoListVerticaltypeFill_title_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__"] [class*="HomeMoListVerticaltypeBgtype_title_wrap__"] {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        box-sizing: border-box;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] [class*="HomeMoListTabsBannertype_list_tabs_bannertype_content__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeSmall_list_squaretype__"] [class*="HomeMoListSquaretypeSmall_content__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeBig_list_squaretype_big__"] [class*="HomeMoListSquaretypeBig_inner_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeBig_list_squaretype_big__"] [class*="HomeMoListSquaretypeBig_content__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltype_list_verticaltype__"] [class*="HomeMoListVerticaltype_content__"],
      .codex-home-lower-replay[class*="HomeMoBannerPromotion_banner_promotion__"] [class*="HomeMoBannerPromotion_content__"],
      .codex-home-lower-replay[class*="HomeMoListRectangletype_list_rectangle__"] [class*="HomeMoListRectangletype_content__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeFill_list_verticaltype_fill__"] [class*="HomeMoListVerticaltypeFill_content__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__"] [class*="HomeMoListVerticaltypeBgtype_content__"] {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] .carousel_carousel__01_6W {
        width: 100% !important;
        max-width: 100% !important;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] .swiper {
        width: 100% !important;
        max-width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        box-sizing: border-box;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] .swiper-wrapper {
        height: 36px !important;
        box-sizing: border-box;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] .swiper-slide {
        width: auto !important;
        max-width: none !important;
        flex: 0 0 auto !important;
        box-sizing: border-box;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] [class*="HomeMoListTabsBannertype_list_tabs_bannertype_list__"] > ul,
      .codex-home-lower-replay[class*="HomeMoListSquaretypeSmall_list_squaretype__"] [class*="HomeMoListSquaretypeSmall_list_squaretype_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeBig_list_squaretype_big__"] [class*="HomeMoListSquaretypeBig_list_squaretype_big_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListRectangletype_list_rectangle__"] [class*="HomeMoListRectangletype_list_rectangle_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltype_list_verticaltype__"] [class*="HomeMoListVerticaltype_list_verticaltype_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeFill_list_verticaltype_fill__"] [class*="HomeMoListVerticaltypeFill_list_verticaltype_fill_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__"] [class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype_wrap__"],
      .codex-home-lower-replay[class*="HomeMoBannerPromotion_banner_promotion__"] [class*="HomeMoBannerPromotion_banner_promotion_list__"] {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box;
      }
      .codex-home-lower-replay[class*="HomeMoListTabsBannertype_list_tabs_bannertype__"] [class*="HomeMoListTabsBannertype_list_tabs_bannertype_list__"] > ul,
      .codex-home-lower-replay[class*="HomeMoListSquaretypeSmall_list_squaretype__"] [class*="HomeMoListSquaretypeSmall_list_squaretype_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListSquaretypeBig_list_squaretype_big__"] [class*="HomeMoListSquaretypeBig_list_squaretype_big_wrap__"],
      .codex-home-lower-replay[class*="HomeMoListRectangletype_list_rectangle__"] [class*="HomeMoListRectangletype_list_rectangle_wrap__"] {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__"] [class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype_wrap__"] {
        display: flex !important;
        align-items: stretch;
      }
      .codex-home-lower-replay[class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__"] [class*="HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype_item__"] {
        flex: 1 1 0 !important;
        min-width: 0 !important;
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_list_inner__"] {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_item__"] {
        list-style: none;
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_item__"] + [class*="HomeMoListBannertype_list_bannertype_item__"] {
        margin-top: 12px;
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_item__"] > a {
        display: grid;
        grid-template-columns: minmax(0, 1fr) var(--codex-home-lower-media-size);
        gap: 14px;
        align-items: center;
        text-decoration: none;
        color: inherit;
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_box__"] {
        min-width: 0;
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_image__"] {
        width: var(--codex-home-lower-media-size);
        min-width: var(--codex-home-lower-media-size);
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_image__"] .product-card-image_image,
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_image__"] .image {
        display: block;
        width: var(--codex-home-lower-media-size);
        height: var(--codex-home-lower-media-size);
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] [class*="HomeMoListBannertype_list_bannertype_image__"] img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .codex-home-lower-replay[class*="HomeMoListBannertype_list_bannertype__"] .product-card-title_headline {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.35;
      }
      .codex-home-lower-replay .codex-home-template-image {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .codex-home-lower-replay[class*="HomeMoListVerticaltype_list_verticaltype__"] [class*="HomeMoListVerticaltype_image__"] {
        overflow: hidden;
        border-radius: 20px;
        background: #f3f4f6;
      }
      .codex-home-lower-replay[class*="HomeMoListVerticaltype_list_verticaltype__"] [class*="HomeMoListVerticaltype_image__"] .codex-home-template-image {
        border-radius: inherit;
        object-position: center center;
      }
      .codex-home-lower-replay[class*="HomeMoBannerPromotion_banner_promotion__"] [class*="HomeMoBannerPromotion_banner_image_wrap__"] {
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        overflow: hidden;
      }
      .codex-home-lower-replay[class*="HomeMoBannerPromotion_banner_promotion__"] [class*="HomeMoBannerPromotion_banner_image_wrap__"] .codex-home-template-image {
        object-fit: contain;
        object-position: center bottom;
      }
      .codex-home-lower-replay .codex-home-template-fallback {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 18px;
        background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      }
      .codex-home-lower-replay[class*="HomeMoListHorizontype_list_horizontype__"] {
        width: var(--codex-home-lower-width);
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] {
        width: var(--codex-home-lower-width);
      }
      .codex-home-lower-replay[class*="HomeMoListSquaretypeSmall_list_squaretype__"] {
        width: var(--codex-home-lower-width);
      }
      .codex-home-lower-replay[class*="HomeMoListSquaretypeBig_list_squaretype_big__"] {
        width: var(--codex-home-lower-width);
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .swiper {
        overflow: hidden;
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .swiper-wrapper {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        transform: none !important;
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .swiper-slide {
        width: auto !important;
        margin-right: 0 !important;
        height: auto;
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .swiper-slide:nth-child(n + 3) {
        display: none !important;
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .HomeMoTimedeal_timedeal_wrap__cvPbn,
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .HomeMoTimedeal_timedeal_item__rwiPz,
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .HomeMoTimedeal_timedeal_item__rwiPz > a {
        height: 100%;
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .HomeMoTimedeal_timedeal_item__rwiPz > a {
        display: block;
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .HomeMoTimedeal_item_cont__2UOQW {
        min-height: 0;
      }
      .codex-home-lower-replay[class*="HomeMoTimedeal_timedeal__"] .HomeMoTimedeal_image__M6OoV {
        min-height: 0;
      }
      .codex-home-best-ranking {
        display: block !important;
        width: var(--codex-home-lower-width) !important;
        max-width: var(--codex-home-lower-width);
        margin: 0 auto !important;
        padding: 0 !important;
        float: none !important;
        clear: both;
      }
      .codex-home-best-ranking-inner {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .codex-home-best-ranking-headline {
        margin-bottom: 20px;
      }
      .codex-home-best-ranking-content {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .codex-home-best-ranking-top {
        display: block;
        width: 100%;
      }
      .codex-home-best-ranking-tabs {
        display: flex;
        gap: 14px;
        overflow-x: auto;
        padding-bottom: 16px;
        scrollbar-width: none;
      }
      .codex-home-best-ranking-tabs::-webkit-scrollbar {
        display: none;
      }
      .codex-home-best-ranking-tab {
        flex: 0 0 auto;
        width: 96px;
        padding: 0;
        border: 0;
        background: transparent;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        color: #111111;
        appearance: none;
        cursor: pointer;
      }
      .codex-home-best-ranking-tab-image {
        display: block;
        width: 72px;
        height: 72px;
        border-radius: 999px;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        background-color: #ffffff;
        box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.08);
      }
      .codex-home-best-ranking-tab.is-active .codex-home-best-ranking-tab-image {
        box-shadow: inset 0 0 0 2px #111111;
      }
      .codex-home-best-ranking-tab-text {
        font-size: 14px;
        line-height: 1.35;
        text-align: center;
        white-space: normal;
      }
      .codex-home-best-ranking-list-wrap {
        display: block;
        width: 100%;
      }
      .codex-home-best-ranking-placeholder {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin: 0;
        padding: 0;
        width: 100% !important;
      }
      .codex-home-best-ranking-item {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        float: none !important;
      }
      .codex-home-best-ranking-card {
        min-height: 124px;
        border-radius: 20px;
        background: #f7f8fa;
        display: grid;
        grid-template-columns: 132px minmax(0, 1fr);
        gap: 18px;
        align-items: center;
        padding: 18px 20px;
        width: 100%;
        box-sizing: border-box;
        text-decoration: none;
        color: #111111;
      }
      .codex-home-best-ranking-thumb-wrap {
        position: relative;
        width: 132px;
        height: 132px;
      }
      .codex-home-best-ranking-rank {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 4;
        width: 32px;
        height: 32px;
        display: block;
      }
      .codex-home-best-ranking-rank img {
        display: block;
        width: 100%;
        height: 100%;
      }
      .codex-home-best-ranking-body {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .codex-home-best-ranking-badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 6px;
      }
      .codex-home-best-ranking-badge {
        display: inline-flex;
        align-items: center;
        height: 18px;
        padding: 0 6px;
        border-radius: 4px;
        background: transparent !important;
        color: #ea1917 !important;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.01em;
        box-shadow: none !important;
        border: 0 !important;
      }
      .codex-home-best-ranking-badge.is-multi {
        color: #ea1917 !important;
      }
      .codex-home-best-ranking-badge.is-dotcom {
        color: #111111 !important;
        background: #f3f4f6 !important;
        border: 1px solid rgba(17, 17, 17, 0.08) !important;
      }
      .codex-home-best-ranking-badge.is-benefit {
        color: #7c2d12 !important;
        background: #ffedd5 !important;
        border: 1px solid rgba(124, 45, 18, 0.08) !important;
      }
      .codex-home-best-ranking-badge.is-default {
        color: #ea1917 !important;
      }
      .codex-home-best-ranking-badge--release {
        color: #111111 !important;
        background: #ffffff !important;
        border: 1px solid rgba(17, 17, 17, 0.12) !important;
      }
      .codex-home-best-ranking-name {
        font-size: 16px;
        line-height: 1.35;
        color: #111111;
        font-weight: 700;
      }
      .codex-home-best-ranking-category,
      .codex-home-best-ranking-sku {
        font-size: 12px;
        line-height: 1.45;
        color: #333333;
      }
      .codex-home-best-ranking-price {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.4;
        color: #ea1917;
      }
      .codex-home-best-ranking-thumb {
        width: 132px;
        height: 132px;
        border-radius: 18px;
        overflow: hidden;
        background: #ffffff;
        box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.08);
        justify-self: center;
      }
      .codex-home-best-ranking-thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #ffffff;
      }
      .codex-home-best-ranking-more {
        margin-top: 28px;
        display: flex;
        justify-content: center;
      }
      .codex-home-best-ranking-more-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 92px;
        height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        border: 1px solid rgba(17,17,17,0.12);
        color: #111111;
        text-decoration: none;
        background: transparent;
        font-size: 14px;
        font-weight: 500;
      }
      .codex-home-space-renewal {
        display: block !important;
        width: var(--codex-home-lower-width) !important;
        max-width: var(--codex-home-lower-width);
        margin: -160px auto 0 !important;
        padding: 0 !important;
      }
      .codex-home-marketing-area {
        display: block !important;
        width: var(--codex-home-lower-width) !important;
        max-width: var(--codex-home-lower-width);
        margin: 0 auto !important;
      }
      .codex-home-space-renewal-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
      }
      .codex-home-space-renewal-more {
        flex: 0 0 auto;
        color: #111111;
        text-decoration: none;
        font-size: 14px;
        line-height: 1.4;
      }
      .codex-home-space-renewal-hero {
        position: relative;
        width: 100%;
        aspect-ratio: 920 / 503;
        border-radius: 24px;
        overflow: hidden;
        background: linear-gradient(180deg, #f7f8fa 0%, #eceff3 100%);
        box-shadow: inset 0 0 0 1px rgba(17,17,17,0.06);
      }
      .codex-home-space-renewal-hero img,
      .codex-home-space-renewal-hero-fallback {
        display: block;
        width: 100%;
        height: 100%;
      }
      .codex-home-space-renewal-hero img {
        object-fit: cover;
      }
      .codex-home-space-renewal-hero-fallback,
      .codex-home-space-renewal-card-fallback {
        background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      }
      .codex-home-space-renewal-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        margin-top: 18px;
      }
      .codex-home-space-renewal-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        text-decoration: none;
        color: #111111;
      }
      .codex-home-space-renewal-card-media {
        position: relative;
        aspect-ratio: 1 / 1;
        border-radius: 18px;
        overflow: hidden;
        background: #f7f8fa;
        box-shadow: inset 0 0 0 1px rgba(17,17,17,0.06);
      }
      .codex-home-space-renewal-card-media img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #ffffff;
      }
      .codex-home-space-renewal-card-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .codex-home-space-renewal-card-title {
        font-size: 16px;
        line-height: 1.4;
        font-weight: 700;
        color: #111111;
      }
      .codex-home-space-renewal-card-meta,
      .codex-home-space-renewal-card-sku {
        font-size: 12px;
        line-height: 1.45;
        color: #333333;
      }
      .codex-home-space-renewal-card-price {
        font-size: 14px;
        line-height: 1.4;
        font-weight: 700;
        color: #ea1917;
      }
      .codex-home-brand-showroom {
        display: block !important;
        width: var(--codex-home-lower-width) !important;
        max-width: var(--codex-home-lower-width);
        margin: 0 auto !important;
        padding: 0 !important;
      }
      .codex-home-brand-showroom-head {
        margin-bottom: 20px;
      }
      .codex-home-brand-showroom-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }
      .codex-home-brand-showroom-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        text-decoration: none;
        color: #111111;
      }
      .codex-home-brand-showroom-card-media {
        position: relative;
        aspect-ratio: 1 / 1;
        border-radius: 18px;
        overflow: hidden;
        background: linear-gradient(180deg, #f7f8fa 0%, #eceff3 100%);
        box-shadow: inset 0 0 0 1px rgba(17,17,17,0.06);
      }
      .codex-home-brand-showroom-card-media img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .codex-home-brand-showroom-card.is-fallback .codex-home-brand-showroom-card-media {
        background:
          radial-gradient(circle at 20% 20%, rgba(255,255,255,0.7), transparent 38%),
          linear-gradient(135deg, #111827 0%, #374151 55%, #6b7280 100%);
      }
      .codex-home-brand-showroom-fallback {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: end;
        padding: 18px;
        color: #ffffff;
        font-size: 22px;
        line-height: 1.25;
        font-weight: 700;
        letter-spacing: -0.03em;
      }
      .codex-home-brand-showroom-card-title {
        display: block;
        font-size: 16px;
        line-height: 1.35;
        font-weight: 700;
        color: #111111;
      }
      .codex-home-latest-news {
        display: block !important;
        width: var(--codex-home-lower-width) !important;
        max-width: var(--codex-home-lower-width);
        margin: 0 auto !important;
        padding: 0 !important;
      }
      .codex-home-latest-news-head {
        margin-bottom: 20px;
      }
      .codex-home-latest-news-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }
      .codex-home-latest-news-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        text-decoration: none;
        color: #111111;
      }
      .codex-home-latest-news-card-media {
        position: relative;
        aspect-ratio: 1.28 / 1;
        border-radius: 18px;
        overflow: hidden;
        background: linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%);
        box-shadow: inset 0 0 0 1px rgba(17,17,17,0.06);
      }
      .codex-home-latest-news-card-media-bg {
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 10px;
        top: 18px;
        border-radius: 16px;
        background: linear-gradient(180deg, #ffffff 0%, #eef2f6 100%);
        box-shadow: 0 10px 22px rgba(17,24,39,0.06);
      }
      .codex-home-latest-news-card-media img {
        display: block;
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
        object-fit: contain;
        padding: 18px 18px 10px;
      }
      .codex-home-latest-news-fallback {
        display: block;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #dbe2ea 0%, #eef2f6 100%);
      }
      .codex-home-latest-news-card-title {
        display: block;
        font-size: 16px;
        line-height: 1.4;
        font-weight: 700;
        color: #111111;
        letter-spacing: -0.02em;
      }
      .codex-home-product-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 20px;
      }
      .codex-home-product-card {
        background: #fff;
        border-radius: 18px;
        overflow: hidden;
        text-decoration: none;
        color: #111;
        box-shadow: 0 1px 0 rgba(17,24,39,0.04), 0 8px 24px rgba(17,24,39,0.06);
      }
      .codex-home-product-image-wrap {
        position: relative;
        background: #fff;
        aspect-ratio: 1 / 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
      }
      .codex-home-product-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .codex-home-badge {
        position: absolute;
        top: 12px;
        right: 12px;
        background: #e6002d;
        color: #fff;
        border-radius: 999px;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 700;
      }
      .codex-home-product-body {
        padding: 16px 18px 18px;
      }
      .codex-home-product-title {
        font-size: 18px;
        line-height: 25px;
        font-weight: 600;
        min-height: 50px;
      }
      .codex-home-product-meta {
        margin-top: 8px;
        color: #6b7280;
        font-size: 14px;
        min-height: 20px;
      }
      .codex-home-product-price {
        margin-top: 12px;
        color: #e6002d;
        font-size: 16px;
        font-weight: 700;
      }
      .codex-home-product-price span {
        color: #e6002d;
        font-size: 14px;
        font-weight: 600;
      }
      @media (max-width: 1200px) {
        .codex-home-quickmenu-grid {
          grid-template-columns: repeat(5, 90px);
        }
        .codex-home-product-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .codex-home-space-renewal-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .codex-home-brand-showroom-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .codex-home-latest-news-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 768px) {
        .codex-home-shell {
          width: calc(100vw - 24px);
        }
        .codex-home-shell--narrow {
          width: calc(100vw - 28px);
        }
        .codex-home-quickmenu-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        .codex-home-product-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .codex-home-space-renewal {
          width: calc(100vw - 28px) !important;
        }
        .codex-home-space-renewal-head {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .codex-home-space-renewal-grid {
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .codex-home-brand-showroom {
          width: calc(100vw - 28px) !important;
        }
        .codex-home-brand-showroom-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .codex-home-brand-showroom-card-title {
          font-size: 14px;
        }
        .codex-home-brand-showroom-fallback {
          padding: 14px;
          font-size: 18px;
        }
        .codex-home-latest-news {
          width: calc(100vw - 28px) !important;
        }
        .codex-home-latest-news-grid {
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .codex-home-latest-news-card-title {
          font-size: 14px;
        }
      }
      .codex-chat-launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 999999;
        width: 60px;
        height: 60px;
        border-radius: 999px;
        border: 0;
        background: linear-gradient(180deg, #d71f48, #a50034);
        color: #fff;
        font: 700 14px/1 Arial, sans-serif;
        box-shadow: 0 12px 28px rgba(0,0,0,0.22);
        cursor: pointer;
      }
      .codex-page-pill {
        position: fixed;
        right: 90px;
        bottom: 24px;
        z-index: 999999;
        max-width: min(42vw, 420px);
        background: rgba(255,255,255,0.98);
        color: #111827;
        border: 1px solid rgba(17,24,39,0.08);
        padding: 10px 14px;
        border-radius: 999px;
        font: 700 12px/1 Arial, sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,0.10);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      a[href^="https://www.lge.co.kr/"] { cursor: pointer; }
      .codex-chat-panel {
        position: fixed;
        right: 18px;
        bottom: 90px;
        z-index: 999999;
        width: min(380px, calc(100vw - 24px));
        max-height: min(72vh, 760px);
        display: none;
        flex-direction: column;
        overflow: hidden;
        border-radius: 20px;
        background: rgba(255,255,255,0.98);
        border: 1px solid rgba(17,24,39,0.08);
        box-shadow: 0 20px 48px rgba(17,24,39,0.22);
        font-family: Arial, sans-serif;
      }
      .codex-chat-panel.is-open { display: flex; }
      .codex-link-toast {
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        z-index: 999999;
        background: rgba(17,24,39,0.92);
        color: #fff;
        border-radius: 999px;
        padding: 10px 14px;
        font: 600 12px/1 Arial, sans-serif;
        box-shadow: 0 10px 24px rgba(0,0,0,0.18);
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease;
      }
      .codex-link-toast.is-visible { opacity: 1; }
      .codex-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: #101828;
        color: #fff;
      }
      .codex-chat-title { font: 700 14px/1 Arial, sans-serif; }
      .codex-chat-close {
        background: transparent;
        color: #fff;
        border: 0;
        font-size: 18px;
        cursor: pointer;
      }
      .codex-chat-body {
        padding: 14px;
        overflow: auto;
        background: #f8fafc;
      }
      .codex-chat-log {
        display: grid;
        gap: 10px;
      }
      .codex-chat-msg {
        border-radius: 14px;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.45;
        white-space: pre-wrap;
      }
      .codex-chat-msg.system { background: #fff; color: #344054; border: 1px solid #e4e7ec; }
      .codex-chat-msg.user { background: #111827; color: #fff; margin-left: 28px; }
      .codex-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .codex-coverage-card {
        display: grid;
        gap: 10px;
        margin-top: 12px;
        padding: 12px;
        border: 1px solid #e4e7ec;
        background: #fff;
        border-radius: 14px;
      }
      .codex-coverage-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .codex-coverage-title {
        font: 700 12px/1 Arial, sans-serif;
        color: #111827;
      }
      .codex-badge {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        padding: 0 8px;
        border-radius: 999px;
        font: 700 11px/1 Arial, sans-serif;
        border: 1px solid #d0d5dd;
        background: #fff;
        color: #344054;
      }
      .codex-badge.captured { background: #ecfdf3; border-color: #abefc6; color: #067647; }
      .codex-badge.partial { background: #fffaeb; border-color: #fedf89; color: #b54708; }
      .codex-badge.missing { background: #f2f4f7; border-color: #eaecf0; color: #667085; }
      .codex-badge.replaced { background: #eef4ff; border-color: #b2ddff; color: #175cd3; }
      .codex-badge.figma-derived { background: #f4f3ff; border-color: #d9d6fe; color: #5925dc; }
      .codex-coverage-meta {
        display: grid;
        gap: 4px;
        font-size: 11px;
        color: #667085;
      }
      .codex-coverage-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .codex-coverage-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid #eaecf0;
        border-radius: 10px;
        background: #fcfcfd;
        font-size: 11px;
        color: #344054;
      }
      .codex-chip-btn {
        border: 1px solid #d0d5dd;
        background: #fff;
        color: #344054;
        border-radius: 999px;
        padding: 8px 10px;
        font: 600 12px/1 Arial, sans-serif;
        cursor: pointer;
      }
      .codex-section-list {
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }
      .codex-section-item {
        display: grid;
        grid-template-columns: 1fr auto auto auto;
        gap: 6px;
        align-items: center;
        padding: 10px;
        border: 1px solid #e4e7ec;
        background: #fff;
        border-radius: 12px;
      }
      .codex-section-meta {
        font-size: 11px;
        color: #667085;
      }
      .codex-mini-btn {
        border: 1px solid #d0d5dd;
        background: #fff;
        color: #344054;
        border-radius: 10px;
        padding: 6px 8px;
        font: 600 11px/1 Arial, sans-serif;
        cursor: pointer;
      }
      .codex-mini-btn.primary {
        background: #d71f48;
        border-color: #d71f48;
        color: #fff;
      }
      .codex-chat-form {
        display: grid;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid #eaecf0;
        background: #fff;
      }
      .codex-chat-textarea {
        width: 100%;
        min-height: 92px;
        resize: vertical;
        border: 1px solid #d0d5dd;
        border-radius: 12px;
        padding: 10px 12px;
        font: 13px/1.45 Arial, sans-serif;
      }
      .codex-chat-actions {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .codex-chat-submit {
        border: 0;
        border-radius: 12px;
        padding: 10px 14px;
        background: #111827;
        color: #fff;
        font: 700 12px/1 Arial, sans-serif;
        cursor: pointer;
      }
    </style>
    <script>
      window.__CODEX_PAGE_ID__ = ${JSON.stringify(pageId)};
      window.__CODEX_VIEWPORT_PROFILE__ = ${JSON.stringify(viewportProfile)};
      window.__CODEX_HOME_CLONE__ = "/clone/home";
      window.__CODEX_LINK_MAP__ = ${JSON.stringify(internalLinkMap)};
      window.__CODEX_PDP_CAPTURE_MAP__ = ${JSON.stringify(pdpCaptureMap)};
      window.__CODEX_EDITOR__ = {
        open: false,
        page: null,
      };
    </script>
  `;
  html = html.replace(/<head([^>]*)>/i, `<head$1>${injectedHead}`);
  const injectedBodyChrome = showEditorChrome
    ? `<div class="codex-page-pill">${pageTitle}</div>
    <button class="codex-chat-launcher" type="button" aria-label="Open editor">Edit</button>
    <div class="codex-link-toast" aria-live="polite"></div>
    <section class="codex-chat-panel" aria-label="Prototype editor">
      <div class="codex-chat-header">
        <div class="codex-chat-title">Prototype Editor</div>
        <button class="codex-chat-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="codex-chat-body">
        <div class="codex-chat-log"></div>
        <div class="codex-coverage-card" hidden>
          <div class="codex-coverage-head">
            <div class="codex-coverage-title">Coverage</div>
            <span class="codex-badge missing" data-codex-page-status>missing</span>
          </div>
          <div class="codex-coverage-meta" data-codex-coverage-meta></div>
          <div class="codex-coverage-grid" data-codex-slot-coverage></div>
        </div>
        <div class="codex-chip-row">
          <button class="codex-chip-btn" type="button" data-action="show-sections">현재 섹션 보기</button>
          <button class="codex-chip-btn" type="button" data-action="show-coverage">수집 상태 보기</button>
          <button class="codex-chip-btn" type="button" data-action="show-help">가능한 명령</button>
        </div>
        <div class="codex-section-list" hidden></div>
      </div>
      <form class="codex-chat-form">
        <textarea class="codex-chat-textarea" placeholder="예: 메인 CTA를 숨기고 Hero Banner를 위로 강조해줘"></textarea>
        <div class="codex-chat-actions">
          <a class="codex-mini-btn" href="/admin" target="_blank" rel="noreferrer">Legacy Admin</a>
          <button class="codex-chat-submit" type="submit">요청 적용</button>
        </div>
      </form>
    </section>`
    : `<div class="codex-link-toast" aria-live="polite"></div>`;
  html = html.replace(
    /<body([^>]*)>/i,
    `<body$1><div class="codex-gnb-overlay" data-codex-interaction-id="home.gnb.open" data-codex-open-state="closed" aria-hidden="true"></div>${injectedBodyChrome}`
  );
  html = html.replace(
    /<\/body>/i,
    `<script>
      (() => {
        const state = window.__CODEX_EDITOR__;
        const pageId = window.__CODEX_PAGE_ID__;
        const linkMap = window.__CODEX_LINK_MAP__ || {};
        const pdpCaptureMap = window.__CODEX_PDP_CAPTURE_MAP__ || {};
        const viewportProfile = window.__CODEX_VIEWPORT_PROFILE__ || 'pc';
        const panel = document.querySelector('.codex-chat-panel');
        const launcher = document.querySelector('.codex-chat-launcher');
        const closer = document.querySelector('.codex-chat-close');
        const log = document.querySelector('.codex-chat-log');
        const form = document.querySelector('.codex-chat-form');
        const textarea = document.querySelector('.codex-chat-textarea');
        const sectionList = document.querySelector('.codex-section-list');
        const toast = document.querySelector('.codex-link-toast');
        const coverageCard = document.querySelector('.codex-coverage-card');
        const coverageMeta = document.querySelector('[data-codex-coverage-meta]');
        const slotCoverage = document.querySelector('[data-codex-slot-coverage]');
        const pageStatusBadge = document.querySelector('[data-codex-page-status]');
        let toastTimer = null;

        const escapeHtml = (value) => String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        ${isHome ? buildHomeHeroRuntimeScript() : ""}

        function addMessage(kind, text) {
          const div = document.createElement('div');
          div.className = 'codex-chat-msg ' + kind;
          div.innerHTML = escapeHtml(text);
          log.appendChild(div);
          log.scrollTop = log.scrollHeight;
        }

        function showToast(text) {
          if (!toast) return;
          toast.textContent = text;
          toast.classList.add('is-visible');
          window.clearTimeout(toastTimer);
          toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1800);
        }

        function setOpen(next) {
          state.open = next;
          if (!panel) return;
          panel.classList.toggle('is-open', next);
        }

        function notifyParentNavigate(nextPageId) {
          if (window.top && window.top !== window) {
            window.top.postMessage({ type: 'codex:navigate', pageId: nextPageId }, window.location.origin);
            return true;
          }
          return false;
        }

        async function loadSections() {
          const response = await fetch('/api/editor/page?id=' + encodeURIComponent(pageId));
          const payload = await response.json();
          state.page = payload;
          if (coverageCard) coverageCard.hidden = true;
          sectionList.hidden = false;
          sectionList.innerHTML = (payload.sections || []).map((section) => {
            return '<div class="codex-section-item">' +
              '<div><div><strong>' + escapeHtml(section.name) + '</strong></div><div class="codex-section-meta">' + escapeHtml(section.componentType) + ' · order ' + section.order + '</div></div>' +
              '<button class="codex-mini-btn" type="button" data-move="up" data-section="' + escapeHtml(section.id) + '">위</button>' +
              '<button class="codex-mini-btn" type="button" data-move="down" data-section="' + escapeHtml(section.id) + '">아래</button>' +
              '<button class="codex-mini-btn ' + (section.visible ? '' : 'primary') + '" type="button" data-toggle="' + escapeHtml(section.id) + '">' + (section.visible ? '숨김' : '보이기') + '</button>' +
              '</div>';
          }).join('');
          addMessage('system', '현재 페이지 섹션 ' + (payload.sections || []).length + '개를 불러왔습니다.');
        }

        function renderCoverage(payload) {
          if (!coverageCard || !coverageMeta || !slotCoverage || !pageStatusBadge) return;
          coverageCard.hidden = false;
          sectionList.hidden = true;
          const status = String(payload.pageStatus || 'missing');
          pageStatusBadge.className = 'codex-badge ' + status;
          pageStatusBadge.textContent = status;
          coverageMeta.innerHTML = [
            'baseline: ' + escapeHtml(payload.baseline?.route || 'n/a') + ' · ' + escapeHtml(payload.baseline?.mode || 'n/a'),
            'archive: ' + escapeHtml(payload.archiveStatus || 'n/a') + ' · reference: ' + (payload.hasReference ? 'yes' : 'no') + ' · working: ' + (payload.hasWorking ? 'yes' : 'no'),
            'interaction: ' + escapeHtml(payload.interactionStatus || 'missing') + ' · count: ' + String((payload.interactions || []).length),
            payload.referenceMatchesBaseline === false ? 'reference mismatch: ' + escapeHtml(payload.referenceUrl || 'n/a') : 'reference: baseline-aligned',
          ].map((line) => '<div>' + line + '</div>').join('');
          slotCoverage.innerHTML = (payload.slots || []).map((slot) => {
            const slotStatus = escapeHtml(slot.status || 'missing');
            return '<div class="codex-coverage-item">' +
              '<span>' + escapeHtml(slot.slotId) + '</span>' +
              '<span class="codex-badge ' + slotStatus + '">' + slotStatus + '</span>' +
              '</div>';
          }).join('');
        }

        async function loadCoverage() {
          const response = await fetch('/api/coverage?pageId=' + encodeURIComponent(pageId));
          const payload = await response.json();
          renderCoverage(payload);
          addMessage('system', '현재 페이지 수집 상태를 불러왔습니다.');
        }

        async function postJson(url, body) {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          return response.json();
        }

        if (launcher) launcher.addEventListener('click', () => setOpen(true));
        if (closer) closer.addEventListener('click', () => setOpen(false));

        const gnbBannerCatalog = ${JSON.stringify(readReferenceGnbBannerCatalog())};
        const gnbBannerCatalogByHref = Object.values(gnbBannerCatalog).reduce((acc, item) => {
          if (item && item.href) acc[item.href] = item;
          return acc;
        }, {});

        function normalizeLgeUrl(value) {
          try {
            return new URL(value, 'https://www.lge.co.kr').toString();
          } catch (_) {
            return String(value || '');
          }
        }

        function remapLinks(root) {
          (root || document).querySelectorAll('a[href]').forEach((anchor) => {
            const href = anchor.getAttribute('href') || '';
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('/admin')) return;
            let absolute = href;
            try {
              absolute = new URL(href, 'https://www.lge.co.kr').toString();
            } catch {}
            const isLge = absolute.includes('lge.co.kr');
            const hostname = (() => {
              try { return new URL(absolute).hostname || ''; } catch { return ''; }
            })();
            const pathname = (() => {
              try { return new URL(absolute).pathname || ''; } catch { return ''; }
            })();
            anchor.setAttribute('data-codex-origin-href', absolute);
            const mapped = linkMap[absolute];
            if (mapped) {
              anchor.setAttribute('href', mapped);
              anchor.setAttribute('data-codex-internal-link', 'true');
              anchor.removeAttribute('data-codex-blocked-link');
              return;
            }
            const pdpCapture = pdpCaptureMap[absolute];
            if (pdpCapture && pdpCapture.pageId) {
              const workingHref =
                '/clone-product?pageId=' + encodeURIComponent(pdpCapture.pageId) +
                '&viewportProfile=' + encodeURIComponent(pdpCapture.viewportProfile || viewportProfile) +
                '&href=' + encodeURIComponent(absolute) +
                '&title=' + encodeURIComponent(pathname || absolute);
              anchor.setAttribute('href', workingHref);
              anchor.setAttribute('data-codex-internal-link', 'true');
              anchor.removeAttribute('data-codex-blocked-link');
              return;
            }
            if (isLge) {
              let clonePageHref = '';
              if (pathname.startsWith('/support')) clonePageHref = '/clone/support';
              else if (hostname === 'bestshop.lge.co.kr' || pathname.startsWith('/bestshop')) clonePageHref = '/clone/bestshop';
              else if (pathname.startsWith('/care-solutions') || pathname.startsWith('/category/care-solutions')) clonePageHref = '/clone/care-solutions';
              else if (pathname.startsWith('/lg-signature')) clonePageHref = '/clone/lg-signature-info';
              else if (pathname.startsWith('/objet-collection')) clonePageHref = '/clone/objet-collection-story';
              if (clonePageHref) {
                anchor.setAttribute('href', clonePageHref);
                anchor.setAttribute('data-codex-internal-link', 'true');
                anchor.removeAttribute('data-codex-blocked-link');
                return;
              }
            }
            if (isLge && pageId.startsWith('category-') && /^\\/(tvs|refrigerators)\\//.test(pathname)) {
              const workingHref = '/clone-product?pageId=' + encodeURIComponent(pageId) + '&viewportProfile=' + encodeURIComponent(viewportProfile) + '&href=' + encodeURIComponent(absolute) + '&title=' + encodeURIComponent(pathname);
              anchor.setAttribute('href', workingHref);
              anchor.setAttribute('data-codex-internal-link', 'true');
              anchor.removeAttribute('data-codex-blocked-link');
              return;
            }
            if (isLge) {
              anchor.setAttribute('href', '#');
              anchor.setAttribute('data-codex-blocked-link', absolute);
            }
          });
        }

        function enhanceGnbBannerList(root) {
          (root || document).querySelectorAll('.CommonPcGnb_banner_list__am9D6').forEach((list) => {
            const bannerLinks = Array.from(list.querySelectorAll('a.banner_link, a.banner_box'));
            if (!bannerLinks.length) return;
            let enhancedCount = 0;
            bannerLinks.forEach((anchor) => {
              const key = (anchor.getAttribute('data-contents') || '').trim();
              const originHref = normalizeLgeUrl(anchor.getAttribute('data-codex-origin-href') || anchor.getAttribute('href') || '');
              const item = gnbBannerCatalog[key] || gnbBannerCatalogByHref[originHref];
              if (!item?.imageUrl) return;
              const titleNode =
                anchor.querySelector('.CommonPcGnb_tit__OxgXg') ||
                anchor.querySelector('.CommonPcGnb_bn_txt__Rxqh1 p') ||
                anchor.querySelector('.banner_text .text') ||
                anchor.querySelector('p') ||
                anchor.querySelector('span');
              anchor.querySelectorAll('template[data-dgst]').forEach((node) => node.remove());
              let thumb = anchor.querySelector('.codex-gnb-banner-thumb');
              if (!thumb) {
                thumb = document.createElement('span');
                thumb.className = 'codex-gnb-banner-thumb';
                anchor.insertBefore(thumb, anchor.firstChild);
              }
              let image = thumb.querySelector('img');
              if (!image) {
                image = document.createElement('img');
                thumb.appendChild(image);
              }
              image.src = item.imageUrl;
              image.alt = (titleNode?.textContent || key.split('-').slice(1).join(' ') || '').replace(/\\s+/g, ' ').trim();
              anchor.classList.toggle('codex-gnb-banner-featured', item.kind === 'featured');
              enhancedCount += 1;
            });
            if (enhancedCount > 0) {
              list.classList.add('codex-gnb-banner-enhanced');
            }
          });
        }

        remapLinks(document);
        const quickmenuSlot = document.querySelector('[data-codex-slot="quickmenu"]');
        if (quickmenuSlot) quickmenuSlot.setAttribute('data-codex-interaction-id', 'home.quickmenu.nav');
        const timedealSlot = document.querySelector('[data-codex-slot="timedeal"]');
        if (timedealSlot) timedealSlot.setAttribute('data-codex-interaction-id', 'home.timedeal.cards');
        ${isHome ? "initCodexHomeHeroRuntime(document); initCodexBestRankingRuntime(document);" : ""}

        const overlay = document.querySelector('.codex-gnb-overlay');
        let overlayCloseTimer = null;

        function cancelOverlayClose() {
          window.clearTimeout(overlayCloseTimer);
          overlayCloseTimer = null;
        }

        function closeGnbOverlay() {
          cancelOverlayClose();
          const bgLayer = document.querySelector('.CommonPcGnb_bg___BHPF');
          if (bgLayer) bgLayer.style.height = '0px';
          if (overlay) {
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = '';
          }
          document.querySelectorAll('.CommonPcGnb_item__ooPqg.codex-active-nav').forEach((node) => {
            node.classList.remove('codex-active-nav');
            node.setAttribute('aria-expanded', 'false');
          });
          document.querySelectorAll('.CommonPcGnb_nav__Ri977 li.codex-active-li').forEach((node) => {
            node.classList.remove('codex-active-li');
            node.classList.remove('CommonPcGnb_active___XS51');
          });
          document.querySelectorAll('[data-codex-interaction-id="home.gnb.open"]').forEach((node) => {
            node.setAttribute('data-codex-open-state', 'closed');
          });
        }

        function scheduleOverlayClose() {
          cancelOverlayClose();
          overlayCloseTimer = window.setTimeout(closeGnbOverlay, 260);
        }

        function activateOverlayPanel(root, panelId) {
          const triggers = Array.from(root.querySelectorAll('.CommonPcGnb_scroll_item__bXHY9'));
          const panels = Array.from(root.querySelectorAll('.CommonPcGnb_nav_cate_list__BYpir'));
          const activePanelId = panelId || triggers[0]?.getAttribute('aria-controls') || panels[0]?.id || '';
          panels.forEach((panel, index) => {
            const isActive = panel.id === activePanelId || (!activePanelId && index === 0);
            panel.classList.toggle('codex-active-panel', isActive);
          });
          triggers.forEach((trigger, index) => {
            const isActive = trigger.getAttribute('aria-controls') === activePanelId || (!activePanelId && index === 0);
            trigger.classList.toggle('codex-active-trigger', isActive);
          });
        }

        function openGnbOverlay(sourceLayer, triggerAnchor, navItem) {
          if (!sourceLayer) return;
          cancelOverlayClose();
          closeGnbOverlay();
          const bgLayer = document.querySelector('.CommonPcGnb_bg___BHPF');
          const menuLabel = (triggerAnchor?.textContent || sourceLayer.getAttribute('id') || '').replace(/\\s+/g, ' ').trim();
          const depth2Triggers = sourceLayer.querySelectorAll('.CommonPcGnb_scroll_item__bXHY9').length;
          sourceLayer.classList.remove(
            'codex-menu-products',
            'codex-menu-subscription',
            'codex-menu-support',
            'codex-menu-benefits',
            'codex-menu-story',
            'codex-menu-bestshop',
            'codex-menu-ai',
            'codex-menu-with-depth2',
            'codex-menu-banner-panel'
          );
          if (menuLabel === '제품/소모품') sourceLayer.classList.add('codex-menu-products');
          if (menuLabel === '가전 구독') sourceLayer.classList.add('codex-menu-subscription');
          if (menuLabel === '고객지원') sourceLayer.classList.add('codex-menu-support');
          if (menuLabel === '혜택/이벤트') sourceLayer.classList.add('codex-menu-benefits');
          if (menuLabel === '스토리') sourceLayer.classList.add('codex-menu-story');
          if (menuLabel === '베스트샵') sourceLayer.classList.add('codex-menu-bestshop');
          if (menuLabel === 'LG AI') sourceLayer.classList.add('codex-menu-ai');
          sourceLayer.setAttribute('data-codex-interaction-id', 'home.gnb.open');
          sourceLayer.setAttribute('data-codex-open-state', 'open');
          const hasBannerPanel = depth2Triggers === 0 && !!sourceLayer.querySelector('.CommonPcGnb_banner__q3HSG');
          sourceLayer.classList.toggle('codex-simple-panel', depth2Triggers === 0 && !hasBannerPanel);
          sourceLayer.classList.toggle('codex-menu-with-depth2', depth2Triggers > 0);
          sourceLayer.classList.toggle('codex-menu-banner-panel', hasBannerPanel);
          navItem?.classList.add('codex-active-li');
          navItem?.classList.add('CommonPcGnb_active___XS51');
          if (triggerAnchor) triggerAnchor.classList.add('codex-active-nav');
          if (triggerAnchor) triggerAnchor.setAttribute('aria-expanded', 'true');
          remapLinks(sourceLayer);
          if (menuLabel !== '제품/소모품') {
            enhanceGnbBannerList(sourceLayer);
          } else {
            sourceLayer.querySelectorAll('.codex-gnb-banner-thumb').forEach((node) => node.remove());
            sourceLayer.querySelectorAll('.CommonPcGnb_banner_list__am9D6.codex-gnb-banner-enhanced').forEach((node) => {
              node.classList.remove('codex-gnb-banner-enhanced');
            });
          }
          activateOverlayPanel(sourceLayer, '');
          requestAnimationFrame(() => {
            const panelRect = sourceLayer.getBoundingClientRect();
            if (bgLayer && panelRect.height > 0) {
              bgLayer.style.height = panelRect.height + 'px';
            }
          });
          sourceLayer.querySelectorAll('.CommonPcGnb_scroll_item__bXHY9').forEach((trigger) => {
            const panelId = trigger.getAttribute('aria-controls') || '';
            trigger.addEventListener('mouseenter', () => activateOverlayPanel(sourceLayer, panelId));
            trigger.addEventListener('focusin', () => activateOverlayPanel(sourceLayer, panelId));
          });
        }

        document.querySelectorAll('.CommonPcGnb_item__ooPqg').forEach((anchor) => {
          const navItem = anchor.closest('li');
          const sourceGroup =
            navItem?.querySelector(':scope > div') ||
            anchor.parentElement?.querySelector(':scope > div');
          if (!sourceGroup) return;
          const handleOpen = () => openGnbOverlay(sourceGroup, anchor, navItem);
          anchor.addEventListener('mouseenter', handleOpen);
          anchor.addEventListener('focusin', handleOpen);
          navItem?.addEventListener('mouseenter', handleOpen);
          navItem?.addEventListener('mouseleave', scheduleOverlayClose);
          anchor.parentElement?.addEventListener('mouseleave', scheduleOverlayClose);
          anchor.addEventListener('click', (event) => {
            const href = anchor.getAttribute('href') || '';
            if (!href || href === '#none' || href === '#') {
              event.preventDefault();
              handleOpen();
            }
          });
        });

        window.addEventListener('scroll', closeGnbOverlay, { passive: true });
        window.addEventListener('resize', closeGnbOverlay);

        const homeLogoSelectors = [
          'h1.CommonPcGnb_logo___kjxo a',
          'h1.CommonMoGnb_logo__6Jxci a',
          'h1.logo a',
          'h1[class*="logo"] a',
          '.header-top h1 a[aria-label="LG전자"]',
          '.header-top h1 a[data-contents="LG전자"]'
        ];
        const homeLogos = Array.from(document.querySelectorAll(homeLogoSelectors.join(',')));
        homeLogos.forEach((homeLogo) => {
          homeLogo.setAttribute('href', '/clone/home');
          homeLogo.setAttribute('target', '_self');
          homeLogo.setAttribute('data-codex-home-link', 'true');
        });
        document.querySelectorAll('.header-top .home a, li.home a').forEach((homeAnchor) => {
          homeAnchor.setAttribute('href', '/clone/home');
          homeAnchor.setAttribute('target', '_self');
          homeAnchor.setAttribute('data-codex-home-link', 'true');
        });

        document.querySelectorAll('.header-wrap .nav > li').forEach((navItem) => {
          const navAnchor = navItem.querySelector(':scope > .nav-item[data-super-category-item]');
          const layer = navItem.querySelector(':scope > .nav-category-layer');
          if (!navAnchor || !layer) return;
          let legacyCloseTimer = null;
          const cancelLegacyClose = () => {
            window.clearTimeout(legacyCloseTimer);
            legacyCloseTimer = null;
          };
          const closeLegacy = () => {
            cancelLegacyClose();
            navItem.classList.remove('codex-legacy-open');
          };
          const scheduleLegacyClose = () => {
            cancelLegacyClose();
            legacyCloseTimer = window.setTimeout(closeLegacy, 120);
          };
          const activateLegacyPanel = (panelId) => {
            const triggers = Array.from(layer.querySelectorAll('.super-category-nav .swiper-slide'));
            const panels = Array.from(layer.querySelectorAll('.nav-category-wrap'));
            const activePanelId = panelId || panels[0]?.id || '';
            triggers.forEach((trigger, index) => {
              const href = trigger.querySelector('a')?.getAttribute('href') || '';
              const targetId = href.startsWith('#') ? href.slice(1) : '';
              const isActive = targetId === activePanelId || (!activePanelId && index === 0);
              trigger.classList.toggle('on', isActive);
              trigger.classList.toggle('codex-active-trigger', isActive);
            });
            panels.forEach((panel, index) => {
              const isActive = panel.id === activePanelId || (!activePanelId && index === 0);
              panel.classList.toggle('on', isActive);
              panel.classList.toggle('codex-active-panel', isActive);
            });
          };
          const openLegacy = () => {
            cancelLegacyClose();
            navItem.classList.add('codex-legacy-open');
            activateLegacyPanel('');
          };
          navAnchor.addEventListener('mouseenter', openLegacy);
          navAnchor.addEventListener('focusin', openLegacy);
          navItem.addEventListener('mouseenter', openLegacy);
          navItem.addEventListener('mouseleave', scheduleLegacyClose);
          layer.addEventListener('mouseenter', cancelLegacyClose);
          layer.addEventListener('mouseleave', scheduleLegacyClose);
          navAnchor.addEventListener('click', (event) => {
            const href = navAnchor.getAttribute('href') || '';
            if (!href || href === '#' || href.startsWith('javascript:')) {
              event.preventDefault();
              openLegacy();
            }
          });
          layer.querySelectorAll('.super-category-nav .swiper-slide a[href^="#"]').forEach((link) => {
            const panelId = (link.getAttribute('href') || '').slice(1);
            const trigger = link.closest('.swiper-slide');
            const handle = (event) => {
              event.preventDefault();
              activateLegacyPanel(panelId);
            };
            link.addEventListener('mouseenter', handle);
            link.addEventListener('focusin', handle);
            link.addEventListener('click', handle);
            trigger?.addEventListener('mouseenter', () => activateLegacyPanel(panelId));
          });
        });

        if (window.top && window.top !== window) {
          window.top.postMessage({ type: 'codex:title', title: pageTitle }, window.location.origin);
        }

        document.querySelectorAll('[data-action="show-coverage"]').forEach((button) => {
          button.addEventListener('click', () => {
            loadCoverage().catch((error) => addMessage('system', '수집 상태를 불러오지 못했습니다: ' + String(error)));
          });
        });

        function summarizeRows(items) {
          const rows = [];
          items.forEach((item) => {
            const existing = rows.find((row) => Math.abs(row.y - item.y) <= 18);
            if (existing) {
              existing.count += 1;
              existing.minX = Math.min(existing.minX, item.x);
              existing.maxX = Math.max(existing.maxX, item.x + item.width);
              return;
            }
            rows.push({
              y: item.y,
              count: 1,
              minX: item.x,
              maxX: item.x + item.width
            });
          });
          return rows.map((row) => ({
            y: row.y,
            count: row.count,
            width: row.maxX - row.minX
          }));
        }

        function rectItem(label, node) {
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          if (!rect.width || !rect.height) return null;
          return {
            label,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        }

        function collectSlotMetrics() {
          const slots = Array.from(document.querySelectorAll('[data-codex-slot]')).map((node) => {
            const rect = node.getBoundingClientRect();
            const slotId = node.getAttribute('data-codex-slot');
            let items = [];
            if (slotId === 'hero') {
              const heroScope = node.querySelector('.swiper-slide.codex-hero-active') || node.querySelector('.swiper-slide:nth-child(2)') || node;
              items = Array.from(heroScope.querySelectorAll('h1, h2, h3, p, strong, a, button'))
                .slice(0, 16)
                .map((child) => {
                  const childRect = child.getBoundingClientRect();
                  const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
                  if (!text) return null;
                  return {
                    label: text.slice(0, 80),
                    x: Math.round(childRect.x),
                    y: Math.round(childRect.y),
                    width: Math.round(childRect.width),
                    height: Math.round(childRect.height)
                  };
                })
                .filter(Boolean);
            }
            if (slotId === 'quickmenu') {
              items = Array.from(node.querySelectorAll('a, button')).slice(0, 16).map((child) => {
                const childRect = child.getBoundingClientRect();
                return {
                  label: (child.textContent || '').replace(/\s+/g, ' ').trim(),
                  x: Math.round(childRect.x),
                  y: Math.round(childRect.y),
                  width: Math.round(childRect.width),
                  height: Math.round(childRect.height)
                };
              });
            }
            if (slotId === 'md-choice') {
              const cards = Array.from(node.querySelectorAll('li')).slice(0, 2);
              items = cards.flatMap((card, index) => ([
                rectItem('card-' + (index + 1), card),
                rectItem('card-' + (index + 1) + '-image', card.querySelector('.HomeMoListHorizontype_list_horizontype_image__PVllq')),
                rectItem('card-' + (index + 1) + '-title', card.querySelector('.HomeMoListHorizontype_list_horizontype_title__M1A_5')),
              ].filter(Boolean)));
            }
            if (slotId === 'timedeal') {
              const cards = Array.from(node.querySelectorAll('.swiper-slide')).slice(0, 2);
              items = cards.flatMap((card, index) => ([
                rectItem('card-' + (index + 1), card.querySelector('.HomeMoTimedeal_timedeal_item__rwiPz') || card),
                rectItem('card-' + (index + 1) + '-image', card.querySelector('.HomeMoTimedeal_image__M6OoV')),
                rectItem('card-' + (index + 1) + '-bottom', card.querySelector('.HomeMoTimedeal_item_bottom__YMRu9')),
              ].filter(Boolean)));
            }
            const interaction = (() => {
              if (slotId === 'hero') {
                return {
                  interactionId: node.getAttribute('data-codex-interaction-id') || 'home.hero.carousel',
                  activeSlide: Number(node.getAttribute('data-codex-active-hero-slide') || 0),
                  slideCount: node.querySelectorAll('.swiper-slide').length || 0
                };
              }
              if (slotId === 'best-ranking') {
                return {
                  interactionId: node.getAttribute('data-codex-interaction-id') || 'home.best-ranking.tabs',
                  activeCategoryId: node.getAttribute('data-codex-active-category-id') || '',
                  tabCount: node.querySelectorAll('.codex-home-best-ranking-tab').length || 0
                };
              }
              if (slotId === 'quickmenu') {
                const rows = summarizeRows(items);
                return {
                  interactionId: node.getAttribute('data-codex-interaction-id') || 'home.quickmenu.nav',
                  itemCount: items.length,
                  rowCount: rows.length,
                  columnCount: rows[0]?.count || items.length
                };
              }
              if (slotId === 'timedeal') {
                return {
                  interactionId: node.getAttribute('data-codex-interaction-id') || 'home.timedeal.cards',
                  visibleCardCount: items.filter((item) => /^card-\d+$/.test(item.label)).length
                };
              }
              return null;
            })();
            return {
              slotId,
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              items,
              rowGroups: summarizeRows(items),
              interaction
            };
          });
          return {
            pageId,
            source: 'clone-content',
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight
            },
            scrollWidth: document.documentElement.scrollWidth,
            slots
          };
        }

        function persistMeasurements(payload) {
          const body = JSON.stringify(payload);
          try {
            if (navigator.sendBeacon) {
              const blob = new Blob([body], { type: 'application/json' });
              navigator.sendBeacon('/api/measure', blob);
            } else {
              fetch('/api/measure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true
              }).catch(() => {});
            }
          } catch (_) {}
        }

        let measureTimer = null;
        let measureInterval = null;
        function postMeasurements() {
          try {
            const payload = collectSlotMetrics();
            persistMeasurements(payload);
            if (window.top && window.top !== window) {
              window.top.postMessage({ type: 'codex:measure', payload }, window.location.origin);
            }
          } catch (_) {}
        }
        function startMeasurementBurst() {
          window.clearTimeout(measureTimer);
          window.clearInterval(measureInterval);
          measureTimer = window.setTimeout(postMeasurements, 40);
          measureInterval = window.setInterval(postMeasurements, 400);
          window.setTimeout(() => {
            window.clearInterval(measureInterval);
            measureInterval = null;
          }, 3200);
        }
        function scheduleMeasurements() {
          startMeasurementBurst();
        }

        document.addEventListener('click', (event) => {
          const anchor = event.target.closest('a[href]');
          if (!anchor) return;
          if (anchor.hasAttribute('data-codex-home-link')) {
            event.preventDefault();
            notifyParentNavigate('home');
            return;
          }
          const href = anchor.getAttribute('href') || '';
          if (href.startsWith('/clone/')) {
            event.preventDefault();
            const nextPageId = decodeURIComponent(href.slice('/clone/'.length));
            notifyParentNavigate(nextPageId);
            return;
          }
          const blocked = anchor.getAttribute('data-codex-blocked-link');
          if (blocked) {
            event.preventDefault();
            showToast('이 링크는 아직 수집되지 않았습니다.');
          }
        }, true);

        document.querySelectorAll('.codex-chip-btn').forEach((button) => {
          button.addEventListener('click', async () => {
            const action = button.getAttribute('data-action');
            if (action === 'show-sections') {
              await loadSections();
            }
            if (action === 'show-help') {
              addMessage('system', '가능한 작업: 섹션 보기, 숨김/보이기, 순서 이동, 자연어 변경 요청.');
            }
          });
        });

        sectionList.addEventListener('click', async (event) => {
          const toggleId = event.target.getAttribute('data-toggle');
          const moveDirection = event.target.getAttribute('data-move');
          const moveSectionId = event.target.getAttribute('data-section');
          if (toggleId) {
            const section = (state.page?.sections || []).find((item) => item.id === toggleId);
            if (!section) return;
            const payload = await postJson('/api/editor/toggle-section', {
              pageId,
              sectionId: toggleId,
              visible: !section.visible
            });
            state.page = payload.page;
            addMessage('system', section.name + ' 섹션을 ' + (!section.visible ? '표시' : '숨김') + ' 상태로 저장했습니다.');
            await loadSections();
          }
          if (moveDirection && moveSectionId) {
            const section = (state.page?.sections || []).find((item) => item.id === moveSectionId);
            if (!section) return;
            const payload = await postJson('/api/editor/move-section', {
              pageId,
              sectionId: moveSectionId,
              direction: moveDirection
            });
            state.page = payload.page;
            addMessage('system', section.name + ' 섹션 순서를 변경했습니다.');
            await loadSections();
          }
        });

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const prompt = textarea.value.trim();
          if (!prompt) return;
          addMessage('user', prompt);
          textarea.value = '';
          const payload = await postJson('/api/llm/change', { prompt });
          if (payload.error) {
            addMessage('system', '요청 처리 실패: ' + payload.error);
            return;
          }
          addMessage('system', payload.summary || '변경을 적용했습니다.');
          sectionList.hidden = true;
        });

        addMessage('system', '오른쪽 하단에서 현재 화면을 수정할 수 있습니다.');
        if (window.top && window.top !== window) {
          window.top.postMessage({ type: 'codex:ready', pageId }, window.location.origin);
        }
        document.addEventListener('DOMContentLoaded', scheduleMeasurements);
        window.addEventListener('load', scheduleMeasurements);
        window.addEventListener('resize', scheduleMeasurements);
        scheduleMeasurements();
      })();
    </script></body>`
  );

  return html;
}

function rewriteReferenceHtml(rawHtml, pageId) {
  let html = rawHtml;
  const isHome = pageId === "home";
  const homeMobileHtml = isHome ? readHomeMobileHtml() : "";
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<base[^>]+href=("|')[^"']+\1[^>]*>/gi, "");
  html = html.replace(/<link[^>]+as=("|')font\1[^>]*>/gi, "");
  html = html.replace(/<link[^>]+rel=("|')manifest\1[^>]*>/gi, "");
  html = html.replace(/\b(href|src|poster)=("|')\/(?!\/)/gi, `$1=$2https://www.lge.co.kr/`);
  html = html.replace(/url\((["']?)\/(?!\/)/gi, `url($1https://www.lge.co.kr/`);
  html = html.replace(/\shidden(?=[\s>])/gi, "");
  if (isHome) {
    html = injectHomeReplacements(html, rawHtml, homeMobileHtml);
  }
  if (isHome && homeMobileHtml) {
    const extraMobileStyles = extractMissingStylesheetLinks(html, homeMobileHtml);
    html = injectExtraHeadLinks(html, extraMobileStyles);
  }
  html = html.replace(/<section class="CommonPcGnb_top__([^"]*)"/, '<section data-codex-slot="header-top" class="CommonPcGnb_top__$1"');
  html = html.replace(/<section class="CommonPcGnb_bottom__([^"]*)"/, '<section data-codex-slot="header-bottom" class="CommonPcGnb_bottom__$1"');
  html = html.replace(/<section class="HomePcBannerHero_banner_hero__([^"]*)"/, '<section data-codex-slot="hero" class="HomePcBannerHero_banner_hero__$1"');
  html = html.replace(/<section class="HomeTaBannerHero_banner_hero__([^"]*)"/, '<section data-codex-slot="hero" class="HomeTaBannerHero_banner_hero__$1"');
  html = html.replace(/<section class="HomePcQuickmenu_quickmenu__([^"]*)"/, '<section data-codex-slot="quickmenu" class="HomePcQuickmenu_quickmenu__$1"');

  html = html.replace(
    /<\/head>/i,
    `<style>
      html, body { min-height: 100%; visibility: visible !important; opacity: 1 !important; }
      body { background: #fff; visibility: visible !important; opacity: 1 !important; }
      img[style*="visibility:hidden"][src]:not([src=""]) { visibility: visible !important; }
      img[style*="opacity:0"][src]:not([src=""]) { opacity: 1 !important; }
      ${isHome ? buildHomeHeroRuntimeCss() : ""}
    </style></head>`
  );

  html = html.replace(
    /<\/body>/i,
    `<script>
      (() => {
        function summarizeRows(items) {
          const rows = [];
          items.forEach((item) => {
            const existing = rows.find((row) => Math.abs(row.y - item.y) <= 18);
            if (existing) {
              existing.count += 1;
              existing.minX = Math.min(existing.minX, item.x);
              existing.maxX = Math.max(existing.maxX, item.x + item.width);
              return;
            }
            rows.push({
              y: item.y,
              count: 1,
              minX: item.x,
              maxX: item.x + item.width
            });
          });
          return rows.map((row) => ({
            y: row.y,
            count: row.count,
            width: row.maxX - row.minX
          }));
        }

        function intersectsSlot(slotRect, itemRect) {
          const slotLeft = Math.round(slotRect.x);
          const slotTop = Math.round(slotRect.y);
          const slotRight = slotLeft + Math.round(slotRect.width);
          const slotBottom = slotTop + Math.round(slotRect.height);
          const itemLeft = Math.round(itemRect.x);
          const itemTop = Math.round(itemRect.y);
          const itemRight = itemLeft + Math.round(itemRect.width);
          const itemBottom = itemTop + Math.round(itemRect.height);
          return itemRight > slotLeft && itemLeft < slotRight && itemBottom > slotTop && itemTop < slotBottom;
        }

        function rectItem(label, node) {
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          if (!rect.width || !rect.height) return null;
          return {
            label,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        }

        function collectSlotItems(node, slotId, slotRect) {
          if (slotId === 'md-choice') {
            const cards = Array.from(node.querySelectorAll('li')).slice(0, 2);
            return cards.flatMap((card, index) => ([
              rectItem('card-' + (index + 1), card),
              rectItem('card-' + (index + 1) + '-image', card.querySelector('.HomeMoListHorizontype_list_horizontype_image__PVllq')),
              rectItem('card-' + (index + 1) + '-title', card.querySelector('.HomeMoListHorizontype_list_horizontype_title__M1A_5')),
            ].filter(Boolean)));
          }
          if (slotId === 'timedeal') {
            const cards = Array.from(node.querySelectorAll('.swiper-slide')).slice(0, 2);
            return cards.flatMap((card, index) => ([
              rectItem('card-' + (index + 1), card.querySelector('.HomeMoTimedeal_timedeal_item__rwiPz') || card),
              rectItem('card-' + (index + 1) + '-image', card.querySelector('.HomeMoTimedeal_image__M6OoV')),
              rectItem('card-' + (index + 1) + '-bottom', card.querySelector('.HomeMoTimedeal_item_bottom__YMRu9')),
            ].filter(Boolean)));
          }
          let selectors = '';
          if (slotId === 'header-top') selectors = 'a, button, img, svg';
          if (slotId === 'header-bottom') selectors = 'a, button';
          if (slotId === 'hero') selectors = 'h1, h2, h3, p, strong, a, button';
          if (slotId === 'quickmenu') selectors = 'a, button';
          if (!selectors) return [];
          const scope = slotId === 'hero'
            ? (node.querySelector('.swiper-slide.codex-hero-active') || node.querySelector('.swiper-slide:nth-child(2)') || node)
            : node;
          return Array.from(scope.querySelectorAll(selectors)).slice(0, 48).map((child) => {
            const childRect = child.getBoundingClientRect();
            if (!intersectsSlot(slotRect, childRect)) return null;
            const label = (child.textContent || child.getAttribute('aria-label') || child.getAttribute('alt') || '').replace(/\s+/g, ' ').trim();
            if (!label && slotId !== 'header-top') return null;
            return {
              label,
              x: Math.round(childRect.x),
              y: Math.round(childRect.y),
              width: Math.round(childRect.width),
              height: Math.round(childRect.height)
            };
          }).filter((item) => item && item.width > 0 && item.height > 0);
        }

        function collectSlotMetrics() {
          const slots = Array.from(document.querySelectorAll('[data-codex-slot]')).map((node) => {
            const rect = node.getBoundingClientRect();
            const slotId = node.getAttribute('data-codex-slot');
            const items = collectSlotItems(node, slotId, rect);
            return {
              slotId,
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              items,
              rowGroups: summarizeRows(items)
            };
          });
          return {
            pageId: ${JSON.stringify(pageId)},
            source: 'reference-content',
            viewport: { width: window.innerWidth, height: window.innerHeight },
            scrollWidth: document.documentElement.scrollWidth,
            slots
          };
        }
        function persistMeasurements(payload) {
          const body = JSON.stringify(payload);
          try {
            if (navigator.sendBeacon) {
              const blob = new Blob([body], { type: 'application/json' });
              navigator.sendBeacon('/api/measure', blob);
            } else {
              fetch('/api/measure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true
              }).catch(() => {});
            }
          } catch (_) {}
        }

        let measureInterval = null;
        function postMeasurements() {
          try {
            const payload = collectSlotMetrics();
            persistMeasurements(payload);
            if (window.top && window.top !== window) {
              window.top.postMessage({ type: 'codex:measure', payload }, window.location.origin);
            }
          } catch (_) {}
        }
        function startMeasurementBurst() {
          window.clearInterval(measureInterval);
          postMeasurements();
          measureInterval = window.setInterval(postMeasurements, 400);
          window.setTimeout(() => {
            window.clearInterval(measureInterval);
            measureInterval = null;
          }, 3200);
        }
        ${isHome ? buildHomeHeroRuntimeScript() : ""}
        document.addEventListener('DOMContentLoaded', startMeasurementBurst);
        document.addEventListener('DOMContentLoaded', () => {
        ${isHome ? "initCodexHomeHeroRuntime(document); initCodexBestRankingRuntime(document);" : ""}
        });
        window.addEventListener('load', startMeasurementBurst);
        window.addEventListener('load', () => {
          ${isHome ? "initCodexHomeHeroRuntime(document); initCodexBestRankingRuntime(document);" : ""}
        });
        window.addEventListener('resize', startMeasurementBurst);
        window.addEventListener('resize', () => {
          ${isHome ? "initCodexHomeHeroRuntime(document); initCodexBestRankingRuntime(document);" : ""}
        });
        ${isHome ? "setTimeout(() => { initCodexHomeHeroRuntime(document); initCodexBestRankingRuntime(document); }, 40);" : ""}
        setTimeout(startMeasurementBurst, 40);
      })();
    </script></body>`
  );

  return html;
}

function rewriteProductCapturedHtml(rawHtml, pageId = "", viewportProfile = "pc", href = "", editableData = null) {
  let html = rawHtml;
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<base[^>]+href=("|')[^"']+\1[^>]*>/gi, "");
  html = html.replace(/<link[^>]+as=("|')font\1[^>]*>/gi, "");
  html = html.replace(/<link[^>]+rel=("|')manifest\1[^>]*>/gi, "");
  html = html.replace(/\b(href|src|poster)=("|')\/(?!\/)/gi, `$1=$2https://www.lge.co.kr/`);
  html = html.replace(/url\((["']?)\/(?!\/)/gi, `url($1https://www.lge.co.kr/`);
  html = applyWorkspaceProductVariants(html, pageId, viewportProfile, href, editableData || {});
  html = html.replace(
    /<\/head>/i,
    `<style>
      html, body { min-height: 100%; visibility: visible !important; opacity: 1 !important; }
      body { background: #fff; visibility: visible !important; opacity: 1 !important; }
      img[style*="visibility:hidden"][src]:not([src=""]) { visibility: visible !important; }
      img[style*="opacity:0"][src]:not([src=""]) { opacity: 1 !important; }
    </style></head>`
  );
  return html;
}

function sendCloneContent(req, res, pageId, requestUrl = null) {
  try {
    const viewportProfile = String(requestUrl?.searchParams?.get("viewportProfile") || "pc").trim() || "pc";
    const homeSandbox = String(requestUrl?.searchParams?.get("homeSandbox") || "").trim();
    const homeVariant = String(requestUrl?.searchParams?.get("homeVariant") || "").trim();
    const editorEnabled = String(requestUrl?.searchParams?.get("editor") || "").trim() === "1";
    const { data: editableData } = resolvePinnedDataForPage(req, pageId);
    const rawHtml = readCloneSourceHtmlByPageId(pageId, viewportProfile);
    if (!rawHtml) {
      return sendRawHtml(
        res,
        404,
        `<!doctype html><html><head><meta charset="utf-8"><title>Clone not found</title></head><body><h1>Clone not found</h1><p>${pageId}</p><p><a href="/preview">Back to preview</a></p></body></html>`
      );
    }
    const transformed = rewriteCloneHtml(rawHtml, pageId, viewportProfile, {
      homeSandbox,
      homeVariant,
      editableData,
      editorEnabled,
    });
    return sendRawHtml(res, 200, transformed);
  } catch (error) {
    return sendRawHtml(
      res,
      500,
      `<!doctype html><html><head><meta charset="utf-8"><title>Clone render failed</title></head><body><h1>Clone render failed</h1><pre>${String(error)}</pre></body></html>`
    );
  }
}

function sendCloneProductContent(req, res, requestUrl) {
  try {
    const pageId = String(requestUrl.searchParams.get("pageId") || "").trim();
    const viewportProfile = String(requestUrl.searchParams.get("viewportProfile") || "pc").trim() || "pc";
    const href = String(requestUrl.searchParams.get("href") || "").trim();
    const { data: editableData } = resolvePinnedDataForPage(req, pageId);
    const pdpContext = resolvePdpRuntimeContext(pageId, href);
    const capturePageId = pdpContext?.runtimePageId || pageId;
    const effectiveHref = pdpContext?.href || href;
    if (!pageId || !effectiveHref) {
      return sendRawHtml(
        res,
        400,
        `<!doctype html><html><head><meta charset="utf-8"><title>Clone product missing params</title></head><body><h1>Missing params</h1></body></html>`
      );
    }
    const capture =
      findPdpVisualCapture(capturePageId, viewportProfile, effectiveHref, "reference") ||
      findPdpVisualCapture(capturePageId, viewportProfile === "pc" ? "mo" : "pc", effectiveHref, "reference");
    const htmlPath = capture?.artifact?.htmlPath || "";
    if (!htmlPath || !fs.existsSync(htmlPath)) {
      return sendRawHtml(
        res,
        404,
        `<!doctype html><html><head><meta charset="utf-8"><title>Clone product source not found</title></head><body><h1>Clone product source not found</h1><p>${escapeHtml(effectiveHref)}</p></body></html>`
      );
    }
    const rawHtml = fs.readFileSync(htmlPath, "utf-8");
    const transformed = rewriteProductCapturedHtml(rawHtml, pageId, viewportProfile, effectiveHref, editableData);
    return sendRawHtml(res, 200, transformed);
  } catch (error) {
    return sendRawHtml(
      res,
      500,
      `<!doctype html><html><head><meta charset="utf-8"><title>Clone product render failed</title></head><body><h1>Clone product render failed</h1><pre>${String(error)}</pre></body></html>`
    );
  }
}

function sendCloneProductShell(req, res, requestUrl) {
  const pageId = String(requestUrl.searchParams.get("pageId") || "").trim();
  const viewportProfile = String(requestUrl.searchParams.get("viewportProfile") || "pc").trim() || "pc";
  const href = String(requestUrl.searchParams.get("href") || "").trim();
  const { pinnedView } = resolvePinnedDataForPage(req, pageId);
  const title = escapeHtml(requestUrl.searchParams.get("title") || href || "PDP");
  const visibleTitle = `${title}${pinnedView?.version?.versionLabel ? ` · ${escapeHtml(pinnedView.version.versionLabel)}` : ""}`;
  const iframeSrc = `/clone-product-content?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}&href=${encodeURIComponent(href)}&v=${Date.now()}`;
  return sendRawHtml(
    res,
    200,
    `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PDP Clone | ${title}</title>
    <style>
      html, body { margin: 0; width: 100%; height: 100%; background: #fff; font-family: Arial, sans-serif; }
      .pdp-clone-shell { width: 100%; min-height: 100vh; display: grid; grid-template-rows: 48px 1fr; }
      .pdp-clone-bar { display:flex; align-items:center; justify-content:space-between; padding:0 14px; border-bottom:1px solid #e5e7eb; background:#111827; color:#fff; font:600 12px/1 Arial,sans-serif; }
      .pdp-clone-bar a { color:#fff; text-decoration:none; }
      .pdp-clone-frame { width: 100%; height: calc(100vh - 49px); border: 0; display:block; background:#fff; }
    </style>
  </head>
  <body>
    <div class="pdp-clone-shell">
      <div class="pdp-clone-bar">
        <span>${visibleTitle}</span>
        <a href="/workbench/pdp?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}">workbench</a>
      </div>
      <iframe class="pdp-clone-frame" src="${iframeSrc}" title="${title}"></iframe>
    </div>
  </body>
</html>`
  );
}

function sendReferenceContent(res, pageId, requestUrl = null) {
  try {
    const viewportProfile = String(requestUrl?.searchParams?.get("viewportProfile") || "pc").trim() || "pc";
    const rawHtml = String(pageId || "").startsWith("category-")
      ? readPlpReferenceHtml(pageId, viewportProfile)
      : readReferenceSourceHtmlByPageId(pageId);
    if (!rawHtml) {
      return sendRawHtml(
        res,
        404,
        `<!doctype html><html><head><meta charset="utf-8"><title>Reference not found</title></head><body><h1>Reference not found</h1><p>${pageId}</p></body></html>`
      );
    }
    return sendRawHtml(res, 200, rewriteReferenceHtml(rawHtml, pageId));
  } catch (error) {
    return sendRawHtml(
      res,
      500,
      `<!doctype html><html><head><meta charset="utf-8"><title>Reference render failed</title></head><body><pre>${String(error)}</pre></body></html>`
    );
  }
}

function sendCloneShell(req, res, pageId, requestUrl = null) {
  const safePageId = String(pageId || "home");
  const homeSandbox = String(requestUrl?.searchParams?.get("homeSandbox") || "").trim();
  const homeVariant = String(requestUrl?.searchParams?.get("homeVariant") || "").trim();
  const requestedView = String(
    requestUrl?.searchParams?.get("view") ||
    requestUrl?.searchParams?.get("viewportProfile") ||
    ""
  )
    .trim()
    .toLowerCase();
  const homeSandboxQuery = homeSandbox ? `&homeSandbox=${encodeURIComponent(homeSandbox)}` : "";
  const homeVariantQuery = homeVariant ? `&homeVariant=${encodeURIComponent(homeVariant)}` : "";
  const { pinnedView, effectiveSource } = resolvePinnedDataForPage(req, safePageId);
  const workspaceSource = effectiveSource || "shared-default";
  const baseline = resolveBaselineInfo(safePageId);
  const shellViewportProfile = requestedView === "mo" || requestedView === "pc"
    ? requestedView
    : baseline.mode === "mobile"
      ? "mo"
      : "pc";
  const isMobileShell = shellViewportProfile === "mo";
  const useCapturedShellHeader = true;
  const gnb = isMobileShell ? { topLinks: [], brandTabs: [], utilityLinks: [], dropdownMenus: {} } : buildShellGnbData();
  const dropdownPanelsHtml = Object.values(gnb.dropdownMenus || {})
    .map(
      (menu) => `
        <div class="shell-dropdown-panel" data-shell-menu-panel="${menu.id}">
          <div class="shell-product-panel-inner">
            ${
              menu.tabs.length
                ? `
              <div class="shell-panel-tabs">
                ${menu.tabs
                  .map(
                    (tab, index) =>
                      `<button type="button" class="shell-panel-tab${index === 0 ? " is-active" : ""}" data-panel-tab="${tab.id}" data-shell-menu="${menu.id}">${tab.label}</button>`
                  )
                  .join("")}
              </div>
              ${menu.panels
                .map(
                  (panel, index) => `
                <div class="shell-panel-grid${index === 0 ? " is-active" : ""}" data-panel-id="${panel.id}" data-shell-menu-grid="${menu.id}">
                  ${panel.columns
                    .map(
                      (items) => `
                    <div class="shell-panel-column">
                      ${items
                        .map(
                          (item) => `
                        <div class="shell-panel-block">
                          <a class="shell-panel-title" href="${item.href}">${item.label}</a>
                          ${item.children.length ? `<div class="shell-panel-links">${item.children.map((child) => `<a href="${child.href}">${child.label}</a>`).join("")}</div>` : ""}
                        </div>`
                        )
                        .join("")}
                    </div>`
                    )
                    .join("")}
                </div>`
                )
                .join("")}
            `
                : `
              <div class="shell-panel-grid is-active" data-panel-id="${menu.id}" data-shell-menu-grid="${menu.id}">
                ${menu.panels
                  .map(
                    (panel) => `
                  ${panel.columns
                    .map(
                      (items) => `
                    <div class="shell-panel-column">
                      ${items
                        .map(
                          (item) => `
                        <div class="shell-panel-block">
                          <a class="shell-panel-title" href="${item.href}">${item.label}</a>
                          ${item.children.length ? `<div class="shell-panel-links">${item.children.map((child) => `<a href="${child.href}">${child.label}</a>`).join("")}</div>` : ""}
                        </div>`
                        )
                        .join("")}
                    </div>`
                    )
                    .join("")}
                `
                  )
                  .join("")}
              </div>
            `
            }
          </div>
        </div>`
    )
    .join("");
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="codex-workspace-source" content="${escapeHtml(workspaceSource || "shared-default")}" />
    <title>Clone | ${safePageId}${pinnedView?.version?.versionLabel ? ` | ${escapeHtml(pinnedView.version.versionLabel)}` : ""}</title>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #ffffff;
        overflow: hidden;
        font-family: Arial, sans-serif;
      }
      .clone-shell {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .shell-header {
        position: relative;
        z-index: 20;
        background: #fff;
        border-bottom: 1px solid #e5e7eb;
        box-shadow: 0 1px 0 rgba(17,24,39,0.04);
      }
      .shell-header-inner {
        width: ${DEFAULT_CANVAS_WIDTH}px;
        max-width: ${DEFAULT_CANVAS_WIDTH}px;
        margin: 0 auto;
      }
      .shell-top {
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 0 40px;
        box-sizing: border-box;
        border-bottom: 1px solid #eceff3;
      }
      .shell-logo {
        display: inline-flex;
        align-items: center;
        height: 40px;
        text-decoration: none;
        flex: 0 0 auto;
      }
      .shell-logo img {
        height: 28px;
        width: auto;
        display: block;
      }
      .shell-main-nav { display: flex; align-items: center; gap: 28px; min-width: 0; }
      .shell-main-item {
        position: relative;
      }
      .shell-main-item > a,
      .shell-main-item > button {
        background: none;
        border: 0;
        padding: 0;
        font: 700 15px/1.2 Arial, sans-serif;
        color: #111827;
        text-decoration: none;
        cursor: pointer;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }
      .shell-main-item > a:hover,
      .shell-main-item > button:hover {
        color: #111;
      }
      .shell-brand-tabs {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
      }
      .shell-brand-tabs a {
        display: inline-flex;
        align-items: center;
        min-height: 38px;
        padding: 0 18px;
        border-radius: 999px;
        background: #f3f4f6;
        color: #111827;
        text-decoration: none;
        font: 600 13px/1 Arial, sans-serif;
        letter-spacing: -0.02em;
      }
      .shell-bottom {
        height: 64px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 40px;
        box-sizing: border-box;
      }
      .shell-bottom-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
      }
      .shell-gnb-arrow {
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        border-radius: 999px;
        border: 1px solid #eceff3;
        background: #fff;
        color: #111827;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font: 500 18px/1 Arial, sans-serif;
      }
      .shell-home-style {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
        padding: 0 11px;
        border-radius: 10px;
        background: #e84a5f;
        color: #fff;
        text-decoration: none;
        font: 700 12px/1 Arial, sans-serif;
        white-space: nowrap;
      }
      .shell-utility {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        flex: 0 0 auto;
      }
      .shell-utility-icons {
        display: flex;
        align-items: center;
        gap: 2px;
        margin-right: 8px;
      }
      .shell-utility a {
        color: #111827;
        text-decoration: none;
        white-space: nowrap;
        line-height: 40px;
      }
      .shell-icon {
        width: 40px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #111827;
      }
      .shell-icon svg {
        width: 20px;
        height: 20px;
        stroke: currentColor;
      }
      .shell-product-panel {
        position: absolute;
        left: 0;
        right: 0;
        top: 100%;
        display: none;
        background: #fff;
        border-top: 1px solid #e5e7eb;
        box-shadow: 0 18px 40px rgba(17,24,39,0.12);
      }
      .shell-product-panel.is-open {
        display: block;
      }
      .shell-dropdown-panel { display: none; }
      .shell-dropdown-panel.is-open { display: block; }
      .shell-product-panel-inner {
        width: ${DEFAULT_CANVAS_WIDTH}px;
        max-width: ${DEFAULT_CANVAS_WIDTH}px;
        margin: 0 auto;
        padding: 16px 0 24px;
      }
      .shell-panel-tabs {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 14px;
        font-size: 14px;
      }
      .shell-panel-tab {
        background: none;
        border: 0;
        padding: 0;
        color: #4b5563;
        cursor: pointer;
        font: 500 14px/1.4 Arial, sans-serif;
      }
      .shell-panel-tab.is-active {
        color: #111827;
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 6px;
      }
      .shell-panel-grid {
        display: none;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 18px;
      }
      .shell-panel-grid.is-active {
        display: grid;
      }
      .shell-panel-column {
        min-width: 0;
      }
      .shell-panel-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 10px;
        color: #111827;
        font: 700 15px/1.35 Arial, sans-serif;
        text-decoration: none;
      }
      .shell-panel-links {
        display: grid;
        gap: 8px;
      }
      .shell-panel-links a {
        color: #374151;
        text-decoration: none;
        font-size: 14px;
        line-height: 1.4;
      }
      .clone-frame {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: #fff;
        flex: 1;
      }
      .clone-loading {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,0.92);
        color: #111827;
        font: 600 14px/1 Arial, sans-serif;
        z-index: 10;
        transition: opacity 160ms ease;
      }
      .clone-loading.is-hidden {
        opacity: 0;
        pointer-events: none;
      }
      .shell-toast {
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        z-index: 50;
        background: rgba(17,24,39,0.92);
        color: #fff;
        border-radius: 999px;
        padding: 10px 14px;
        font: 600 12px/1 Arial, sans-serif;
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease;
      }
      .shell-toast.is-visible { opacity: 1; }
      @media (max-width: 1280px) {
        .shell-top {
          gap: 10px;
          padding: 0 24px;
        }
        .shell-main-nav {
          gap: 18px;
        }
        .shell-main-item > a,
        .shell-main-item > button {
          font-size: 14px;
        }
        .shell-bottom { gap: 10px; padding: 0 24px; }
        .shell-bottom-left { gap: 10px; }
        .shell-brand-tabs { gap: 6px; }
        .shell-brand-tabs a {
          min-height: 34px;
          padding: 0 14px;
          font-size: 12px;
        }
        .shell-home-style { min-height: 30px; padding: 0 10px; font-size: 12px; }
        .shell-gnb-arrow { width: 30px; height: 30px; flex-basis: 30px; }
        .shell-logo img { height: 26px; }
      }
    </style>
  </head>
  <body>
    <div class="clone-shell">
      ${isMobileShell || useCapturedShellHeader ? "" : `<header class="shell-header">
        <div class="shell-header-inner">
          <div class="shell-top">
            <a class="shell-logo" href="/clone/home" data-shell-home="true">
              <img src="https://www.lge.co.kr/kr/images/nextjs/lg_logo_213x56.png" alt="LG전자 로고" />
            </a>
            <div class="shell-utility">
              <div class="shell-utility-icons">
                <span class="shell-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
                </span>
                <span class="shell-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6"></path></svg>
                </span>
                <span class="shell-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8H18a1 1 0 0 0 1-.8L21 7H7"></path><circle cx="10" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle></svg>
                </span>
              </div>
              ${gnb.utilityLinks.map((item) => `<a href="${item.href}" data-shell-utility>${item.label}</a>`).join("")}
            </div>
          </div>
          <div class="shell-bottom">
            <div class="shell-bottom-left">
              <button type="button" class="shell-gnb-arrow" aria-label="이전" data-shell-arrow="prev">‹</button>
              <nav class="shell-main-nav" aria-label="Global navigation">
                ${gnb.topLinks
                  .map((item, index) =>
                    item.kind === "dropdown"
                      ? `<div class="shell-main-item"><button type="button" data-shell-dropdown="${item.menuId}">${item.label}</button></div>`
                      : `<div class="shell-main-item"><a href="${item.href}" data-shell-link="${index}">${item.label}</a></div>`
                  )
                  .join("")}
              </nav>
              <a class="shell-home-style" href="#" data-shell-secondary="home-style">홈스타일</a>
              <div class="shell-brand-tabs">
                ${gnb.brandTabs.map((item) => `<a href="${item.href}" data-shell-brand>${item.label}</a>`).join("")}
              </div>
              <button type="button" class="shell-gnb-arrow" aria-label="다음" data-shell-arrow="next">›</button>
            </div>
          </div>
        </div>
        <div class="shell-product-panel" id="shell-product-panel">
          ${dropdownPanelsHtml}
        </div>
      </header>`}
      <div class="clone-loading" id="clone-loading">페이지를 불러오는 중…</div>
      <div class="shell-toast" id="shell-toast"></div>
      <iframe
        id="clone-frame"
        class="clone-frame"
        title="Captured clone"
        src="/clone-content/${encodeURIComponent(safePageId)}?viewportProfile=${encodeURIComponent(shellViewportProfile)}&v=${Date.now()}${homeSandboxQuery}${homeVariantQuery}"
      ></iframe>
    </div>
    <script>
      (() => {
        const cacheBust = '${Date.now()}';
        const frame = document.getElementById('clone-frame');
        const loading = document.getElementById('clone-loading');
        const toast = document.getElementById('shell-toast');
        const productPanel = document.getElementById('shell-product-panel');
        const dropdownButtons = Array.from(document.querySelectorAll('[data-shell-dropdown]'));
        const dropdownPanels = Array.from(document.querySelectorAll('[data-shell-menu-panel]'));
        let loadingTimer = null;
        let toastTimer = null;
        let productPanelCloseTimer = null;
        let activeMenuId = null;

        function hideLoading() {
          loading.classList.add('is-hidden');
          window.clearTimeout(loadingTimer);
          loadingTimer = null;
        }

        function showToast(text) {
          toast.textContent = text;
          toast.classList.add('is-visible');
          window.clearTimeout(toastTimer);
          toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1600);
        }

        function setPage(nextPageId) {
          const normalized = decodeURIComponent(nextPageId || 'home');
          const nextUrl = '/clone/' + encodeURIComponent(normalized) + '${homeSandbox ? `?homeSandbox=${homeSandbox}${homeVariant ? `&homeVariant=${homeVariant}` : ""}` : homeVariant ? `?homeVariant=${homeVariant}` : ""}';
          history.replaceState({ pageId: normalized }, '', nextUrl);
          frame.src = '/clone-content/' + encodeURIComponent(normalized) + '?v=' + cacheBust + '${homeSandboxQuery}${homeVariantQuery}';
          loading.classList.remove('is-hidden');
          window.clearTimeout(loadingTimer);
          loadingTimer = window.setTimeout(hideLoading, 2200);
        }

        frame.addEventListener('load', () => {
          window.clearTimeout(loadingTimer);
          loadingTimer = window.setTimeout(hideLoading, 300);
          scheduleShellMeasurements(280);
        });

        function routeLink(href) {
          if (!href || href === '#') {
            showToast('이 링크는 아직 수집되지 않았습니다.');
            return;
          }
          if (href.startsWith('/clone/')) {
            const pageId = decodeURIComponent(href.slice('/clone/'.length));
            setPage(pageId);
            return;
          }
          showToast('이 링크는 아직 수집되지 않았습니다.');
        }

        document.querySelectorAll('[data-shell-home], [data-shell-link], [data-shell-brand], [data-shell-utility], .shell-panel-title, .shell-panel-links a').forEach((anchor) => {
          anchor.addEventListener('click', (event) => {
            event.preventDefault();
            routeLink(anchor.getAttribute('href') || '');
          });
        });

        function openProductPanel(menuId) {
          window.clearTimeout(productPanelCloseTimer);
          productPanel.classList.add('is-open');
          activeMenuId = menuId || activeMenuId || '제품/소모품';
          dropdownPanels.forEach((panel) => {
            panel.classList.toggle('is-open', panel.getAttribute('data-shell-menu-panel') === activeMenuId);
          });
          dropdownButtons.forEach((button) => {
            const isActive = button.getAttribute('data-shell-dropdown') === activeMenuId;
            button.classList.toggle('is-active', isActive);
            button.parentElement?.classList.toggle('is-active', isActive);
          });
        }

        function closeProductPanel() {
          window.clearTimeout(productPanelCloseTimer);
          productPanel.classList.remove('is-open');
          dropdownPanels.forEach((panel) => panel.classList.remove('is-open'));
          dropdownButtons.forEach((button) => {
            button.classList.remove('is-active');
            button.parentElement?.classList.remove('is-active');
          });
          activeMenuId = null;
        }

        function scheduleCloseProductPanel() {
          window.clearTimeout(productPanelCloseTimer);
          productPanelCloseTimer = window.setTimeout(closeProductPanel, 260);
        }

        dropdownButtons.forEach((button) => {
          const menuId = button.getAttribute('data-shell-dropdown');
          button.addEventListener('mouseenter', () => openProductPanel(menuId));
          button.addEventListener('focusin', () => openProductPanel(menuId));
          button.parentElement?.addEventListener('mouseleave', scheduleCloseProductPanel);
          button.parentElement?.addEventListener('focusout', scheduleCloseProductPanel);
          button.addEventListener('click', (event) => {
            event.preventDefault();
            if (activeMenuId === menuId && productPanel.classList.contains('is-open')) {
              closeProductPanel();
            } else {
              openProductPanel(menuId);
            }
          });
        });

        productPanel.addEventListener('mouseenter', () => openProductPanel(activeMenuId));
        productPanel.addEventListener('mouseleave', scheduleCloseProductPanel);
        productPanel.addEventListener('focusin', () => openProductPanel(activeMenuId));
        productPanel.addEventListener('focusout', scheduleCloseProductPanel);

        document.querySelectorAll('.shell-panel-tab').forEach((button) => {
          button.addEventListener('mouseenter', () => {
            const panelId = button.getAttribute('data-panel-tab');
            const menuId = button.getAttribute('data-shell-menu');
            document.querySelectorAll('.shell-panel-tab').forEach((node) => {
              const sameMenu = node.getAttribute('data-shell-menu') === menuId;
              node.classList.toggle('is-active', sameMenu && node === button);
            });
            document.querySelectorAll('.shell-panel-grid').forEach((panel) => {
              const sameMenu = panel.getAttribute('data-shell-menu-grid') === menuId;
              panel.classList.toggle('is-active', sameMenu && panel.getAttribute('data-panel-id') === panelId);
            });
          });
          button.addEventListener('click', (event) => {
            event.preventDefault();
            button.dispatchEvent(new Event('mouseenter'));
          });
        });

        function summarizeRows(items) {
          const rows = [];
          items.forEach((item) => {
            const existing = rows.find((row) => Math.abs(row.y - item.y) <= 18);
            if (existing) {
              existing.count += 1;
              existing.minX = Math.min(existing.minX, item.x);
              existing.maxX = Math.max(existing.maxX, item.x + item.width);
              return;
            }
            rows.push({
              y: item.y,
              count: 1,
              minX: item.x,
              maxX: item.x + item.width
            });
          });
          return rows.map((row) => ({
            y: row.y,
            count: row.count,
            width: row.maxX - row.minX
          }));
        }

        function intersectsSlot(slotRect, itemRect) {
          const slotLeft = Math.round(slotRect.x);
          const slotTop = Math.round(slotRect.y);
          const slotRight = slotLeft + Math.round(slotRect.width);
          const slotBottom = slotTop + Math.round(slotRect.height);
          const itemLeft = Math.round(itemRect.x);
          const itemTop = Math.round(itemRect.y);
          const itemRight = itemLeft + Math.round(itemRect.width);
          const itemBottom = itemTop + Math.round(itemRect.height);
          return itemRight > slotLeft && itemLeft < slotRight && itemBottom > slotTop && itemTop < slotBottom;
        }

        function collectSlotItems(node, slotId) {
          let selectors = '';
          if (slotId === 'header-top') selectors = '.shell-utility a, .shell-icon, .shell-logo';
          if (slotId === 'header-bottom') selectors = '.shell-main-item a, .shell-main-item button, .shell-home-style, .shell-brand-tabs a, .shell-gnb-arrow';
          if (slotId === 'gnb-open-panel') selectors = '.shell-panel-tab, .shell-panel-title, .shell-panel-links a';
          if (!selectors) return [];
          const slotRect = node.getBoundingClientRect();
          return Array.from(node.querySelectorAll(selectors)).slice(0, 48).map((target) => {
            const itemRect = target.getBoundingClientRect();
            if (!intersectsSlot(slotRect, itemRect)) return null;
            return {
              label: (target.textContent || target.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
              ...rectOf(target)
            };
          }).filter(Boolean);
        }

        function collectDocumentSlotMetrics(doc) {
          return Array.from(doc.querySelectorAll('[data-codex-slot]')).map((node) => {
            const rect = node.getBoundingClientRect();
            const slotId = node.getAttribute('data-codex-slot');
            let selectors = '';
            if (slotId === 'header-top') selectors = 'a, button, img, svg';
            if (slotId === 'header-bottom') selectors = 'a, button';
            if (slotId === 'hero') selectors = 'h1, h2, h3, p, strong, a, button';
            if (slotId === 'quickmenu') selectors = 'a, button';
            const scope = slotId === 'hero'
              ? (node.querySelector('.swiper-slide.codex-hero-active') || node.querySelector('.swiper-slide:nth-child(2)') || node)
              : node;
            const items = selectors
              ? Array.from(scope.querySelectorAll(selectors)).slice(0, 48).map((child) => {
                  const childRect = child.getBoundingClientRect();
                  if (!intersectsSlot(rect, childRect)) return null;
                  return {
                    label: (child.textContent || child.getAttribute('aria-label') || child.getAttribute('alt') || '').replace(/\s+/g, ' ').trim(),
                    x: Math.round(childRect.x),
                    y: Math.round(childRect.y),
                    width: Math.round(childRect.width),
                    height: Math.round(childRect.height)
                  };
                }).filter((item) => item && item.width > 0 && item.height > 0)
              : [];
            return {
              slotId,
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              items,
              rowGroups: summarizeRows(items)
            };
          });
        }

        function collectShellMetrics() {
          const shellSlots = [];
          const topRow = document.querySelector('.shell-top');
          const bottomRow = document.querySelector('.shell-bottom');
          const dropdown = document.querySelector('.shell-product-panel');
          const rectOf = (node) => {
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          };
          if (topRow) {
            const items = collectSlotItems(topRow, 'header-top');
            shellSlots.push({
              slotId: 'header-top',
              ...rectOf(topRow),
              items,
              rowGroups: summarizeRows(items)
            });
          }
          if (bottomRow) {
            const items = collectSlotItems(bottomRow, 'header-bottom');
            shellSlots.push({
              slotId: 'header-bottom',
              ...rectOf(bottomRow),
              items,
              rowGroups: summarizeRows(items)
            });
          }
          if (dropdown && dropdown.classList.contains('is-open')) {
            const items = collectSlotItems(dropdown, 'gnb-open-panel');
            shellSlots.push({
              slotId: 'gnb-open-panel',
              menuId: activeMenuId,
              ...rectOf(dropdown),
              items,
              rowGroups: summarizeRows(items)
            });
          }
          return {
            pageId: ${JSON.stringify(safePageId)},
            source: 'clone-shell',
            viewport: { width: window.innerWidth, height: window.innerHeight },
            scrollWidth: document.documentElement.scrollWidth,
            slots: shellSlots
          };
        }

        function collectFrameMetrics() {
          try {
            const childWin = frame.contentWindow;
            const childDoc = frame.contentDocument || childWin?.document;
            if (!childWin || !childDoc) return null;
            return {
              pageId: ${JSON.stringify(safePageId)},
              source: 'clone-content',
              viewport: {
                width: childWin.innerWidth || window.innerWidth,
                height: childWin.innerHeight || window.innerHeight
              },
              scrollWidth: childDoc.documentElement?.scrollWidth || 0,
              slots: collectDocumentSlotMetrics(childDoc)
            };
          } catch (_) {
            return null;
          }
        }

        function persistMeasurements(payload) {
          const body = JSON.stringify(payload);
          try {
            if (navigator.sendBeacon) {
              const blob = new Blob([body], { type: 'application/json' });
              navigator.sendBeacon('/api/measure', blob);
            } else {
              fetch('/api/measure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true
              }).catch(() => {});
            }
          } catch (_) {}
        }

        function emitMeasurement(payload) {
          if (!payload) return;
          persistMeasurements(payload);
          if (window.top && window.top !== window) {
            window.top.postMessage({ type: 'codex:measure', payload }, window.location.origin);
          }
        }

        function postShellMeasurements() {
          emitMeasurement(collectShellMetrics());
          emitMeasurement(collectFrameMetrics());
        }

        let shellMeasureTimer = null;
        let shellMeasureInterval = null;
        function scheduleShellMeasurements(delay = 120) {
          window.clearTimeout(shellMeasureTimer);
          window.clearInterval(shellMeasureInterval);
          shellMeasureTimer = window.setTimeout(postShellMeasurements, Math.max(20, delay));
          shellMeasureInterval = window.setInterval(postShellMeasurements, 400);
          window.setTimeout(() => {
            window.clearInterval(shellMeasureInterval);
            shellMeasureInterval = null;
          }, 3200);
        }

        window.addEventListener('message', (event) => {
          if (event.origin !== window.location.origin) return;
          const data = event.data || {};
          if (data.type === 'codex:navigate' && data.pageId) {
            setPage(data.pageId);
          }
          if (data.type === 'codex:title' && data.title) {
            document.title = data.title;
          }
          if (data.type === 'codex:ready') {
            hideLoading();
            scheduleShellMeasurements();
          }
          if (data.type === 'codex:measure') {
            if (window.top && window.top !== window) {
              window.top.postMessage({ type: 'codex:measure', payload: data.payload }, window.location.origin);
            }
            scheduleShellMeasurements();
          }
        });

        window.addEventListener('popstate', () => {
          const pageId = decodeURIComponent(window.location.pathname.slice('/clone/'.length) || 'home');
          frame.src = '/clone-content/' + encodeURIComponent(pageId);
          loading.classList.remove('is-hidden');
        });
        document.addEventListener('DOMContentLoaded', () => scheduleShellMeasurements(40));
        window.addEventListener('load', scheduleShellMeasurements);
        window.addEventListener('resize', scheduleShellMeasurements);
        scheduleShellMeasurements();
      })();
    </script>
  </body>
</html>`;

  return sendRawHtml(res, 200, html);
}

function sendCompareShell(res, pageId) {
  const safePageId = String(pageId || "home");
  const liveReferenceSrc = `/visual/${encodeURIComponent(safePageId)}/live-reference.png`;
  const baseline = resolveBaselineInfo(safePageId);
  const usesMobileHomeBaseline = baseline.mode === "mobile";
  const liveReferenceUrl = baseline.url;
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compare | ${safePageId}</title>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #0f172a;
        color: #e5e7eb;
        font-family: Arial, sans-serif;
      }
      .compare-shell {
        height: 100%;
        display: grid;
        grid-template-rows: 56px 1fr;
      }
      .compare-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        background: #111827;
      }
      .compare-toolbar strong {
        font-size: 14px;
      }
      .compare-toolbar a {
        color: #fff;
        text-decoration: none;
        font-size: 13px;
      }
      .compare-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2px;
        background: rgba(255,255,255,0.08);
        min-height: 0;
      }
      .compare-pane {
        min-width: 0;
        min-height: 0;
        display: grid;
        grid-template-rows: 40px 1fr 180px;
        background: #fff;
      }
      .compare-label {
        display: flex;
        align-items: center;
        padding: 0 14px;
        font: 700 12px/1 Arial, sans-serif;
        color: #111827;
        border-bottom: 1px solid #e5e7eb;
      }
      .compare-frame {
        width: ${DEFAULT_CANVAS_WIDTH}px;
        height: ${DEFAULT_COMPARE_CANVAS_HEIGHT}px;
        border: 0;
        display: block;
        background: #fff;
      }
      .compare-frame-wrap {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        background: #cbd5e1;
      }
      .compare-canvas-wrap {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        background: #cbd5e1;
        position: relative;
      }
      .compare-canvas-stage {
        position: relative;
        transform-origin: top left;
        width: ${DEFAULT_CANVAS_WIDTH}px;
      }
      .compare-image-wrap {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        background: #cbd5e1;
        display: flex;
        align-items: flex-start;
        justify-content: center;
      }
      .compare-image {
        width: ${DEFAULT_CANVAS_WIDTH}px;
        height: auto;
        display: block;
        background: #fff;
      }
      .compare-measure {
        overflow: auto;
        padding: 12px;
        border-top: 1px solid #e5e7eb;
        font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
        color: #111827;
        background: #f8fafc;
        white-space: pre-wrap;
      }
      .compare-diff {
        overflow: auto;
        padding: 12px;
        border-top: 1px solid #c7d2fe;
        font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
        color: #111827;
        background: #eef2ff;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
      <div class="compare-shell">
      <div class="compare-toolbar">
        <strong>Compare: ${safePageId} · canvas ${DEFAULT_CANVAS_WIDTH}px</strong>
        <a href="/clone/${encodeURIComponent(safePageId)}">작업본만 보기</a>
      </div>
      <div class="compare-grid">
        <section class="compare-pane">
          <div class="compare-label">Live Visual Baseline · ${baseline.route}</div>
          <div class="compare-canvas-wrap" data-compare-wrap>
            <div class="compare-canvas-stage" data-compare-stage>
              <img
                class="compare-image"
                id="reference-image"
                src="${liveReferenceSrc}?v=${Date.now()}"
                alt="Live visual baseline"
              />
            </div>
          </div>
          <pre class="compare-measure" id="reference-measure">reference metrics pending…</pre>
        </section>
        <section class="compare-pane">
          <div class="compare-label">Working Clone</div>
          <div class="compare-canvas-wrap" data-compare-wrap>
            <div class="compare-canvas-stage" data-compare-stage>
              <iframe
                class="compare-frame"
                id="working-frame"
                src="/clone/${encodeURIComponent(safePageId)}"
              ></iframe>
            </div>
          </div>
          <pre class="compare-measure" id="working-measure">working metrics pending…</pre>
        </section>
      </div>
      <iframe
        style="position:absolute;width:1px;height:1px;left:-99999px;top:-99999px;border:0;opacity:0;pointer-events:none"
        aria-hidden="true"
        tabindex="-1"
        src="/reference-content/${encodeURIComponent(safePageId)}"
      ></iframe>
      <pre class="compare-diff" id="compare-diff">diff pending…</pre>
      <script>
        (() => {
          const pageId = ${JSON.stringify(safePageId)};
          const referenceEl = document.getElementById('reference-measure');
          const workingEl = document.getElementById('working-measure');
          const diffEl = document.getElementById('compare-diff');
          const workingFrame = document.getElementById('working-frame');
          const referenceFrame = document.querySelector('iframe[aria-hidden="true"]');
          const store = {};

          function summarizeRows(items) {
            const rows = [];
            items.forEach((item) => {
              const existing = rows.find((row) => Math.abs(row.y - item.y) <= 18);
              if (existing) {
                existing.count += 1;
                existing.minX = Math.min(existing.minX, item.x);
                existing.maxX = Math.max(existing.maxX, item.x + item.width);
                return;
              }
              rows.push({
                y: item.y,
                count: 1,
                minX: item.x,
                maxX: item.x + item.width
              });
            });
            return rows.map((row) => ({
              y: row.y,
              count: row.count,
              width: row.maxX - row.minX
            }));
          }

          function rectOf(node) {
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          }

          function intersectsSlot(slotRect, itemRect) {
            const slotLeft = Math.round(slotRect.x);
            const slotTop = Math.round(slotRect.y);
            const slotRight = slotLeft + Math.round(slotRect.width);
            const slotBottom = slotTop + Math.round(slotRect.height);
            const itemLeft = Math.round(itemRect.x);
            const itemTop = Math.round(itemRect.y);
            const itemRight = itemLeft + Math.round(itemRect.width);
            const itemBottom = itemTop + Math.round(itemRect.height);
            return itemRight > slotLeft && itemLeft < slotRight && itemBottom > slotTop && itemTop < slotBottom;
          }

          function collectDocumentSlotMetrics(doc, source, offset = { x: 0, y: 0 }) {
            if (!doc) return null;
            const slots = Array.from(doc.querySelectorAll('[data-codex-slot]')).map((node) => {
              const rect = node.getBoundingClientRect();
              const slotId = node.getAttribute('data-codex-slot');
              let selectors = '';
              if (slotId === 'header-top') selectors = 'a, button, img, svg';
              if (slotId === 'header-bottom') selectors = 'a, button';
              if (slotId === 'hero') selectors = 'h1, h2, h3, p, strong, a, button';
              if (slotId === 'quickmenu') selectors = 'a, button';
              const scope = slotId === 'hero'
                ? (node.querySelector('.swiper-slide.codex-hero-active') || node.querySelector('.swiper-slide:nth-child(2)') || node)
                : node;
              const items = selectors
                ? Array.from(scope.querySelectorAll(selectors)).slice(0, 48).map((child) => {
                    const childRect = child.getBoundingClientRect();
                    if (!intersectsSlot(rect, childRect)) return null;
                    return {
                      label: (child.textContent || child.getAttribute('aria-label') || child.getAttribute('alt') || '').replace(/\\s+/g, ' ').trim(),
                      x: Math.round(childRect.x),
                      y: Math.round(childRect.y),
                      width: Math.round(childRect.width),
                      height: Math.round(childRect.height)
                    };
                  }).filter((item) => item && item.width > 0 && item.height > 0)
                : [];
              return {
                slotId,
                x: Math.round(rect.x + (offset.x || 0)),
                y: Math.round(rect.y + (offset.y || 0)),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                items: items.map((item) => ({
                  ...item,
                  x: Math.round(item.x + (offset.x || 0)),
                  y: Math.round(item.y + (offset.y || 0))
                })),
                rowGroups: summarizeRows(
                  items.map((item) => ({
                    ...item,
                    x: Math.round(item.x + (offset.x || 0)),
                    y: Math.round(item.y + (offset.y || 0))
                  }))
                )
              };
            });
            return {
              pageId,
              source,
              viewport: {
                width: doc.defaultView?.innerWidth || 0,
                height: doc.defaultView?.innerHeight || 0
              },
              scrollWidth: doc.documentElement?.scrollWidth || 0,
              slots
            };
          }

          function collectShellMetrics(doc) {
            if (!doc) return null;
            const shellSlots = [];
            const topRow = doc.querySelector('.shell-top');
            const bottomRow = doc.querySelector('.shell-bottom');
            const dropdown = doc.querySelector('.shell-product-panel.is-open');
            const collectSlotItems = (node, slotId) => {
              let selectors = '';
              if (slotId === 'header-top') selectors = '.shell-utility a, .shell-icon, .shell-logo';
              if (slotId === 'header-bottom') selectors = '.shell-main-item a, .shell-main-item button, .shell-home-style, .shell-brand-tabs a, .shell-gnb-arrow';
              if (slotId === 'gnb-open-panel') selectors = '.shell-panel-tab, .shell-panel-title, .shell-panel-links a';
              if (!selectors) return [];
              const slotRect = node.getBoundingClientRect();
              return Array.from(node.querySelectorAll(selectors)).slice(0, 48).map((target) => {
                const itemRect = target.getBoundingClientRect();
                if (!intersectsSlot(slotRect, itemRect)) return null;
                return {
                  label: (target.textContent || target.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim(),
                  ...rectOf(target)
                };
              }).filter(Boolean);
            };
            if (topRow) {
              const items = collectSlotItems(topRow, 'header-top');
              shellSlots.push({
                slotId: 'header-top',
                ...rectOf(topRow),
                items,
                rowGroups: summarizeRows(items)
              });
            }
            if (bottomRow) {
              const items = collectSlotItems(bottomRow, 'header-bottom');
              shellSlots.push({
                slotId: 'header-bottom',
                ...rectOf(bottomRow),
                items,
                rowGroups: summarizeRows(items)
              });
            }
            if (dropdown) {
              const items = collectSlotItems(dropdown, 'gnb-open-panel');
              shellSlots.push({
                slotId: 'gnb-open-panel',
                ...rectOf(dropdown),
                items,
                rowGroups: summarizeRows(items)
              });
            }
            return {
              pageId,
              source: 'clone-shell',
              viewport: {
                width: doc.defaultView?.innerWidth || 0,
                height: doc.defaultView?.innerHeight || 0
              },
              scrollWidth: doc.documentElement?.scrollWidth || 0,
              slots: shellSlots
            };
          }

          function persistMeasurement(payload) {
            if (!payload) return;
            fetch('/api/measure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              keepalive: true
            }).catch(() => {});
          }

          function updateMeasurementStores() {
            try {
              const refDoc = referenceFrame?.contentDocument || referenceFrame?.contentWindow?.document;
              const workingShellDoc = workingFrame?.contentDocument || workingFrame?.contentWindow?.document;
              const cloneInnerFrame = workingShellDoc?.getElementById('clone-frame');
              const cloneContentDoc = cloneInnerFrame?.contentDocument || cloneInnerFrame?.contentWindow?.document;
              const innerFrameRect = cloneInnerFrame?.getBoundingClientRect?.() || { x: 0, y: 0 };
              const refPayload = collectDocumentSlotMetrics(refDoc, 'reference-content');
              const shellPayload = collectShellMetrics(workingShellDoc);
              const contentPayload = collectDocumentSlotMetrics(cloneContentDoc, 'clone-content', {
                x: Math.round(innerFrameRect.x || 0),
                y: Math.round(innerFrameRect.y || 0)
              });
              if (refPayload) {
                store.reference = store.reference || {};
                store.reference['reference-content'] = refPayload;
                persistMeasurement(refPayload);
              }
              if (shellPayload) {
                store.working = store.working || {};
                store.working['clone-shell'] = shellPayload;
                persistMeasurement(shellPayload);
              }
              if (contentPayload) {
                store.working = store.working || {};
                store.working['clone-content'] = contentPayload;
                persistMeasurement(contentPayload);
              }
              refresh();
            } catch (_) {}
          }

          function seedReference() {
            Promise.all([
              fetch('/api/slot-snapshots?pageId=' + encodeURIComponent(pageId) + '&source=reference').then((r) => r.json()),
              fetch('/api/slot-diff?pageId=' + encodeURIComponent(pageId)).then((r) => r.json()),
              fetch('/api/baseline-audit?pageId=' + encodeURIComponent(pageId)).then((r) => r.json())
            ]).then(([reference, diff, audit]) => {
              store.reference = {
                'visual-baseline': {
                  source: 'visual-baseline',
                  pageId,
                  baselineUrl: ${JSON.stringify(liveReferenceUrl)},
                  baselineRoute: ${JSON.stringify(baseline.route)},
                  baselineMode: ${JSON.stringify(baseline.mode)}
                },
                'reference-structure': {
                  source: 'reference-structure',
                  pageId,
                  slots: reference.slots || [],
                  states: reference.states || []
                }
              };
              if (diff && diff.reference) {
                store.reference['reference-diff'] = diff.reference;
              }
              if (audit) {
                store.audit = audit;
              }
              refresh();
            }).catch(() => {});
          }

          function pollWorking() {
            fetch('/api/measurements?pageId=' + encodeURIComponent(pageId))
              .then((r) => r.json())
              .then((payload) => {
                const measurements = payload.measurements || {};
                if (measurements['clone-shell'] || measurements['clone-content']) {
                  store.working = store.working || {};
                  if (measurements['clone-shell']) {
                    store.working['clone-shell'] = measurements['clone-shell'];
                  }
                  if (measurements['clone-content']) {
                    store.working['clone-content'] = measurements['clone-content'];
                  }
                  refresh();
                }
              })
              .catch(() => {});
            updateMeasurementStores();
          }

          function renderBucket(bucket) {
            if (!bucket) return 'no data';
            const parts = [];
            Object.entries(bucket).forEach(([source, payload]) => {
              parts.push('[' + source + ']');
              parts.push(JSON.stringify(payload, null, 2));
            });
            return parts.join('\\n\\n');
          }

          function refresh() {
            referenceEl.textContent = renderBucket(store.reference);
            workingEl.textContent = renderBucket(store.working);
            const renderedDiff = renderDiff();
            const auditText = renderAudit();
            diffEl.textContent = [renderedDiff, '', auditText].filter(Boolean).join('\\n');
          }

          function normalize(bucket) {
            const merged = {};
            Object.values(bucket || {}).forEach((payload) => {
              (payload.slots || []).forEach((slot) => {
                merged[slot.slotId] = slot;
              });
            });
            return merged;
          }

          function renderDiff() {
            const referenceSlots = normalize(store.reference);
            const workingSlots = normalize(store.working);
            const slotIds = Array.from(new Set([...Object.keys(referenceSlots), ...Object.keys(workingSlots)]));
            if (!slotIds.length) return 'diff pending…';
            const lines = [];
            slotIds.forEach((slotId) => {
              const ref = referenceSlots[slotId];
              const work = workingSlots[slotId];
              if (!ref || !work) {
                lines.push(slotId + ': missing on ' + (!ref ? 'reference' : 'working'));
                return;
              }
              const dx = work.x - ref.x;
              const dy = work.y - ref.y;
              const dw = work.width - ref.width;
              const dh = work.height - ref.height;
              lines.push(
                slotId +
                  ' :: x ' + ref.x + ' -> ' + work.x + ' (' + (dx >= 0 ? '+' : '') + dx + ')' +
                  ', y ' + ref.y + ' -> ' + work.y + ' (' + (dy >= 0 ? '+' : '') + dy + ')' +
                  ', w ' + ref.width + ' -> ' + work.width + ' (' + (dw >= 0 ? '+' : '') + dw + ')' +
                  ', h ' + ref.height + ' -> ' + work.height + ' (' + (dh >= 0 ? '+' : '') + dh + ')'
              );
              if ((ref.rowGroups || []).length || (work.rowGroups || []).length) {
                lines.push('  rows ref=' + JSON.stringify(ref.rowGroups || []) + ' work=' + JSON.stringify(work.rowGroups || []));
              }
            });
            return lines.join('\\n');
          }

          function renderAudit() {
            if (!store.audit) return 'audit pending…';
            const audit = store.audit;
            const lines = [
              '[baseline-audit]',
              'overall=' + String(audit.overallStatus || 'unknown'),
              'pageStatus=' + String(audit.pageStatus || 'unknown'),
              'interactionStatus=' + String(audit.interactionStatus || 'unknown'),
            ];
            (audit.checks || []).forEach((check) => {
              lines.push('- ' + check.id + ' [' + check.status + '] ' + check.detail);
            });
            (audit.slots || []).forEach((slot) => {
              lines.push('* ' + slot.slotId + ' [' + slot.status + '] ' + slot.reason);
            });
            return lines.join('\\n');
          }

          function fitCanvases() {
            document.querySelectorAll('[data-compare-wrap]').forEach((wrap) => {
              const stage = wrap.querySelector('[data-compare-stage]');
              if (!stage) return;
              const available = wrap.clientWidth;
              const scale = Math.min(1, available / ${DEFAULT_CANVAS_WIDTH});
              stage.style.transform = 'scale(' + scale + ')';
              stage.style.height = (${DEFAULT_COMPARE_CANVAS_HEIGHT} * scale) + 'px';
            });
          }

          window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data || {};
            if (data.type !== 'codex:measure' || !data.payload) return;
            const payload = data.payload;
            if (payload.pageId && payload.pageId !== pageId) return;
            fetch('/api/measure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              keepalive: true
            }).catch(() => {});
            const bucket =
              payload.source === 'reference-content'
                ? 'reference'
                : 'working';
            store[bucket] = store[bucket] || {};
            store[bucket][payload.source] = payload;
            refresh();
          });

          seedReference();
          pollWorking();
          setInterval(pollWorking, 1200);
          workingFrame?.addEventListener('load', () => setTimeout(updateMeasurementStores, 200));
          referenceFrame?.addEventListener('load', () => setTimeout(updateMeasurementStores, 200));
          fitCanvases();
          window.addEventListener('resize', fitCanvases);
        })();
      </script>
    </div>
  </body>
</html>`;
  return sendRawHtml(res, 200, html);
}

function pickByLargestFileSize(assets) {
  let best = null;
  let bestSize = -1;
  for (const asset of assets) {
    const localPath = asset.localPath;
    if (!localPath) continue;
    try {
      const size = fs.statSync(localPath).size;
      if (size > bestSize) {
        best = asset;
        bestSize = size;
      }
    } catch {
      // ignore missing files
    }
  }
  return best;
}

function selectHeroAsset(assets) {
  const validImages = assets.filter((asset) => {
    if (!asset || !asset.localPath) return false;
    const kind = String(asset.kind || "").toLowerCase();
    const src = String(asset.src || "").toLowerCase();
    const alt = String(asset.alt || "").toLowerCase();
    if (kind && kind !== "image") return false;
    if (src.includes("logo") || alt.includes("로고") || alt.includes("logo")) return false;
    return true;
  });

  const keywordPriority = [
    "displayobject",
    "hero",
    "1760x500",
    "main",
    "pc_",
    "upload/admin/display",
  ];

  for (const keyword of keywordPriority) {
    const hit = validImages.find((asset) => String(asset.src || "").toLowerCase().includes(keyword));
    if (hit) return hit;
  }

  return pickByLargestFileSize(validImages) || pickByLargestFileSize(assets);
}

function route(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (pathname === "/" || pathname === "/preview") {
    return sendHtml(res, 200, "preview.html");
  }
  if (pathname === "/login") {
    return sendHtml(res, 200, "login.html");
  }
  if (pathname === "/admin") {
    if (!getUserFromRequest(req)) {
      return sendRedirect(res, "/login");
    }
    return sendHtml(res, 200, "admin.html");
  }
  if (pathname.startsWith("/reference-content/")) {
    const pageId = decodeURIComponent(pathname.slice("/reference-content/".length));
    return sendReferenceContent(res, pageId, requestUrl);
  }
  if (pathname.startsWith("/compare/")) {
    const pageId = decodeURIComponent(pathname.slice("/compare/".length));
    return sendCompareShell(res, pageId);
  }
  if (pathname === "/workbench/gnb") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const menu = requestUrl.searchParams.get("menu") || "제품/소모품";
    return sendGnbWorkbench(res, pageId, menu);
  }
  if (pathname === "/workbench/pdp") {
    const pageId = requestUrl.searchParams.get("pageId") || "category-tvs";
    const viewportProfile = requestUrl.searchParams.get("viewportProfile") || "pc";
    return sendPdpWorkbench(res, pageId, viewportProfile);
  }
  if (pathname === "/workbench/plp") {
    const pageId = requestUrl.searchParams.get("pageId") || "category-tvs";
    const viewportProfile = requestUrl.searchParams.get("viewportProfile") || "pc";
    return sendPlpWorkbench(res, pageId, viewportProfile);
  }
  if (pathname === "/workbench/service") {
    const pageId = requestUrl.searchParams.get("pageId") || "support";
    const viewportProfile = requestUrl.searchParams.get("viewportProfile") || "pc";
    return sendServicePageWorkbench(res, pageId, viewportProfile);
  }
  if (pathname === "/workbench/home") {
    return sendHomeWorkbench(res);
  }
  if (pathname === "/workbench/acceptance") {
    return sendAcceptanceWorkbench(res);
  }
  if (pathname === "/clone-product-content") {
    return sendCloneProductContent(req, res, requestUrl);
  }
  if (pathname === "/clone-product") {
    return sendCloneProductShell(req, res, requestUrl);
  }
  if (pathname.startsWith("/clone-content/")) {
    const pageId = decodeURIComponent(pathname.slice("/clone-content/".length));
    return sendCloneContent(req, res, pageId, requestUrl);
  }
  if (pathname === "/api/slot-snapshots") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const source = requestUrl.searchParams.get("source") || "reference";
    const snapshot = source === "working" ? buildWorkingSlotSnapshot(pageId) : readSlotSnapshot(pageId, source);
    if (!snapshot) {
      return sendJson(res, 404, { error: "slot_snapshot_not_found", pageId, source });
    }
    return sendJson(res, 200, snapshot);
  }
  if (pathname === "/api/interaction-snapshots") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const source = requestUrl.searchParams.get("source") || "reference";
    const snapshot = source === "working" ? buildWorkingInteractionSnapshot(pageId) : readInteractionSnapshot(pageId, source);
    if (!snapshot) {
      return sendJson(res, 404, { error: "interaction_snapshot_not_found", pageId, source });
    }
    return sendJson(res, 200, snapshot);
  }
  if (pathname === "/api/component-inventory") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const source = requestUrl.searchParams.get("source") || "working";
    if (source !== "working") {
      return sendJson(res, 400, { error: "component_inventory_source_not_supported", pageId, source });
    }
    return sendJson(res, 200, buildWorkingComponentInventory(pageId));
  }
  if (pathname === "/api/component-editability") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const source = requestUrl.searchParams.get("source") || "working";
    if (source !== "working") {
      return sendJson(res, 400, { error: "component_editability_source_not_supported", pageId, source });
    }
    return sendJson(res, 200, buildWorkingEditableComponentCatalog(pageId));
  }
  if (pathname === "/api/component-rollback") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const source = requestUrl.searchParams.get("source") || "working";
    if (source !== "working") {
      return sendJson(res, 400, { error: "component_rollback_source_not_supported", pageId, source });
    }
    return sendJson(res, 200, buildWorkingRollbackCatalog(pageId));
  }
  if (pathname === "/api/interaction-verification") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const source = requestUrl.searchParams.get("source") || "working";
    if (source !== "working") {
      return sendJson(res, 400, { error: "interaction_verification_source_not_supported", pageId, source });
    }
    return sendJson(res, 200, buildWorkingInteractionVerificationCatalog(pageId));
  }
  if (pathname === "/api/llm-readiness") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const source = requestUrl.searchParams.get("source") || "working";
    if (source !== "working") {
      return sendJson(res, 400, { error: "llm_readiness_source_not_supported", pageId, source });
    }
    return sendJson(res, 200, buildLlmReadinessReport(pageId));
  }
  if (pathname === "/api/baseline-url") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    return sendJson(res, 200, resolveBaselineInfo(pageId));
  }
  if (pathname === "/api/gnb-workbench") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const menu = requestUrl.searchParams.get("menu") || "제품/소모품";
    return sendJson(res, 200, buildGnbWorkbench(pageId, menu));
  }
  if (pathname === "/api/pdp-workbench") {
    const pageId = requestUrl.searchParams.get("pageId") || "category-tvs";
    const viewportProfile = requestUrl.searchParams.get("viewportProfile") || "pc";
    return sendJson(res, 200, buildPdpWorkbench(pageId, viewportProfile));
  }
  if (pathname === "/api/plp-workbench") {
    const pageId = requestUrl.searchParams.get("pageId") || "category-tvs";
    const viewportProfile = requestUrl.searchParams.get("viewportProfile") || "pc";
    return sendJson(res, 200, buildPlpWorkbench(pageId, viewportProfile));
  }
  if (pathname === "/api/service-workbench") {
    const pageId = requestUrl.searchParams.get("pageId") || "support";
    const viewportProfile = requestUrl.searchParams.get("viewportProfile") || "pc";
    return sendJson(res, 200, buildServicePageWorkbench(pageId, viewportProfile));
  }
  if (pathname === "/api/home-workbench") {
    return sendJson(res, 200, buildHomeWorkbench());
  }
  if (pathname === "/api/acceptance-summary") {
    return sendJson(res, 200, buildAcceptanceSummary());
  }
  if (pathname === "/api/baseline-audit") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    return sendJson(res, 200, buildBaselineAudit(pageId));
  }
  if (pathname === "/api/coverage") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    return sendJson(res, 200, buildCoverageModel(pageId));
  }
  if (pathname === "/api/slot-diff") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const diff = buildSlotDiff(pageId);
    if (!diff) {
      return sendJson(res, 404, { error: "slot_diff_not_found", pageId });
    }
    return sendJson(res, 200, diff);
  }
  if (pathname === "/api/interaction-coverage") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const coverage = buildCoverageModel(pageId);
    return sendJson(res, 200, {
      pageId,
      baseline: coverage.baseline,
      interactionStatus: coverage.interactionStatus,
      interactions: coverage.interactions,
    });
  }
  if (pathname === "/api/workbench-targets") {
    const targetType = String(requestUrl.searchParams.get("targetType") || "").trim();
    const pageId = String(requestUrl.searchParams.get("pageId") || "").trim();
    const viewportProfile = String(requestUrl.searchParams.get("viewportProfile") || "").trim();
    const payload = readWorkbenchTargets();
    let items = [...(payload.plpTargets || []), ...(payload.pdpTargets || [])];
    if (targetType) items = items.filter((item) => item.targetType === targetType);
    if (pageId) items = items.filter((item) => item.pageId === pageId);
    if (viewportProfile) items = items.filter((item) => item.viewportProfile === viewportProfile);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt || null,
      targetType: targetType || null,
      pageId: pageId || null,
      viewportProfile: viewportProfile || null,
      count: items.length,
      items,
    });
  }
  if (pathname === "/api/measurements") {
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    return sendJson(res, 200, {
      pageId,
      measurements: readMeasurements(pageId),
    });
  }
  if (pathname === "/api/measure" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        rememberMeasurement(payload);
        return sendJson(res, 200, { ok: true });
      })
      .catch((error) => sendJson(res, 500, { error: "measure_store_failed", detail: String(error) }));
  }
  if (pathname.startsWith("/clone/")) {
    const pageId = decodeURIComponent(pathname.slice("/clone/".length));
    return sendCloneShell(req, res, pageId, requestUrl);
  }
  if (pathname.startsWith("/p/")) {
    return sendHtml(res, 200, "page.html");
  }
  if (pathname.startsWith("/assets/")) {
    const fileName = pathname.slice("/assets/".length);
    const safeName = path.basename(fileName);
    const filePath = path.join(ASSET_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: "asset_not_found", file: safeName });
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".svg"
            ? "image/svg+xml"
            : ext === ".webp"
              ? "image/webp"
              : ext === ".gif"
                ? "image/gif"
                : "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  if (pathname.startsWith("/debug/gnb-state/")) {
    const relativePath = decodeURIComponent(pathname.slice("/debug/gnb-state/".length));
    const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(GNB_STATE_DIR, safePath);
    if (!filePath.startsWith(GNB_STATE_DIR) || !fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: "gnb_debug_not_found", file: safePath });
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".json"
            ? "application/json; charset=utf-8"
            : "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  if (pathname.startsWith("/visual/")) {
    const relativePath = decodeURIComponent(pathname.slice("/visual/".length));
    const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(VISUAL_DIR, safePath);
    if (!filePath.startsWith(VISUAL_DIR) || !fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: "visual_not_found", file: safePath });
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".json"
            ? "application/json; charset=utf-8"
            : "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  if (pathname === "/api/auth/session") {
    const user = getUserFromRequest(req);
    if (!user) return sendJson(res, 200, { authenticated: false, user: null });
    const workspace = getWorkspace(user.userId);
    return sendJson(res, 200, {
      authenticated: true,
      user: sanitizeUser(user),
      workspace: {
        base: workspace.base || "shared-default",
        ...buildWorkspaceMetaSummary(workspace),
      },
    });
  }
  if (pathname === "/api/auth/register" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const payload = body ? JSON.parse(body) : {};
        const user = registerUser(payload);
        const { token } = loginUser(payload);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Set-Cookie": buildSessionCookie(token),
        });
        res.end(JSON.stringify({ ok: true, user }, null, 2));
      })
      .catch((error) => sendJson(res, 400, { error: "register_failed", detail: String(error) }));
  }
  if (pathname === "/api/auth/login" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const payload = body ? JSON.parse(body) : {};
        const { user, token } = loginUser(payload);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Set-Cookie": buildSessionCookie(token),
        });
        res.end(JSON.stringify({ ok: true, user }, null, 2));
      })
      .catch((error) => sendJson(res, 400, { error: "login_failed", detail: String(error) }));
  }
  if (pathname === "/api/auth/logout" && req.method === "POST") {
    logoutUser(req);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": buildLogoutCookie(),
    });
    res.end(JSON.stringify({ ok: true }, null, 2));
    return;
  }
  if (pathname === "/api/workspace/reset" && req.method === "POST") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const shared = readEditableData();
    saveDataForUser(user, shared, "workspace_reset_to_shared_default");
    logEvent(user.userId, "workspace_reset", { base: "shared-default" });
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === "/api/workspace/history") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const workspace = getWorkspace(user.userId);
    return sendJson(res, 200, {
      items: (workspace.workHistory || []).slice(0, 50),
    });
  }
  if (pathname === "/api/workspace/plans") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = String(requestUrl.searchParams.get("pageId") || "").trim();
    const limit = Math.max(1, Math.min(200, Number(requestUrl.searchParams.get("limit") || 50)));
    return sendJson(res, 200, {
      items: listRequirementPlans(user.userId, { pageId, limit }),
    });
  }
  if (pathname === "/api/workspace/plan" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const pageId = String(payload.pageId || "").trim();
        if (!pageId) return sendJson(res, 400, { error: "page_id_required" });
        const saved = saveRequirementPlan(user.userId, payload);
        return sendJson(res, 200, { ok: true, item: saved });
      })
      .catch((error) => sendJson(res, 500, { error: "workspace_plan_save_failed", detail: String(error) }));
  }
  if (pathname === "/api/workspace/draft-builds") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = String(requestUrl.searchParams.get("pageId") || "").trim();
    const limit = Math.max(1, Math.min(200, Number(requestUrl.searchParams.get("limit") || 50)));
    return sendJson(res, 200, {
      items: listDraftBuilds(user.userId, { pageId, limit }),
    });
  }
  if (pathname === "/api/workspace/draft-build" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const pageId = String(payload.pageId || "").trim();
        if (!pageId) return sendJson(res, 400, { error: "page_id_required" });
        const saved = saveDraftBuild(user.userId, payload);
        return sendJson(res, 200, { ok: true, item: saved });
      })
      .catch((error) => sendJson(res, 500, { error: "workspace_draft_build_save_failed", detail: String(error) }));
  }
  if (pathname === "/api/workspace/versions") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = String(requestUrl.searchParams.get("pageId") || "").trim();
    const limit = Math.max(1, Math.min(200, Number(requestUrl.searchParams.get("limit") || 50)));
    return sendJson(res, 200, {
      items: listSavedVersions(user.userId, { pageId, limit }),
    });
  }
  if (pathname === "/api/workspace/version-save" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const pageId = String(payload.pageId || "").trim();
        if (!pageId) return sendJson(res, 400, { error: "page_id_required" });
        const currentData = readWorkspaceData(user.userId);
        const buildId = String(payload.buildId || "").trim();
        const draftBuild =
          buildId
            ? listDraftBuilds(user.userId, { pageId, limit: 200 }).find((item) => item.id === buildId) || null
            : null;
        const pageSnapshot =
          (payload.snapshotData && payload.snapshotData.pageSnapshot) ||
          draftBuild?.snapshotData?.pageSnapshot ||
          extractPageScopedSnapshot(currentData, pageId);
        const changedComponentIds = Array.isArray(payload.snapshotData?.changedComponentIds)
          ? payload.snapshotData.changedComponentIds.filter(Boolean)
          : Array.isArray(draftBuild?.snapshotData?.changedComponentIds)
            ? draftBuild.snapshotData.changedComponentIds.filter(Boolean)
            : [];
        if (!changedComponentIds.length) {
          return sendJson(res, 400, { error: "no_effect_build_cannot_save" });
        }
        const item = saveSavedVersion(user.userId, {
          ...payload,
          snapshotData: {
            ...(payload.snapshotData && typeof payload.snapshotData === "object" ? payload.snapshotData : {}),
            changedComponentIds,
            pageSnapshot,
          },
          createdBy: user.userId,
        });
        return sendJson(res, 200, { ok: true, item });
      })
      .catch((error) => sendJson(res, 500, { error: "workspace_version_save_failed", detail: String(error) }));
  }
  if (pathname === "/api/workspace/view-pin") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    if (req.method === "GET") {
      const pageId = String(requestUrl.searchParams.get("pageId") || "").trim();
      if (!pageId) return sendJson(res, 400, { error: "page_id_required" });
      return sendJson(res, 200, {
        item: getPinnedView(user.userId, pageId),
      });
    }
    if (req.method === "POST") {
      return readBody(req)
        .then((body) => {
          const payload = body ? JSON.parse(body) : {};
          const pageId = String(payload.pageId || "").trim();
          const versionId = String(payload.versionId || "").trim();
          const item = pinSavedVersion(user.userId, pageId, versionId);
          return sendJson(res, 200, { ok: true, item });
        })
        .catch((error) => sendJson(res, 500, { error: "workspace_view_pin_failed", detail: String(error) }));
    }
  }
  if (pathname === "/api/workspace/slot-registry") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const data = readWorkspaceData(user.userId);
    const registry = findSlotRegistry(data, pageId);
    if (!registry) return sendJson(res, 404, { error: "slot_registry_not_found", pageId });
    return sendJson(res, 200, registry);
  }
  if (pathname === "/api/workspace/slot-variants") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const slotId = requestUrl.searchParams.get("slotId") || "";
    const data = readWorkspaceData(user.userId);
    const slot = findSlotConfig(data, pageId, slotId);
    if (!slot) return sendJson(res, 404, { error: "slot_not_found", pageId, slotId });
    return sendJson(res, 200, {
      pageId,
      slotId,
      activeSourceId: slot.activeSourceId,
      sources: slot.sources || [],
    });
  }
  if (pathname === "/api/workspace/slot-source" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const pageId = String(payload.pageId || "home").trim() || "home";
        const slotId = String(payload.slotId || "").trim();
        const sourceId = String(payload.sourceId || "").trim();
        if (!slotId || !sourceId) {
          return sendJson(res, 400, { error: "slot_id_and_source_id_required" });
        }
        const data = readWorkspaceData(user.userId);
        const registry = findSlotRegistry(data, pageId);
        if (!registry) return sendJson(res, 404, { error: "slot_registry_not_found", pageId });
        const slot = (registry.slots || []).find((item) => item.slotId === slotId);
        if (!slot) return sendJson(res, 404, { error: "slot_not_found", pageId, slotId });
        if (!(slot.sources || []).some((source) => source.sourceId === sourceId)) {
          return sendJson(res, 400, { error: "source_not_found", pageId, slotId, sourceId });
        }
        const nextData = JSON.parse(JSON.stringify(data));
        const nextRegistry = findSlotRegistry(nextData, pageId);
        const nextSlot = (nextRegistry?.slots || []).find((item) => item.slotId === slotId);
        nextSlot.activeSourceId = sourceId;
        nextSlot.sources = (nextSlot.sources || []).map((source) => ({
          ...source,
          status:
            source.sourceId === sourceId
              ? "active"
              : source.sourceType === "captured"
                ? "validated"
                : "draft",
        }));
        saveDataForUser(user, nextData, `slot_source:${pageId}:${slotId}:${sourceId}`);
        return sendJson(res, 200, {
          ok: true,
          pageId,
          slotId,
          activeSourceId: nextSlot.activeSourceId,
          sources: nextSlot.sources,
        });
      })
      .catch((error) => sendJson(res, 500, { error: "workspace_slot_source_failed", detail: String(error) }));
  }
  if (pathname === "/api/workspace/component-inventory") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const data = readWorkspaceData(user.userId);
    return sendJson(res, 200, buildWorkingComponentInventory(pageId, { editableData: data }));
  }
  if (pathname === "/api/workspace/component-patches") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "";
    const componentId = requestUrl.searchParams.get("componentId") || "";
    const sourceId = requestUrl.searchParams.get("sourceId") || "";
    const data = readWorkspaceData(user.userId);
    if (componentId) {
      return sendJson(res, 200, {
        pageId,
        componentId,
        sourceId,
        patch: findComponentPatch(data, pageId, componentId, sourceId)?.patch || null,
      });
    }
    return sendJson(res, 200, {
      pageId,
      items: listComponentPatches(data, pageId),
    });
  }
  if (pathname === "/api/workspace/component-patch" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const pageId = String(payload.pageId || "").trim();
        const componentId = String(payload.componentId || "").trim();
        const sourceId = String(payload.sourceId || "").trim();
        const patch = payload.patch && typeof payload.patch === "object" ? payload.patch : null;
        if (!pageId || !componentId || !sourceId || !patch) {
          return sendJson(res, 400, { error: "page_id_component_id_source_id_patch_required" });
        }
        const data = readWorkspaceData(user.userId);
        const editableCatalog = buildWorkingEditableComponentCatalog(pageId, { editableData: data });
        const editable = (editableCatalog.components || []).find((item) => item.componentId === componentId);
        if (!editable) {
          return sendJson(res, 404, { error: "component_not_found", pageId, componentId });
        }
        const sanitizedPatch = sanitizeComponentPatch(patch, editable.patchSchema || {});
        const nextData = upsertComponentPatch(data, pageId, componentId, sourceId, sanitizedPatch);
        saveDataForUser(user, nextData, `component_patch:${pageId}:${componentId}:${sourceId}`);
        return sendJson(res, 200, {
          ok: true,
          pageId,
          componentId,
          sourceId,
          patch: sanitizedPatch,
          patchSchema: editable.patchSchema || { rootKeys: [], styleKeys: [] },
        });
      })
      .catch((error) => sendJson(res, 500, { error: "workspace_component_patch_failed", detail: String(error) }));
  }
  if (pathname === "/api/workspace/component-editability") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const data = readWorkspaceData(user.userId);
    return sendJson(res, 200, buildWorkingEditableComponentCatalog(pageId, { editableData: data }));
  }
  if (pathname === "/api/workspace/component-rollback") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const data = readWorkspaceData(user.userId);
    return sendJson(res, 200, buildWorkingRollbackCatalog(pageId, { editableData: data }));
  }
  if (pathname === "/api/workspace/interaction-verification") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    return sendJson(res, 200, buildWorkingInteractionVerificationCatalog(pageId));
  }
  if (pathname === "/api/workspace/llm-readiness") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const data = readWorkspaceData(user.userId);
    return sendJson(res, 200, buildLlmReadinessReport(pageId, { editableData: data }));
  }
  if (pathname === "/api/workspace/pre-llm-gaps") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const data = readWorkspaceData(user.userId);
    return sendJson(res, 200, buildPreLlmGapReport(pageId, { editableData: data }));
  }
  if (pathname === "/api/workspace/llm-editable-list") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const pageId = requestUrl.searchParams.get("pageId") || "home";
    const data = readWorkspaceData(user.userId);
    return sendJson(res, 200, buildLlmEditableList(pageId, { editableData: data }));
  }
  if (pathname === "/api/workspace/final-readiness") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const data = readWorkspaceData(user.userId);
    return sendJson(res, 200, buildFinalReadinessReport({ editableData: data }));
  }
  if (pathname === "/api/workspace/acceptance-results") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const data = readWorkspaceData(user.userId);
    const pageId = requestUrl.searchParams.get("pageId") || "";
    return sendJson(res, 200, buildAcceptanceResultsReport({ editableData: data, pageId }));
  }
  if (pathname === "/api/workspace/acceptance-queue") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const data = readWorkspaceData(user.userId);
    const pageId = requestUrl.searchParams.get("pageId") || "";
    return sendJson(res, 200, buildAcceptanceQueueReport({ editableData: data, pageId }));
  }
  if (pathname === "/api/workspace/acceptance-result" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const bundleId = String(payload.bundleId || "").trim();
        const status = String(payload.status || "pending").trim();
        const note = String(payload.note || "").trim();
        if (!bundleId) {
          return sendJson(res, 400, { error: "bundle_id_required" });
        }
        if (!["pass", "fail", "pending"].includes(status)) {
          return sendJson(res, 400, { error: "invalid_status" });
        }
        if (status === "fail" && !note) {
          return sendJson(res, 400, { error: "fail_note_required" });
        }
        const bundle = (buildFinalAcceptanceBundles().bundles || []).find((item) => item.bundleId === bundleId);
        if (!bundle) {
          return sendJson(res, 404, { error: "acceptance_bundle_not_found", bundleId });
        }
        const data = readWorkspaceData(user.userId);
        const nextData = upsertAcceptanceResult(data, bundle, status, note);
        saveDataForUser(user, nextData, `acceptance_result:${bundleId}:${status}`);
        logEvent(user.userId, "acceptance_result_saved", {
          bundleId,
          pageId: bundle.pageId,
          status,
          note,
        });
        return sendJson(res, 200, {
          ok: true,
          bundleId,
          pageId: bundle.pageId,
          status,
          note,
          results: buildAcceptanceResultsReport({ editableData: nextData, pageId: bundle.pageId }),
        });
      })
      .catch((error) => sendJson(res, 500, { error: "workspace_acceptance_result_failed", detail: String(error) }));
  }
  if (pathname === "/api/visual-batch-summary") {
    const summary = readVisualBatchSummary();
    if (!summary) {
      return sendJson(res, 404, { error: "visual_batch_summary_not_found" });
    }
    return sendJson(res, 200, summary);
  }
  if (pathname === "/api/visual-review-manifest") {
    return sendJson(res, 200, buildVisualReviewManifest());
  }
  if (pathname === "/api/final-acceptance-bundles") {
    return sendJson(res, 200, buildFinalAcceptanceBundles());
  }
  if (pathname === "/api/activity") {
    const user = requireAuthenticatedUser(req, res);
    if (!user) return;
    const limit = Math.max(1, Math.min(100, Number(requestUrl.searchParams.get("limit") || 30)));
    return sendJson(res, 200, {
      items: readUserActivity(user.userId, limit),
    });
  }
  if (pathname === "/api/data") {
    try {
      const { user, data, workspace, source } = readDataForRequest(req);
      const { linkMap, heroMap } = buildPageEnhancementMaps(data);
      const runtimePageSummary = buildRuntimePageSummary(data);
      const pageAdvisories = buildPageOperationalAdvisories();
      const includeCoverage = requestUrl.searchParams.get("includeCoverage") === "1";
      const coverageMap = includeCoverage
        ? Object.fromEntries((data.pages || []).map((page) => [page.id, buildCoverageModel(page.id)]))
        : undefined;
      return sendJson(res, 200, {
        ...data,
        linkMap,
        heroMap,
        runtimePageSummary,
        pageAdvisories,
        ...(includeCoverage ? { coverageMap } : {}),
        homePageId: (data.pages || []).find((p) => p.id === "home") ? "home" : (data.pages || [])[0]?.id,
        workspaceSource: source,
        currentUser: sanitizeUser(user),
        workspaceMeta: buildWorkspaceMetaSummary(workspace),
      });
    } catch (error) {
      return sendJson(res, 500, { error: "failed_to_read_data", detail: String(error) });
    }
  }
  if (pathname === "/api/llm/status") {
    return sendJson(res, 200, {
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
      plannerModel: process.env.PLANNER_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
      builderModel: process.env.BUILDER_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
    });
  }
  if (pathname === "/api/llm/plan" && req.method === "POST") {
    return readBody(req)
      .then(async (body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const pageId = String(payload.pageId || "").trim();
        const viewportProfile = String(payload.viewportProfile || "pc").trim() || "pc";
        const mode = String(payload.mode || "direct").trim() || "direct";
        const requestText = String(payload.requestText || "").trim();
        const keyMessage = String(payload.keyMessage || "").trim();
        const preferredDirection = String(payload.preferredDirection || "").trim();
        const avoidDirection = String(payload.avoidDirection || "").trim();
        const toneAndMood = String(payload.toneAndMood || "").trim();
        const referenceUrls = safeArray(payload.referenceUrls || [], 5);
        const designChangeLevel = normalizeDesignChangeLevel(payload.designChangeLevel, "medium");
        const targetScope = String(payload.targetScope || "page").trim() || "page";
        const targetComponents = safeArray(payload.targetComponents || [], 50)
          .map((item) => String(item || "").trim())
          .filter(Boolean);
        if (!pageId) {
          return sendJson(res, 400, { error: "page_id_required" });
        }
        if (!requestText && referenceUrls.length === 0) {
          return sendJson(res, 400, { error: "request_text_or_reference_required" });
        }
        const data = readWorkspaceData(user.userId);
        const page = findPage(data, pageId);
        if (!page) {
          return sendJson(res, 404, { error: "page_not_found", pageId });
        }
        const plannerInput = await buildPlannerInputPayload({
          user,
          editableData: data,
          pageId,
          viewportProfile,
          mode,
          requestText,
          keyMessage,
          preferredDirection,
          avoidDirection,
          toneAndMood,
          referenceUrls,
          designChangeLevel,
          targetScope,
          targetComponents,
        });
        const plannerResult = await handleLlmPlan(plannerInput);
        const savedPlan = saveRequirementPlan(user.userId, {
          pageId,
          viewportProfile,
          mode,
          status: "draft",
          title: plannerResult.requirementPlan?.title || "",
          summary: plannerResult.summary || "",
          input: plannerInput,
          output: {
            requirementPlan: plannerResult.requirementPlan || {},
            toolContext: {
              referenceSummary: plannerInput.referenceSummary,
              guardrailBundle: plannerInput.guardrailBundle,
            },
          },
        });
        incrementLlmUsage(user.userId, {
          kind: "planner",
          pageId,
          promptLength: requestText.length,
          referenceCount: referenceUrls.length,
        });
        logEvent(user.userId, "llm_plan_created", {
          pageId,
          planId: savedPlan?.id || null,
          referenceCount: referenceUrls.length,
          viewportProfile,
        });
        return sendJson(res, 200, {
          summary: plannerResult.summary || "요구사항 정리 완료",
          planId: savedPlan?.id || null,
          requirementPlan: plannerResult.requirementPlan || {},
          toolContext: {
            referenceSummary: plannerInput.referenceSummary,
            guardrailBundle: plannerInput.guardrailBundle,
          },
        });
      })
      .catch((error) => {
        return sendJson(res, 500, {
          error: "llm_plan_failed",
          detail: String(error),
        });
      });
  }
  if (pathname === "/api/llm/build" && req.method === "POST") {
    return readBody(req)
      .then(async (body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const pageId = String(payload.pageId || "").trim();
        const viewportProfile = String(payload.viewportProfile || "pc").trim() || "pc";
        const planId = String(payload.planId || "").trim();
        const intensity = String(payload.intensity || "balanced").trim() || "balanced";
        const versionLabelHint = String(payload.versionLabelHint || "").trim();
        if (!pageId) return sendJson(res, 400, { error: "page_id_required" });
        const data = readWorkspaceData(user.userId);
        const page = findPage(data, pageId);
        if (!page) return sendJson(res, 404, { error: "page_not_found", pageId });
        const savedPlans = listRequirementPlans(user.userId, { pageId, limit: 200 });
        const matchedPlan = planId
          ? savedPlans.find((item) => item.id === planId) || null
          : savedPlans[0] || null;
        const targetScope = String(payload.targetScope || matchedPlan?.input?.userInput?.targetScope || "page").trim() || "page";
        const designChangeLevel = normalizeDesignChangeLevel(
          payload.designChangeLevel ||
            payload.approvedPlan?.designChangeLevel ||
            matchedPlan?.output?.requirementPlan?.designChangeLevel ||
            matchedPlan?.input?.userInput?.designChangeLevel,
          "medium"
        );
        const targetComponents = safeArray(payload.targetComponents || matchedPlan?.input?.userInput?.targetComponents || [], 50)
          .map((item) => String(item || "").trim())
          .filter(Boolean);
        const approvedPlan =
          payload.approvedPlan && typeof payload.approvedPlan === "object"
            ? payload.approvedPlan
            : matchedPlan?.output?.requirementPlan || null;
        if (!approvedPlan) {
          return sendJson(res, 400, { error: "approved_plan_required" });
        }
        const builderInput = buildBuilderInputPayload({
          editableData: data,
          pageId,
          viewportProfile,
          approvedPlan,
          intensity,
          versionLabelHint,
          designChangeLevel,
          targetScope,
          targetComponents,
        });
        const buildResult = await handleLlmBuildOnData(builderInput, data);
        const changedComponentIds = Array.from(
          new Set(
            (buildResult.buildResult?.changedTargets || [])
              .map((item) => String(item.componentId || "").trim())
              .filter(Boolean)
          )
        );
        const pageSnapshot = extractPageScopedSnapshot(buildResult.data || data, pageId);
        const saved = saveDraftBuild(user.userId, {
          pageId,
          viewportProfile,
          planId: matchedPlan?.id || planId || "",
          status: "draft",
          summary: buildResult.summary || "",
          proposedVersionLabel: buildResult.buildResult?.proposedVersionLabel || "",
          operations: buildResult.buildResult?.operations || [],
          report: buildResult.buildResult?.report || {},
          snapshotData: {
            changedComponentIds,
            previewUrl: buildPreviewUrlForWorkspacePage(pageId),
            intensity,
            designChangeLevel,
            pageSnapshot,
          },
        });
        incrementLlmUsage(user.userId, {
          kind: "builder",
          pageId,
          planId: matchedPlan?.id || planId || null,
          operationCount: Array.isArray(buildResult.buildResult?.operations) ? buildResult.buildResult.operations.length : 0,
        });
        logEvent(user.userId, "llm_build_created", {
          pageId,
          draftBuildId: saved?.id || null,
          planId: matchedPlan?.id || planId || null,
          intensity,
        });
        return sendJson(res, 200, {
          summary: buildResult.summary || "시안 생성 완료",
          draftBuildId: saved?.id || null,
          buildResult: buildResult.buildResult || {},
        });
      })
      .catch((error) => {
        return sendJson(res, 500, {
          error: "llm_build_failed",
          detail: String(error),
        });
      });
  }
  if (pathname === "/api/llm/change" && req.method === "POST") {
    return readBody(req)
      .then(async (body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const prompt = String(payload.prompt || "").trim();
        if (!prompt) {
          return sendJson(res, 400, { error: "prompt_required" });
        }
        const workspace = getWorkspace(user.userId);
        const normalizedWorkspaceData = normalizeEditableData(workspace.data || {});
        const finalReadiness = buildFinalReadinessReport({ editableData: normalizedWorkspaceData });
        if (finalReadiness.llmGateStatus !== "ready-for-llm") {
          return sendJson(res, 400, {
            error: "llm_gate_blocked",
            detail: finalReadiness.llmGateStatus,
            nextActionablePageId: finalReadiness.nextActionablePageId || null,
            nextAcceptanceTarget: finalReadiness.nextAcceptanceTarget || null,
          });
        }
        const result = await handleLlmChangeOnData(prompt, normalizedWorkspaceData);
        saveDataForUser(user, result.data, result.summary || "llm_change");
        incrementLlmUsage(user.userId, { promptLength: prompt.length });
        logEvent(user.userId, "llm_change_applied", {
          summary: result.summary || "llm_change",
          operationCount: Array.isArray(result.operations) ? result.operations.length : 0,
        });
        return sendJson(res, 200, result);
      })
      .catch((error) => {
        return sendJson(res, 500, {
          error: "llm_change_failed",
          detail: String(error),
        });
      });
  }
  if (pathname === "/api/editor/page") {
    try {
      const user = requireAuthenticatedUser(req, res);
      if (!user) return;
      const pageId = requestUrl.searchParams.get("id") || "";
      const data = readWorkspaceData(user.userId);
      const page = findPage(data, pageId);
      if (!page) return sendJson(res, 404, { error: "page_not_found", pageId });
      return sendJson(res, 200, page);
    } catch (error) {
      return sendJson(res, 500, { error: "failed_to_read_editor_page", detail: String(error) });
    }
  }
  if (pathname === "/api/editor/toggle-section" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const data = readWorkspaceData(user.userId);
        const page = findPage(data, payload.pageId);
        if (!page) return sendJson(res, 404, { error: "page_not_found", pageId: payload.pageId });
        const nextPage = updatePageSections(page, (draft) => {
          const section = (draft.sections || []).find((item) => item.id === payload.sectionId);
          if (section) section.visible = Boolean(payload.visible);
        });
        const nextData = {
          ...data,
          pages: (data.pages || []).map((item) => (item.id === nextPage.id ? nextPage : item)),
        };
        saveDataForUser(user, nextData, `toggle_section:${payload.pageId}:${payload.sectionId}`);
        return sendJson(res, 200, { ok: true, page: nextPage });
      })
      .catch((error) => sendJson(res, 500, { error: "toggle_failed", detail: String(error) }));
  }
  if (pathname === "/api/editor/move-section" && req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const user = requireAuthenticatedUser(req, res);
        if (!user) return;
        const payload = body ? JSON.parse(body) : {};
        const data = readWorkspaceData(user.userId);
        const page = findPage(data, payload.pageId);
        if (!page) return sendJson(res, 404, { error: "page_not_found", pageId: payload.pageId });
        const nextPage = updatePageSections(page, (draft) => {
          const sections = draft.sections || [];
          const index = sections.findIndex((item) => item.id === payload.sectionId);
          if (index < 0) return;
          const swapIndex =
            payload.direction === "up" ? Math.max(0, index - 1) : Math.min(sections.length - 1, index + 1);
          if (swapIndex === index) return;
          const currentOrder = sections[index].order;
          sections[index].order = sections[swapIndex].order;
          sections[swapIndex].order = currentOrder;
        });
        const nextData = {
          ...data,
          pages: (data.pages || []).map((item) => (item.id === nextPage.id ? nextPage : item)),
        };
        saveDataForUser(user, nextData, `move_section:${payload.pageId}:${payload.sectionId}:${payload.direction}`);
        return sendJson(res, 200, { ok: true, page: nextPage });
      })
      .catch((error) => sendJson(res, 500, { error: "move_failed", detail: String(error) }));
  }
  if (pathname === "/api/page") {
    try {
      const pageId = requestUrl.searchParams.get("id") || "";
      const data = readEditableData();
      const page = data.pages.find((item) => item.id === pageId);
      if (!page) return sendJson(res, 404, { error: "page_not_found", pageId });
      const { linkMap, heroMap } = buildPageEnhancementMaps(data);
      return sendJson(res, 200, {
        ...page,
        linkedPageIds: linkMap[pageId] || [],
        heroImage: heroMap[pageId] || null,
      });
    } catch (error) {
      return sendJson(res, 500, { error: "failed_to_read_page", detail: String(error) });
    }
  }
  if (pathname === "/api/slot-registry") {
    try {
      const pageId = requestUrl.searchParams.get("pageId") || "home";
      const data = readEditableData();
      const registry = findSlotRegistry(data, pageId);
      if (!registry) return sendJson(res, 404, { error: "slot_registry_not_found", pageId });
      return sendJson(res, 200, registry);
    } catch (error) {
      return sendJson(res, 500, { error: "failed_to_read_slot_registry", detail: String(error) });
    }
  }
  if (pathname === "/api/slot-variants") {
    try {
      const pageId = requestUrl.searchParams.get("pageId") || "home";
      const slotId = requestUrl.searchParams.get("slotId") || "";
      const data = readEditableData();
      const registry = findSlotRegistry(data, pageId);
      const slot = (registry?.slots || []).find((item) => item.slotId === slotId);
      if (!slot) return sendJson(res, 404, { error: "slot_not_found", pageId, slotId });
      return sendJson(res, 200, {
        pageId,
        slotId,
        activeSourceId: slot.activeSourceId,
        sources: slot.sources || []
      });
    } catch (error) {
      return sendJson(res, 500, { error: "failed_to_read_slot_variants", detail: String(error) });
    }
  }
  if (pathname === "/api/clone-page") {
    try {
      const pageId = requestUrl.searchParams.get("id") || "";
      const data = readEditableData();
      const payload = buildClonePagePayload(pageId, data);
      if (!payload) return sendJson(res, 404, { error: "page_not_found", pageId });
      return sendJson(res, 200, payload);
    } catch (error) {
      return sendJson(res, 500, { error: "failed_to_build_clone_page", detail: String(error) });
    }
  }

  return sendJson(res, 404, { error: "not_found", path: pathname });
}

http.createServer(route).listen(PORT, HOST, () => {
  console.log(`server listening on http://localhost:${PORT}`);
  console.log("admin:   /admin");
  console.log("preview: /preview");
  console.log("page:    /p/<pageId>");
  console.log("clone:   /clone/<pageId>");
});
