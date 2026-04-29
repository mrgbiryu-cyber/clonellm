# Admin Asset Pipeline Architecture Options

Date: 2026-04-19
Owner: Codex / mrgbiryu alignment draft
Status: Architecture option review

## 1. Goal

This document defines how the design builder should handle images and visual assets when redesign quality depends on more than layout and CSS.

The core question is:

- when are existing assets enough
- when should the system search for external assets
- when should the system generate new assets

This document compares three architecture options:

1. search-first
2. generation-first
3. hybrid asset pipeline

Related gap review:

- [admin-asset-pipeline-architecture-supplement-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-asset-pipeline-architecture-supplement-2026-04-19.md)

## 2. Current System Reality

Current builder capability:

- can restructure components through renderer/template selection
- can select starter asset ids through `assetPlan` / `assetReferences`
- can replace image URLs through `update_slot_image`
- can report missing asset requirements through `assetNeeds`

Current builder limitation:

- cannot create new hero visuals, icons, badges, thumbnails, or campaign graphics by itself
- cannot edit an existing image in a controlled way
- cannot register newly created assets back into the runtime asset library

Current code paths:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `buildBuilderSystemPrompt()`
  - `handleLlmBuildOnData()`
  - `applyOperations()`
- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `buildInterventionAssetNeeds()`
  - `buildAssetPipelineStarterContext()`
  - `mergeRuntimeCompositionAssetPlan()`
- [asset-pipeline-starter.json](/home/mrgbiryu/clonellm/data/normalized/asset-pipeline-starter.json)

This means the current system is a redesign builder with limited asset substitution, not yet a full asset-producing design system.

Important current contradiction:

- the target architecture should move away from free-form image URL selection
- but the current builder still allows `update_slot_image`
- therefore the asset orchestrator must be treated as a migration target, not as already enforced behavior

## 3. Why Asset Strategy Matters

The builder can already improve:

- hierarchy
- rhythm
- layout
- component structure
- visual density

But the builder still struggles when redesign quality depends on:

- a new hero image
- a new campaign mood image
- a new icon set
- new badge graphics
- new editorial thumbnails

Without a stronger asset pipeline, the system risks:

- looking too similar to the original
- looking placeholder-grade
- producing correct structure with weak visual impact

## 4. Option A — Search-First Asset Pipeline

### 4.1 Summary

The system retrieves external images from free or licensed image sources, reranks them against page identity and reference anchors, and injects only the highest-fit candidates.

### 4.2 Flow

`assetNeeds -> search query build -> candidate retrieval -> style-aware rerank -> component fit check -> visual critic`

### 4.3 Best Use Cases

- editorial filler visuals
- generic lifestyle visuals
- supporting banner images
- secondary card thumbnails
- non-brand-specific illustration references

### 4.4 Advantages

- cheaper than generation-first
- faster to adopt
- can produce realistic imagery without model variance
- useful when “good enough” stock-style imagery is acceptable

### 4.5 Risks

- keyword-only retrieval can produce semantically correct but visually wrong results
- stock results often mismatch brand mood
- composition, crop, and subject focus may not fit the component geometry
- licensing and provenance rules need to be explicit

### 4.6 Required Guardrails

- search results are never applied directly
- every candidate must be reranked using:
  - `pageIdentity`
  - `referenceAnchors`
  - `targetLayer`
  - `targetComponents`
  - `why`
  - `avoid`
- results must pass component-level fit checks:
  - hero fit
  - card crop
  - icon suitability
  - banner readability

### 4.7 Architecture Impact

New required modules:

- `searchAssetCandidates()`
- `rerankAssetCandidatesAgainstReference()`
- `checkComponentAssetFit()`
- `persistSelectedExternalAsset()`

Best fit with current code:

- strong fit with `assetNeeds`
- strong fit with `referenceAnchors`
- strong fit with `visual critic`

## 5. Option B — Generation-First Asset Pipeline

### 5.1 Summary

The system calls an image generation or image editing API whenever the redesign needs a net-new visual result.

### 5.2 Flow

`assetNeeds -> generation brief build -> image generation / edit -> asset QA -> visual critic -> registry save`

### 5.3 Best Use Cases

- hero visuals
- campaign mood banners
- custom badge/chip graphics
- quickmenu icon illustration sets
- branded editorial cards

### 5.4 Advantages

- strongest path for large visual change
- can create page-specific art direction
- can align more tightly to reference mood and planner intent
- can create families of assets for template variants

### 5.5 Risks

- cost
- latency
- output inconsistency
- brand drift
- copyright / provenance review
- generated image may still not fit actual UI geometry

### 5.6 Required Guardrails

- generation prompt must be built from:
  - `approvedPlan`
  - `referenceAnchors`
  - `targetLayer`
  - `targetComponents`
  - `assetIntent`
  - `negativeConstraints`
- generated assets must be validated before use
- generated hero/icon/badge results must be stored as named asset ids, not one-off ephemeral URLs

### 5.7 Architecture Impact

New required modules:

- `buildAssetGenerationBrief()`
- `generateAssetVariant()`
- `editAssetVariant()` for controlled image edits
- `registerGeneratedAsset()`
- `scoreGeneratedAssetFit()`

Best fit with current code:

- strongest fit for `home`, `homestyle-home`, `care-solutions`
- strongest fit for `hero`, `quickmenu`, `badge`, `banner`

## 6. Option C — Hybrid Asset Pipeline

### 6.1 Summary

The system uses existing assets first, then external search, then generation only when needed.

This is the recommended architecture.

### 6.2 Flow

`starter assets -> search candidates -> generation fallback -> visual critic -> asset registry`

### 6.3 Decision Order

1. use starter asset registry if fit is good enough
2. search external candidates when a real-world visual is acceptable
3. generate or edit an asset when:
   - change strength is still too weak
   - no candidate fits the required component
   - the redesign needs a branded visual focal point

### 6.4 Why Hybrid Fits This System Best

- preserves existing asset investments
- avoids unnecessary generation cost
- enables stronger redesign where stock imagery is not enough
- matches the current `assetNeeds` architecture without replacing it
- fits the current builder/critic loop naturally

## 7. Recommended System Design

### 7.1 Asset Decision Layers

The builder should not directly “pick an image URL”.

It should output:

- `assetNeeds`
- `assetIntent`
- `assetBindings`
- `assetPriority`

Then a separate asset orchestrator decides:

- starter asset reuse
- search retrieval
- generation

### 7.1.1 Transition Rule for `update_slot_image`

Current code still allows:

- `update_slot_image`

Target architecture rule:

- `update_slot_image` should not accept arbitrary external URLs during redesign/build passes
- builder should emit:
  - `assetNeeds`
  - `assetIntent`
  - `assetBindings`
  - optional `preferredAssetFamily`
- asset orchestrator should resolve those into:
  - `assetId`
  - `assetSourceType`
  - `resolvedAssetUrl`

Migration rule:

- short term:
  - allow `update_slot_image` only when the image source resolves from a known asset registry entry
- long term:
  - deprecate raw URL image replacement from builder output
  - reserve raw URL use for admin/manual override only

### 7.2 Asset Orchestrator Contract

Required input:

- `pageId`
- `interventionLayer`
- `patchDepth`
- `targetGroupId`
- `targetComponents`
- `approvedPlan`
- `referenceAnchors`
- `visualComparison` feedback
- `assetNeeds`

Required output:

- `resolvedAssetPlan`
- `assetSourceType`
  - `starter`
  - `search`
  - `generated`
- `assetQuality`
- `registeredAssetIds`

### 7.2.1 Phase 0 Requirement

Before `starter assets first` can be real, the starter registry must contain actual asset payload references.

Required fields to add per starter entry:

- `assetUrl`
- `format`
- `dimensions`
- `aspectRatio`
- optional `spriteRef` or `inlineSvgRef`

Current status:

- `asset-pipeline-starter.json` currently contains ids, labels, usage, and style metadata
- it does not yet contain the actual asset location

Operational conclusion:

- `Phase 0` is mandatory before the hybrid pipeline can be treated as executable

### 7.2.2 Proposed `resolveAssetPlan()` Contract

The orchestrator contract must be explicit so it can be implemented safely.

Recommended signature:

```js
async function resolveAssetPlan({
  pageId,
  viewportProfile,
  interventionLayer,
  patchDepth,
  targetGroupId,
  targetComponents,
  approvedPlan,
  compositionResult,
  visualComparison,
  assetNeeds,
  assetBindings,
  referenceAnchors,
  geometrySpecMap,
}) => {
  return {
    resolvedAssetPlan: {
      iconSetIds: [],
      badgePresetIds: [],
      visualSetIds: [],
      thumbnailPresetIds: [],
      resolvedAssets: [],
    },
    assetSourceTypeById: {},
    registeredAssetIds: [],
    unresolvedNeeds: [],
    qualityFlags: [],
  };
}
```

Required `resolvedAssets[]` shape:

```js
{
  assetId: "home-hero-premium-stage-v2",
  sourceType: "starter" | "search" | "generated",
  targetComponentId: "home.hero",
  targetSlotId: "hero",
  assetUrl: "https://...",
  format: "webp",
  width: 1440,
  height: 810,
  aspectRatio: "16:9",
  geometryFit: "pass" | "warning" | "fail",
}
```

### 7.2.3 `assetBindings` Enforcement Rule

Current problem:

- composer can emit `assetBindings`
- but there is no final enforcement step that guarantees those bindings resolve to valid starter/search/generated assets before runtime render

Required enforcement point:

- after builder output
- before `applyOperations()`
- before runtime renderer consumes `assetPlan`

Required enforcement behavior:

- drop unresolved asset ids
- mark missing assets in `unresolvedNeeds`
- add `qualityFlags`
- block raw free-form asset URLs unless explicitly allowed by admin/manual mode

## 8. Where Search Is Enough vs Where Generation Is Better

### 8.1 Search-Enough Cases

- secondary lifestyle cards
- editorial filler imagery
- supporting banners
- generic category thumbnails

### 8.2 Generation-Better Cases

- hero main visual
- premium campaign banner
- quickmenu icon illustration family
- badge/chip graphics
- page-specific branded editorial art direction

### 8.3 Rerank Decision

The rerank layer must not remain abstract.

Recommended launch order:

1. `LLM vision rerank` for launch-quality path
2. optional `CLIP / embedding rerank` later for latency optimization
3. rule-based rerank only as a weak prefilter, not the final selector

Concrete recommendation:

- use rule-based filtering first
  - aspect ratio
  - format
  - usage compatibility
- then use `LLM vision rerank`
  - page identity fit
  - reference anchor similarity
  - target component suitability
  - avoid-pattern rejection

This is the preferred implementation target for:

- `rerankAssetCandidatesAgainstReference()`

## 9. Geometry and Family Contracts

### 9.1 Geometry Spec Requirement

`checkComponentAssetFit()` cannot be real until the system has geometry specs.

Required data structure:

```json
{
  "home.hero": {
    "aspectRatio": "16:9",
    "minWidth": 1440,
    "safeTextZone": "left 55%",
    "focalPointBias": "right-center",
    "preferredFormat": "webp"
  },
  "home.quickmenu.icon": {
    "aspectRatio": "1:1",
    "size": 48,
    "preferredFormat": "svg",
    "strokeWeight": "2px"
  },
  "home.summary-banner-2": {
    "aspectRatio": "3:1",
    "minWidth": 960,
    "safeTextZone": "full-bleed",
    "preferredFormat": "webp"
  }
}
```

Minimum implementation target:

- `hero`
- `quickmenu icon`
- `summary-banner-2`
- `ranking card`
- `story card`

### 9.2 Icon Family Consistency Contract

Quickmenu and icon-heavy sections must not generate icons one-by-one without family constraints.

Required icon family structure:

```json
{
  "familyId": "home-quickmenu-line",
  "memberCount": 8,
  "memberLabels": ["배송조회", "주문배송", "고객상담", "이벤트", "포인트", "기획전", "멤버십", "설정"],
  "styleSpec": {
    "viewport": "24x24",
    "strokeWeight": "2px",
    "cornerStyle": "rounded",
    "palette": ["var(--color-brand-red)", "#111111"]
  },
  "generationMode": "batch-consistent"
}
```

Rule:

- icon family generation must be batch-consistent
- a quickmenu icon set is not valid if each icon comes from unrelated single generations

## 10. Recommended Implementation Order

### Phase 0

Make starter assets real.

Required:

- add `assetUrl`
- add `format`
- add `dimensions`
- add `aspectRatio`
- add first-pass geometry spec map

### Phase 1

Build the hybrid contract without changing user UI.

Required:

- add `asset orchestrator` layer after builder and before renderer
- keep user-facing flow unchanged
- persist `assetSourceType` and `registeredAssetIds`
- enforce `assetBindings` before runtime render
- restrict raw URL image replacement in redesign mode

### Phase 2

Add search-based asset resolution.

Required:

- candidate retrieval
- rerank by reference and page identity
- component fit scoring
- rule prefilter + LLM vision rerank

### Phase 3

Add generation-based asset resolution for high-impact cases.

Required:

- hero visual generation brief
- badge/icon generation brief
- asset registration and reuse
- batch-consistent icon family generation

### Phase 4

Feed asset success/failure back into visual critic and fix loop.

Required:

- critic can say asset mismatch, not just hierarchy mismatch
- fix pass can request a better asset source type

## 11. Code Ownership Proposal

### `server.js`

Should own:

- asset orchestrator
- search/generation selection rules
- asset registry persistence
- critic routing for asset mismatch
- geometry spec fit checks
- asset binding enforcement

### `llm.js`

Should own:

- asset intent generation
- generation/search briefs
- asset-aware fix instructions
- image-free builder output policy for redesign mode

### `data/normalized/*`

Should own:

- starter assets
- registered generated assets
- registered external search assets
- search source policies
- geometry specs
- icon family specs

## 12. Final Recommendation

Do not choose between search and generation as a single permanent strategy.

The correct architecture is:

- `starter assets first`
- `search next`
- `generation for high-impact gaps`

Operational conclusion:

- search-only is too weak for hero-grade redesign
- generation-only is too costly and unstable for all cases
- hybrid is the only option that matches current clonellm architecture and quality goals
- but hybrid is only implementable after `Phase 0`, explicit rerank choice, geometry spec, and asset orchestrator contract are recorded
