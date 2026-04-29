import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const SHARDS_DIR = path.join(RUNTIME_DIR, "workspaces");
const SHARE_LINKS_PATH = path.join(RUNTIME_DIR, "share-links.json");
const JOURNEY_BUILDS_PATH = path.join(RUNTIME_DIR, "journey-builds.json");
const KEEP_LATEST_PER_PAGE_VIEWPORT = Math.max(1, Number(process.env.DRAFT_RETENTION_KEEP_LATEST || 8));
const DRY_RUN = process.argv.includes("--dry-run");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeGzipJson(gzipPath, payload) {
  const tmpPath = `${gzipPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, zlib.gzipSync(`${JSON.stringify(payload)}\n`, { level: 9 }));
  fs.renameSync(tmpPath, gzipPath);
}

function listShardFiles() {
  if (!fs.existsSync(SHARDS_DIR)) return [];
  return fs.readdirSync(SHARDS_DIR)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !file.includes(".draftBuilds") && !file.includes(".requirementPlans") && file !== "index.json")
    .map((file) => path.join(SHARDS_DIR, file));
}

function collectShareProtectedBuildIds() {
  const payload = readJson(SHARE_LINKS_PATH, { links: [] });
  return new Set(
    (Array.isArray(payload.links) ? payload.links : [])
      .map((item) => String(item?.buildId || item?.draftBuildId || "").trim())
      .filter(Boolean)
  );
}

function collectJourneyProtectedBuildIds() {
  const payload = readJson(JOURNEY_BUILDS_PATH, { records: [] });
  const ids = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const draftBuildId = String(value.draftBuildId || value.nextDraftBuildId || "").trim();
    if (draftBuildId) ids.add(draftBuildId);
    Object.values(value).forEach(visit);
  };
  visit(payload);
  return ids;
}

function buildProtectedIdsForWorkspace(workspace, globalProtectedIds) {
  const ids = new Set(globalProtectedIds);
  const savedVersions = Array.isArray(workspace?.savedVersions) ? workspace.savedVersions : [];
  savedVersions.forEach((version) => {
    const buildId = String(version?.buildId || "").trim();
    if (buildId) ids.add(buildId);
  });
  const pins = workspace?.pinnedViewsByPage && typeof workspace.pinnedViewsByPage === "object"
    ? Object.values(workspace.pinnedViewsByPage)
    : [];
  pins.forEach((pin) => {
    const versionId = String(pin?.versionId || "").trim();
    const version = savedVersions.find((item) => String(item?.id || "").trim() === versionId);
    const buildId = String(version?.buildId || pin?.buildId || "").trim();
    if (buildId) ids.add(buildId);
  });
  return ids;
}

function chooseLatestIdsByPageViewport(items) {
  const groups = new Map();
  for (const item of items) {
    const pageId = String(item?.pageId || "unknown").trim() || "unknown";
    const viewport = String(item?.viewportProfile || "pc").trim() || "pc";
    const key = `${pageId}@${viewport}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const keep = new Set();
  for (const groupItems of groups.values()) {
    groupItems
      .slice()
      .sort((a, b) => String(b?.updatedAt || b?.createdAt || "").localeCompare(String(a?.updatedAt || a?.createdAt || "")))
      .slice(0, KEEP_LATEST_PER_PAGE_VIEWPORT)
      .forEach((item) => {
        const id = String(item?.id || "").trim();
        if (id) keep.add(id);
      });
  }
  return keep;
}

function itemPathFor(baseName, itemId) {
  return path.join(SHARDS_DIR, `${baseName}.draftBuilds.${itemId}.json`);
}

const globalProtectedIds = new Set([
  ...collectShareProtectedBuildIds(),
  ...collectJourneyProtectedBuildIds(),
]);

const summary = {
  dryRun: DRY_RUN,
  keepLatestPerPageViewport: KEEP_LATEST_PER_PAGE_VIEWPORT,
  users: 0,
  scanned: 0,
  protected: 0,
  alreadyCompressed: 0,
  compressed: 0,
  missing: 0,
  bytesBefore: 0,
  bytesAfter: 0,
};

for (const shardPath of listShardFiles()) {
  const workspace = readJson(shardPath, null);
  if (!workspace?.userId) continue;
  summary.users += 1;
  const baseName = path.basename(shardPath, ".json");
  const indexPath = path.join(SHARDS_DIR, `${baseName}.draftBuilds.index.json`);
  const indexPayload = readJson(indexPath, { items: workspace.draftBuilds || [] });
  const items = Array.isArray(indexPayload.items) ? indexPayload.items : [];
  const protectedIds = buildProtectedIdsForWorkspace(workspace, globalProtectedIds);
  chooseLatestIdsByPageViewport(items).forEach((id) => protectedIds.add(id));

  for (const item of items) {
    const itemId = String(item?.id || "").trim();
    if (!itemId) continue;
    summary.scanned += 1;
    if (protectedIds.has(itemId)) {
      summary.protected += 1;
      continue;
    }
    const jsonPath = itemPathFor(baseName, itemId);
    const gzipPath = `${jsonPath}.gz`;
    if (fs.existsSync(gzipPath) && !fs.existsSync(jsonPath)) {
      summary.alreadyCompressed += 1;
      summary.bytesAfter += fs.statSync(gzipPath).size;
      continue;
    }
    if (!fs.existsSync(jsonPath)) {
      summary.missing += 1;
      continue;
    }
    const raw = fs.readFileSync(jsonPath);
    const gz = zlib.gzipSync(raw, { level: 9 });
    summary.bytesBefore += raw.length;
    summary.bytesAfter += gz.length;
    summary.compressed += 1;
    if (!DRY_RUN) {
      writeGzipJson(gzipPath, JSON.parse(raw.toString("utf8")));
      fs.unlinkSync(jsonPath);
    }
  }
}

console.log(JSON.stringify(summary, null, 2));
