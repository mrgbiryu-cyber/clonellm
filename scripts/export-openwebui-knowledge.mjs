import path from "node:path";
import {
  EXPORT_ROOT,
  DRY_RUN_SOURCE_PATHS,
  collectionForSource,
  emptyDir,
  freshnessForTruthLevel,
  getSourceRecord,
  loadInventory,
  readJson,
  slugify,
  unique,
  writeJson,
} from "./openwebui-export-utils.mjs";

function describeSource(sourcePath, data) {
  if (sourcePath.includes("asset-role-policies")) {
    const policies = Array.isArray(data.policies) ? data.policies : [];
    return {
      title: "LGE Asset Role Policies",
      summary: `${policies.length} asset role policies covering stage hero, quickmenu icon family, banner, commerce, benefit, and PDP summary usage.`,
      markdown: [
        "# LGE Asset Role Policies",
        "",
        ...policies.flatMap((policy) => [
          `## ${policy.label || policy.policyId}`,
          "",
          `- policyId: ${policy.policyId}`,
          `- targetSlots: ${unique(policy.targetSlots).join(", ")}`,
          `- imageUsageMode: ${policy.imageUsageMode || ""}`,
          `- allowedBackgroundRoles: ${unique(policy.allowedBackgroundRoles).join(", ") || "n/a"}`,
          `- allowedPrimaryRoles: ${unique(policy.allowedPrimaryRoles).join(", ") || "n/a"}`,
          `- allowedAccentRoles: ${unique(policy.allowedAccentRoles).join(", ") || "n/a"}`,
          `- disallowPromoReoverlay: ${Boolean(policy.disallowPromoReoverlay)}`,
          "",
          ...(policy.notes || []).map((note) => `- note: ${note}`),
          "",
        ]),
      ].join("\n"),
      metadata: {
        assetRoleIds: policies.map((policy) => policy.policyId),
        tags: ["#policy", "#asset-role", "#guardrail"],
      },
    };
  }

  if (sourcePath.includes("component-rebuild-schema-catalog")) {
    const families = Array.isArray(data.families) ? data.families : [];
    const assignments = Array.isArray(data.assignments) ? data.assignments : [];
    return {
      title: "LGE Component Rebuild Schema Catalog",
      summary: `${families.length} component family schemas and ${assignments.length} component assignments.`,
      markdown: [
        "# LGE Component Rebuild Schema Catalog",
        "",
        "## Families",
        "",
        ...families.flatMap((family) => [
          `### ${family.id}`,
          "",
          `- label: ${family.label || ""}`,
          `- useWhen: ${family.useWhen || ""}`,
          `- layoutBlocks: ${unique(family.layoutBlocks).join(", ")}`,
          `- requiredFields: ${unique(family.requiredFields).join(", ")}`,
          `- assetNeeds: ${unique(family.assetNeeds).join(", ")}`,
          "",
        ]),
        "## Assignments",
        "",
        ...assignments.map((assignment) => `- ${assignment.componentId} -> ${assignment.familyId}`),
      ].join("\n"),
      metadata: {
        componentIds: assignments.map((assignment) => assignment.componentId),
        tags: ["#component", "#schema", "#builder-contract"],
      },
    };
  }

  if (sourcePath.includes("image-asset-registry")) {
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const roleCounts = assets.reduce((acc, asset) => {
      const role = asset.role || "unknown";
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    return {
      title: "LGE Image Asset Registry",
      summary: `${assets.length} image assets with role, status, slot, component, and viewport variant metadata.`,
      markdown: [
        "# LGE Image Asset Registry",
        "",
        `- registryKind: ${data.registryKind || ""}`,
        `- statusValues: ${unique(data.statusValues).join(", ")}`,
        `- totalAssets: ${assets.length}`,
        "",
        "## Role Counts",
        "",
        ...Object.entries(roleCounts).sort().map(([role, count]) => `- ${role}: ${count}`),
        "",
        "## Representative Assets",
        "",
        ...assets.slice(0, 80).flatMap((asset) => [
          `### ${asset.assetId}`,
          "",
          `- status: ${asset.status || ""}`,
          `- role: ${asset.role || ""}`,
          `- targetSlots: ${unique(asset.targetSlots).join(", ")}`,
          `- componentIds: ${unique(asset.componentIds).join(", ")}`,
          `- allowedUse: ${unique(asset.allowedUse).join(", ")}`,
          `- forbiddenUse: ${unique(asset.forbiddenUse).join(", ")}`,
          `- description: ${asset.llmDescription || asset.semanticRole || ""}`,
          "",
        ]),
      ].join("\n"),
      metadata: {
        assetRoleIds: Object.keys(roleCounts),
        tags: ["#asset", "#asset-role", "#registry"],
      },
    };
  }

  if (sourcePath.includes("page-runtime-status")) {
    const pages = Array.isArray(data.pages) ? data.pages : [];
    return {
      title: "LGE Page Runtime Status",
      summary: `${pages.length} pages with runtime, asset, and asset contract status by viewport.`,
      markdown: [
        "# LGE Page Runtime Status",
        "",
        `- generatedAt: ${data.generatedAt || ""}`,
        `- principle: ${data.principle || ""}`,
        `- viewports: ${unique(data.viewports).join(", ")}`,
        "",
        "## Pages",
        "",
        ...pages.flatMap((page) => [
          `### ${page.pageId}`,
          "",
          `- label: ${page.label || ""}`,
          `- targetKind: ${page.targetKind || ""}`,
          `- runtimeStatus: ${page.runtimeStatus || ""}`,
          `- assetStatus: ${page.assetStatus || ""}`,
          `- assetContractStatus: ${page.assetContractStatus || ""}`,
          `- staleBlueprintSignal: ${Boolean(page.staleBlueprintSignal)}`,
          `- viewportProfiles: ${unique((page.viewports || []).map((item) => item.viewportProfile)).join(", ")}`,
          "",
        ]),
      ].join("\n"),
      metadata: {
        pageId: "all",
        tags: ["#runtime-truth", "#page", "#validation"],
      },
    };
  }

  if (sourcePath.includes("section-family-contracts")) {
    const families = data.families || {};
    return {
      title: "LGE Section Family Contracts",
      summary: `${Object.keys(families).length} section family contracts and global design guardrails.`,
      markdown: [
        "# LGE Section Family Contracts",
        "",
        "## Global Principles",
        "",
        ...(data.global?.principles || []).map((item) => `- ${item}`),
        "",
        "## Families",
        "",
        ...Object.entries(families).flatMap(([familyId, family]) => [
          `### ${familyId}`,
          "",
          `- label: ${family.label || ""}`,
          `- targetSlots: ${unique(family.targetSlots).join(", ")}`,
          `- primaryGoal: ${family.primaryGoal || ""}`,
          "",
          ...(family.must || []).map((item) => `- must: ${item}`),
          ...(family.avoid || []).map((item) => `- avoid: ${item}`),
          "",
        ]),
      ].join("\n"),
      metadata: {
        slots: Object.values(families).flatMap((family) => family.targetSlots || []),
        tags: ["#policy", "#component", "#section-family"],
      },
    };
  }

  return {
    title: sourcePath,
    summary: "Open WebUI knowledge projection source.",
    markdown: `# ${sourcePath}\n\nThis source is included in the Open WebUI export.`,
    metadata: {
      tags: ["#openwebui"],
    },
  };
}

export function buildKnowledgeProjections() {
  const inventory = loadInventory();
  return DRY_RUN_SOURCE_PATHS.map((sourcePath) => {
    const record = getSourceRecord(inventory, sourcePath);
    const data = readJson(sourcePath);
    const description = describeSource(sourcePath, data);
    return {
      projectionVersion: "knowledge-projection-v1",
      documentId: `knowledge.${slugify(path.basename(sourcePath, ".json"))}`,
      collection: collectionForSource(sourcePath),
      truthLevel: record.truthLevel,
      freshness: freshnessForTruthLevel(record.truthLevel),
      sourcePath,
      sourceHash: record.sourceHash,
      generatedAt: new Date().toISOString(),
      title: description.title,
      summary: description.summary,
      markdown: description.markdown,
      metadata: description.metadata,
    };
  });
}

export function writeKnowledgeProjections() {
  emptyDir(path.join(EXPORT_ROOT, "knowledge"));
  return buildKnowledgeProjections().map((projection) => {
    const relativePath = `exports/openwebui/knowledge/${projection.collection}/${slugify(projection.documentId)}.json`;
    writeJson(relativePath, projection);
    return relativePath;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = writeKnowledgeProjections();
  console.log(`Wrote ${files.length} knowledge projections`);
}
