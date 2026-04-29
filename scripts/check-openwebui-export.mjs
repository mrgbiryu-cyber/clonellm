import fs from "node:fs";
import {
  EXPORT_ROOT,
  MANIFEST_PATH,
  fromRoot,
  loadInventory,
  readJsonAbsolute,
  sha256File,
} from "./openwebui-export-utils.mjs";

const REQUIRED_KNOWLEDGE_FIELDS = [
  "projectionVersion",
  "documentId",
  "collection",
  "truthLevel",
  "freshness",
  "sourcePath",
  "sourceHash",
  "generatedAt",
  "title",
  "markdown",
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readProjection(relativePath) {
  return readJsonAbsolute(fromRoot(relativePath));
}

function checkManifest(inventory) {
  assert(fs.existsSync(MANIFEST_PATH), "Missing exports/openwebui/import-manifest.json");
  const manifest = readJsonAbsolute(MANIFEST_PATH);
  assert(manifest.manifestVersion === "import-manifest-v1", "Invalid manifestVersion");
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, "Manifest has no files");

  for (const file of manifest.files) {
    assert(file.source, "Manifest file missing source");
    assert(file.sourceHash, `Manifest entry missing sourceHash: ${file.projection}`);
    assert(file.projection, "Manifest entry missing projection");
    assert(file.projectionHash, `Manifest entry missing projectionHash: ${file.projection}`);
    assert(file.projectionType, `Manifest entry missing projectionType: ${file.projection}`);
    assert(file.truthLevel, `Manifest entry missing truthLevel: ${file.projection}`);
    assert(file.freshness, `Manifest entry missing freshness: ${file.projection}`);

    const projectionPath = fromRoot(file.projection);
    assert(fs.existsSync(projectionPath), `Projection file missing: ${file.projection}`);
    assert(sha256File(projectionPath) === file.projectionHash, `Projection hash mismatch: ${file.projection}`);

    const sourceRecord = (inventory.sources || []).find((item) => item.sourcePath === file.source);
    assert(sourceRecord, `Source not found in inventory: ${file.source}`);
    assert(sourceRecord.sourceHash === file.sourceHash, `Source hash mismatch: ${file.source}`);
  }
  return manifest;
}

function checkKnowledge(manifest) {
  const knowledgeEntries = manifest.files.filter((item) => item.projectionType === "knowledge");
  assert(knowledgeEntries.length >= 5, "Expected at least 5 knowledge projections");
  for (const entry of knowledgeEntries) {
    const projection = readProjection(entry.projection);
    for (const field of REQUIRED_KNOWLEDGE_FIELDS) {
      assert(projection[field] !== undefined && projection[field] !== "", `Knowledge projection missing ${field}: ${entry.projection}`);
    }
    assert(projection.projectionVersion === "knowledge-projection-v1", `Invalid knowledge projectionVersion: ${entry.projection}`);
    assert(typeof projection.markdown === "string" && projection.markdown.length > 80, `Knowledge markdown too small: ${entry.projection}`);
  }
}

function checkBuilderContract(manifest) {
  const entry = manifest.files.find((item) => item.projectionType === "builder-contract");
  assert(entry, "Missing builder-contract projection");
  const contract = readProjection(entry.projection);
  assert(contract.builderContractVersion === "builder-contract-v1", "Invalid builderContractVersion");
  for (const field of ["sourceManifest", "pages", "slots", "components", "componentFamilies", "assetRolePolicies", "assets"]) {
    assert(Array.isArray(contract[field]), `Builder contract field must be array: ${field}`);
  }
  assert(contract.pages.some((page) => page.pageId === "home"), "Builder contract missing home page");
  assert(contract.slots.some((slot) => slot.pageId === "home" && slot.slotId === "hero"), "Builder contract missing home.hero slot");
  assert(contract.components.some((component) => component.componentId === "home.hero"), "Builder contract missing home.hero component");
  assert(contract.assetRolePolicies.some((policy) => policy.policyId === "stage-hero" && policy.allowedRoles.includes("background-only")), "Builder contract missing stage-hero background-only policy");

  for (const asset of contract.assets) {
    assert(Array.isArray(asset.usableSlotIds), `Asset usableSlotIds must be array: ${asset.assetId}`);
    if (asset.role === "promo-complete") {
      assert(!asset.usableSlotIds.includes("hero"), `promo-complete asset exported as hero-usable: ${asset.assetId}`);
    }
  }

  return contract;
}

function checkOntology(manifest) {
  const entry = manifest.files.find((item) => item.projectionType === "ontology");
  assert(entry, "Missing ontology projection");
  const ontology = readProjection(entry.projection);
  assert(ontology.projectionVersion === "ontology-projection-v1", "Invalid ontology projectionVersion");
  assert(Array.isArray(ontology.entities), "Ontology entities must be array");
  assert(Array.isArray(ontology.edges), "Ontology edges must be array");

  const entityIds = new Set(ontology.entities.map((entity) => entity.id));
  for (const edge of ontology.edges) {
    assert(entityIds.has(edge.sourceId), `Ontology edge source missing: ${edge.id}`);
    assert(entityIds.has(edge.targetId), `Ontology edge target missing: ${edge.id}`);
  }

  assert(entityIds.has("Page:home"), "Ontology missing Page:home");
  assert(entityIds.has("Slot:home.hero"), "Ontology missing Slot:home.hero");
  assert(entityIds.has("Component:home.hero"), "Ontology missing Component:home.hero");
  assert(
    ontology.edges.some((edge) => edge.sourceId === "Page:home" && edge.relation === "has_slot" && edge.targetId === "Slot:home.hero"),
    "Ontology missing Page:home -> has_slot -> Slot:home.hero"
  );
  assert(
    ontology.edges.some((edge) => edge.sourceId === "Slot:home.hero" && edge.relation === "implemented_by" && edge.targetId === "Component:home.hero"),
    "Ontology missing Slot:home.hero -> implemented_by -> Component:home.hero"
  );

  for (const edge of ontology.edges) {
    if (edge.relation === "usable_for" && edge.targetId.endsWith(".hero")) {
      const source = ontology.entities.find((entity) => entity.id === edge.sourceId);
      assert(source?.properties?.role !== "promo-complete", `promo-complete asset exported as hero usable_for: ${edge.sourceId}`);
    }
  }
}

function checkProjectionConsistency(manifest) {
  const knowledgeTexts = manifest.files
    .filter((item) => item.projectionType === "knowledge")
    .map((item) => readProjection(item.projection).markdown)
    .join("\n");
  const builderContract = readProjection(manifest.files.find((item) => item.projectionType === "builder-contract").projection);
  assert(knowledgeTexts.includes("background-only"), "Knowledge projection missing background-only phrase");
  assert(knowledgeTexts.includes("Promo-complete") || knowledgeTexts.includes("promo-complete"), "Knowledge projection missing promo-complete phrase");
  assert(
    builderContract.assetRolePolicies.some((policy) => policy.allowedRoles.includes("background-only")),
    "Builder contract missing background-only role"
  );
}

function main() {
  assert(fs.existsSync(EXPORT_ROOT), "Missing exports/openwebui. Run npm run export:openwebui first.");
  const inventory = loadInventory();
  const manifest = checkManifest(inventory);
  checkKnowledge(manifest);
  checkBuilderContract(manifest);
  checkOntology(manifest);
  checkProjectionConsistency(manifest);
  console.log("Open WebUI export checks passed");
}

main();
