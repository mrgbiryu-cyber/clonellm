# Artifact + Sidecar Contract

## Goal
- Keep the visually aligned clone/artifact HTML as the rendering source of truth.
- Extract structure as a separate sidecar so planner/builder can reason without rebuilding the page DOM.
- Apply this consistently across `home`, service-like pages, PLP, PDP, and homestyle pages.

## Why
- Reconstructing the page from inferred structure caused visible drift.
- The current clone/artifact path is visually closer to the real page.
- The builder still needs stable structure, geometry, image zones, and editable-field hints.

## Contract
Each page/viewport should have two synchronized outputs:

1. `artifact html`
- Purpose: preview, compare, executive review, final rendered draft.
- Rule: preserve visual fidelity first.

2. `sidecar json`
- Purpose: planner/builder/critic input only.
- Rule: describe the artifact, do not replace it.

## Sidecar Section Schema
Each section entry should contain:

- `sectionId`
- `pageId`
- `viewportProfile`
- `slotId`
- `componentId`
- `label`
- `sectionType`

Artifact evidence:
- `artifact.source`
- `artifact.artifactOrigin`
- `artifact.extractStatus`
- `artifact.selectorHints`
- `artifact.referenceSection`

Geometry:
- `geometry.plannedSectionRect`
- `geometry.plannedContentRect`
- `geometry.referenceRect`
- `geometry.workingRect`

Media:
- `media.imageZones`
- `media.measuredScale`

Text:
- `text.labels`

Editing:
- `editing.replacementMode`
- `editing.allowedFields`
- `editing.patchBridge`
- `editing.mediaSpec`

Fidelity:
- `sourceFidelity.hasReferenceMarkup`
- `sourceFidelity.hasReferenceMeasurement`
- `sourceFidelity.hasWorkingMeasurement`

## Boundary-Aware Editing Contract
The sidecar is not just metadata. It is the replacement contract for the artifact.

Each section should also expose:

- `regions`
- `layoutGovernance`

### `regions`
Use nested edit scopes instead of a single coarse section whenever the page needs more detailed control.

Recommended hierarchy:

1. `section`
2. `region`
3. `repeater`
4. `node`

Example use cases:

- `home.quickmenu`
  - `quickmenu.root`
  - `quickmenu.items` (repeater, itemCount=10, uniform item contract)
- `pdp.gallery`
  - `gallery.main`
  - `gallery.thumbnails` (repeater)
- `pdp.summary`
  - `summary.header`
- `pdp.option`
  - `option.controls`
- `pdp.sticky`
  - `sticky.buybox`
- `pdp.review`
  - `review.list`

Each region entry should contain:

- `regionId`
- `role`
- `replaceMode`
- `selectorHints`
- `editableFields`
- `visibleLabels`
- `repeater`
  - `itemCount`
  - `itemKind`
  - `uniformItemContract`
- `governance`

### `layoutGovernance`
The builder must follow container-level layout rules, not arbitrary per-node resizing.

Each section should define:

- `layoutScope`
  - `section-container`
  - `repeater-container`
  - `grid-container`
  - `column-group`
  - `content-list`
- `resizePolicy`
  - `container-only`
  - `group-only`
  - `uniform-items-only`
- `widthPolicy`
  - `follow-parent-container`
  - `follow-parent-column`
  - `container-only`
  - `follow-layout-token`
- `itemConsistency`
  - `shared-item-size`
  - `shared-card-rhythm`
  - `thumbnail-rail-uniform`
  - `shared-column-width`
- `alignmentPolicy`
- `forbiddenMoves`

### Required constraints
- Never overlay a new block on top of the artifact without a region boundary.
- Never widen only one item inside a repeater when the repeater is marked `uniform-items-only`.
- Never let a single option, card, or quickmenu item protrude outside the parent container.
- Width expansion is allowed only at the container/group scope.
- If a layout change is requested, the builder must update the whole repeater rhythm or the full column contract, not a single child item.

### Practical interpretation
- Quickmenu:
  - Allowed: `1x10 -> 2x5`, wider container rhythm, uniform card scaling.
  - Forbidden: one tile becomes double-width or taller than others.
- PDP option / summary / sticky:
  - Allowed: make the whole right-column block taller or more spacious.
  - Forbidden: let only the option block stick out wider than the summary/sticky column.

## Pipeline Usage
- Planner reads page identity, references, and section evidence.
- Builder reads `designSpecMarkdown`, `sectionBlueprints`, `artifactSectionRegistry`, and `artifactSidecarRegistry`.
- Builder decides changes from sidecar constraints, not from free-form DOM reinterpretation.
- Renderer applies changes back to the artifact HTML path.

## Page Family Rollout Order
1. `home`
2. service-like:
   - `support`
   - `bestshop`
   - `care-solutions`
   - `care-solutions-pdp`
   - `homestyle-home`
   - `homestyle-pdp`
3. PLP:
   - `category-tvs`
   - `category-refrigerators`
4. PDP cases

## Immediate Priorities
1. Keep `homestyle-home` visually stable.
2. Expose `artifactSidecarRegistry` for all page families.
3. Feed sidecar into builder selection and later critic loops.
4. Make reference ranking identity-aware after sidecar coverage is stable.
