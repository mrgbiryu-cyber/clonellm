#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  listLocalPlanningScenarios,
  runLocalPlanningProvider,
  createLocalPlanningFoundation,
} = require("../design-pipeline");

function parseArgs(argv = []) {
  const parsed = {
    scenario: "home-top-stage",
    stage: "brief",
    pretty: false,
    listScenarios: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "").trim();
    if (!token) continue;
    if (token === "--list-scenarios") {
      parsed.listScenarios = true;
      continue;
    }
    if (token === "--pretty") {
      parsed.pretty = true;
      continue;
    }
    if (token === "--scenario" && argv[index + 1]) {
      parsed.scenario = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === "--input" && argv[index + 1]) {
      parsed.inputPath = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === "--stage" && argv[index + 1]) {
      parsed.stage = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === "--concept" && argv[index + 1]) {
      parsed.selectedConceptLabel = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === "--concept-id" && argv[index + 1]) {
      parsed.selectedConceptId = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === "--concept-index" && argv[index + 1]) {
      parsed.selectedConceptIndex = Number.parseInt(argv[index + 1], 10);
      index += 1;
    }
  }
  return parsed;
}

function readJsonInput(inputPath = "") {
  if (!String(inputPath || "").trim()) return {};
  const resolvedPath = path.resolve(inputPath);
  return JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
}

function printJson(value, pretty = false) {
  const spacing = pretty ? 2 : 0;
  process.stdout.write(`${JSON.stringify(value, null, spacing)}\n`);
}

const args = parseArgs(process.argv.slice(2));

if (args.listScenarios) {
  printJson(listLocalPlanningScenarios(), true);
  process.exit(0);
}

const input = readJsonInput(args.inputPath);
const options = {
  scenarioId: args.scenario,
  selectedConceptId: args.selectedConceptId,
  selectedConceptLabel: args.selectedConceptLabel,
  selectedConceptIndex: args.selectedConceptIndex,
};

const result = args.stage === "foundation"
  ? createLocalPlanningFoundation(input, options)
  : runLocalPlanningProvider(input, options);

printJson(result, args.pretty);
