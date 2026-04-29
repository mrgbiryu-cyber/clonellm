import path from "node:path";
import {
  EXPORT_ROOT,
  emptyDir,
  loadDryRunSources,
  sourceRefFromRecord,
  unique,
  writeJson,
} from "./openwebui-export-utils.mjs";

function buildPages(pageRuntimeStatus, assignments) {
  const componentsByPage = new Map();
  for (const assignment of assignments) {
    const [pageId, ...slotParts] = String(assignment.componentId || "").split(".");
    const slotId = slotParts.join(".");
    if (!pageId || !slotId) continue;
    if (!componentsByPage.has(pageId)) componentsByPage.set(pageId, []);
    componentsByPage.get(pageId).push(slotId);
  }
  return (pageRuntimeStatus.pages || []).map((page) => ({
    pageId: page.pageId,
    label: page.label || page.pageId,
    slotIds: unique(componentsByPage.get(page.pageId) || []),
  }));
}

function buildSlots(assignments, policies, pageRuntimeStatus) {
  const viewportByPage = new Map((pageRuntimeStatus.pages || []).map((page) => [
    page.pageId,
    unique((page.viewports || []).map((item) => item.viewportProfile)),
  ]));
  const slotMap = new Map();
  for (const assignment of assignments) {
    const [pageId, ...slotParts] = String(assignment.componentId || "").split(".");
    const slotId = slotParts.join(".");
    if (!pageId || !slotId) continue;
    const key = `${pageId}.${slotId}`;
    const existing = slotMap.get(key) || {
      slotId,
      pageId,
      componentIds: [],
      assetRolePolicyIds: [],
      viewportProfiles: viewportByPage.get(pageId) || ["pc", "mo"],
    };
    existing.componentIds.push(assignment.componentId);
    existing.assetRolePolicyIds.push(
      ...policies
        .filter((policy) => (policy.targetSlots || []).includes(slotId))
        .map((policy) => policy.policyId)
    );
    existing.componentIds = unique(existing.componentIds);
    existing.assetRolePolicyIds = unique(existing.assetRolePolicyIds);
    slotMap.set(key, existing);
  }
  return [...slotMap.values()].sort((a, b) => `${a.pageId}.${a.slotId}`.localeCompare(`${b.pageId}.${b.slotId}`));
}

function buildComponents(assignments) {
  return assignments.map((assignment) => {
    const [pageId, ...slotParts] = String(assignment.componentId || "").split(".");
    return {
      componentId: assignment.componentId,
      familyId: assignment.familyId,
      slotIds: [slotParts.join(".") || assignment.componentId],
    };
  });
}

function buildComponentFamilies(families) {
  return families.map((family) => ({
    familyId: family.id,
    contractId: family.id,
  }));
}

function buildAssetRolePolicies(policies) {
  return policies.map((policy) => ({
    policyId: policy.policyId,
    slotIds: unique(policy.targetSlots),
    allowedRoles: unique([
      ...(policy.allowedBackgroundRoles || []),
      ...(policy.allowedAccentRoles || []),
      ...(policy.allowedPrimaryRoles || []),
      ...(policy.allowedCardMediaRoles || []),
    ]),
    forbiddenRoles: policy.disallowPromoReoverlay ? ["promo-complete"] : [],
  }));
}

function buildAssets(assets) {
  return assets.map((asset) => ({
    assetId: asset.assetId,
    role: asset.role || "unknown",
    usableSlotIds: asset.role === "promo-complete" ? [] : unique(asset.targetSlots),
    variants: Object.values(asset.variants || {}).map((variant) => ({
      variantId: variant.variantId,
      viewportProfile: variant.viewportProfile,
    })).filter((variant) => variant.variantId && ["pc", "mo", "ta"].includes(variant.viewportProfile)),
  }));
}

export function buildBuilderContract() {
  const sources = loadDryRunSources();
  const sectionContracts = sources["data/normalized/section-family-contracts.json"];
  const componentCatalog = sources["data/normalized/component-rebuild-schema-catalog.json"];
  const imageRegistry = sources["data/normalized/image-asset-registry.json"];
  const rolePolicies = sources["data/normalized/asset-role-policies.json"];
  const pageRuntimeStatus = sources["data/normalized/page-runtime-status.json"];

  const assignments = componentCatalog.data.assignments || [];
  const policies = rolePolicies.data.policies || [];
  const families = componentCatalog.data.families || [];
  const assets = imageRegistry.data.assets || [];

  return {
    builderContractVersion: "builder-contract-v1",
    generatedAt: new Date().toISOString(),
    sourceManifest: [
      sourceRefFromRecord(sectionContracts.record),
      sourceRefFromRecord(componentCatalog.record),
      sourceRefFromRecord(imageRegistry.record),
      sourceRefFromRecord(rolePolicies.record),
      sourceRefFromRecord(pageRuntimeStatus.record),
    ],
    pages: buildPages(pageRuntimeStatus.data, assignments),
    slots: buildSlots(assignments, policies, pageRuntimeStatus.data),
    components: buildComponents(assignments),
    componentFamilies: buildComponentFamilies(families),
    assetRolePolicies: buildAssetRolePolicies(policies),
    assets: buildAssets(assets),
  };
}

export function writeBuilderContract() {
  emptyDir(path.join(EXPORT_ROOT, "builder-contract"));
  const relativePath = "exports/openwebui/builder-contract/builder-contract-v1.json";
  writeJson(relativePath, buildBuilderContract());
  return relativePath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = writeBuilderContract();
  console.log(`Wrote ${file}`);
}
