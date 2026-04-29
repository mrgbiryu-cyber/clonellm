import fs from "node:fs";
import {
  EXPORT_ROOT,
  MANIFEST_PATH,
  collectionForSource,
  emptyDir,
  freshnessForTruthLevel,
  listFilesRecursive,
  loadInventory,
  relativeFromRoot,
  sha256File,
  writeJson,
} from "./openwebui-export-utils.mjs";
import { writeKnowledgeProjections } from "./export-openwebui-knowledge.mjs";
import { writeBuilderContract } from "./export-builder-contract-v1.mjs";
import { writeOntologyProjection } from "./export-openwebui-ontology.mjs";

function projectionTypeForPath(relativePath) {
  if (relativePath.includes("/knowledge/")) return "knowledge";
  if (relativePath.includes("/ontology/")) return "ontology";
  if (relativePath.includes("/builder-contract/")) return "builder-contract";
  return "unknown";
}

function manifestEntriesForFiles(files, inventory) {
  return files.map((projection) => {
    const projectionType = projectionTypeForPath(projection);
    const absoluteProjection = fs.realpathSync(projection);
    const parsed = JSON.parse(fs.readFileSync(absoluteProjection, "utf8"));
    const sourcePath = parsed.sourcePath || parsed.sourceManifest?.[0]?.sourcePath || "data/normalized/openwebui-source-inventory.json";
    const sourceRecord = (inventory.sources || []).find((item) => item.sourcePath === sourcePath) || null;
    const truthLevel = parsed.truthLevel || sourceRecord?.truthLevel || "policy";
    return {
      source: sourcePath,
      sourceHash: parsed.sourceHash || parsed.sourceManifest?.[0]?.sourceHash || sourceRecord?.sourceHash,
      projection,
      projectionHash: sha256File(absoluteProjection),
      projectionType,
      collection: parsed.collection || (sourceRecord ? collectionForSource(sourceRecord.sourcePath) : undefined),
      truthLevel,
      freshness: parsed.freshness || freshnessForTruthLevel(truthLevel),
    };
  });
}

export function exportOpenWebui() {
  emptyDir(EXPORT_ROOT);
  const inventory = loadInventory();
  const projectionFiles = [
    ...writeKnowledgeProjections(),
    writeOntologyProjection(),
    writeBuilderContract(),
  ];

  const manifest = {
    manifestVersion: "import-manifest-v1",
    lastExportedAt: new Date().toISOString(),
    files: manifestEntriesForFiles(projectionFiles, inventory),
  };
  writeJson(relativeFromRoot(MANIFEST_PATH), manifest);
  return {
    manifestPath: relativeFromRoot(MANIFEST_PATH),
    files: listFilesRecursive(EXPORT_ROOT).map(relativeFromRoot).sort(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = exportOpenWebui();
  console.log(`Wrote ${result.manifestPath}`);
  console.log(`Export files: ${result.files.length}`);
}
