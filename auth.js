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

function initializeWorkspace(userId) {
  const payload = readWorkspaces();
  const existing = (payload.workspaces || []).find((item) => item.userId === userId);
  if (existing) {
    existing.data = normalizeEditableData(existing.data || {});
    return existing;
  }
  const workspace = {
    userId,
    updatedAt: nowIso(),
    base: "shared-default",
    data: readEditableData(),
    llmUsageCount: 0,
    workHistory: [],
  };
  payload.workspaces.push(workspace);
  writeWorkspaces(payload);
  logEvent(userId, "workspace_initialized", { base: "shared-default" });
  return workspace;
}

function getWorkspace(userId) {
  const workspace = initializeWorkspace(userId);
  workspace.data = normalizeEditableData(workspace.data || {});
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
  workspace.data = nextData;
  workspace.updatedAt = nowIso();
  workspace.workHistory = Array.isArray(workspace.workHistory) ? workspace.workHistory : [];
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
  workspace.llmUsageCount = Number(workspace.llmUsageCount || 0) + 1;
  workspace.updatedAt = nowIso();
  writeWorkspaces(payload);
  logEvent(userId, "llm_usage", detail);
  return workspace.llmUsageCount;
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
};
