import path from "node:path";
import {
  EXPORT_ROOT,
  emptyDir,
  loadDryRunSources,
  parseComponentId,
  sourceRefFromRecord,
  unique,
  writeJson,
} from "./openwebui-export-utils.mjs";

function provenance(record, projectionVersion = "ontology-projection-v1") {
  return {
    sourcePath: record.sourcePath,
    sourceHash: record.sourceHash,
    projectionVersion,
    truthLevel: record.truthLevel,
    freshness: "current",
  };
}

function addEntity(map, entity) {
  if (!map.has(entity.id)) map.set(entity.id, entity);
}

function addEdge(edges, edge) {
  edges.push({
    id: `${edge.sourceId}:${edge.relation}:${edge.targetId}`,
    ...edge,
  });
}

export function buildOntologyProjection() {
  const sources = loadDryRunSources();
  const componentCatalog = sources["data/normalized/component-rebuild-schema-catalog.json"];
  const imageRegistry = sources["data/normalized/image-asset-registry.json"];
  const rolePolicies = sources["data/normalized/asset-role-policies.json"];
  const pageRuntimeStatus = sources["data/normalized/page-runtime-status.json"];

  const entities = new Map();
  const edges = [];

  for (const page of pageRuntimeStatus.data.pages || []) {
    addEntity(entities, {
      id: `Page:${page.pageId}`,
      type: "Page",
      label: page.label || page.pageId,
      externalKeys: { clonellm: page.pageId },
      properties: {
        runtimeStatus: page.runtimeStatus,
        assetStatus: page.assetStatus,
        assetContractStatus: page.assetContractStatus,
      },
      provenance: provenance(pageRuntimeStatus.record),
    });
  }

  for (const family of componentCatalog.data.families || []) {
    addEntity(entities, {
      id: `ComponentFamily:${family.id}`,
      type: "ComponentFamily",
      label: family.label || family.id,
      externalKeys: { clonellm: family.id },
      properties: {
        requiredFields: unique(family.requiredFields),
        assetNeeds: unique(family.assetNeeds),
      },
      provenance: provenance(componentCatalog.record),
    });
    addEntity(entities, {
      id: `SectionFamilyContract:${family.id}`,
      type: "SectionFamilyContract",
      label: family.label || family.id,
      externalKeys: { clonellm: family.id },
      properties: {
        layoutBlocks: unique(family.layoutBlocks),
      },
      provenance: provenance(componentCatalog.record),
    });
    addEdge(edges, {
      sourceId: `ComponentFamily:${family.id}`,
      relation: "governed_by",
      targetId: `SectionFamilyContract:${family.id}`,
      provenance: provenance(componentCatalog.record),
    });
  }

  for (const assignment of componentCatalog.data.assignments || []) {
    const parsed = parseComponentId(assignment.componentId);
    if (!parsed.pageId || !parsed.slotId) continue;
    addEntity(entities, {
      id: `Slot:${parsed.pageId}.${parsed.slotId}`,
      type: "Slot",
      label: parsed.slotId,
      externalKeys: { clonellm: `${parsed.pageId}.${parsed.slotId}` },
      properties: { pageId: parsed.pageId, slotId: parsed.slotId },
      provenance: provenance(componentCatalog.record),
    });
    addEntity(entities, {
      id: `Component:${assignment.componentId}`,
      type: "Component",
      label: assignment.componentId,
      externalKeys: { clonellm: assignment.componentId },
      properties: { familyId: assignment.familyId },
      provenance: provenance(componentCatalog.record),
    });
    addEdge(edges, {
      sourceId: `Page:${parsed.pageId}`,
      relation: "has_slot",
      targetId: `Slot:${parsed.pageId}.${parsed.slotId}`,
      provenance: provenance(componentCatalog.record),
    });
    addEdge(edges, {
      sourceId: `Slot:${parsed.pageId}.${parsed.slotId}`,
      relation: "implemented_by",
      targetId: `Component:${assignment.componentId}`,
      provenance: provenance(componentCatalog.record),
    });
    addEdge(edges, {
      sourceId: `Component:${assignment.componentId}`,
      relation: "belongs_to_family",
      targetId: `ComponentFamily:${assignment.familyId}`,
      provenance: provenance(componentCatalog.record),
    });
  }

  for (const policy of rolePolicies.data.policies || []) {
    addEntity(entities, {
      id: `AssetRolePolicy:${policy.policyId}`,
      type: "AssetRolePolicy",
      label: policy.label || policy.policyId,
      externalKeys: { clonellm: policy.policyId },
      properties: {
        targetSlots: unique(policy.targetSlots),
        imageUsageMode: policy.imageUsageMode,
        disallowPromoReoverlay: Boolean(policy.disallowPromoReoverlay),
      },
      provenance: provenance(rolePolicies.record),
    });
    for (const slotName of policy.targetSlots || []) {
      for (const entity of entities.values()) {
        if (entity.type === "Slot" && entity.properties?.slotId === slotName) {
          addEdge(edges, {
            sourceId: entity.id,
            relation: "governed_by",
            targetId: `AssetRolePolicy:${policy.policyId}`,
            provenance: provenance(rolePolicies.record),
          });
        }
      }
    }
  }

  for (const asset of imageRegistry.data.assets || []) {
    addEntity(entities, {
      id: `Asset:${asset.assetId}`,
      type: "Asset",
      label: asset.assetId,
      externalKeys: { clonellm: asset.assetId },
      properties: {
        status: asset.status,
        role: asset.role,
        targetSlots: unique(asset.targetSlots),
      },
      provenance: provenance(imageRegistry.record),
    });
    for (const [viewportProfile, variant] of Object.entries(asset.variants || {})) {
      if (!variant?.variantId || !["pc", "mo", "ta"].includes(variant.viewportProfile || viewportProfile)) continue;
      addEntity(entities, {
        id: `AssetVariant:${variant.variantId}`,
        type: "AssetVariant",
        label: variant.variantId,
        externalKeys: { clonellm: variant.variantId },
        properties: {
          viewportProfile: variant.viewportProfile || viewportProfile,
          status: variant.status,
        },
        provenance: provenance(imageRegistry.record),
      });
      addEntity(entities, {
        id: `ViewportProfile:${variant.viewportProfile || viewportProfile}`,
        type: "ViewportProfile",
        label: variant.viewportProfile || viewportProfile,
        externalKeys: { clonellm: variant.viewportProfile || viewportProfile },
        properties: {},
        provenance: provenance(imageRegistry.record),
      });
      addEdge(edges, {
        sourceId: `Asset:${asset.assetId}`,
        relation: "has_variant",
        targetId: `AssetVariant:${variant.variantId}`,
        provenance: provenance(imageRegistry.record),
      });
      addEdge(edges, {
        sourceId: `AssetVariant:${variant.variantId}`,
        relation: "targets_viewport",
        targetId: `ViewportProfile:${variant.viewportProfile || viewportProfile}`,
        provenance: provenance(imageRegistry.record),
      });
    }
    for (const slotName of asset.role === "promo-complete" ? [] : asset.targetSlots || []) {
      for (const entity of entities.values()) {
        if (entity.type === "Slot" && entity.properties?.slotId === slotName) {
          addEdge(edges, {
            sourceId: `Asset:${asset.assetId}`,
            relation: "usable_for",
            targetId: entity.id,
            properties: { role: asset.role, status: asset.status },
            provenance: provenance(imageRegistry.record),
          });
        }
      }
    }
  }

  return {
    projectionVersion: "ontology-projection-v1",
    generatedAt: new Date().toISOString(),
    sourcePath: pageRuntimeStatus.record.sourcePath,
    sourceHash: pageRuntimeStatus.record.sourceHash,
    entities: [...entities.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function writeOntologyProjection() {
  emptyDir(path.join(EXPORT_ROOT, "ontology"));
  const relativePath = "exports/openwebui/ontology/ontology-projection-v1.json";
  writeJson(relativePath, buildOntologyProjection());
  return relativePath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = writeOntologyProjection();
  console.log(`Wrote ${file}`);
}
