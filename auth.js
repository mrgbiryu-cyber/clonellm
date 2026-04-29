const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { normalizeEditableData, readEditableData, writeEditableData } = require("./llm");

const ROOT = __dirname;
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const USERS_PATH = path.join(RUNTIME_DIR, "users.json");
const SESSIONS_PATH = path.join(RUNTIME_DIR, "sessions.json");
const WORKSPACES_PATH = path.join(RUNTIME_DIR, "workspaces.json");
const WORKSPACE_SHARDS_DIR = path.join(RUNTIME_DIR, "workspaces");
const WORKSPACE_LOCKS_DIR = path.join(WORKSPACE_SHARDS_DIR, ".locks");
const ACTIVITY_PATH = path.join(RUNTIME_DIR, "activity-log.json");
const COOKIE_NAME = "lge_workspace_session";
let workspaceStoreCache = null;
let workspaceStoreCacheStat = null;
const workspaceShardCache = new Map();
const WORKSPACE_SHARD_CACHE_MAX = 20;
const WORKSPACE_LOCK_STALE_MS = 2 * 60 * 1000;
const WORKSPACE_LOCK_TIMEOUT_MS = 30 * 1000;
const MAX_SESSIONS_PER_USER = 8;

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
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

function sleepSync(ms) {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, Math.max(1, Number(ms || 1)));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeViewportProfile(value, fallback = "pc") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (normalized === "pc" || normalized === "mo" || normalized === "ta") return normalized;
  return fallback;
}

function resolveWorkspaceViewportKey(pageId, viewportProfile = "pc") {
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return "";
  return `${normalizedPageId}@${normalizeViewportProfile(viewportProfile, "pc")}`;
}

function toPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : {};
}

function toPlainArray(value) {
  return Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : [];
}

function normalizeGeneratedAssetEntry(item) {
  return {
    id: String(item?.id || "").trim(),
    label: String(item?.label || "").trim(),
    assetUrl: String(item?.assetUrl || "").trim(),
    kind: String(item?.kind || "").trim(),
    role: String(item?.role || "").trim(),
    source: String(item?.source || "").trim(),
    model: String(item?.model || "").trim(),
    prompt: String(item?.prompt || "").trim(),
    format: String(item?.format || "").trim(),
    width: Number(item?.width || 0) || 0,
    height: Number(item?.height || 0) || 0,
    aspectRatio: String(item?.aspectRatio || "").trim(),
    slotId: String(item?.slotId || "").trim(),
    componentId: String(item?.componentId || "").trim(),
    tags: Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [],
  };
}

function mergeGeneratedAssetsIntoDraftReport(report, snapshotData) {
  const nextReport = toPlainObject(report);
  const generatedAssets = toPlainArray(snapshotData?.generatedAssets)
    .map((item) => normalizeGeneratedAssetEntry(item))
    .filter((item) => item.assetUrl);
  if (!generatedAssets.length) return nextReport;
  const generatedByComponent = new Map(
    generatedAssets.map((item) => [`${item.componentId}::${item.slotId}`, item])
  );
  const nextComponentComposition = toPlainArray(nextReport.componentComposition).map((item) => {
    const nextItem = toPlainObject(item);
    const key = `${String(nextItem.componentId || "").trim()}::${String(nextItem.slotId || "").trim()}`;
    const generated = generatedByComponent.get(key);
    if (!generated) return nextItem;
    const assetPlan = toPlainObject(nextItem.assetPlan);
    const existingGenerated = toPlainArray(assetPlan.generatedAssets)
      .map((entry) => normalizeGeneratedAssetEntry(entry))
      .filter((entry) => entry.assetUrl && entry.id !== generated.id);
    return {
      ...nextItem,
      assetPlan: {
        ...assetPlan,
        generatedAssets: [generated, ...existingGenerated],
      },
    };
  });
  const assetReferences = toPlainObject(nextReport.assetReferences);
  const existingReportGenerated = toPlainArray(assetReferences.generatedAssets)
    .map((entry) => normalizeGeneratedAssetEntry(entry))
    .filter((entry) => entry.assetUrl);
  return {
    ...nextReport,
    componentComposition: nextComponentComposition,
    assetReferences: {
      ...assetReferences,
      generatedAssets: [
        ...existingReportGenerated,
        ...generatedAssets.filter((item) => !existingReportGenerated.some((entry) => entry.id === item.id)),
      ],
    },
  };
}

function normalizePlanLine(value, maxLength = 480) {
  const text = String(value || "")
    .replace(/�+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.slice(0, maxLength);
}

function tokenizePlanLine(value = "") {
  return normalizePlanLine(value, 600)
    .toLowerCase()
    .replace(/[`"'“”‘’.,:;!?()[\]{}<>|/\\_-]+/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function planLineSimilarity(left = "", right = "") {
  const leftTokens = new Set(tokenizePlanLine(left));
  const rightTokens = new Set(tokenizePlanLine(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

function sanitizePlanLineArray(value, { limit = 8, maxLength = 480 } = {}) {
  const source = Array.isArray(value) ? value : [];
  const next = [];
  for (const raw of source) {
    const line = normalizePlanLine(raw, maxLength);
    if (!line) continue;
    if (next.some((existing) => existing === line || planLineSimilarity(existing, line) >= 0.9)) {
      continue;
    }
    next.push(line);
    if (next.length >= limit) break;
  }
  return next;
}

function sanitizePlannerPriorityItems(value, limit = 6) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((item, index) => ({
      rank: Number(item?.rank || index + 1) || index + 1,
      target: normalizePlanLine(item?.target || "", 120),
      reason: normalizePlanLine(item?.reason || "", 320),
    }))
    .filter((item) => item.target)
    .slice(0, limit);
}

function sanitizeReferenceNotes(value, limit = 5) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((item) => ({
      url: normalizePlanLine(item?.url || "", 320),
      takeaways: sanitizePlanLineArray(item?.takeaways, { limit: 5, maxLength: 240 }),
    }))
    .filter((item) => item.url || item.takeaways.length)
    .slice(0, limit);
}

function sanitizeSectionBlueprints(value, limit = 8) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((item, index) => ({
      order: Number(item?.order || index + 1) || index + 1,
      slotId: normalizePlanLine(item?.slotId || "", 120),
      label: normalizePlanLine(item?.label || "", 160),
      archetype: normalizePlanLine(item?.archetype || "", 80),
      containerMode: normalizePlanLine(item?.containerMode || "", 80),
      objective: normalizePlanLine(item?.objective || "", 320),
      problemStatement: normalizePlanLine(item?.problemStatement || "", 320),
      visualDirection: normalizePlanLine(item?.visualDirection || "", 320),
      mustKeep: normalizePlanLine(item?.mustKeep || "", 240),
      mustChange: normalizePlanLine(item?.mustChange || "", 240),
      hierarchy: sanitizePlanLineArray(item?.hierarchy, { limit: 6, maxLength: 120 }),
      actionCue: normalizePlanLine(item?.actionCue || "", 80),
    }))
    .filter((item) => item.label || item.slotId)
    .slice(0, limit);
}

function sanitizeRequirementPlanOutput(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const builderBrief = source.builderBrief && typeof source.builderBrief === "object" ? source.builderBrief : {};
  return {
    ...JSON.parse(JSON.stringify(source)),
    title: normalizePlanLine(source.title || "", 200),
    designChangeLevel: normalizePlanLine(source.designChangeLevel || "", 20) || "medium",
    requestSummary: sanitizePlanLineArray(source.requestSummary, { limit: 7, maxLength: 360 }),
    planningDirection: sanitizePlanLineArray(source.planningDirection, { limit: 8, maxLength: 520 }),
    designDirection: sanitizePlanLineArray(source.designDirection, { limit: 8, maxLength: 520 }),
    priority: sanitizePlannerPriorityItems(source.priority, 6),
    guardrails: sanitizePlanLineArray(source.guardrails, { limit: 6, maxLength: 240 }),
    referenceNotes: sanitizeReferenceNotes(source.referenceNotes, 5),
    builderBrief: {
      ...JSON.parse(JSON.stringify(builderBrief)),
      objective: normalizePlanLine(builderBrief.objective || "", 320),
      mustKeep: sanitizePlanLineArray(builderBrief.mustKeep, { limit: 5, maxLength: 240 }),
      mustChange: sanitizePlanLineArray(builderBrief.mustChange, { limit: 5, maxLength: 240 }),
      suggestedFocusSlots: sanitizePlanLineArray(builderBrief.suggestedFocusSlots, { limit: 8, maxLength: 80 }),
    },
    builderMarkdown: String(source.builderMarkdown || "").slice(0, 32000),
    layoutMockupMarkdown: String(source.layoutMockupMarkdown || "").slice(0, 32000),
    designSpecMarkdown: String(source.designSpecMarkdown || "").slice(0, 32000),
    sectionBlueprints: sanitizeSectionBlueprints(source.sectionBlueprints, 24),
  };
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

function buildWorkspaceShardFileName(userId = "") {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return "";
  if (/^[a-zA-Z0-9._-]+$/.test(normalizedUserId)) return `${normalizedUserId}.json`;
  return `${crypto.createHash("sha1").update(normalizedUserId).digest("hex")}.json`;
}

function buildWorkspaceStorageBaseName(userId = "") {
  return buildWorkspaceShardFileName(userId).replace(/\.json$/, "");
}

function getWorkspaceShardPath(userId = "") {
  const fileName = buildWorkspaceShardFileName(userId);
  return fileName ? path.join(WORKSPACE_SHARDS_DIR, fileName) : "";
}

function getWorkspaceLockPath(userId = "") {
  const baseName = buildWorkspaceStorageBaseName(userId);
  return baseName ? path.join(WORKSPACE_LOCKS_DIR, `${baseName}.lock`) : "";
}

function acquireWorkspaceWriteLock(userId = "") {
  const lockPath = getWorkspaceLockPath(userId);
  if (!lockPath) return () => {};
  ensureDir(WORKSPACE_LOCKS_DIR);
  const startedAt = Date.now();
  while (true) {
    try {
      fs.mkdirSync(lockPath);
      fs.writeFileSync(path.join(lockPath, "owner.json"), JSON.stringify({
        pid: process.pid,
        userId: String(userId || "").trim(),
        acquiredAt: nowIso(),
      }));
      return () => {
        try {
          fs.rmSync(lockPath, { recursive: true, force: true });
        } catch {}
      };
    } catch (error) {
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - Number(stat.mtimeMs || 0) > WORKSPACE_LOCK_STALE_MS) {
          fs.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {}
      if (Date.now() - startedAt > WORKSPACE_LOCK_TIMEOUT_MS) {
        throw new Error("workspace_write_lock_timeout");
      }
      sleepSync(25);
    }
  }
}

function withWorkspaceWriteLock(userId = "", fn) {
  const release = acquireWorkspaceWriteLock(userId);
  try {
    return typeof fn === "function" ? fn() : undefined;
  } finally {
    release();
  }
}

function getFileSignature(filePath = "") {
  try {
    const stat = fs.statSync(filePath);
    return `${Number(stat.mtimeMs || 0)}:${Number(stat.size || 0)}`;
  } catch {
    return "";
  }
}

function rememberWorkspaceShard(userId = "", filePath = "", workspace = null) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || !workspace) return;
  workspaceShardCache.delete(normalizedUserId);
  workspaceShardCache.set(normalizedUserId, {
    signature: getFileSignature(filePath),
    workspace,
  });
  while (workspaceShardCache.size > WORKSPACE_SHARD_CACHE_MAX) {
    const oldestKey = workspaceShardCache.keys().next().value;
    workspaceShardCache.delete(oldestKey);
  }
}

function readWorkspaceShard(userId = "") {
  const normalizedUserId = String(userId || "").trim();
  const filePath = getWorkspaceShardPath(normalizedUserId);
  if (!normalizedUserId || !filePath || !fs.existsSync(filePath)) return null;
  const signature = getFileSignature(filePath);
  const cached = workspaceShardCache.get(normalizedUserId);
  if (cached && cached.signature === signature) {
    workspaceShardCache.delete(normalizedUserId);
    workspaceShardCache.set(normalizedUserId, cached);
    return cached.workspace;
  }
  const workspace = readJson(filePath, null);
  if (!workspace || typeof workspace !== "object") return null;
  rememberWorkspaceShard(normalizedUserId, filePath, workspace);
  return workspace;
}

function writeWorkspaceShard(userId = "", workspace = null) {
  const normalizedUserId = String(userId || workspace?.userId || "").trim();
  const filePath = getWorkspaceShardPath(normalizedUserId);
  if (!normalizedUserId || !filePath || !workspace) return null;
  const normalizedWorkspace = normalizeWorkspaceRecord(workspace, { userId: normalizedUserId });
  const hasFullRequirementPlans = normalizedWorkspace.requirementPlans.some((item) =>
    Boolean(item?.builderMarkdown || item?.designSpecMarkdown || item?.output?.requirementPlan?.builderMarkdown || item?.output?.requirementPlan?.designSpecMarkdown)
  );
  const hasFullDraftBuilds = normalizedWorkspace.draftBuilds.some((item) =>
    Boolean(item?.snapshotData && Object.keys(item.snapshotData).length)
  );
  if (hasFullRequirementPlans) writeWorkspaceCollection(normalizedUserId, "requirementPlans", normalizedWorkspace.requirementPlans);
  if (hasFullDraftBuilds) writeWorkspaceCollection(normalizedUserId, "draftBuilds", normalizedWorkspace.draftBuilds);
  normalizedWorkspace.requirementPlans = normalizedWorkspace.requirementPlans.map(summarizeRequirementPlanRecord);
  normalizedWorkspace.draftBuilds = normalizedWorkspace.draftBuilds.map(summarizeDraftBuildRecord);
  writeJson(filePath, normalizedWorkspace);
  rememberWorkspaceShard(normalizedUserId, filePath, normalizedWorkspace);
  return normalizedWorkspace;
}

function getWorkspaceCollectionPath(userId = "", collectionName = "") {
  const baseName = buildWorkspaceStorageBaseName(userId);
  const normalizedCollectionName = String(collectionName || "").trim();
  if (!baseName || !/^(requirementPlans|draftBuilds)$/.test(normalizedCollectionName)) return "";
  return path.join(WORKSPACE_SHARDS_DIR, `${baseName}.${normalizedCollectionName}.json`);
}

function getWorkspaceCollectionIndexPath(userId = "", collectionName = "") {
  const baseName = buildWorkspaceStorageBaseName(userId);
  const normalizedCollectionName = String(collectionName || "").trim();
  if (!baseName || !/^(requirementPlans|draftBuilds)$/.test(normalizedCollectionName)) return "";
  return path.join(WORKSPACE_SHARDS_DIR, `${baseName}.${normalizedCollectionName}.index.json`);
}

function getWorkspaceCollectionItemPath(userId = "", collectionName = "", itemId = "") {
  const baseName = buildWorkspaceStorageBaseName(userId);
  const normalizedCollectionName = String(collectionName || "").trim();
  const normalizedItemId = String(itemId || "").trim();
  if (!baseName || !/^(requirementPlans|draftBuilds)$/.test(normalizedCollectionName) || !normalizedItemId) return "";
  const safeItemId = /^[a-zA-Z0-9._-]+$/.test(normalizedItemId)
    ? normalizedItemId
    : crypto.createHash("sha1").update(normalizedItemId).digest("hex");
  return path.join(WORKSPACE_SHARDS_DIR, `${baseName}.${normalizedCollectionName}.${safeItemId}.json`);
}

function normalizeWorkspaceCollectionItem(collectionName = "", item = {}) {
  if (collectionName === "requirementPlans") return normalizeRequirementPlan(item);
  if (collectionName === "draftBuilds") return normalizeDraftBuild(item);
  return item;
}

function readWorkspaceCollectionItem(userId = "", collectionName = "", itemId = "") {
  const filePath = getWorkspaceCollectionItemPath(userId, collectionName, itemId);
  if (filePath && fs.existsSync(filePath)) {
    const payload = readJson(filePath, null);
    const item = payload?.item && typeof payload.item === "object" ? payload.item : payload;
    return item ? normalizeWorkspaceCollectionItem(collectionName, item) : null;
  }
  const gzipPath = filePath ? `${filePath}.gz` : "";
  if (gzipPath && fs.existsSync(gzipPath)) {
    try {
      const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(gzipPath)).toString("utf8"));
      const item = payload?.item && typeof payload.item === "object" ? payload.item : payload;
      return item ? normalizeWorkspaceCollectionItem(collectionName, item) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function writeWorkspaceCollectionItem(userId = "", collectionName = "", item = {}) {
  const itemId = String(item?.id || "").trim();
  const filePath = getWorkspaceCollectionItemPath(userId, collectionName, itemId);
  if (!filePath || !itemId) return null;
  const normalizedItem = normalizeWorkspaceCollectionItem(collectionName, item);
  writeJson(filePath, {
    userId: String(userId || "").trim(),
    collection: collectionName,
    itemId,
    updatedAt: nowIso(),
    item: normalizedItem,
  });
  try {
    fs.rmSync(`${filePath}.gz`, { force: true });
  } catch {}
  return normalizedItem;
}

function summarizeWorkspaceCollectionItem(collectionName = "", item = {}) {
  if (collectionName === "requirementPlans") return summarizeRequirementPlanRecord(item);
  if (collectionName === "draftBuilds") return summarizeDraftBuildRecord(item);
  return item;
}

function readWorkspaceCollectionIndex(userId = "", collectionName = "") {
  const normalizedUserId = String(userId || "").trim();
  const indexPath = getWorkspaceCollectionIndexPath(normalizedUserId, collectionName);
  if (indexPath && fs.existsSync(indexPath)) {
    const payload = readJson(indexPath, { items: [] });
    return toPlainArray(payload?.items).map((item) => summarizeWorkspaceCollectionItem(collectionName, item));
  }
  const collectionPath = getWorkspaceCollectionPath(normalizedUserId, collectionName);
  if (collectionPath && fs.existsSync(collectionPath)) {
    const payload = readJson(collectionPath, { items: [] });
    return toPlainArray(payload?.items).map((item) => summarizeWorkspaceCollectionItem(collectionName, item));
  }
  const workspace = readWorkspaceShard(normalizedUserId);
  return toPlainArray(workspace?.[collectionName]).map((item) => summarizeWorkspaceCollectionItem(collectionName, item));
}

function writeWorkspaceCollectionIndex(userId = "", collectionName = "", items = []) {
  const normalizedUserId = String(userId || "").trim();
  const indexPath = getWorkspaceCollectionIndexPath(normalizedUserId, collectionName);
  if (!normalizedUserId || !indexPath) return [];
  const summaries = toPlainArray(items).map((item) => summarizeWorkspaceCollectionItem(collectionName, item)).slice(0, 200);
  writeJson(indexPath, {
    userId: normalizedUserId,
    collection: collectionName,
    updatedAt: nowIso(),
    items: summaries,
  });
  return summaries;
}

function readWorkspaceCollection(userId = "", collectionName = "") {
  const normalizedUserId = String(userId || "").trim();
  const indexItems = readWorkspaceCollectionIndex(normalizedUserId, collectionName);
  if (indexItems.length) {
    const hydrated = indexItems
      .map((item) => readWorkspaceCollectionItem(normalizedUserId, collectionName, item.id) || null)
      .filter(Boolean);
    if (hydrated.length) return hydrated;
  }
  const collectionPath = getWorkspaceCollectionPath(normalizedUserId, collectionName);
  if (collectionPath && fs.existsSync(collectionPath)) {
    const payload = readJson(collectionPath, { items: [] });
    const items = toPlainArray(payload?.items).map((item) => normalizeWorkspaceCollectionItem(collectionName, item));
    if (items.length) return items;
  }
  const workspace = readWorkspaceShard(normalizedUserId);
  const inlineItems = toPlainArray(workspace?.[collectionName]);
  if (inlineItems.length && !inlineItems.every((item) => item?.output?.requirementPlan || item?.snapshotData)) {
    const legacy = readWorkspaces();
    const legacyWorkspace = (legacy.workspaces || []).find((item) => item.userId === normalizedUserId);
    const legacyItems = toPlainArray(legacyWorkspace?.[collectionName]);
    if (legacyItems.length) return legacyItems.map((item) => normalizeWorkspaceCollectionItem(collectionName, item));
  }
  if (inlineItems.length) return inlineItems.map((item) => normalizeWorkspaceCollectionItem(collectionName, item));
  const legacy = readWorkspaces();
  const legacyWorkspace = (legacy.workspaces || []).find((item) => item.userId === normalizedUserId);
  return toPlainArray(legacyWorkspace?.[collectionName]).map((item) => normalizeWorkspaceCollectionItem(collectionName, item));
}

function writeWorkspaceCollection(userId = "", collectionName = "", items = []) {
  const normalizedUserId = String(userId || "").trim();
  const filePath = getWorkspaceCollectionPath(normalizedUserId, collectionName);
  if (!normalizedUserId || !filePath) return [];
  const normalizedItems = toPlainArray(items).map((item) => normalizeWorkspaceCollectionItem(collectionName, item)).slice(0, 200);
  normalizedItems.forEach((item) => writeWorkspaceCollectionItem(normalizedUserId, collectionName, item));
  const summaries = writeWorkspaceCollectionIndex(normalizedUserId, collectionName, normalizedItems);
  writeJson(filePath, {
    userId: normalizedUserId,
    collection: collectionName,
    updatedAt: nowIso(),
    storageMode: "item-files",
    items: summaries,
  });
  return normalizedItems;
}

function readWorkspaces() {
  try {
    const stat = fs.statSync(WORKSPACES_PATH);
    const signature = `${Number(stat.mtimeMs || 0)}:${Number(stat.size || 0)}`;
    if (workspaceStoreCache && workspaceStoreCacheStat === signature) {
      return workspaceStoreCache;
    }
    workspaceStoreCache = readJson(WORKSPACES_PATH, { workspaces: [] });
    workspaceStoreCacheStat = signature;
    return workspaceStoreCache;
  } catch {
    const fallback = { workspaces: [] };
    workspaceStoreCache = fallback;
    workspaceStoreCacheStat = null;
    return fallback;
  }
}

function writeWorkspaces(payload) {
  writeJson(WORKSPACES_PATH, payload);
  workspaceStoreCache = payload;
  try {
    const stat = fs.statSync(WORKSPACES_PATH);
    workspaceStoreCacheStat = `${Number(stat.mtimeMs || 0)}:${Number(stat.size || 0)}`;
  } catch {
    workspaceStoreCacheStat = null;
  }
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
  const nextSession = {
    token,
    userId,
    createdAt: nowIso(),
  };
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const sameUserSessions = sessions
    .filter((item) => item.userId === userId)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
    .slice(0, Math.max(0, MAX_SESSIONS_PER_USER - 1));
  payload.sessions = [
    ...sessions.filter((item) => item.userId !== userId),
    ...sameUserSessions,
    nextSession,
  ];
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
  const output = toPlainObject(plan?.output);
  const requirementPlanOutput = sanitizeRequirementPlanOutput(output?.requirementPlan);
  const topLevelRequirementPlan = sanitizeRequirementPlanOutput(plan);
  const generatedBy = String(plan?.generatedBy || output?.generatedBy || "").trim();
  const originType = (() => {
    const explicit = String(plan?.originType || "").trim();
    if (explicit) return explicit;
    if (generatedBy === "codex-docs-backfill") return "auto-backfilled";
    return "user-input";
  })();
  const approvalState = String(
    plan?.approvalState ||
    (originType === "auto-backfilled" ? "system-generated" : "user-reviewed")
  ).trim();
  return {
    id: String(plan?.id || crypto.randomUUID()),
    pageId: String(plan?.pageId || "").trim(),
    viewportProfile: normalizeViewportProfile(plan?.viewportProfile, "pc"),
    mode: String(plan?.mode || "direct").trim() || "direct",
    status: String(plan?.status || "draft").trim() || "draft",
    originType,
    approvalState,
    generatedBy,
    title: String(plan?.title || requirementPlanOutput?.title || output?.title || "").trim(),
    designChangeLevel: normalizePlanLine(
      plan?.designChangeLevel || requirementPlanOutput?.designChangeLevel || topLevelRequirementPlan?.designChangeLevel || "",
      20
    ) || "medium",
    interventionLayer: normalizePlanLine(
      plan?.interventionLayer || topLevelRequirementPlan?.interventionLayer || "",
      40
    ),
    patchDepth: normalizePlanLine(
      plan?.patchDepth || topLevelRequirementPlan?.patchDepth || "",
      40
    ),
    targetGroupId: normalizePlanLine(
      plan?.targetGroupId || topLevelRequirementPlan?.targetGroupId || "",
      120
    ),
    targetGroupLabel: normalizePlanLine(
      plan?.targetGroupLabel || topLevelRequirementPlan?.targetGroupLabel || "",
      160
    ),
    targetComponents: sanitizePlanLineArray(
      plan?.targetComponents || topLevelRequirementPlan?.targetComponents,
      { limit: 24, maxLength: 160 }
    ),
    planningDirection: sanitizePlanLineArray(
      plan?.planningDirection || topLevelRequirementPlan?.planningDirection,
      { limit: 8, maxLength: 520 }
    ),
    designDirection: sanitizePlanLineArray(
      plan?.designDirection || topLevelRequirementPlan?.designDirection,
      { limit: 8, maxLength: 520 }
    ),
    guardrails: sanitizePlanLineArray(
      plan?.guardrails || topLevelRequirementPlan?.guardrails,
      { limit: 8, maxLength: 240 }
    ),
    referenceNotes: sanitizeReferenceNotes(
      plan?.referenceNotes || topLevelRequirementPlan?.referenceNotes,
      5
    ),
    builderBrief: sanitizeRequirementPlanOutput({
      builderBrief:
        (plan?.builderBrief && typeof plan.builderBrief === "object" ? plan.builderBrief : null) ||
        (topLevelRequirementPlan?.builderBrief && typeof topLevelRequirementPlan.builderBrief === "object"
          ? topLevelRequirementPlan.builderBrief
          : null) ||
        {},
    }).builderBrief,
    builderMarkdown: String(
      plan?.builderMarkdown || topLevelRequirementPlan?.builderMarkdown || ""
    ).slice(0, 32000),
    designSpecMarkdown: String(
      plan?.designSpecMarkdown || topLevelRequirementPlan?.designSpecMarkdown || ""
    ).slice(0, 32000),
    sectionBlueprints: sanitizeSectionBlueprints(
      plan?.sectionBlueprints || topLevelRequirementPlan?.sectionBlueprints,
      24
    ),
    conceptPlans: Array.isArray(plan?.conceptPlans)
      ? JSON.parse(JSON.stringify(plan.conceptPlans)).slice(0, 8)
      : (Array.isArray(topLevelRequirementPlan?.conceptPlans)
        ? JSON.parse(JSON.stringify(topLevelRequirementPlan.conceptPlans)).slice(0, 8)
        : []),
    selectedConcept:
      plan?.selectedConcept && typeof plan.selectedConcept === "object"
        ? JSON.parse(JSON.stringify(plan.selectedConcept))
        : (topLevelRequirementPlan?.selectedConcept && typeof topLevelRequirementPlan.selectedConcept === "object"
          ? JSON.parse(JSON.stringify(topLevelRequirementPlan.selectedConcept))
          : null),
    planningPackage:
      plan?.planningPackage && typeof plan.planningPackage === "object"
        ? JSON.parse(JSON.stringify(plan.planningPackage))
        : (topLevelRequirementPlan?.planningPackage && typeof topLevelRequirementPlan.planningPackage === "object"
          ? JSON.parse(JSON.stringify(topLevelRequirementPlan.planningPackage))
          : null),
    journeyFlow:
      plan?.journeyFlow && typeof plan.journeyFlow === "object"
        ? JSON.parse(JSON.stringify(plan.journeyFlow))
        : (topLevelRequirementPlan?.journeyFlow && typeof topLevelRequirementPlan.journeyFlow === "object"
          ? JSON.parse(JSON.stringify(topLevelRequirementPlan.journeyFlow))
          : null),
    input: toPlainObject(plan?.input),
    output: {
      ...output,
      ...(Object.keys(requirementPlanOutput || {}).length ? { requirementPlan: requirementPlanOutput } : {}),
    },
    summary: String(plan?.summary || "").trim(),
    createdAt: String(plan?.createdAt || nowIso()),
    updatedAt: String(plan?.updatedAt || plan?.createdAt || nowIso()),
  };
}

function normalizeDraftBuild(build) {
  const snapshotData = toPlainObject(build?.snapshotData);
  const report = mergeGeneratedAssetsIntoDraftReport(build?.report, snapshotData);
  return {
    id: String(build?.id || crypto.randomUUID()),
    pageId: String(build?.pageId || "").trim(),
    viewportProfile: normalizeViewportProfile(build?.viewportProfile, "pc"),
    planId: String(build?.planId || "").trim(),
    builderVersion: String(build?.builderVersion || "").trim(),
    rendererSurface: String(build?.rendererSurface || "").trim(),
    status: String(build?.status || "draft").trim() || "draft",
    summary: String(build?.summary || "").trim(),
    proposedVersionLabel: String(build?.proposedVersionLabel || "").trim(),
    operations: toPlainArray(build?.operations),
    report,
    snapshotData,
    createdAt: String(build?.createdAt || nowIso()),
    updatedAt: String(build?.updatedAt || build?.createdAt || nowIso()),
  };
}

function summarizeRequirementPlanRecord(plan = {}) {
  const userInput = toPlainObject(plan?.input?.userInput);
  const journeyFlow =
    plan?.journeyFlow && typeof plan.journeyFlow === "object"
      ? JSON.parse(JSON.stringify(plan.journeyFlow))
      : (plan?.output?.requirementPlan?.journeyFlow && typeof plan.output.requirementPlan.journeyFlow === "object"
        ? JSON.parse(JSON.stringify(plan.output.requirementPlan.journeyFlow))
        : null);
  const journeyStrategy =
    plan?.journeyStrategy && typeof plan.journeyStrategy === "object"
      ? JSON.parse(JSON.stringify(plan.journeyStrategy))
      : (plan?.output?.requirementPlan?.journeyStrategy && typeof plan.output.requirementPlan.journeyStrategy === "object"
        ? JSON.parse(JSON.stringify(plan.output.requirementPlan.journeyStrategy))
        : null);
  const outputRequirementPlan = plan?.output?.requirementPlan
    ? {
      title: String(plan.output.requirementPlan.title || plan.title || "").trim(),
      ...(journeyFlow ? { journeyFlow } : {}),
      ...(journeyStrategy ? { journeyStrategy } : {}),
    }
    : {};
  return {
    id: String(plan?.id || "").trim(),
    pageId: String(plan?.pageId || "").trim(),
    viewportProfile: normalizeViewportProfile(plan?.viewportProfile, "pc"),
    mode: String(plan?.mode || "").trim(),
    status: String(plan?.status || "").trim(),
    originType: String(plan?.originType || "").trim(),
    approvalState: String(plan?.approvalState || "").trim(),
    generatedBy: String(plan?.generatedBy || "").trim(),
    title: String(plan?.title || plan?.output?.requirementPlan?.title || "").trim(),
    summary: String(plan?.summary || "").trim(),
    designChangeLevel: String(plan?.designChangeLevel || "").trim(),
    interventionLayer: String(plan?.interventionLayer || "").trim(),
    patchDepth: String(plan?.patchDepth || "").trim(),
    targetGroupId: String(plan?.targetGroupId || "").trim(),
    targetGroupLabel: String(plan?.targetGroupLabel || "").trim(),
    targetComponents: toPlainArray(plan?.targetComponents).slice(0, 24),
    ...(journeyFlow ? { journeyFlow } : {}),
    ...(journeyStrategy ? { journeyStrategy } : {}),
    input: { userInput },
    output: Object.keys(outputRequirementPlan).length ? { requirementPlan: outputRequirementPlan } : {},
    createdAt: String(plan?.createdAt || ""),
    updatedAt: String(plan?.updatedAt || plan?.createdAt || ""),
  };
}

function summarizeDraftBuildRecord(build = {}) {
  return {
    id: String(build?.id || "").trim(),
    pageId: String(build?.pageId || "").trim(),
    viewportProfile: normalizeViewportProfile(build?.viewportProfile, "pc"),
    planId: String(build?.planId || "").trim(),
    builderVersion: String(build?.builderVersion || "").trim(),
    rendererSurface: String(build?.rendererSurface || "").trim(),
    status: String(build?.status || "").trim(),
    summary: String(build?.summary || "").trim(),
    proposedVersionLabel: String(build?.proposedVersionLabel || "").trim(),
    createdAt: String(build?.createdAt || ""),
    updatedAt: String(build?.updatedAt || build?.createdAt || ""),
  };
}

function normalizeSavedVersion(version) {
  return {
    id: String(version?.id || crypto.randomUUID()),
    pageId: String(version?.pageId || "").trim(),
    viewportProfile: normalizeViewportProfile(version?.viewportProfile, "pc"),
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
      viewportProfile: normalizeViewportProfile(entry?.viewportProfile, "pc"),
      pinnedAt: String(entry?.pinnedAt || nowIso()),
    };
  });
  return next;
}

function normalizePageIdentityLines(value) {
  return toPlainArray(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizePageIdentityOverride(entry, { pageId = "" } = {}) {
  const normalizedPageId = String(entry?.pageId || pageId || "").trim();
  return {
    pageId: normalizedPageId,
    role: String(entry?.role || "").trim(),
    purpose: String(entry?.purpose || "").trim(),
    designIntent: String(entry?.designIntent || "").trim(),
    mustPreserve: normalizePageIdentityLines(entry?.mustPreserve),
    shouldAvoid: normalizePageIdentityLines(entry?.shouldAvoid),
    visualGuardrails: normalizePageIdentityLines(entry?.visualGuardrails),
    createdAt: String(entry?.createdAt || nowIso()),
    updatedAt: String(entry?.updatedAt || entry?.createdAt || nowIso()),
  };
}

function normalizePageIdentityOverrides(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([pageId, entry]) => {
        const normalized = normalizePageIdentityOverride(entry, { pageId });
        return normalized.pageId ? [normalized.pageId, normalized] : null;
      })
      .filter(Boolean)
  );
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
    pageIdentityOverrides: normalizePageIdentityOverrides(workspace?.pageIdentityOverrides),
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
  const sharded = readWorkspaceShard(userId);
  if (sharded) {
    ensureWorkspaceStorage(sharded, { userId });
    return sharded;
  }
  const payload = readWorkspaces();
  const existing = (payload.workspaces || []).find((item) => item.userId === userId);
  if (existing) {
    ensureWorkspaceStorage(existing, { userId });
    return writeWorkspaceShard(userId, existing) || existing;
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
    pageIdentityOverrides: {},
  });
  writeWorkspaceShard(userId, workspace);
  logEvent(userId, "workspace_initialized", { base: "shared-default" });
  return workspace;
}

function getWorkspace(userId, options = {}) {
  const workspace = initializeWorkspace(userId);
  if (options?.normalize !== false) {
    ensureWorkspaceStorage(workspace, { userId });
  }
  return workspace;
}

function saveWorkspace(userId, data, changeSummary = "workspace_update") {
  return withWorkspaceWriteLock(userId, () => {
    const nextData = normalizeEditableData(JSON.parse(JSON.stringify(data)));
    const workspace = initializeWorkspace(userId);
    ensureWorkspaceStorage(workspace, { userId });
    workspace.data = nextData;
    workspace.updatedAt = nowIso();
    workspace.workHistory.unshift({
      id: crypto.randomUUID(),
      summary: changeSummary,
      recordedAt: workspace.updatedAt,
    });
    workspace.workHistory = workspace.workHistory.slice(0, 100);
    const savedWorkspace = writeWorkspaceShard(userId, workspace) || workspace;
    logEvent(userId, "workspace_saved", { summary: changeSummary });
    return savedWorkspace;
  });
}

function incrementLlmUsage(userId, detail = {}) {
  return withWorkspaceWriteLock(userId, () => {
    const workspace = initializeWorkspace(userId);
    ensureWorkspaceStorage(workspace, { userId });
    workspace.llmUsageCount = Number(workspace.llmUsageCount || 0) + 1;
    workspace.updatedAt = nowIso();
    writeWorkspaceShard(userId, workspace);
    logEvent(userId, "llm_usage", detail);
    return workspace.llmUsageCount;
  });
}

function updateWorkspaceMeta(userId, mutator, { logType = "", logDetail = {}, historySummary = "" } = {}) {
  return withWorkspaceWriteLock(userId, () => {
    const workspace = initializeWorkspace(userId);
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
    const savedWorkspace = writeWorkspaceShard(userId, workspace) || workspace;
    if (logType) logEvent(userId, logType, logDetail);
    return { workspace: savedWorkspace, result };
  });
}

function listRequirementPlans(userId, { pageId = "", viewportProfile = "", limit = 50, summaryOnly = false } = {}) {
  const sourceItems = summaryOnly
    ? readWorkspaceCollectionIndex(userId, "requirementPlans")
    : readWorkspaceCollection(userId, "requirementPlans");
  const normalizedPageId = String(pageId || "").trim();
  const normalizedViewportProfile = String(viewportProfile || "").trim();
  const items = sourceItems
    .filter(
      (item) =>
        (!normalizedPageId || item.pageId === normalizedPageId) &&
        (!normalizedViewportProfile || normalizeViewportProfile(item.viewportProfile, "pc") === normalizeViewportProfile(normalizedViewportProfile, "pc"))
    )
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, Math.max(0, Number(limit) || 0));
  if (!summaryOnly) return items;
  return items.map((item) => {
    const userInput = item?.input?.userInput && typeof item.input.userInput === "object" ? item.input.userInput : {};
    const hasJourneyIntent =
      String(userInput.journeyMode || "").trim() === "journey" ||
      String(userInput.journeyId || "").trim() ||
      String(item?.mode || "").trim() === "journey";
    const hasJourneyFlow =
      (item?.journeyFlow && typeof item.journeyFlow === "object") ||
      (item?.output?.requirementPlan?.journeyFlow && typeof item.output.requirementPlan.journeyFlow === "object");
    if (!hasJourneyIntent || hasJourneyFlow) return item;
    const hydrated = readWorkspaceCollectionItem(userId, "requirementPlans", item.id);
    return hydrated ? summarizeRequirementPlanRecord(hydrated) : item;
  });
}

function saveRequirementPlan(userId, planInput = {}) {
  const normalizedInput = normalizeRequirementPlan(planInput);
  let savedPlan = null;
  updateWorkspaceMeta(
    userId,
    (draft) => {
      const items = readWorkspaceCollection(userId, "requirementPlans");
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
      const nextItems = writeWorkspaceCollection(userId, "requirementPlans", items.slice(0, 200));
      draft.requirementPlans = nextItems.map(summarizeRequirementPlanRecord);
      savedPlan = nextPlan;
      return nextPlan;
    },
    {
      logType: "workspace_requirement_plan_saved",
      logDetail: { pageId: normalizedInput.pageId, planId: normalizedInput.id },
      historySummary: `requirement_plan:${normalizedInput.pageId || "unknown"}:${normalizedInput.id}`,
    }
  );
  return savedPlan;
}

function listDraftBuilds(userId, { pageId = "", viewportProfile = "", limit = 50, summaryOnly = false } = {}) {
  const sourceItems = summaryOnly
    ? readWorkspaceCollectionIndex(userId, "draftBuilds")
    : readWorkspaceCollection(userId, "draftBuilds");
  const normalizedPageId = String(pageId || "").trim();
  const normalizedViewportProfile = String(viewportProfile || "").trim();
  return sourceItems
    .filter(
      (item) =>
        (!normalizedPageId || item.pageId === normalizedPageId) &&
        (!normalizedViewportProfile || normalizeViewportProfile(item.viewportProfile, "pc") === normalizeViewportProfile(normalizedViewportProfile, "pc"))
    )
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, Math.max(0, Number(limit) || 0));
}

function findDraftBuildById(userId, draftBuildId = "") {
  const normalizedDraftBuildId = String(draftBuildId || "").trim();
  if (!normalizedDraftBuildId) return null;
  const item = readWorkspaceCollectionItem(userId, "draftBuilds", normalizedDraftBuildId);
  if (item) return item;
  return readWorkspaceCollection(userId, "draftBuilds").find((item) => String(item?.id || "").trim() === normalizedDraftBuildId) || null;
}

function saveDraftBuild(userId, buildInput = {}) {
  const normalizedInput = normalizeDraftBuild(buildInput);
  let savedBuild = null;
  updateWorkspaceMeta(
    userId,
    (draft) => {
      const items = readWorkspaceCollection(userId, "draftBuilds");
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
      const nextItems = writeWorkspaceCollection(userId, "draftBuilds", items.slice(0, 200));
      draft.draftBuilds = nextItems.map(summarizeDraftBuildRecord);
      savedBuild = nextBuild;
      return nextBuild;
    },
    {
      logType: "workspace_draft_build_saved",
      logDetail: { pageId: normalizedInput.pageId, buildId: normalizedInput.id, planId: normalizedInput.planId || null },
      historySummary: `draft_build:${normalizedInput.pageId || "unknown"}:${normalizedInput.id}`,
    }
  );
  return savedBuild;
}

function attachDraftReplayCheck(userId, draftBuildId, replayCheck = null) {
  const normalizedDraftBuildId = String(draftBuildId || "").trim();
  if (!normalizedDraftBuildId) return null;
  const normalizedReplayCheck =
    replayCheck && typeof replayCheck === "object" ? JSON.parse(JSON.stringify(replayCheck)) : null;
  let savedBuild = null;
  updateWorkspaceMeta(
    userId,
    (draft) => {
      const items = readWorkspaceCollection(userId, "draftBuilds");
      const existingIndex = items.findIndex((item) => String(item?.id || "").trim() === normalizedDraftBuildId);
      if (existingIndex < 0) return null;
      const existing = items[existingIndex];
      const nextBuild = normalizeDraftBuild({
        ...existing,
        snapshotData: {
          ...(existing?.snapshotData && typeof existing.snapshotData === "object" ? existing.snapshotData : {}),
          localReplayCheck: normalizedReplayCheck,
        },
        updatedAt: existing?.updatedAt || nowIso(),
      });
      items[existingIndex] = nextBuild;
      const nextItems = writeWorkspaceCollection(userId, "draftBuilds", items.slice(0, 200));
      draft.draftBuilds = nextItems.map(summarizeDraftBuildRecord);
      savedBuild = nextBuild;
      return nextBuild;
    },
    {
      logType: "workspace_draft_replay_check_attached",
      logDetail: { buildId: normalizedDraftBuildId },
      historySummary: "",
    }
  );
  return savedBuild || findDraftBuildById(userId, normalizedDraftBuildId);
}

function listSavedVersions(userId, { pageId = "", viewportProfile = "", limit = 50 } = {}) {
  const workspace = getWorkspace(userId, { normalize: false });
  const normalizedPageId = String(pageId || "").trim();
  const normalizedViewportProfile = String(viewportProfile || "").trim();
  return (workspace.savedVersions || [])
    .filter(
      (item) =>
        (!normalizedPageId || item.pageId === normalizedPageId) &&
        (!normalizedViewportProfile || normalizeViewportProfile(item.viewportProfile, "pc") === normalizeViewportProfile(normalizedViewportProfile, "pc"))
    )
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, Math.max(0, Number(limit) || 0));
}

function saveSavedVersion(userId, versionInput = {}) {
  const normalizedInput = normalizeSavedVersion(versionInput);
  const { workspace, result } = updateWorkspaceMeta(
    userId,
    (draft) => {
      const items = Array.isArray(draft.savedVersions) ? draft.savedVersions : [];
      const existingIndex = items.findIndex((item) => {
        if (item.id === normalizedInput.id) return true;
        return (
          normalizedInput.buildId &&
          item.pageId === normalizedInput.pageId &&
          normalizeViewportProfile(item.viewportProfile, "pc") === normalizeViewportProfile(normalizedInput.viewportProfile, "pc") &&
          item.planId === normalizedInput.planId &&
          item.buildId === normalizedInput.buildId
        );
      });
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
      logDetail: {
        pageId: normalizedInput.pageId,
        versionId: normalizedInput.id,
        versionLabel: normalizedInput.versionLabel || null,
        buildId: normalizedInput.buildId || null,
        planId: normalizedInput.planId || null,
      },
      historySummary: `saved_version:${normalizedInput.pageId || "unknown"}:${normalizedInput.id}`,
    }
  );
  return result || (workspace.savedVersions || [])[0] || null;
}

function pinSavedVersion(userId, pageId, versionId, viewportProfile = "") {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedVersionId = String(versionId || "").trim();
  const normalizedViewportProfile = normalizeViewportProfile(viewportProfile, "pc");
  if (!normalizedPageId || !normalizedVersionId) {
    throw new Error("page_id_and_version_id_required");
  }
  const workspace = getWorkspace(userId);
  const version = (workspace.savedVersions || []).find(
    (item) =>
      item.pageId === normalizedPageId &&
      item.id === normalizedVersionId &&
      (!viewportProfile || normalizeViewportProfile(item.viewportProfile, "pc") === normalizedViewportProfile)
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
      draft.pinnedViewsByPage[resolveWorkspaceViewportKey(normalizedPageId, normalizedViewportProfile)] = {
        versionId: normalizedVersionId,
        viewportProfile: normalizedViewportProfile,
        pinnedAt: nowIso(),
      };
      return {
        pageId: normalizedPageId,
        versionId: normalizedVersionId,
        viewportProfile: normalizedViewportProfile,
        pinnedAt: draft.pinnedViewsByPage[resolveWorkspaceViewportKey(normalizedPageId, normalizedViewportProfile)].pinnedAt,
      };
    },
    {
      logType: "workspace_view_pinned",
      logDetail: { pageId: normalizedPageId, versionId: normalizedVersionId, viewportProfile: normalizedViewportProfile },
      historySummary: `view_pin:${normalizedPageId}:${normalizedViewportProfile}:${normalizedVersionId}`,
    }
  );
  return result;
}

function getPinnedView(userId, pageId, viewportProfile = "") {
  const workspace = getWorkspace(userId, { normalize: false });
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return null;
  const normalizedViewportProfile = normalizeViewportProfile(viewportProfile, "pc");
  const pin =
    workspace.pinnedViewsByPage?.[resolveWorkspaceViewportKey(normalizedPageId, normalizedViewportProfile)] ||
    workspace.pinnedViewsByPage?.[normalizedPageId] ||
    null;
  if (!pin?.versionId) return null;
  const version = (workspace.savedVersions || []).find(
    (item) =>
      item.pageId === normalizedPageId &&
      item.id === pin.versionId &&
      (!pin.viewportProfile || normalizeViewportProfile(item.viewportProfile, "pc") === normalizeViewportProfile(pin.viewportProfile, "pc"))
  ) || null;
  return {
    pageId: normalizedPageId,
    versionId: pin.versionId,
    viewportProfile: normalizeViewportProfile(pin.viewportProfile || version?.viewportProfile, normalizedViewportProfile),
    pinnedAt: pin.pinnedAt || null,
    version,
  };
}

function getPageIdentityOverride(userId, pageId) {
  const workspace = getWorkspace(userId, { normalize: false });
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) return null;
  const entry = workspace.pageIdentityOverrides?.[normalizedPageId] || null;
  return entry ? normalizePageIdentityOverride(entry, { pageId: normalizedPageId }) : null;
}

function savePageIdentityOverride(userId, pageId, input = {}) {
  const normalizedPageId = String(pageId || "").trim();
  if (!normalizedPageId) throw new Error("page_id_required");
  const normalizedInput = normalizePageIdentityOverride({ ...input, pageId: normalizedPageId }, { pageId: normalizedPageId });
  const { workspace, result } = updateWorkspaceMeta(
    userId,
    (draft) => {
      draft.pageIdentityOverrides = normalizePageIdentityOverrides(draft.pageIdentityOverrides);
      const existing = draft.pageIdentityOverrides[normalizedPageId] || null;
      const nextEntry = normalizePageIdentityOverride(
        {
          ...(existing || {}),
          ...normalizedInput,
          pageId: normalizedPageId,
          createdAt: existing?.createdAt || normalizedInput.createdAt || nowIso(),
          updatedAt: nowIso(),
        },
        { pageId: normalizedPageId }
      );
      draft.pageIdentityOverrides[normalizedPageId] = nextEntry;
      return nextEntry;
    },
    {
      logType: "workspace_page_identity_saved",
      logDetail: { pageId: normalizedPageId },
      historySummary: `page_identity:${normalizedPageId}`,
    }
  );
  return result || workspace.pageIdentityOverrides?.[normalizedPageId] || null;
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
  findDraftBuildById,
  saveDraftBuild,
  attachDraftReplayCheck,
  listSavedVersions,
  saveSavedVersion,
  pinSavedVersion,
  getPinnedView,
  getPageIdentityOverride,
  savePageIdentityOverride,
};
