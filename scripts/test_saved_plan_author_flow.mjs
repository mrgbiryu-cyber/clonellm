import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  buildConceptPackageFromRequirementPlan,
  buildDesignAuthorInput,
} = require("../design-pipeline");

const WORKSPACES_PATH = path.resolve("/home/mrgbiryu/clonellm/data/runtime/workspaces.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "").trim();
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function collectRequirementPlans(root, items = []) {
  if (!root || typeof root !== "object") return items;
  if (Array.isArray(root)) {
    root.forEach((entry) => collectRequirementPlans(entry, items));
    return items;
  }
  if (
    typeof root.id === "string" &&
    typeof root.pageId === "string" &&
    (root.output?.requirementPlan || root.planningPackage || root.sectionBlueprints)
  ) {
    items.push(root);
  }
  Object.values(root).forEach((entry) => collectRequirementPlans(entry, items));
  return items;
}

function pickPlan(plans, args) {
  const planId = String(args["plan-id"] || "").trim();
  const pageId = String(args["page-id"] || "").trim();
  const viewportProfile = String(args["viewport-profile"] || "").trim();
  if (planId) {
    return plans.find((item) => String(item.id || "").trim() === planId) || null;
  }
  const filtered = plans.filter((item) => {
    if (pageId && String(item.pageId || "").trim() !== pageId) return false;
    if (viewportProfile && String(item.viewportProfile || "").trim() !== viewportProfile) return false;
    return true;
  });
  return filtered[0] || null;
}

function toList(value, limit = 8) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = readJson(WORKSPACES_PATH);
  const plans = collectRequirementPlans(payload, [])
    .filter((item) => item?.output?.requirementPlan || item?.planningPackage || item?.sectionBlueprints)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));

  const plan = pickPlan(plans, args);
  if (!plan) {
    console.error("saved_requirement_plan_not_found");
    process.exit(1);
  }

  const conceptPackage = buildConceptPackageFromRequirementPlan(plan, {
    targetGroupId: plan.targetGroupId,
    targetGroupLabel: plan.targetGroupLabel,
    targetScope: plan.targetScope || plan?.input?.userInput?.targetScope,
    patchDepth: plan.patchDepth || plan?.input?.userInput?.patchDepth,
    designChangeLevel: plan.designChangeLevel || plan?.input?.userInput?.designChangeLevel,
  });

  const authorInput = buildDesignAuthorInput({
    pageId: plan.pageId,
    viewportProfile: plan.viewportProfile || "pc",
    conceptPackage,
    referenceContext: {
      currentPageHtmlExcerpt: "",
      currentPageAssetMap: {},
    },
    currentSectionContext: {
      currentSectionHtmlMap: {},
      currentSectionAssetMap: {},
    },
  });

  const result = {
    plan: {
      id: String(plan.id || "").trim(),
      pageId: String(plan.pageId || "").trim(),
      viewportProfile: String(plan.viewportProfile || "").trim(),
      title: String(plan.title || plan?.output?.requirementPlan?.title || "").trim(),
    },
    savedPlanShape: {
      targetGroupId: String(plan.targetGroupId || "").trim(),
      targetGroupLabel: String(plan.targetGroupLabel || "").trim(),
      targetComponentsCount: Array.isArray(plan.targetComponents) ? plan.targetComponents.length : 0,
      targetComponentsSample: toList(plan.targetComponents),
      sectionBlueprintCount: Array.isArray(plan.sectionBlueprints) ? plan.sectionBlueprints.length : 0,
      sectionBlueprintSample: toList(plan.sectionBlueprints).map((item) => ({
        slotId: item?.slotId || "",
        label: item?.label || "",
      })),
      planningPackageKeys:
        plan.planningPackage && typeof plan.planningPackage === "object"
          ? Object.keys(plan.planningPackage)
          : [],
      selectedConceptId: String(plan?.selectedConcept?.conceptId || "").trim(),
      conceptPlanCount: Array.isArray(plan.conceptPlans) ? plan.conceptPlans.length : 0,
    },
    conceptPackage: {
      selectedConceptId: String(conceptPackage.selectedConceptId || "").trim(),
      targetGroup: conceptPackage.executionBrief?.targetGroup || {},
      sectionBlueprintCount: Array.isArray(conceptPackage.executionBrief?.sectionBlueprints)
        ? conceptPackage.executionBrief.sectionBlueprints.length
        : 0,
    },
    designAuthorPacket: {
      sectionCount: authorInput.packetStats?.sectionCount || 0,
      slotIds: Array.isArray(authorInput.designAuthorPacket?.sections)
        ? authorInput.designAuthorPacket.sections.map((item) => item.slotId)
        : [],
      componentIds: Array.isArray(authorInput.designAuthorPacket?.sections)
        ? authorInput.designAuthorPacket.sections.map((item) => item.componentId)
        : [],
    },
  };

  console.log(JSON.stringify(result, null, 2));
  if ((authorInput.packetStats?.sectionCount || 0) <= 0) {
    process.exitCode = 2;
  }
}

main();
