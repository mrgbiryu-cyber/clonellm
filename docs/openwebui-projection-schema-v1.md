# Open WebUI Projection Schema v1

## Purpose

This document fixes the Phase 0B contract for exporting `clonellm` normalized data into Open WebUI. Open WebUI owns planning, knowledge, decisions, and canonical artifacts. `clonellm` remains the LGE builder/runtime source for renderable drafts.

Phase 0B does not add builder APIs. Phase 1 remains blocked until Phase 0C exports and Phase 0D deterministic checks pass.

## Schema Bundle

Machine-readable schemas live at:

```text
data/normalized/openwebui-projection-schema-v1.json
```

The bundle contains:

- `knowledgeProjectionV1`
- `ontologyProjectionV1`
- `builderContractProjectionV1`
- `feedbackProjectionV1`
- `importManifestV1`
- `conceptThreadV1`

Canonical schemas use `additionalProperties: false`. Debug, trace, and experimental values must go into non-canonical sidecars:

```text
exports/openwebui/debug/
exports/openwebui/traces/
```

## Knowledge Projection

Knowledge projection is the Open WebUI RAG import shape.

Required fields:

- `projectionVersion: knowledge-projection-v1`
- `documentId`
- `collection`
- `truthLevel`
- `freshness`
- `sourcePath`
- `sourceHash`
- `generatedAt`
- `title`
- `markdown`

Allowed collections:

- `lge-policy`
- `lge-design-history`
- `lge-idea-archive`
- `lge-requirements`
- `lge-component-spec`

Phase 0D blocking checks must verify metadata presence and known phrase/field coverage. LLM readability is optional only.

## Ontology Projection

Ontology is a relationship map and provenance ledger. It is not the final execution judge. Builder Contract validation and Runtime Validation make final execution decisions.

Canonical edge list v1:

- `Page -> has_slot -> Slot`
- `Slot -> implemented_by -> Component`
- `Component -> belongs_to_family -> ComponentFamily`
- `ComponentFamily -> governed_by -> SectionFamilyContract`
- `Slot -> governed_by -> AssetRolePolicy`
- `Asset -> usable_for -> Slot`
- `Asset -> has_variant -> AssetVariant`
- `AssetVariant -> targets_viewport -> ViewportProfile`
- `ConceptDocument -> targets -> Page / Slot / Component`
- `ConceptDocument -> starts -> ConceptThread`
- `ConceptThread -> contains -> ConceptDocument`
- `ConceptThread -> contains -> DraftBuild`
- `DraftBuild -> belongs_to -> ConceptThread`
- `BuilderRun -> executes -> ConceptDocument`
- `DraftBuild -> generated_from -> BuilderRun`
- `DraftBuild -> revised_from -> DraftBuild`
- `Evaluation -> reviews -> DraftBuild`
- `Decision -> accepts/rejects/requests_revision -> DraftBuild`
- `Handoff -> implements -> DraftBuild`

Phase 0D must verify referential integrity and the canonical `home.hero` path:

```text
Page -> has_slot -> Slot -> implemented_by -> Component
```

## Builder Contract Projection

Builder Contract is the machine-readable execution boundary for `clonellm`.

Required top-level fields:

- `builderContractVersion: builder-contract-v1`
- `generatedAt`
- `sourceManifest`
- `pages`
- `slots`
- `components`
- `componentFamilies`
- `assetRolePolicies`
- `assets`

Validator boundaries are intentionally separate:

- `validateBuilderContract(contract)` validates this exported contract.
- `validateConceptPayload(payload)` validates an Open WebUI builder request.
- `validateConceptAgainstContract(payload, contract)` checks target, slot, component, asset, and viewport compatibility.

Policy and runtime-truth sources marked `stale` cannot enter the current builder contract.

## Feedback Projection

Feedback projection is the shared format for later feedback loops:

- `FL1`: critic result -> `lge-design-history`
- `FL2`: human approval/rejection/revision request -> `lge-design-history`
- `FL3`: contract violation -> `lge-policy`

Cross-field rules:

- `sourceType=critic` requires `targetCollection=lge-design-history`
- `sourceType=human` requires `targetCollection=lge-design-history`
- `sourceType=contract-violation` requires `targetCollection=lge-policy`
- `sourceType=contract-violation` requires `violationDetail`

These rules are enforced by `scripts/check-openwebui-export.mjs` in Phase 0C/0D, not by LLM judgment.

## Import Manifest

Every Phase 0C export writes:

```text
exports/openwebui/import-manifest.json
```

The manifest records source and projection hashes:

- `source`
- `sourceHash`
- `projection`
- `projectionHash`
- `projectionType`
- `collection`
- `truthLevel`
- `freshness`

Phase 0D must fail if any manifest hash differs from the actual file hash.

## ConceptThread ID

`ConceptThread` IDs use UUID v4 with the `ct-` prefix:

```text
ct-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

Human-readable names are optional and non-unique. Builder APIs and ontology edges use the stable `conceptThreadId`.

## Freshness Policy

Policy data:

- `fresh`: manifest `sourceHash` matches current source hash
- `stale`: source changed but projection/export was not refreshed
- No TTL is applied

Runtime-truth data:

- `fresh`: source hash matches and TTL is valid
- `stale`: source hash mismatch or TTL expired
- Initial TTL is 7 days

Candidate data:

- `fresh`: source hash matches and status is explicit
- `stale`: source hash mismatch or status is missing

Historical data:

- Never converted to stale
- Provenance is preserved

Legacy-reference data:

- May enter knowledge
- Must not enter the current builder contract

## Phase 0D Gates

All blocking gates are deterministic:

- Source existence
- Source hash integrity
- Knowledge metadata
- Builder contract validation
- Concept payload validation
- Concept vs contract validation
- Projection consistency
- Ontology referential integrity
- Ontology canonical path
- Ontology role constraint
- import-manifest integrity

LLM readability is non-blocking and can only be recorded as a quality note.
