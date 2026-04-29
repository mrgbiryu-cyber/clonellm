"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const IMAGE_ASSET_REGISTRY_PATH = path.join(ROOT, "data", "normalized", "image-asset-registry.json");
const ICON_FAMILY_REGISTRY_PATH = path.join(ROOT, "data", "normalized", "icon-family-registry.json");
const INTERACTION_COMPONENT_REGISTRY_PATH = path.join(ROOT, "data", "normalized", "interaction-component-registry.json");

function readJsonFile(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, payload = {}) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeRegistryStatus(value = "") {
  const normalized = String(value || "").trim();
  return ["candidate", "approved", "blocked", "retired"].includes(normalized) ? normalized : "";
}

function toStringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeScopeToken(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function listMatchesScopeValue(list = [], value = "") {
  const source = toStringList(list);
  const exact = String(value || "").trim();
  if (!source.length) return true;
  if (source.includes(exact)) return true;
  const normalizedValue = normalizeScopeToken(exact);
  return Boolean(normalizedValue && source.some((item) => normalizeScopeToken(item) === normalizedValue));
}

function matchesScope(entry = {}, { pageId = "", slotId = "", componentId = "", viewportProfile = "" } = {}) {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedSlotId = String(slotId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  const normalizedViewport = String(viewportProfile || "").trim() || "pc";
  const pageFamilies = toStringList(entry.pageFamilies);
  const slotFamilies = toStringList(entry.slotFamilies);
  const componentIds = toStringList(entry.componentIds);
  const viewportProfiles = toStringList(entry.viewportProfiles);
  const pageOk = listMatchesScopeValue(pageFamilies, normalizedPageId);
  const slotOk = listMatchesScopeValue(slotFamilies, normalizedSlotId);
  const componentOk = listMatchesScopeValue(componentIds, normalizedComponentId);
  const viewportOk = listMatchesScopeValue(viewportProfiles, normalizedViewport);
  return pageOk && slotOk && componentOk && viewportOk;
}

function pickViewportVariant(entry = {}, viewportProfile = "pc") {
  const variants = entry?.variants && typeof entry.variants === "object" && !Array.isArray(entry.variants)
    ? entry.variants
    : {};
  const normalizedViewport = String(viewportProfile || "pc").trim() || "pc";
  const exact = variants[normalizedViewport] && typeof variants[normalizedViewport] === "object"
    ? variants[normalizedViewport]
    : null;
  if (exact) return exact;
  const fallback = variants.pc && typeof variants.pc === "object" ? variants.pc : null;
  return fallback;
}

function compactImageAssetCard(asset = {}, viewportProfile = "pc") {
  const variant = pickViewportVariant(asset, viewportProfile);
  const variantStatus = String(variant?.status || "").trim();
  const publicAssetUrl = (sourceRef = "") => {
    const ref = String(sourceRef || "").trim();
    if (!ref.startsWith("data/raw/assets/")) return "";
    const relative = ref.slice("data/raw/assets/".length);
    return `/raw-assets/${relative.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
  };
  const approvalChecklist = (() => {
    const items = [];
    if (asset.derivativeType === "text-removed") {
      items.push("텍스트 제거 파생본: 원본 blocked는 그대로 보존됨");
      items.push("잔여 텍스트/합성 흔적 확인 필요");
    }
    if (variant?.viewportProfile) items.push(`${variant.viewportProfile} variant 전용 승인 필요`);
    if (asset.role === "background-only") items.push("배경용: 새 카피 오버레이 safe area 확인 필요");
    if (asset.role === "object-only") items.push("오브젝트용: 배경/아이콘 대체 사용 금지");
    if (asset.containsText) items.push("containsText=true: 승인 전 실제 잔여 텍스트 확인 필요");
    return items;
  })();
  return {
    assetId: String(asset.assetId || "").trim(),
    status: variantStatus || String(asset.status || "candidate").trim() || "candidate",
    sourceType: String(asset.sourceType || "").trim(),
    sourceProfileId: String(asset.sourceProfileId || "").trim(),
    sourceTitle: String(asset.sourceTitle || "").trim(),
    derivativeType: String(asset.derivativeType || "").trim(),
    parentAssetId: String(asset.parentAssetId || "").trim(),
    parentVariantId: String(asset.parentVariantId || "").trim(),
    variantPolicy: String(asset.variantPolicy || "shared").trim() || "shared",
    licenseProfile: String(asset.licenseProfile || "").trim(),
    licenseUrl: String(asset.licenseUrl || "").trim(),
    attribution: String(asset.attribution || "").trim(),
    attributionRequired: String(asset.attributionRequired || "").trim(),
    licenseCheckedAt: String(asset.licenseCheckedAt || "").trim(),
    viewportProfile: String(viewportProfile || "pc").trim() || "pc",
    variant: variant
      ? {
          variantId: String(variant.variantId || "").trim(),
          status: String(variant.status || asset.status || "candidate").trim() || "candidate",
          viewportProfile: String(variant.viewportProfile || viewportProfile || "pc").trim() || "pc",
          assetUrl: String(variant.assetUrl || publicAssetUrl(variant.sourceRef || asset.sourceRef) || "").trim(),
          sourceRef: String(variant.sourceRef || "").trim(),
          sourceUrl: String(variant.sourceUrl || "").trim(),
          pageUrl: String(variant.pageUrl || asset.pageUrl || "").trim(),
          width: Number(variant.width || 0) || 0,
          height: Number(variant.height || 0) || 0,
          aspectRatio: String(variant.aspectRatio || "").trim(),
          safeArea: variant.safeArea && typeof variant.safeArea === "object" ? variant.safeArea : {},
          cropGuidance: variant.cropGuidance && typeof variant.cropGuidance === "object" ? variant.cropGuidance : {},
          processing: toStringList(variant.processing),
        }
      : null,
    role: String(asset.role || "").trim(),
    allowedUsage: toStringList(asset.allowedUsage),
    restrictedUsage: toStringList(asset.restrictedUsage),
    containsText: Boolean(asset.containsText),
    textDensity: String(asset.textDensity || "").trim(),
    visualTone: String(asset.visualTone || "").trim(),
    semanticRole: String(asset.semanticRole || "").trim(),
    llmDescription: String(asset.llmDescription || "").trim(),
    llmDo: toStringList(asset.llmDo),
    llmDont: toStringList(asset.llmDont),
    selectionHints: toStringList(asset.selectionHints),
    conflictHints: toStringList(asset.conflictHints),
    validationTags: toStringList(asset.validationTags),
    approvalChecklist,
  };
}

function compactIconFamilyCard(family = {}) {
  return {
    familyId: String(family.familyId || "").trim(),
    status: String(family.status || "candidate").trim() || "candidate",
    role: String(family.role || "icon-only").trim() || "icon-only",
    memberCount: Number(family.memberCount || 0) || (Array.isArray(family.members) ? family.members.length : 0),
    styleSummary: String(family.styleSummary || "").trim(),
    styleSpec: family.styleSpec && typeof family.styleSpec === "object" ? family.styleSpec : {},
    semanticRole: String(family.semanticRole || "").trim(),
    llmDescription: String(family.llmDescription || "").trim(),
    llmDo: toStringList(family.llmDo),
    llmDont: toStringList(family.llmDont),
    selectionHints: toStringList(family.selectionHints),
    conflictHints: toStringList(family.conflictHints),
    validationTags: toStringList(family.validationTags),
    members: Array.isArray(family.members)
      ? family.members.map((member) => ({
          label: String(member?.label || "").trim(),
          assetId: String(member?.assetId || "").trim(),
        })).filter((member) => member.label && member.assetId)
      : [],
  };
}

function compactInteractionComponentCard(component = {}) {
  return {
    interactionId: String(component.interactionId || "").trim(),
    status: String(component.status || "candidate").trim() || "candidate",
    componentType: String(component.componentType || "").trim(),
    runtimeModule: String(component.runtimeModule || "").trim(),
    semanticRole: String(component.semanticRole || "").trim(),
    llmDescription: String(component.llmDescription || "").trim(),
    llmDo: toStringList(component.llmDo),
    llmDont: toStringList(component.llmDont),
    selectionHints: toStringList(component.selectionHints),
    conflictHints: toStringList(component.conflictHints),
    stateSchema: component.stateSchema && typeof component.stateSchema === "object" ? component.stateSchema : {},
    controlSchema: component.controlSchema && typeof component.controlSchema === "object" ? component.controlSchema : {},
    verificationSchema: toStringList(component.verificationSchema),
  };
}

function readImageAssetRegistry() {
  return readJsonFile(IMAGE_ASSET_REGISTRY_PATH, { assets: [] });
}

function readIconFamilyRegistry() {
  return readJsonFile(ICON_FAMILY_REGISTRY_PATH, { families: [] });
}

function readInteractionComponentRegistry() {
  return readJsonFile(INTERACTION_COMPONENT_REGISTRY_PATH, { components: [] });
}

function updateImageAssetVariantStatus(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const assetId = String(source.assetId || "").trim();
  const viewportProfile = String(source.viewportProfile || "pc").trim() || "pc";
  const status = normalizeRegistryStatus(source.status || "");
  if (!assetId) throw new Error("asset_id_required");
  if (!status) throw new Error("valid_status_required");
  const registry = readImageAssetRegistry();
  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const asset = assets.find((item) => String(item?.assetId || "").trim() === assetId);
  if (!asset) throw new Error("image_asset_not_found");
  const variants = asset.variants && typeof asset.variants === "object" && !Array.isArray(asset.variants)
    ? asset.variants
    : {};
  const variant = variants[viewportProfile] && typeof variants[viewportProfile] === "object"
    ? variants[viewportProfile]
    : null;
  if (!variant) throw new Error("image_asset_variant_not_found");
  const nowIso = new Date().toISOString();
  variant.status = status;
  variant.reviewedAt = nowIso;
  variant.reviewedBy = String(source.reviewedBy || "").trim();
  variant.reviewNotes = String(source.reviewNotes || "").trim();
  variant.processing = Array.from(new Set([
    ...toStringList(variant.processing),
    `status-${status}`,
  ]));
  const variantStatuses = Object.values(variants)
    .map((item) => normalizeRegistryStatus(item?.status || ""))
    .filter(Boolean);
  if (variantStatuses.length && variantStatuses.every((item) => item === "approved")) {
    asset.status = "approved";
  } else if (variantStatuses.includes("blocked")) {
    asset.status = asset.status === "approved" ? "approved" : "blocked";
  } else if (variantStatuses.includes("candidate")) {
    asset.status = asset.status === "approved" ? "approved" : "candidate";
  }
  registry.updatedAt = nowIso;
  registry.auditLog = [
    ...(Array.isArray(registry.auditLog) ? registry.auditLog : []),
    {
      type: "image-variant-status-update",
      assetId,
      viewportProfile,
      status,
      reviewedBy: String(source.reviewedBy || "").trim(),
      reviewNotes: String(source.reviewNotes || "").trim(),
      updatedAt: nowIso,
    },
  ].slice(-120);
  writeJsonFile(IMAGE_ASSET_REGISTRY_PATH, registry);
  return compactImageAssetCard(asset, viewportProfile);
}

function updateInteractionComponentStatus(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const interactionId = String(source.interactionId || "").trim();
  const status = normalizeRegistryStatus(source.status || "");
  if (!interactionId) throw new Error("interaction_id_required");
  if (!status) throw new Error("valid_status_required");
  const registry = readInteractionComponentRegistry();
  const components = Array.isArray(registry.components) ? registry.components : [];
  const component = components.find((item) => String(item?.interactionId || "").trim() === interactionId);
  if (!component) throw new Error("interaction_component_not_found");
  if (status === "approved") {
    const runtimeModule = String(component.runtimeModule || "").trim();
    if (!runtimeModule) throw new Error("runtime_module_required_for_approval");
    const modulePath = path.join(ROOT, runtimeModule);
    if (!fs.existsSync(modulePath)) throw new Error(`runtime_module_missing:${runtimeModule}`);
  }
  const nowIso = new Date().toISOString();
  component.status = status;
  component.reviewedAt = nowIso;
  component.reviewedBy = String(source.reviewedBy || "").trim();
  component.reviewNotes = String(source.reviewNotes || "").trim();
  registry.updatedAt = nowIso;
  registry.auditLog = [
    ...(Array.isArray(registry.auditLog) ? registry.auditLog : []),
    {
      type: "interaction-status-update",
      interactionId,
      status,
      reviewedBy: String(source.reviewedBy || "").trim(),
      reviewNotes: String(source.reviewNotes || "").trim(),
      updatedAt: nowIso,
    },
  ].slice(-120);
  writeJsonFile(INTERACTION_COMPONENT_REGISTRY_PATH, registry);
  return compactInteractionComponentCard(component);
}

function registryStatusRank(status = "") {
  const normalized = String(status || "").trim();
  if (normalized === "approved") return 0;
  if (normalized === "candidate") return 1;
  if (normalized === "blocked") return 2;
  if (normalized === "retired") return 3;
  return 4;
}

function compareRegistryCards(a = {}, b = {}) {
  const statusDiff = registryStatusRank(a.status) - registryStatusRank(b.status);
  if (statusDiff) return statusDiff;
  const roleDiff = String(a.role || "").localeCompare(String(b.role || ""), "ko");
  if (roleDiff) return roleDiff;
  return String(a.assetId || a.familyId || a.interactionId || "").localeCompare(
    String(b.assetId || b.familyId || b.interactionId || ""),
    "ko"
  );
}

function countByField(items = [], fieldName = "status") {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const value = String(item?.[fieldName] || "unknown").trim() || "unknown";
    acc[value] = Number(acc[value] || 0) + 1;
    return acc;
  }, {});
}

function summarizeFullAssetRegistryInventory() {
  const imageAssets = Array.isArray(readImageAssetRegistry().assets) ? readImageAssetRegistry().assets : [];
  const imageVariants = imageAssets.flatMap((asset) => Object.values(asset?.variants || {}));
  const iconFamilies = Array.isArray(readIconFamilyRegistry().families) ? readIconFamilyRegistry().families : [];
  const interactionComponents = Array.isArray(readInteractionComponentRegistry().components) ? readInteractionComponentRegistry().components : [];
  return {
    imageAssetCount: imageAssets.length,
    imageVariantCount: imageVariants.length,
    imageStatus: countByField(imageAssets, "status"),
    imageSourceType: countByField(imageAssets, "sourceType"),
    imageVariantStatus: countByField(imageVariants, "status"),
    imageVariantViewportStatus: imageVariants.reduce((acc, variant) => {
      const key = `${String(variant?.viewportProfile || "unknown").trim() || "unknown"}:${String(variant?.status || "unknown").trim() || "unknown"}`;
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    }, {}),
    iconFamilyCount: iconFamilies.length,
    iconFamilyStatus: countByField(iconFamilies, "status"),
    interactionComponentCount: interactionComponents.length,
    interactionStatus: countByField(interactionComponents, "status"),
  };
}

function resolveAssetRegistryCardsForSection(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const scope = {
    pageId: String(source.pageId || "").trim(),
    slotId: String(source.slotId || "").trim(),
    componentId: String(source.componentId || "").trim(),
    viewportProfile: String(source.viewportProfile || "pc").trim() || "pc",
  };
  const imageMatches = (readImageAssetRegistry().assets || [])
    .filter((asset) => matchesScope(asset, scope))
    .map((asset) => compactImageAssetCard(asset, scope.viewportProfile))
    .filter((asset) => asset.assetId)
    .sort(compareRegistryCards);
  const iconFamilyMatches = (readIconFamilyRegistry().families || [])
    .filter((family) => matchesScope(family, scope))
    .map(compactIconFamilyCard)
    .filter((family) => family.familyId)
    .sort(compareRegistryCards);
  const interactionMatches = (readInteractionComponentRegistry().components || [])
    .filter((component) => matchesScope(component, scope))
    .map(compactInteractionComponentCard)
    .filter((component) => component.interactionId)
    .sort(compareRegistryCards);
  return {
    images: imageMatches.slice(0, 8),
    iconFamilies: iconFamilyMatches.slice(0, 4),
    interactionComponents: interactionMatches.slice(0, 4),
    availableCounts: {
      images: imageMatches.length,
      iconFamilies: iconFamilyMatches.length,
      interactionComponents: interactionMatches.length,
    },
  };
}

function summarizeAssetRegistryCards(cards = {}) {
  const images = Array.isArray(cards.images) ? cards.images : [];
  const iconFamilies = Array.isArray(cards.iconFamilies) ? cards.iconFamilies : [];
  const interactionComponents = Array.isArray(cards.interactionComponents) ? cards.interactionComponents : [];
  const countByStatus = (items = []) => items.reduce((acc, item) => {
    const status = String(item?.status || "candidate").trim() || "candidate";
    acc[status] = Number(acc[status] || 0) + 1;
    return acc;
  }, {});
  return {
    imageCount: images.length,
    availableImageCount: Number(cards.availableCounts?.images || images.length || 0) || 0,
    imageStatus: countByStatus(images),
    iconFamilyCount: iconFamilies.length,
    availableIconFamilyCount: Number(cards.availableCounts?.iconFamilies || iconFamilies.length || 0) || 0,
    iconFamilyStatus: countByStatus(iconFamilies),
    interactionComponentCount: interactionComponents.length,
    availableInteractionComponentCount: Number(cards.availableCounts?.interactionComponents || interactionComponents.length || 0) || 0,
    interactionStatus: countByStatus(interactionComponents),
  };
}

function buildAssetRegistryCatalogForPage(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const pageId = String(source.pageId || "").trim();
  const viewportProfile = String(source.viewportProfile || "pc").trim() || "pc";
  const components = Array.isArray(source.components) ? source.components : [];
  const sectionCards = components
    .map((component) => {
      const componentId = String(component?.componentId || "").trim();
      const slotId = String(component?.slotId || componentId.split(".").pop() || "").trim();
      if (!slotId && !componentId) return null;
      const cards = resolveAssetRegistryCardsForSection({
        pageId,
        slotId,
        componentId,
        viewportProfile,
      });
      const summary = summarizeAssetRegistryCards(cards);
      const total =
        summary.imageCount +
        summary.iconFamilyCount +
        summary.interactionComponentCount;
      if (!total && source.includeEmpty !== true) return null;
      return {
        pageId,
        viewportProfile,
        slotId,
        componentId,
        label: String(component?.label || component?.title || slotId || componentId).trim(),
        cards,
        summary,
      };
    })
    .filter(Boolean);
  const totals = sectionCards.reduce((acc, section) => {
    acc.sectionCount += 1;
    acc.imageCount += Number(section.summary?.imageCount || 0);
    acc.availableImageCount += Number(section.summary?.availableImageCount || section.summary?.imageCount || 0);
    acc.iconFamilyCount += Number(section.summary?.iconFamilyCount || 0);
    acc.availableIconFamilyCount += Number(section.summary?.availableIconFamilyCount || section.summary?.iconFamilyCount || 0);
    acc.interactionComponentCount += Number(section.summary?.interactionComponentCount || 0);
    acc.availableInteractionComponentCount += Number(section.summary?.availableInteractionComponentCount || section.summary?.interactionComponentCount || 0);
    for (const [status, count] of Object.entries(section.summary?.imageStatus || {})) {
      acc.imageStatus[status] = Number(acc.imageStatus[status] || 0) + Number(count || 0);
    }
    for (const [status, count] of Object.entries(section.summary?.iconFamilyStatus || {})) {
      acc.iconFamilyStatus[status] = Number(acc.iconFamilyStatus[status] || 0) + Number(count || 0);
    }
    for (const [status, count] of Object.entries(section.summary?.interactionStatus || {})) {
      acc.interactionStatus[status] = Number(acc.interactionStatus[status] || 0) + Number(count || 0);
    }
    return acc;
  }, {
    sectionCount: 0,
    imageCount: 0,
    availableImageCount: 0,
    imageStatus: {},
    iconFamilyCount: 0,
    availableIconFamilyCount: 0,
    iconFamilyStatus: {},
    interactionComponentCount: 0,
    availableInteractionComponentCount: 0,
    interactionStatus: {},
  });
  return {
    pageId,
    viewportProfile,
    generatedAt: new Date().toISOString(),
    inventoryTotals: summarizeFullAssetRegistryInventory(),
    totals,
    sections: sectionCards,
  };
}

module.exports = {
  readImageAssetRegistry,
  readIconFamilyRegistry,
  readInteractionComponentRegistry,
  summarizeFullAssetRegistryInventory,
  resolveAssetRegistryCardsForSection,
  buildAssetRegistryCatalogForPage,
  summarizeAssetRegistryCards,
  updateImageAssetVariantStatus,
  updateInteractionComponentStatus,
};
