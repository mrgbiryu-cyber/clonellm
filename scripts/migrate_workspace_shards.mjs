import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const LEGACY_WORKSPACES_PATH = path.join(RUNTIME_DIR, "workspaces.json");
const SHARDS_DIR = path.join(RUNTIME_DIR, "workspaces");
const INDEX_PATH = path.join(SHARDS_DIR, "index.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function shardFileName(userId = "") {
  const normalized = String(userId || "").trim();
  if (!normalized) return "";
  if (/^[a-zA-Z0-9._-]+$/.test(normalized)) return `${normalized}.json`;
  return `${crypto.createHash("sha1").update(normalized).digest("hex")}.json`;
}

function itemFileName(baseName = "", collectionName = "", itemId = "") {
  const normalizedItemId = String(itemId || "").trim();
  if (!baseName || !collectionName || !normalizedItemId) return "";
  const safeItemId = /^[a-zA-Z0-9._-]+$/.test(normalizedItemId)
    ? normalizedItemId
    : crypto.createHash("sha1").update(normalizedItemId).digest("hex");
  return `${baseName}.${collectionName}.${safeItemId}.json`;
}

function summarizeRequirementPlan(plan = {}) {
  const userInput = plan?.input && typeof plan.input === "object" && plan.input.userInput && typeof plan.input.userInput === "object"
    ? plan.input.userInput
    : {};
  return {
    id: String(plan?.id || "").trim(),
    pageId: String(plan?.pageId || "").trim(),
    viewportProfile: String(plan?.viewportProfile || "pc").trim() || "pc",
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
    targetComponents: Array.isArray(plan?.targetComponents) ? plan.targetComponents.slice(0, 24) : [],
    input: { userInput },
    output: plan?.output?.requirementPlan ? { requirementPlan: { title: String(plan.output.requirementPlan.title || plan.title || "").trim() } } : {},
    createdAt: String(plan?.createdAt || ""),
    updatedAt: String(plan?.updatedAt || plan?.createdAt || ""),
  };
}

function summarizeDraftBuild(build = {}) {
  return {
    id: String(build?.id || "").trim(),
    pageId: String(build?.pageId || "").trim(),
    viewportProfile: String(build?.viewportProfile || "pc").trim() || "pc",
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

const payload = readJson(LEGACY_WORKSPACES_PATH, { workspaces: [] });
const workspaces = Array.isArray(payload.workspaces) ? payload.workspaces : [];
const index = {
  migratedAt: new Date().toISOString(),
  source: path.relative(ROOT, LEGACY_WORKSPACES_PATH),
  workspaces: [],
};

let written = 0;
for (const workspace of workspaces) {
  const userId = String(workspace?.userId || "").trim();
  const fileName = shardFileName(userId);
  if (!userId || !fileName) continue;
  const filePath = path.join(SHARDS_DIR, fileName);
  const baseName = fileName.replace(/\.json$/, "");
  const requirementPlans = Array.isArray(workspace.requirementPlans) ? workspace.requirementPlans : [];
  const draftBuilds = Array.isArray(workspace.draftBuilds) ? workspace.draftBuilds : [];
  const requirementPlanSummaries = requirementPlans.map(summarizeRequirementPlan);
  const draftBuildSummaries = draftBuilds.map(summarizeDraftBuild);
  writeJson(path.join(SHARDS_DIR, `${baseName}.requirementPlans.json`), {
    userId,
    collection: "requirementPlans",
    updatedAt: new Date().toISOString(),
    storageMode: "item-files",
    items: requirementPlanSummaries,
  });
  writeJson(path.join(SHARDS_DIR, `${baseName}.requirementPlans.index.json`), {
    userId,
    collection: "requirementPlans",
    updatedAt: new Date().toISOString(),
    items: requirementPlanSummaries,
  });
  writeJson(path.join(SHARDS_DIR, `${baseName}.draftBuilds.json`), {
    userId,
    collection: "draftBuilds",
    updatedAt: new Date().toISOString(),
    storageMode: "item-files",
    items: draftBuildSummaries,
  });
  writeJson(path.join(SHARDS_DIR, `${baseName}.draftBuilds.index.json`), {
    userId,
    collection: "draftBuilds",
    updatedAt: new Date().toISOString(),
    items: draftBuildSummaries,
  });
  requirementPlans.forEach((item) => {
    const itemName = itemFileName(baseName, "requirementPlans", item?.id);
    if (!itemName) return;
    writeJson(path.join(SHARDS_DIR, itemName), {
      userId,
      collection: "requirementPlans",
      itemId: String(item?.id || "").trim(),
      updatedAt: new Date().toISOString(),
      item,
    });
  });
  draftBuilds.forEach((item) => {
    const itemName = itemFileName(baseName, "draftBuilds", item?.id);
    if (!itemName) return;
    writeJson(path.join(SHARDS_DIR, itemName), {
      userId,
      collection: "draftBuilds",
      itemId: String(item?.id || "").trim(),
      updatedAt: new Date().toISOString(),
      item,
    });
  });
  writeJson(filePath, {
    ...workspace,
    requirementPlans: requirementPlanSummaries,
    draftBuilds: draftBuildSummaries,
  });
  written += 1;
  index.workspaces.push({
    userId,
    file: fileName,
    bytes: fs.statSync(filePath).size,
    updatedAt: workspace?.updatedAt || null,
  });
}

writeJson(INDEX_PATH, index);
console.log(JSON.stringify({ ok: true, sourceWorkspaces: workspaces.length, written, index: path.relative(ROOT, INDEX_PATH) }, null, 2));
