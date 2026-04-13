const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { normalizeEditableData, readEditableData, writeEditableData } = require("./llm");

const ROOT = __dirname;
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const USERS_PATH = path.join(RUNTIME_DIR, "users.json");
const SESSIONS_PATH = path.join(RUNTIME_DIR, "sessions.json");
const WORKSPACES_PATH = path.join(RUNTIME_DIR, "workspaces.json");
const ACTIVITY_PATH = path.join(RUNTIME_DIR, "activity-log.json");
const COOKIE_NAME = "lge_workspace_session";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

function nowIso() {
  return new Date().toISOString();
}

function toPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : {};
}

function toPlainArray(value) {
  return Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : [];
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function readUsers() {
  return readJson(USERS_PATH, { users: [] });
}

function writeUsers(payload) {
  writeJson(USERS_PATH, payload);
}

function readSessions() {
  return readJson(SESSIONS_PATH, { sessions: [] });
}

function writeSessions(payload) {
  writeJson(SESSIONS_PATH, payload);
}

function readWorkspaces() {
  return readJson(WORKSPACES_PATH, { workspaces: [] });
}

function writeWorkspaces(payload) {
  writeJson(WORKSPACES_PATH, payload);
}

function readActivityLog() {
  return readJson(ACTIVITY_PATH, { events: [] });
}

function writeActivityLog(payload) {
  writeJson(ACTIVITY_PATH, payload);
}

function readUserActivity(userId, limit = 50) {
  const payload = readActivityLog();
  return (payload.events || [])
    .filter((event) => event.userId === userId)
    .sort((a, b) => String(b.recordedAt || "").localeCompare(String(a.recordedAt || "")))
    .slice(0, Math.max(0, Number(limit) || 0));
}

function logEvent(userId, type, detail = {}) {
  const payload = readActivityLog();
  payload.events.push({
    id: crypto.randomUUID(),
    userId,
    type,
    detail,
    recordedAt: nowIso(),
  });
  writeActivityLog(payload);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return { salt, digest };
}

function verifyPassword(password, stored) {
  if (!stored?.salt || !stored?.digest) return false;
  const candidate = crypto.scryptSync(String(password || ""), stored.salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(stored.digest, "hex"));
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    userId: user.userId,
    loginId: user.loginId,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function parseCookies(req) {
  const raw = String(req?.headers?.cookie || "");
  const cookies = {};
  raw.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    cookies[key] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function createSession(userId) {
  const payload = readSessions();
  const token = crypto.randomBytes(24).toString("hex");
  payload.sessions = (payload.sessions || []).filter((item) => item.userId !== userId);
  payload.sessions.push({
    token,
    userId,
    createdAt: nowIso(),
  });
  writeSessions(payload);
  return token;
}

function clearSession(token) {
  if (!token) return;
  const payload = readSessions();
  payload.sessions = (payload.sessions || []).filter((item) => item.token !== token);
  writeSessions(payload);
}

function getSessionFromRequest(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  const payload = readSessions();
  return (payload.sessions || []).find((item) => item.token === token) || null;
}

function getUserById(userId) {
  const payload = readUsers();
  return (payload.users || []).find((item) => item.userId === userId) || null;
}

function getUserFromRequest(req) {
  const session = getSessionFromRequest(req);
  if (!session) return null;
  return getUserById(session.userId);
}

function normalizeHistoryEntry(entry) {
  return {
    id: String(entry?.id || crypto.randomUUID()),
    summary: String(entry?.summary || "workspace_update"),
    recordedAt: String(entry?.recordedAt || nowIso()),
  };
}

function normalizeRequirementPlan(plan) {
  return {
    id: String(plan?.id || crypto.randomUUID()),
    pageId: String(plan?.pageId || "").trim(),
    viewportProfile: String(plan?.viewportProfile || "pc").trim() || "pc",
    mode: String(plan?.mode || "direct").trim() || "direct",
    status: String(plan?.status || "draft").trim() || "draft",
    title: String(plan?.title || plan?.output?.title || "").trim(),
    input: toPlainObject(plan?.input),
    output: toPlainObject(plan?.output),
    summary: String(plan?.summary || "").trim(),
    createdAt: String(plan?.createdAt || nowIso()),
    updatedAt: String(plan?.updatedAt || plan?.createdAt || nowIso()),
  };
}

function normalizeDraftBuild(build) {
  return {
    id: String(build?.id || crypto.randomUUID()),
    pageId: String(build?.pageId || "").trim(),
    viewportProfile: String(build?.viewportProfile || "pc").trim() || "pc",
    planId: String(build?.planId || "").trim(),
    status: String(build?.status || "draft").trim() || "draft",
    summary: String(build?.summary || "").trim(),
    proposedVersionLabel: String(build?.proposedVersionLabel || "").trim(),
    operations: toPlainArray(build?.operations),
    report: toPlainObject(build?.report),
    snapshotData: toPlainObject(build?.snapshotData),
    createdAt: String(build?.createdAt || nowIso()),
    updatedAt: String(build?.updatedAt || build?.createdAt || nowIso()),
  };
}

function normalizeSavedVersion(version) {
  return {
    id: String(version?.id || crypto.randomUUID()),
    pageId: String(version?.pageId || "").trim(),
    viewportProfile: String(version?.viewportProfile || "pc").trim() || "pc",
    versionLabel: String(version?.versionLabel || "").trim(),
    planId: String(version?.planId || "").trim(),
    buildId: String(version?.buildId || "").trim(),
    summary: String(version?.summary || "").trim(),
    snapshotData: toPlainObject(version?.snapshotData),
    createdAt: String(version?.createdAt || nowIso()),
    createdBy: String(version?.createdBy || "").trim(),
  };
}

function normalizePinnedViewsByPage(value) {
  const next = {};
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  Object.entries(source).forEach(([pageId, entry]) => {
    const normalizedPageId = String(pageId || "").trim();
    if (!normalizedPageId) return;
    next[normalizedPageId] = {
      versionId: String(entry?.versionId || "").trim(),
      pinnedAt: String(entry?.pinnedAt || nowIso()),
    };
  });
  return next;
}

function normalizeWorkspaceRecord(workspace, { userId = "" } = {}) {
  const normalizedUserId = String(workspace?.userId || userId || "").trim();
  const normalized = {
    userId: normalizedUserId,
    updatedAt: String(workspace?.updatedAt || nowIso()),
    base: String(workspace?.base || "shared-default"),
    data: normalizeEditableData(workspace?.data || {}),
    llmUsageCount: Number(workspace?.llmUsageCount || 0),
    workHistory: toPlainArray(workspace?.workHistory).map(normalizeHistoryEntry).slice(0, 100),
    requirementPlans: toPlainArray(workspace?.requirementPlans).map(normalizeRequirementPlan).slice(0, 200),
    draftBuilds: toPlainArray(workspace?.draftBuilds).map(normalizeDraftBuild).slice(0, 200),
    savedVersions: toPlainArray(workspace?.savedVersions).map(normalizeSavedVersion).slice(0, 200),
    pinnedViewsByPage: normalizePinnedViewsByPage(workspace?.pinnedViewsByPage),
  };
  return normalized;
}

function ensureWorkspaceStorage(workspace, { userId = "" } = {}) {
  const normalized = normalizeWorkspaceRecord(workspace, { userId });
  Object.keys(workspace || {}).forEach((key) => {
    if (!(key in normalized)) delete workspace[key];
  });
  Object.assign(workspace, normalized);
  return workspace;
}

function initializeWorkspace(userId) {
  const payload = readWorkspaces();
  const existing = (payload.workspaces || []).find((item) => item.userId === userId);
  if (existing) {
    ensureWorkspaceStorage(existing, { userId });
    writeWorkspaces(payload);
    return existing;
  }
  const workspace = normalizeWorkspaceRecord({
    userId,
    updatedAt: nowIso(),
    base: "shared-default",
    data: readEditableData(),
    llmUsageCount: 0,
    workHistory: [],
    requirementPlans: [],
    draftBuilds: [],
    savedVersions: [],
    pinnedViewsByPage: {},
  });
  payload.workspaces.push(workspace);
  writeWorkspaces(payload);
  logEvent(userId, "workspace_initialized", { base: "shared-default" });
  return workspace;
}

function getWorkspace(userId) {
  const workspace = initializeWorkspace(userId);
  ensureWorkspaceStorage(workspace, { userId });
  return workspace;
}

function saveWorkspace(userId, data, changeSummary = "workspace_update") {
  const payload = readWorkspaces();
  const nextData = normalizeEditableData(JSON.parse(JSON.stringify(data)));
  let workspace = (payload.workspaces || []).find((item) => item.userId === userId);
  if (!workspace) {
    workspace = initializeWorkspace(userId);
    return saveWorkspace(userId, nextData, changeSummary);
  }
  ensureWorkspaceStorage(workspace, { userId });
  workspace.data = nextData;
  workspace.updatedAt = nowIso();
  workspace.workHistory.unshift({
    id: crypto.randomUUID(),
    summary: changeSummary,
    recordedAt: workspace.updatedAt,
  });
  workspace.workHistory = workspace.workHistory.slice(0, 100);
  writeWorkspaces(payload);
  logEvent(userId, "workspace_saved", { summary: changeSummary });
  return workspace;
}

function incrementLlmUsage(userId, detail = {}) {
  const payload = readWorkspaces();
  const workspace = (payload.workspaces || []).find((item) => item.userId === userId) || initializeWorkspace(userId);
  ensureWorkspaceStorage(workspace, { userId });
  workspace.llmUsageCount = Number(workspace.llmUsageCount || 0) + 1;
  workspace.updatedAt = nowIso();
  writeWorkspaces(payload);
  logEvent(userId, "llm_usage", detail);
  return workspace.llmUsageCount;
}

function updateWorkspaceMeta(userId, mutator, { logType = "", logDetail = {}, historySummary = "" } = {}) {
  const payload = readWorkspaces();
  let workspace = (payload.workspaces || []).find((item) => item.userId === userId);
  if (!workspace) {
    workspace = initializeWorkspace(userId);
    return updateWorkspaceMeta(userId, mutator, { logType, logDetail, historySummary });
  }
  ensureWorkspaceStorage(workspace, { userId });
  const result = typeof mutator === "function" ? mutator(workspace) : null;
  workspace.updatedAt = nowIso();
  if (historySummary) {
    workspace.workHistory.unshift({
      id: crypto.randomUUID(),
      summary: historySummary,
      recordedAt: workspace.updatedAt,
    });
    workspace.workHistory = workspace.workHistory.slice(0, 100);
  }
  writeWorkspaces(payload);
  if (logType) logEvent(userId, logType, logDetail);
  return { workspace, result };
}

function listRequirementPlans(userId, { pageId = "", limit = 50 } = {}) {
  const workspace = getWorkspace(userId);
  const normalizedPageId = String(pageId || "").trim();
  const items = (workspace.requirementPlans || [])
    .filter((item) => !normalizedPageId || item.pageId === normalizedPageId)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, Math.max(0, Number(limit) || 0));
  return items;
}

function saveRequirementPlan(userId, planInput = {}) {
  const normalizedInput = normalizeRequirementPlan(planInput);
  const { workspace, result } = updateWorkspaceMeta(
    userId,
    (draft) => {
      const items = Array.isArray(draft.requirementPlans) ? draft.requirementPlans : [];
      const existingIndex = items.findIndex((item) => item.id === normalizedInput.id);
      const existing = existingIndex >= 0 ? items[existingIndex] : null;
      const nextPlan = normalizeRequirementPlan({
        ...(existing || {}),
        ...normalizedInput,
        createdAt: existing?.createdAt || normalizedInput.createdAt || nowIso(),
        updatedAt: nowIso(),
      });
      if (existingIndex >= 0) items.splice(existingIndex, 1);
      items.unshift(nextPlan);
      draft.requirementPlans = items.slice(0, 200);
      return nextPlan;
    },
    {
      logType: "workspace_requirement_plan_saved",
      logDetail: { pageId: normalizedInput.pageId, planId: normalizedInput.id },
      historySummary: `requirement_plan:${normalizedInput.pageId || "unknown"}:${normalizedInput.id}`,
    }
  );
  return result || (workspace.requirementPlans || [])[0] || null;
}

function listDraftBuilds(userId, { pageId = "", limit = 50 } = {}) {
  const workspace = getWorkspace(userId);
  const normalizedPageId = String(pageId || "").trim();
  return (workspace.draftBuilds || [])
    .filter((item) => !normalizedPageId || item.pageId === normalizedPageId)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, Math.max(0, Number(limit) || 0));
}

function saveDraftBuild(userId, buildInput = {}) {
  const normalizedInput = normalizeDraftBuild(buildInput);
  const { workspace, result } = updateWorkspaceMeta(
    userId,
    (draft) => {
      const items = Array.isArray(draft.draftBuilds) ? draft.draftBuilds : [];
      const existingIndex = items.findIndex((item) => item.id === normalizedInput.id);
      const existing = existingIndex >= 0 ? items[existingIndex] : null;
      const nextBuild = normalizeDraftBuild({
        ...(existing || {}),
        ...normalizedInput,
        createdAt: existing?.createdAt || normalizedInput.createdAt || nowIso(),
        updatedAt: nowIso(),
      });
      if (existingIndex >= 0) items.splice(existingIndex, 1);
      items.unshift(nextBuild);
      draft.draftBuilds = items.slice(0, 200);
      return nextBuild;
    },
    {
      logType: "workspace_draft_build_saved",
      logDetail: { pageId: normalizedInput.pageId, buildId: normalizedInput.id, planId: normalizedInput.planId || null },
      historySummary: `draft_build:${normalizedInput.pageId || "unknown"}:${normalizedInput.id}`,
    }
  );
  return result || (workspace.draftBuilds || [])[0] || null;
}

function listSavedVersions(userId, { pageId = "", limit = 50 } = {}) {
  const workspace = getWorkspace(userId);
  const normalizedPageId = String(pageId || "").trim();
  return (workspace.savedVersions || [])
    .filter((item) => !normalizedPageId || item.pageId === normalizedPageId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, Math.max(0, Number(limit) || 0));
}

function saveSavedVersion(userId, versionInput = {}) {
  const normalizedInput = normalizeSavedVersion(versionInput);
  const { workspace, result } = updateWorkspaceMeta(
    userId,
    (draft) => {
      const items = Array.isArray(draft.savedVersions) ? draft.savedVersions : [];
      const existingIndex = items.findIndex((item) => item.id === normalizedInput.id);
      const existing = existingIndex >= 0 ? items[existingIndex] : null;
      const nextVersion = normalizeSavedVersion({
        ...(existing || {}),
        ...normalizedInput,
        createdAt: existing?.createdAt || normalizedInput.createdAt || nowIso(),
      });
      if (existingIndex >= 0) items.splice(existingIndex, 1);
      items.unshift(nextVersion);
      draft.savedVersions = items.slice(0, 200);
      return nextVersion;
    },
    {
      logType: "workspace_saved_version_saved",
      logDetail: { pageId: normalizedInput.pageId, versionId: normalizedInput.id, versionLabel: normalizedInput.versionLabel || null },
      historySummary: `saved_version:${normalizedInput.pageId || "unknown"}:${normalizedInput.id}`,
    }
  );
  return result || (workspace.savedVersions || [])[0] || null;
}

function pinSavedVersion(userId, pageId, versionId) {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedVersionId = String(versionId || "").trim();
  if (!normalizedPageId || !normalizedVersionId) {
    throw new Error("page_id_and_version_id_required");
  }
  const workspace = getWorkspace(userId);
  const version = (workspace.savedVersions || []).find(
    (item) => item.pageId === normalizedPageId && item.id === normalizedVersionId
  );
  if (!version) {
    throw new Error("saved_version_not_found");
  }
  const changedComponentIds = Array.isArray(version?.snapshotData?.changedComponentIds)
    ? version.snapshotData.changedComponentIds.filter(Boolean)
    : [];
  if (!changedComponentIds.length) {
    throw new Error("cannot_pin_empty_version");
  }
  const { result } = updateWorkspaceMeta(
    userId,
    (draft) => {
      draft.pinnedViewsByPage = normalizePinnedViewsByPage(draft.pinnedViewsByPage);
      draft.pinnedViewsByPage[normalizedPageId] = {
        versionId: normalizedVersionId,
        pinnedAt: nowIso(),
      };
      return {
        pageId: normalizedPageId,
        versionId: normalizedVersionId,
        pinnedAt: draft.pinnedViewsByPage[normalizedPageId].pinnedAt,
      };
    },
    {
      logType: "workspace_view_pinned",
      logDetail: { pageId: normalizedPageId, versionId: normalizedVersionId },
      historySummary: `view_pin:${normalizedPageId}:${normalizedVersionId}`,
    }
  );
  return result;
}

function getPinnedView(userId, pageId) {
  const workspace = getWorkspace(userId);
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return null;
  const pin = workspace.pinnedViewsByPage?.[normalizedPageId] || null;
  if (!pin?.versionId) return null;
  const version = (workspace.savedVersions || []).find(
    (item) => item.pageId === normalizedPageId && item.id === pin.versionId
  ) || null;
  return {
    pageId: normalizedPageId,
    versionId: pin.versionId,
    pinnedAt: pin.pinnedAt || null,
    version,
  };
}

function registerUser({ loginId, password, displayName }) {
  const normalizedLoginId = normalizeLoginId(loginId);
  if (!normalizedLoginId) throw new Error("login_id_required");
  if (!password || String(password).length < 4) throw new Error("password_too_short");
  const payload = readUsers();
  if ((payload.users || []).some((item) => item.loginId === normalizedLoginId)) {
    throw new Error("login_id_exists");
  }
  const passwordHash = hashPassword(password);
  const user = {
    userId: crypto.randomUUID(),
    loginId: normalizedLoginId,
    displayName: String(displayName || normalizedLoginId).trim() || normalizedLoginId,
    passwordHash,
    createdAt: nowIso(),
  };
  payload.users.push(user);
  writeUsers(payload);
  initializeWorkspace(user.userId);
  logEvent(user.userId, "register", { loginId: normalizedLoginId });
  return sanitizeUser(user);
}

function loginUser({ loginId, password }) {
  const normalizedLoginId = normalizeLoginId(loginId);
  const payload = readUsers();
  const user = (payload.users || []).find((item) => item.loginId === normalizedLoginId);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("invalid_credentials");
  }
  const token = createSession(user.userId);
  initializeWorkspace(user.userId);
  logEvent(user.userId, "login", { loginId: normalizedLoginId });
  return { user: sanitizeUser(user), token };
}

function logoutUser(req) {
  const session = getSessionFromRequest(req);
  if (session) {
    clearSession(session.token);
    logEvent(session.userId, "logout", {});
  }
}

function buildSessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`;
}

function buildLogoutCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

module.exports = {
  COOKIE_NAME,
  parseCookies,
  getSessionFromRequest,
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
};
