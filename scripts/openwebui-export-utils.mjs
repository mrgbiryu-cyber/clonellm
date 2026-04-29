import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export const ROOT_DIR = process.cwd();
export const EXPORT_ROOT = path.join(ROOT_DIR, "exports", "openwebui");
export const INVENTORY_PATH = path.join(ROOT_DIR, "data", "normalized", "openwebui-source-inventory.json");
export const SCHEMA_BUNDLE_PATH = path.join(ROOT_DIR, "data", "normalized", "openwebui-projection-schema-v1.json");
export const MANIFEST_PATH = path.join(EXPORT_ROOT, "import-manifest.json");

export const DRY_RUN_SOURCE_PATHS = [
  "data/normalized/asset-role-policies.json",
  "data/normalized/component-rebuild-schema-catalog.json",
  "data/normalized/image-asset-registry.json",
  "data/normalized/page-runtime-status.json",
  "data/normalized/section-family-contracts.json",
];

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function fromRoot(relativePath) {
  return path.join(ROOT_DIR, relativePath);
}

export function relativeFromRoot(absolutePath) {
  return toPosixPath(path.relative(ROOT_DIR, absolutePath));
}

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(fromRoot(relativePath), "utf8"));
}

export function readJsonAbsolute(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

export function sha256File(absolutePath) {
  return sha256Buffer(fs.readFileSync(absolutePath));
}

export function ensureDir(absolutePath) {
  fs.mkdirSync(absolutePath, { recursive: true });
}

export function emptyDir(absolutePath) {
  fs.rmSync(absolutePath, { recursive: true, force: true });
  ensureDir(absolutePath);
}

export function writeJson(relativePath, value) {
  const absolutePath = fromRoot(relativePath);
  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, stableJson(value));
  return absolutePath;
}

export function writeText(relativePath, value) {
  const absolutePath = fromRoot(relativePath);
  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, value.endsWith("\n") ? value : `${value}\n`);
  return absolutePath;
}

export function loadInventory() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error("Missing Phase 0A inventory. Run npm run openwebui:inventory first.");
  }
  return readJsonAbsolute(INVENTORY_PATH);
}

export function getSourceRecord(inventory, sourcePath) {
  const record = (inventory.sources || []).find((item) => item.sourcePath === sourcePath);
  if (!record) throw new Error(`Missing source in inventory: ${sourcePath}`);
  if (!record.exists) throw new Error(`Inventory marks source missing: ${sourcePath}`);
  return record;
}

export function sourceRefFromRecord(record, freshness = "current") {
  return {
    sourcePath: record.sourcePath,
    sourceHash: record.sourceHash,
    truthLevel: record.truthLevel,
    freshness,
  };
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "item";
}

export function unique(values) {
  return [...new Set((values || []).filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

export function parseComponentId(componentId) {
  const normalized = String(componentId || "").trim();
  const dotIndex = normalized.indexOf(".");
  if (dotIndex < 1 || dotIndex >= normalized.length - 1) {
    return { pageId: "", slotId: normalized, componentId: normalized };
  }
  return {
    pageId: normalized.slice(0, dotIndex),
    slotId: normalized.slice(dotIndex + 1),
    componentId: normalized,
  };
}

export function collectionForSource(sourcePath) {
  if (sourcePath.includes("asset-role") || sourcePath.includes("section-family") || sourcePath.includes("component-rebuild")) {
    return "lge-policy";
  }
  if (sourcePath.includes("image-asset") || sourcePath.includes("page-runtime")) {
    return "lge-component-spec";
  }
  return "lge-design-history";
}

export function freshnessForTruthLevel(truthLevel) {
  if (truthLevel === "historical") return "historical";
  if (truthLevel === "legacy-reference") return "legacy-reference";
  return "current";
}

export function listFilesRecursive(absoluteDir) {
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) return listFilesRecursive(entryPath);
    if (entry.isFile()) return [entryPath];
    return [];
  });
}

export function loadDryRunSources(inventory = loadInventory()) {
  return Object.fromEntries(DRY_RUN_SOURCE_PATHS.map((sourcePath) => {
    const record = getSourceRecord(inventory, sourcePath);
    return [sourcePath, {
      record,
      data: readJson(sourcePath),
    }];
  }));
}
