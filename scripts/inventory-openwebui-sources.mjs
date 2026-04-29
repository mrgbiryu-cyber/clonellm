import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const NORMALIZED_DIR = path.join(ROOT_DIR, "data", "normalized");
const OUTPUT_PATH = path.join(NORMALIZED_DIR, "openwebui-source-inventory.json");
const PROJECTION_VERSION = "openwebui-source-inventory-v1";

const DRY_RUN_TARGETS = new Set([
  "data/normalized/section-family-contracts.json",
  "data/normalized/component-rebuild-schema-catalog.json",
  "data/normalized/image-asset-registry.json",
  "data/normalized/asset-role-policies.json",
  "data/normalized/page-runtime-status.json",
]);

const EXCLUDED_RELATIVE_PATHS = new Set([
  "data/normalized/openwebui-source-inventory.json",
]);

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function relativePath(absolutePath) {
  return toPosixPath(path.relative(ROOT_DIR, absolutePath));
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    if (!entry.isFile()) return [];
    return [entryPath];
  });
}

function sha256(buffer) {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function valueKind(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function fieldGroups(objectValue) {
  const groups = {
    arrayFields: [],
    objectFields: [],
    primitiveFields: [],
  };
  for (const [key, value] of Object.entries(objectValue || {})) {
    const kind = valueKind(value);
    if (kind === "array") groups.arrayFields.push(key);
    else if (kind === "object") groups.objectFields.push(key);
    else groups.primitiveFields.push(key);
  }
  return groups;
}

function arrayItemKinds(items) {
  return [...new Set(items.slice(0, 25).map(valueKind))].sort();
}

function nestedKeySample(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const sample = {};
  for (const [key, child] of Object.entries(value).slice(0, 12)) {
    if (Array.isArray(child)) {
      sample[key] = {
        kind: "array",
        length: child.length,
        itemKinds: arrayItemKinds(child),
      };
    } else if (child && typeof child === "object") {
      sample[key] = {
        kind: "object",
        keys: Object.keys(child).slice(0, 20),
      };
    } else {
      sample[key] = { kind: valueKind(child) };
    }
  }
  return sample;
}

function schemaFingerprintForJson(parsed) {
  if (Array.isArray(parsed)) {
    return {
      rootKind: "array",
      length: parsed.length,
      itemKinds: arrayItemKinds(parsed),
      firstItemKeys: parsed[0] && typeof parsed[0] === "object" && !Array.isArray(parsed[0])
        ? Object.keys(parsed[0]).slice(0, 40)
        : [],
    };
  }

  if (parsed && typeof parsed === "object") {
    const groups = fieldGroups(parsed);
    return {
      rootKind: "object",
      topLevelKeys: Object.keys(parsed),
      ...groups,
      nestedKeySample: nestedKeySample(parsed),
    };
  }

  return {
    rootKind: valueKind(parsed),
  };
}

function schemaFingerprintForText(text) {
  const headings = text
    .split(/\r?\n/)
    .filter((line) => /^#{1,4}\s+/.test(line))
    .slice(0, 30);
  return {
    rootKind: "text",
    lineCount: text.length ? text.split(/\r?\n/).length : 0,
    headings,
  };
}

function classifySource(sourcePath) {
  const filename = path.basename(sourcePath);
  const lower = sourcePath.toLowerCase();
  const dryRunTarget = DRY_RUN_TARGETS.has(sourcePath);

  let truthLevel = "candidate";
  if (
    lower.includes("policy") ||
    lower.includes("policies") ||
    lower.includes("contract") ||
    lower.includes("schema") ||
    lower.includes("catalog") ||
    lower.includes("registry")
  ) {
    truthLevel = "policy";
  }
  if (lower.includes("runtime-status") || lower.includes("reference.") || lower.includes("reference-")) {
    truthLevel = "runtime-truth";
  }
  if (lower.includes("audit") || lower.includes("report") || lower.endsWith(".md")) {
    truthLevel = "historical";
  }
  if (lower.includes("legacy")) {
    truthLevel = "legacy-reference";
  }
  if (filename === "page-runtime-status.json") {
    truthLevel = "runtime-truth";
  }

  let importPolicy = "candidate";
  if (truthLevel === "policy" || truthLevel === "runtime-truth" || dryRunTarget) {
    importPolicy = "project";
  } else if (truthLevel === "historical") {
    importPolicy = "knowledge";
  }

  const targetProjections = new Set();
  if (importPolicy !== "exclude") targetProjections.add("knowledge");
  if (
    dryRunTarget ||
    lower.includes("component") ||
    lower.includes("slot") ||
    lower.includes("asset") ||
    lower.includes("page-runtime") ||
    lower.includes("journey") ||
    lower.includes("workbench-target")
  ) {
    targetProjections.add("ontology");
  }
  if (
    dryRunTarget ||
    lower.includes("policy") ||
    lower.includes("contract") ||
    lower.includes("component-rebuild") ||
    lower.includes("image-asset-registry") ||
    lower.includes("interaction-component")
  ) {
    targetProjections.add("builder-contract");
  }

  return {
    owner: "clonellm",
    importPolicy,
    truthLevel,
    freshnessPolicy: truthLevel === "historical" || truthLevel === "legacy-reference" ? "provenance-only" : "required",
    targetProjections: [...targetProjections].sort(),
    dryRunTarget,
  };
}

function buildSourceRecord(filePath) {
  const sourcePath = relativePath(filePath);
  const buffer = fs.readFileSync(filePath);
  const text = buffer.toString("utf8");
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  const record = {
    sourcePath,
    exists: true,
    sourceHash: sha256(buffer),
    byteSize: buffer.length,
    modifiedAt: stat.mtime.toISOString(),
    fileType: ext ? ext.slice(1) : "unknown",
    schemaFingerprint: null,
    parseStatus: "not-parsed",
    ...classifySource(sourcePath),
  };

  if (ext === ".json") {
    try {
      record.schemaFingerprint = schemaFingerprintForJson(JSON.parse(text));
      record.parseStatus = "parsed";
    } catch (error) {
      record.schemaFingerprint = { rootKind: "invalid-json" };
      record.parseStatus = "parse-error";
      record.parseError = String(error?.message || error);
    }
  } else if (ext === ".md" || ext === ".txt") {
    record.schemaFingerprint = schemaFingerprintForText(text);
    record.parseStatus = "parsed";
  } else {
    record.schemaFingerprint = { rootKind: "binary-or-unknown" };
  }

  return record;
}

function buildInventory() {
  if (!fs.existsSync(NORMALIZED_DIR)) {
    throw new Error(`Missing normalized data directory: ${relativePath(NORMALIZED_DIR)}`);
  }

  const sources = listFiles(NORMALIZED_DIR)
    .map((filePath) => ({ filePath, sourcePath: relativePath(filePath) }))
    .filter(({ sourcePath }) => !EXCLUDED_RELATIVE_PATHS.has(sourcePath))
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))
    .map(({ filePath }) => buildSourceRecord(filePath));

  const dryRunTargets = [...DRY_RUN_TARGETS].sort().map((sourcePath) => {
    const record = sources.find((item) => item.sourcePath === sourcePath);
    return {
      sourcePath,
      exists: Boolean(record),
      sourceHash: record?.sourceHash || null,
      truthLevel: record?.truthLevel || null,
      targetProjections: record?.targetProjections || [],
    };
  });

  const summary = {
    totalSources: sources.length,
    parsedSources: sources.filter((item) => item.parseStatus === "parsed").length,
    parseErrors: sources.filter((item) => item.parseStatus === "parse-error").length,
    dryRunTargetsPresent: dryRunTargets.filter((item) => item.exists).length,
    dryRunTargetsExpected: dryRunTargets.length,
    byTruthLevel: countBy(sources, "truthLevel"),
    byImportPolicy: countBy(sources, "importPolicy"),
    byProjection: countProjectionTargets(sources),
  };

  return {
    projectionVersion: PROJECTION_VERSION,
    generatedAt: new Date().toISOString(),
    sourceRoot: "data/normalized",
    outputPath: relativePath(OUTPUT_PATH),
    summary,
    dryRunTargets,
    sources,
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countProjectionTargets(items) {
  return items.reduce((acc, item) => {
    for (const target of item.targetProjections || []) {
      acc[target] = (acc[target] || 0) + 1;
    }
    return acc;
  }, {});
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const inventory = buildInventory();
  const output = stableJson(inventory);

  if (checkOnly) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.error(`Missing inventory output: ${relativePath(OUTPUT_PATH)}`);
      process.exitCode = 1;
      return;
    }
    const current = fs.readFileSync(OUTPUT_PATH, "utf8");
    const normalizeGeneratedAt = (text) => text.replace(/"generatedAt": "[^"]+"/, '"generatedAt": "<ignored>"');
    if (normalizeGeneratedAt(current) !== normalizeGeneratedAt(output)) {
      console.error(`Inventory output is stale: ${relativePath(OUTPUT_PATH)}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Inventory output is current: ${relativePath(OUTPUT_PATH)}`);
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`Wrote ${relativePath(OUTPUT_PATH)}`);
  console.log(`Sources: ${inventory.summary.totalSources}`);
  console.log(`Dry-run targets: ${inventory.summary.dryRunTargetsPresent}/${inventory.summary.dryRunTargetsExpected}`);
  if (inventory.summary.parseErrors) {
    console.log(`Parse errors: ${inventory.summary.parseErrors}`);
  }
}

main();
