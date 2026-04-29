#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  saveGeneratedAssetFamilyPackage,
  removeGeneratedAssetFamilyPackage,
  normalizeGeneratedFamilyPackage,
} = require("../design-pipeline/asset-family");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/register_asset_family_package.mjs --manifest <path>",
      "  node scripts/register_asset_family_package.mjs --remove <assetFamilyId>",
    ].join("\n")
  );
}

function parseArgs(argv = []) {
  const args = { manifest: "", remove: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "").trim();
    if (token === "--manifest") {
      args.manifest = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (token === "--remove") {
      args.remove = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
  }
  return args;
}

function assertValidManifest(manifest = {}) {
  const normalized = normalizeGeneratedFamilyPackage(manifest);
  if (!normalized.assetFamilyId) {
    throw new Error("manifest must include assetFamilyId");
  }
  if (!normalized.familyId) {
    throw new Error("manifest must include familyId");
  }
  if (!Array.isArray(normalized.members) || !normalized.members.length) {
    throw new Error("manifest must include at least one member");
  }
  return normalized;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.remove) {
    const removed = removeGeneratedAssetFamilyPackage(args.remove);
    console.log(JSON.stringify({ removed, assetFamilyId: args.remove }, null, 2));
    return;
  }

  if (!args.manifest) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const manifestPath = path.resolve(process.cwd(), args.manifest);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest not found: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  const normalized = assertValidManifest(manifest);
  const saved = saveGeneratedAssetFamilyPackage(normalized);
  console.log(
    JSON.stringify(
      {
        saved: true,
        manifestPath,
        assetFamilyId: saved.assetFamilyId,
        familyId: saved.familyId,
        memberCount: Array.isArray(saved.members) ? saved.members.length : 0,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
