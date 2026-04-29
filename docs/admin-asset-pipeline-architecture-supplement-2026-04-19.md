# Admin Asset Pipeline Architecture — Supplement and Gap Analysis

Date: 2026-04-19
Owner: Claude / mrgbiryu alignment draft
Reference: admin-asset-pipeline-architecture-options-2026-04-19.md
Status: Code-evidence-based gap analysis

---

## 1. Purpose

The base document defines a correct hybrid pipeline direction.
This supplement identifies five concrete gaps between the architecture intent and the current code state, with code-line evidence for each.

---

## 2. Gap 1 — Architecture Intent Contradicts Current Builder Operation

### What the document says

Section 7.1:

> The builder should not directly "pick an image URL".

### What the code does

`llm.js:2682`:

```js
"Use only replace_component_template, update_component_patch, update_slot_text, update_hero_field, update_slot_image, and update_page_title."
```

`update_slot_image` is a first-class allowed builder operation. The builder is still prompted to emit image URLs directly. There is no intermediary.

`llm.js:5211-5220` (applyOperations):

```js
if (op.action === "update_slot_image") {
  const slot = findSlotConfig(next, op.pageId, op.slotId);
  if (!slot) continue;
  const sourceId = String(slot.activeSourceId || "").trim();
  const imagePatch = {};
  if (typeof op.imageSrc === "string" && op.imageSrc.trim()) imagePatch.imageSrc = op.imageSrc.trim();
  ...
  next = setSlotComponentPatch(next, op.pageId, slot.slotId, sourceId, imagePatch, viewportProfile);
```

Any arbitrary string URL is accepted with no registry lookup, no validation against starter asset IDs, and no `assetSourceType` tracking.

### Required fix

The base document correctly proposes an `asset orchestrator` layer. To implement this:

- Builder should emit `assetNeeds` + `assetIntent` + `assetBindings` (Composer already emits `assetBindings`, see llm.js:2893)
- Builder should NOT emit `update_slot_image` with raw URLs in redesign/build passes
- `applyOperations()` should distinguish `assetId` references from raw URL strings
- A new `resolveAssetIdToUrl()` call should sit between the builder output and `setSlotComponentPatch()`

Until this is implemented, the "builder should not pick an image URL" principle is not enforceable.

---

## 3. Gap 2 — Starter Asset Registry Contains No Actual Assets

### What the document says

Section 6.3:

> 1. use starter asset registry if fit is good enough

Section 9 Phase 1:

> build the hybrid contract without changing user UI

### What the code does

`data/normalized/asset-pipeline-starter.json` (lines 3-34):

```json
{
  "iconSets": [
    {
      "id": "home-quickmenu-line",
      "label": "홈 퀵메뉴 라인 아이콘",
      "usage": ["home.quickmenu"],
      "style": "clean-line"
    },
    ...
  ],
  "badgePresets": [
    {
      "id": "soft-brand-pill",
      "label": "소프트 브랜드 필",
      "usage": ["hero", "summary-banner-2"],
      "tone": "brand-soft"
    },
    ...
  ]
}
```

Every entry is metadata only. No `url`, no `cdnPath`, no `spriteRef`, no `svgInline`. The "starter assets first" strategy currently has no starter assets to use — only names and usage labels.

### Required fix before Phase 1 is viable

- Add `url` or `assetUrl` field to each starter entry (CDN-hosted SVG for icons, real image URL for visualSets)
- Add `dimensions` field per entry (width, height, aspectRatio) for geometry validation
- Add `format` field (svg | png | webp) per entry to drive renderer decisions
- Phase 1 cannot resolve `assetId → url` until this is populated

This is effectively a **Phase 0** step the document does not name explicitly.

---

## 4. Gap 3 — Rerank Mechanism Is Unspecified

### What the document says

Section 4.2:

> `assetNeeds -> search query build -> candidate retrieval -> style-aware rerank -> component fit check -> visual critic`

Section 4.6:

> every candidate must be reranked using: `pageIdentity`, `referenceAnchors`, `targetLayer`, `targetComponents`, `why`, `avoid`

### What the code does

`server.js:8644-8716` (`buildInterventionAssetNeeds()`):

```js
function buildInterventionAssetNeeds(pageId, interventionLayer, patchDepth) {
  ...
  needs.push("section rhythm guidance");
  needs.push("hero visual");
  needs.push("icon set");
  ...
  return needs;
}
```

Returns a plain string array. Not structured enough to drive a rerank call.

`mergeRuntimeCompositionAssetPlan()` (server.js:10149) reads the starter JSON and merges IDs by familyId and componentId. It never validates whether any ID resolves to a real asset.

### Required additions to the document

The rerank mechanism needs a concrete design decision. Three options:

**Option R-1 — LLM vision rerank** (recommended for launch)
- Feed candidate image URL + slot context + referenceAnchor mood to Claude Vision
- Score: style match, subject fit, crop suitability, brand tone
- Latency: 1-2s per candidate batch

**Option R-2 — CLIP embedding similarity**
- Embed reference anchor image + each candidate
- Cosine similarity as score
- Requires embedding model API or self-hosted CLIP
- No LLM call needed, lower latency

**Option R-3 — Rule-based scoring only**
- Score by aspect ratio match, dominant color hue match, keyword overlap
- No model calls
- Fast but likely insufficient for hero/campaign grade

The document currently implies none of these specifically. Codex cannot implement `rerankAssetCandidatesAgainstReference()` without this decision being recorded.

---

## 5. Gap 4 — Icon Set Family Consistency Not Addressed

### What the document says

Section 5.3 (Generation-Better Cases):

> quickmenu icon illustration family

Section 8.2:

> quickmenu icon illustration family

### What the code does

`server.js:10552-10600` (renderHomeQuickmenuCompositionSection):

Quickmenu renders 7-10 icon items, each with an individual icon reference. The starter JSON has `home-quickmenu-line` and `home-quickmenu-solid` as icon set IDs — but no concept of per-icon URLs within a set, no family count enforcement, and no consistency requirement between icons.

If generation is called once per `assetNeeds` entry, you get one icon image per call with no guarantee of visual family consistency (stroke weight, style, color palette, grid alignment).

### Required addition to the architecture

The document should specify an **icon family generation contract** separate from single-image generation:

```
assetFamily:
  familyId: "home-quickmenu-line"
  memberCount: 8
  memberLabels: ["배송조회", "주문배송", "고객상담", "이벤트", "포인트", "기획전", "멤버십", "설정"]
  styleSpec: "line icon, 24x24 viewport, 2px stroke, LG red primary"
  generationMode: "batch-consistent" | "single-consistent-seed"
```

Without this, icon generation produces 8 stylistically unrelated images that break quickmenu visual rhythm regardless of individual quality.

---

## 6. Gap 5 — Asset Geometry Specification Missing

### What the document says

Section 4.6:

> results must pass component-level fit checks:
> - hero fit
> - card crop
> - icon suitability
> - banner readability

### What the code does

`llm.js:2686-2687`:

```js
"Respect each component's mediaSpec and layout. Do not propose image treatment that would make visuals look shrunken, over-cropped, or mismatched to the slot's intended fit."
"When mediaSpec.measuredScale or patchBridge.measuredScale is provided, keep the slot's usable width, image presence, and text scale close to that measured baseline..."
```

`mediaSpec` exists in the builder payload per component. But neither `asset-pipeline-starter.json` nor `buildInterventionAssetNeeds()` includes any geometry spec. Component fit checks for external search results or generated assets have no reference data to validate against.

### Required additions

A geometry spec should be added to the starter registry and to the `assetOrchestrator` contract:

```json
"geometrySpec": {
  "home.hero": {
    "aspectRatio": "16:9",
    "minWidth": 1440,
    "safeTextZone": "left 55%",
    "focalPointBias": "right-center",
    "format": "webp"
  },
  "home.quickmenu.icon": {
    "aspectRatio": "1:1",
    "size": 48,
    "format": "svg",
    "strokeWeight": "2px"
  },
  "home.summary-banner-2": {
    "aspectRatio": "3:1",
    "minWidth": 960,
    "safeTextZone": "none — full bleed",
    "format": "webp"
  }
}
```

Without this, `checkComponentAssetFit()` (proposed in section 4.7) cannot validate against any reference. It would be a no-op.

---

## 7. Gap 6 — Phase 1 "Asset Orchestrator" Has No Concrete Contract

### What the document says

Section 9 Phase 1:

> add `asset orchestrator` layer after builder and before renderer

Section 7.2 (Asset Orchestrator Contract):

```
Required input: pageId, interventionLayer, patchDepth, targetGroupId, targetComponents, approvedPlan, referenceAnchors, visualComparison, assetNeeds
Required output: resolvedAssetPlan, assetSourceType, assetQuality, registeredAssetIds
```

### What the code does

`mergeRuntimeCompositionAssetPlan()` (server.js:10149) is the current nearest equivalent. It returns merged IDs from the starter registry per familyId and componentId. It does not:
- Accept `assetNeeds` as input
- Return `assetSourceType` or `assetQuality`
- Write anything to a registry
- Distinguish between starter / search / generated sources

### Required function signature for Phase 1

```js
async function resolveAssetPlan(context = {}) {
  const {
    pageId,
    interventionLayer,
    patchDepth,
    targetComponents,    // string[]
    approvedPlan,        // { designSpecMarkdown, referenceAnchors }
    assetNeeds,          // string[] from buildInterventionAssetNeeds()
    composerAssetBindings, // from composition.assetBindings
  } = context;

  return {
    resolvedAssetPlan: {
      /* slotId → { assetId, url, format, dimensions } */
    },
    assetSourceType: "starter" | "search" | "generated",
    assetQuality: "high" | "medium" | "placeholder",
    registeredAssetIds: [],
  };
}
```

Phase 1 minimal implementation (starter-only):
- Walk `assetNeeds` array
- For each need, match against starter registry by `pageId` + `usage`
- Return matched entries with `assetSourceType: "starter"` and `assetQuality: "placeholder"` until URLs are populated

This gives the contract without requiring search or generation to exist yet.

---

## 8. Gap 7 — `assetBindings` Field Not Enforced in Detailer Pass

### What the document says

Section 7.1:

> Then a separate asset orchestrator decides: starter asset reuse, search retrieval, generation

### What the code does

`llm.js:2893` (Composer prompt):

```js
"Required composition keys: focusSlots, referenceUse, compositionTree, styleContract, assetBindings, negativeConstraints."
```

`llm.js:2671` (Builder system prompt):

```js
"If compositionResult is provided, treat composition.focusSlots, composition.referenceUse, composition.compositionTree, composition.styleContract, and composition.assetBindings as the locked structure-and-style intent..."
```

Composer emits `assetBindings`. Builder is told to respect it. But there is no code path between `composition.assetBindings` and `applyOperations()` that enforces binding. The builder reads `assetBindings` as intent text but can still emit a raw URL via `update_slot_image`.

### Required enforcement

After `applyOperations()`, a binding check pass should:

1. Read `composition.assetBindings`
2. For each bound slot, confirm the applied patch contains an `assetId` reference, not a raw URL
3. If raw URL found, replace with the bound `assetId` or flag as `assetBindingViolation` in the build report

---

## 9. Summary of Required Work Before Phase 1 Is Launchable

| Gap | Blocking Phase 1? | Required action |
|-----|-------------------|-----------------|
| `update_slot_image` accepts arbitrary URL | Yes | Restrict to `assetId` in redesign passes; add `resolveAssetIdToUrl()` |
| Starter registry has no real URLs | Yes | Add `url`/`dimensions`/`format` to each starter entry (Phase 0) |
| Rerank mechanism unspecified | No (Phase 2) | Record decision: LLM vision / CLIP / rule-based |
| Icon family consistency | No (Phase 3) | Define `assetFamily` batch generation contract |
| Geometry spec missing | No (Phase 2) | Add `geometrySpec` to starter registry and orchestrator input |
| Phase 1 orchestrator has no function signature | Yes | Write `resolveAssetPlan()` stub with starter-only implementation |
| `assetBindings` not enforced | No (Phase 2) | Add post-apply binding validation pass |

Phase 1 requires resolving three blocking items before the hybrid contract can exist in code.

---

## 10. Recommended Additions to Base Document

1. Add **Phase 0**: populate starter asset registry with real CDN URLs and geometry specs
2. Add **geometry spec schema** to section 7.2 (Asset Orchestrator Contract)
3. Add **`resolveAssetPlan()` function signature** to section 7.2
4. Add **rerank mechanism decision** to section 4.2 (LLM vision is the safest launch choice)
5. Add **icon family generation contract** to section 5.6 (Required Guardrails)
6. Clarify that `update_slot_image` must be restricted from builder-facing API in redesign passes once Phase 1 is live

---

## 11. Code Ownership Additions

The following additions are needed beyond the base document's section 10:

### `server.js`

Should also own:

- `resolveAssetPlan()` — Phase 1 orchestrator stub
- `resolveAssetIdToUrl()` — ID → URL lookup from starter registry
- `validateAssetBinding()` — post-apply binding check

### `llm.js`

Should also own:

- Remove `update_slot_image` from redesign build pass allowed operations (restrict to admin-level slot editing only, not builder redesign)
- Add `assetId` field as preferred alternative to `imageSrc` in slot patches

### `data/normalized/asset-pipeline-starter.json`

Must add:

- `url` or `cdnUrl` per entry
- `dimensions` per entry
- `format` per entry
- `geometrySpec` top-level object per slot type
