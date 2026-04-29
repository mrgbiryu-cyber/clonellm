import fs from "node:fs";
import path from "node:path";
import {
  DRY_RUN_SOURCE_PATHS,
  EXPORT_ROOT,
  MANIFEST_PATH,
  fromRoot,
  getSourceRecord,
  loadInventory,
  readJsonAbsolute,
  relativeFromRoot,
  sha256File,
  writeJson,
} from "./openwebui-export-utils.mjs";
import { exportOpenWebui } from "./export-openwebui.mjs";
import {
  validateBuilderContract,
  validateConceptAgainstContract,
  validateConceptPayload,
} from "./openwebui-builder-validators.mjs";

const REPORT_PATH = "exports/openwebui/phase0d-dry-run-report.json";
const SAMPLE_REQUEST_PATH = "data/normalized/sample-openwebui-builder-request-v1.json";

function gate(name, blocking, fn) {
  try {
    const detail = fn();
    return { name, blocking, status: "pass", detail: detail || {} };
  } catch (error) {
    return {
      name,
      blocking,
      status: "fail",
      error: String(error?.message || error),
    };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readManifest() {
  return readJsonAbsolute(MANIFEST_PATH);
}

function readBuilderContract(manifest = readManifest()) {
  const entry = manifest.files.find((item) => item.projectionType === "builder-contract");
  assert(entry, "Missing builder-contract manifest entry");
  return readJsonAbsolute(fromRoot(entry.projection));
}

function readOntology(manifest = readManifest()) {
  const entry = manifest.files.find((item) => item.projectionType === "ontology");
  assert(entry, "Missing ontology manifest entry");
  return readJsonAbsolute(fromRoot(entry.projection));
}

function sourceExistenceGate() {
  const inventory = loadInventory();
  const targets = DRY_RUN_SOURCE_PATHS.map((sourcePath) => getSourceRecord(inventory, sourcePath));
  return { targetCount: targets.length, sources: targets.map((item) => item.sourcePath) };
}

function sourceHashGate() {
  const inventory = loadInventory();
  for (const sourcePath of DRY_RUN_SOURCE_PATHS) {
    const record = getSourceRecord(inventory, sourcePath);
    const actualHash = sha256File(fromRoot(sourcePath));
    assert(record.sourceHash === actualHash, `Inventory sourceHash mismatch: ${sourcePath}`);
  }
  return { checked: DRY_RUN_SOURCE_PATHS.length };
}

function knowledgeMetadataGate() {
  const manifest = readManifest();
  const entries = manifest.files.filter((item) => item.projectionType === "knowledge");
  assert(entries.length >= 5, "Expected at least 5 knowledge projections");
  for (const entry of entries) {
    const projection = readJsonAbsolute(fromRoot(entry.projection));
    for (const field of ["collection", "truthLevel", "sourcePath", "sourceHash", "projectionVersion", "markdown"]) {
      assert(projection[field], `Knowledge projection missing ${field}: ${entry.projection}`);
    }
  }
  return { checked: entries.length };
}

function builderContractGate() {
  const contract = readBuilderContract();
  const result = validateBuilderContract(contract);
  assert(result.ok, JSON.stringify(result.errors, null, 2));
  return {
    pages: contract.pages.length,
    slots: contract.slots.length,
    components: contract.components.length,
    assets: contract.assets.length,
  };
}

function conceptPayloadGate() {
  const payload = readJsonAbsolute(fromRoot(SAMPLE_REQUEST_PATH));
  const result = validateConceptPayload(payload);
  assert(result.ok, JSON.stringify(result.errors, null, 2));
  return {
    sampleRequest: SAMPLE_REQUEST_PATH,
    pageId: payload.pageId,
    viewportProfile: payload.viewportProfile,
    slots: payload.conceptPackage.targetGroup.slotIds,
  };
}

function conceptAgainstContractGate() {
  const payload = readJsonAbsolute(fromRoot(SAMPLE_REQUEST_PATH));
  const contract = readBuilderContract();
  const result = validateConceptAgainstContract(payload, contract);
  assert(result.ok, JSON.stringify(result.errors, null, 2));
  return {
    pageId: payload.pageId,
    viewportProfile: payload.viewportProfile,
    componentIds: payload.conceptPackage.targetGroup.componentIds,
  };
}

function projectionConsistencyGate() {
  const manifest = readManifest();
  const knowledgeText = manifest.files
    .filter((item) => item.projectionType === "knowledge")
    .map((item) => readJsonAbsolute(fromRoot(item.projection)).markdown)
    .join("\n");
  const contract = readBuilderContract(manifest);
  assert(knowledgeText.includes("background-only"), "Knowledge projections do not mention background-only");
  assert(knowledgeText.includes("promo-complete"), "Knowledge projections do not mention promo-complete");
  assert(contract.assetRolePolicies.some((item) => item.allowedRoles.includes("background-only")), "Builder contract does not allow background-only anywhere");
  assert(contract.assetRolePolicies.some((item) => item.forbiddenRoles.includes("promo-complete")), "Builder contract does not forbid promo-complete anywhere");
  return { checked: true };
}

function ontologyReferentialIntegrityGate() {
  const ontology = readOntology();
  const entityIds = new Set(ontology.entities.map((entity) => entity.id));
  for (const edge of ontology.edges) {
    assert(entityIds.has(edge.sourceId), `Missing edge source: ${edge.id}`);
    assert(entityIds.has(edge.targetId), `Missing edge target: ${edge.id}`);
  }
  return { entities: ontology.entities.length, edges: ontology.edges.length };
}

function ontologyCanonicalPathGate() {
  const ontology = readOntology();
  assert(ontology.entities.some((item) => item.id === "Page:home"), "Missing Page:home");
  assert(ontology.entities.some((item) => item.id === "Slot:home.hero"), "Missing Slot:home.hero");
  assert(ontology.entities.some((item) => item.id === "Component:home.hero"), "Missing Component:home.hero");
  assert(ontology.edges.some((item) => item.sourceId === "Page:home" && item.relation === "has_slot" && item.targetId === "Slot:home.hero"), "Missing Page:home has_slot Slot:home.hero");
  assert(ontology.edges.some((item) => item.sourceId === "Slot:home.hero" && item.relation === "implemented_by" && item.targetId === "Component:home.hero"), "Missing Slot:home.hero implemented_by Component:home.hero");
  return { path: "Page:home -> Slot:home.hero -> Component:home.hero" };
}

function ontologyRoleConstraintGate() {
  const ontology = readOntology();
  const entityById = new Map(ontology.entities.map((entity) => [entity.id, entity]));
  for (const edge of ontology.edges) {
    if (edge.relation !== "usable_for" || !edge.targetId.endsWith(".hero")) continue;
    const source = entityById.get(edge.sourceId);
    assert(source?.properties?.role !== "promo-complete", `promo-complete asset usable_for hero: ${edge.sourceId}`);
  }
  return { checked: true };
}

function importManifestIntegrityGate() {
  const manifest = readManifest();
  for (const file of manifest.files) {
    assert(fs.existsSync(fromRoot(file.projection)), `Projection missing: ${file.projection}`);
    assert(sha256File(fromRoot(file.projection)) === file.projectionHash, `Projection hash mismatch: ${file.projection}`);
    assert(sha256File(fromRoot(file.source)) === file.sourceHash, `Source hash mismatch: ${file.source}`);
  }
  return { checked: manifest.files.length };
}

function llmReadabilityNote() {
  return {
    status: "not-run",
    reason: "Phase 0D blocking gate is deterministic-only. LLM readability remains optional.",
  };
}

export function runPhase0dDryRun() {
  exportOpenWebui();
  const gates = [
    gate("Source existence", true, sourceExistenceGate),
    gate("Source hash", true, sourceHashGate),
    gate("Knowledge projection metadata", true, knowledgeMetadataGate),
    gate("Builder contract validation", true, builderContractGate),
    gate("Concept payload validation", true, conceptPayloadGate),
    gate("Concept vs contract validation", true, conceptAgainstContractGate),
    gate("Projection consistency", true, projectionConsistencyGate),
    gate("Ontology referential integrity", true, ontologyReferentialIntegrityGate),
    gate("Ontology canonical path", true, ontologyCanonicalPathGate),
    gate("Ontology role constraint", true, ontologyRoleConstraintGate),
    gate("import-manifest integrity", true, importManifestIntegrityGate),
    { name: "LLM readability", blocking: false, status: "skipped", detail: llmReadabilityNote() },
  ];
  const failedBlocking = gates.filter((item) => item.blocking && item.status !== "pass");
  const report = {
    reportVersion: "openwebui-phase0d-dry-run-v1",
    generatedAt: new Date().toISOString(),
    status: failedBlocking.length ? "failed" : "passed",
    exportRoot: relativeFromRoot(EXPORT_ROOT),
    sampleRequestPath: SAMPLE_REQUEST_PATH,
    gates,
  };
  writeJson(REPORT_PATH, report);
  if (failedBlocking.length) {
    throw new Error(`Phase 0D dry-run failed: ${failedBlocking.map((item) => item.name).join(", ")}`);
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runPhase0dDryRun();
  console.log(`Phase 0D dry-run ${report.status}`);
  console.log(`Report: ${REPORT_PATH}`);
}
