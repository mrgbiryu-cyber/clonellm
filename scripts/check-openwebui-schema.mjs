import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const SCHEMA_PATH = path.join(ROOT_DIR, "data", "normalized", "openwebui-projection-schema-v1.json");
const REQUIRED_SCHEMA_KEYS = [
  "knowledgeProjectionV1",
  "ontologyProjectionV1",
  "builderContractProjectionV1",
  "feedbackProjectionV1",
  "importManifestV1",
  "conceptThreadV1",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    fail(`Missing schema bundle: ${path.relative(ROOT_DIR, SCHEMA_PATH)}`);
  }

  const bundle = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  if (bundle.projectionVersion !== "openwebui-projection-schema-v1") {
    fail("Invalid projectionVersion");
  }

  for (const key of REQUIRED_SCHEMA_KEYS) {
    const schema = bundle.schemas?.[key];
    if (!schema) fail(`Missing schema: ${key}`);
    if (!schema.$id) fail(`Missing $id for schema: ${key}`);
    if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
      fail(`Invalid $schema for schema: ${key}`);
    }
    if (schema.additionalProperties !== false) {
      fail(`Canonical schema must set additionalProperties=false: ${key}`);
    }
  }

  if (!Array.isArray(bundle.constants?.canonicalOntologyEdges) || bundle.constants.canonicalOntologyEdges.length < 1) {
    fail("Missing canonical ontology edge list");
  }

  if (!Array.isArray(bundle.crossFieldRules) || bundle.crossFieldRules.length < 1) {
    fail("Missing cross-field rules");
  }

  console.log(`Schema bundle is valid: ${path.relative(ROOT_DIR, SCHEMA_PATH)}`);
}

main();
