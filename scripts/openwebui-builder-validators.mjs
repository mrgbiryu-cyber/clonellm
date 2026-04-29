function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(errors, code, message, detail = {}) {
  errors.push({ code, message, detail });
}

function ids(items, key) {
  return new Set((items || []).map((item) => item?.[key]).filter(Boolean));
}

export function validateBuilderContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== "object") {
    fail(errors, "contract.invalid", "Builder contract must be an object.");
    return { ok: false, errors };
  }
  if (contract.builderContractVersion !== "builder-contract-v1") {
    fail(errors, "contract.version", "builderContractVersion must be builder-contract-v1.");
  }
  for (const field of ["sourceManifest", "pages", "slots", "components", "componentFamilies", "assetRolePolicies", "assets"]) {
    if (!Array.isArray(contract[field])) {
      fail(errors, "contract.array_field", `${field} must be an array.`, { field });
    }
  }

  const pageIds = ids(contract.pages, "pageId");
  const componentIds = ids(contract.components, "componentId");
  const familyIds = ids(contract.componentFamilies, "familyId");
  const policyIds = ids(contract.assetRolePolicies, "policyId");

  for (const slot of contract.slots || []) {
    if (!pageIds.has(slot.pageId)) fail(errors, "slot.page_missing", "Slot references missing page.", { slot });
    for (const componentId of slot.componentIds || []) {
      if (!componentIds.has(componentId)) fail(errors, "slot.component_missing", "Slot references missing component.", { slotId: slot.slotId, componentId });
    }
    for (const policyId of slot.assetRolePolicyIds || []) {
      if (!policyIds.has(policyId)) fail(errors, "slot.policy_missing", "Slot references missing asset role policy.", { slotId: slot.slotId, policyId });
    }
  }

  for (const component of contract.components || []) {
    if (!familyIds.has(component.familyId)) {
      fail(errors, "component.family_missing", "Component references missing family.", { componentId: component.componentId, familyId: component.familyId });
    }
  }

  for (const asset of contract.assets || []) {
    if (asset.role === "promo-complete" && (asset.usableSlotIds || []).includes("hero")) {
      fail(errors, "asset.promo_complete_hero", "promo-complete asset must not be exported as hero usable.", { assetId: asset.assetId });
    }
    for (const variant of asset.variants || []) {
      if (!["pc", "mo", "ta"].includes(variant.viewportProfile)) {
        fail(errors, "asset.variant_viewport", "Asset variant viewportProfile must be pc, mo, or ta.", { assetId: asset.assetId, variant });
      }
    }
  }

  const hasHomeHeroSlot = (contract.slots || []).some((slot) => slot.pageId === "home" && slot.slotId === "hero");
  const hasHomeHeroComponent = (contract.components || []).some((component) => component.componentId === "home.hero");
  if (!hasHomeHeroSlot) fail(errors, "contract.home_hero_slot", "Contract must include home.hero slot.");
  if (!hasHomeHeroComponent) fail(errors, "contract.home_hero_component", "Contract must include home.hero component.");

  return { ok: errors.length === 0, errors };
}

export function validateConceptPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    fail(errors, "payload.invalid", "Concept payload must be an object.");
    return { ok: false, errors };
  }
  for (const field of ["builderApiVersion", "externalProjectId", "externalConceptId", "conceptThreadId", "pageId", "viewportProfile", "conceptDocument", "conceptPackage", "builderOptions"]) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      fail(errors, "payload.required", `Missing required field: ${field}`, { field });
    }
  }
  if (payload.builderApiVersion !== "v1") {
    fail(errors, "payload.builder_api_version", "builderApiVersion must be v1.");
  }
  if (!/^ct-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(String(payload.conceptThreadId || ""))) {
    fail(errors, "payload.concept_thread_id", "conceptThreadId must use ct-{uuid-v4} format.");
  }
  if (!["pc", "mo", "ta"].includes(payload.viewportProfile)) {
    fail(errors, "payload.viewport", "viewportProfile must be pc, mo, or ta.");
  }
  if (!isNonEmptyString(payload.conceptDocument)) {
    fail(errors, "payload.concept_document", "conceptDocument must preserve a non-empty source document.");
  }
  const conceptPackage = payload.conceptPackage || {};
  if (!isNonEmptyString(conceptPackage.title)) {
    fail(errors, "payload.concept_package_title", "conceptPackage.title is required.");
  }
  const targetGroup = conceptPackage.targetGroup || {};
  if (!isNonEmptyString(targetGroup.groupId)) {
    fail(errors, "payload.target_group", "conceptPackage.targetGroup.groupId is required.");
  }
  if (!Array.isArray(targetGroup.slotIds) || targetGroup.slotIds.length < 1) {
    fail(errors, "payload.target_slots", "conceptPackage.targetGroup.slotIds must contain at least one slot.");
  }
  if (!Array.isArray(targetGroup.componentIds) || targetGroup.componentIds.length < 1) {
    fail(errors, "payload.target_components", "conceptPackage.targetGroup.componentIds must contain at least one component.");
  }
  return { ok: errors.length === 0, errors };
}

export function validateConceptAgainstContract(payload, contract) {
  const errors = [];
  const page = (contract.pages || []).find((item) => item.pageId === payload.pageId);
  if (!page) {
    fail(errors, "concept.page_missing", "Payload pageId is not present in builder contract.", { pageId: payload.pageId });
    return { ok: false, errors };
  }

  const targetGroup = payload.conceptPackage?.targetGroup || {};
  const targetSlots = targetGroup.slotIds || [];
  const targetComponents = targetGroup.componentIds || [];

  for (const slotId of targetSlots) {
    const slot = (contract.slots || []).find((item) => item.pageId === payload.pageId && item.slotId === slotId);
    if (!slot) {
      fail(errors, "concept.slot_missing", "Target slot is not present in builder contract.", { pageId: payload.pageId, slotId });
      continue;
    }
    if (!slot.viewportProfiles.includes(payload.viewportProfile)) {
      fail(errors, "concept.slot_viewport", "Target slot does not support requested viewport.", { slotId, viewportProfile: payload.viewportProfile });
    }
  }

  for (const componentId of targetComponents) {
    const component = (contract.components || []).find((item) => item.componentId === componentId);
    if (!component) {
      fail(errors, "concept.component_missing", "Target component is not present in builder contract.", { componentId });
      continue;
    }
    if (!componentId.startsWith(`${payload.pageId}.`)) {
      fail(errors, "concept.component_page_mismatch", "Target component does not belong to requested page.", { componentId, pageId: payload.pageId });
    }
  }

  const stageHero = (contract.assetRolePolicies || []).find((policy) => policy.policyId === "stage-hero");
  if (targetSlots.includes("hero") && !stageHero?.allowedRoles?.includes("background-only")) {
    fail(errors, "concept.hero_policy", "Hero slot requires stage-hero policy allowing background-only assets.");
  }

  return { ok: errors.length === 0, errors };
}
