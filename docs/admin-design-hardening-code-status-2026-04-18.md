# Admin Design Hardening Code Status

Date: 2026-04-18
Owner: Codex / mrgbiryu alignment draft
Status: Working status snapshot

## 1. Goal

This document records:

- which design-quality hardening items are already implemented in code
- which items are only partially implemented
- which items are still missing before design quality can be treated as open-ready
- which file and function paths currently own each part

This is a code-status document, not a concept document.

Related direction documents:

- [admin-builder-visual-architecture-2026-04-17.md](/home/mrgbiryu/clonellm/docs/admin-builder-visual-architecture-2026-04-17.md)
- [admin-claude-quality-gap-and-rebuild-decision-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-claude-quality-gap-and-rebuild-decision-2026-04-19.md)
- [admin-reference-source-policy-2026-04-17.md](/home/mrgbiryu/clonellm/docs/admin-reference-source-policy-2026-04-17.md)
- [admin-asset-pipeline-architecture-options-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-asset-pipeline-architecture-options-2026-04-19.md)
- [admin-quality-recovery-and-generation-routing-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-quality-recovery-and-generation-routing-2026-04-19.md)
- [admin-full-redesign-delivery-gates-2026-04-17.md](/home/mrgbiryu/clonellm/docs/admin-full-redesign-delivery-gates-2026-04-17.md)
- [admin-webdesign-quality-execution-plan-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-webdesign-quality-execution-plan-2026-04-18.md)

## 1.1 Final Readiness Cut

This section answers one question directly:

Can the design builder currently be treated as "web-design quality ready" for open use?

Current answer:

- No, not yet.

Reason:

- the architecture layers are mostly in place
- but the system still does not reliably produce redesign output that is visually strong enough, different enough, and repeatable enough to be treated as open-ready

Readiness split:

- Completed enough to continue hardening:
  - reference anchoring
  - planner budget control
  - composer -> detailer -> fix split
  - structural critic
  - multimodal visual critic
  - hard visual delta gate
  - partial self-contained runtime renderer
- Not complete enough for release quality:
  - strong template replacement effect
  - group/page redesign renderer coverage
  - asset depth
  - post-critic correction strength
  - stable high-delta redesign generation

## 1.2 Release Review Table

### Completed

- `reference -> planner/builder/critic` backend integration is live
- `composer -> detailer -> fix` pipeline is live
- `before / after / reference` visual critic is live
- `hard visual delta gate` is live and can block weak redesigns with HTTP `409`
- builder failure UI can now expose quality-gate context instead of dropping the payload
- home runtime composition sections now include self-contained style tags

Primary code paths:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
- [server.js](/home/mrgbiryu/clonellm/server.js)
- [web/admin-research.html](/home/mrgbiryu/clonellm/web/admin-research.html)

### Partially Completed

- `replace_component_template` is now recognized end-to-end, but the visible redesign effect is still not strong enough in real outputs
- component runtime renderer exists for a subset of home-family rebuild cases, but not across all rebuild-core targets
- self-contained renderer styling exists for current home composition families, but this standard is not yet generalized to all rebuild families
- starter asset bundles are wired, but the actual asset library remains shallow
- visual critic failure is now visible and blockable, but automatic correction after critic is still not strong enough to guarantee convergence

Primary code paths:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `normalizeBuilderOperation()`
  - `enforceBuilderOperations()`
  - `handleLlmBuildOnData()`
  - `handleLlmVisualCritic()`
  - `applyOperations()`
- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `runVisualCriticForDraft()`
  - `renderHomeHeroCompositionSection()`
  - `renderHomeQuickmenuCompositionSection()`
  - `renderHomeRankingCompositionSection()`
  - `renderHomeCommerceCompositionSection()`
  - `renderHomeImageBannerCompositionSection()`

### Not Completed / Release Blockers

- `group redesign renderer` is not complete
- `page redesign renderer` is not complete
- redesign output still risks looking too close to the original screen
- the system does not yet guarantee a strong enough structural shift after reference-guided generation
- asset coverage is not deep enough for production-level visual richness
- there is no proven release pass on the pages that matter most:
  - `home`
  - `homestyle-home`
  - `care-solutions`

Release blockers must be treated as blockers, not polish.

## 1.3 Minimum Open-Ready Conditions

The builder should not be treated as open-ready until all of the following are true:

- a strong redesign request on `home` produces a visibly different result and passes the hard visual delta gate
- the same is true for at least one other high-value page family
- visual critic failure dimensions can be corrected into a passing build without manual code edits
- component rebuild output looks intentional, not patch-like
- group/page redesign requests render through dedicated renderer coverage instead of collapsing back into weak patch behavior
- asset-driven sections do not look placeholder-grade

## 1.4 Current Final Judgment

Current judgment:

- The design-builder hardening program is well underway.
- The quality architecture is not missing.
- The release-quality finish is still missing.

Operational conclusion:

- continue implementation
- do not treat the current state as final quality complete
- evaluate readiness only after high-delta redesign output becomes repeatable on core pages

## 2. Completed In Code

### 2.1 Reference Anchoring

Status: implemented

What exists:

- structured reference anchors are built and injected into planner / builder context
- source class, target layer, target components, why, avoid, capture mode, screenshot URLs are included
- build-time reference visual assets are now materialized and attached as image inputs

Code paths:

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `buildDesignReferenceSourceSeedContext()`
  - `buildDesignReferenceAnchors()`
  - `buildDesignReferenceLibraryContext()`
  - `materializePlannerReferenceVisualAssets()`
  - `materializeReferenceVisualAssets()`
- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `buildPlannerSystemPrompt()`
  - `buildPlannerPromptPayload()`
  - `buildComposerSystemPrompt()`
  - `buildBuilderSystemPrompt()`
  - `readReferenceVisualAssets()`
  - `buildReferenceVisualUserContent()`

Data paths:

- [design-reference-source-seeds.json](/home/mrgbiryu/clonellm/data/normalized/design-reference-source-seeds.json)
- [design-reference-library.json](/home/mrgbiryu/clonellm/data/normalized/design-reference-library.json)
- [admin-reference-source-policy-2026-04-17.md](/home/mrgbiryu/clonellm/docs/admin-reference-source-policy-2026-04-17.md)

### 2.2 Asset Starter Registry

Status: implemented as starter registry

What exists:

- page-level default asset bundles
- family-level default asset bundles
- component-level default asset bundles
- planner / composer / detailer receive starter asset ids

Code paths:

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `readAssetPipelineStarter()`
  - `buildAssetPipelineStarterContext()`
- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `buildPlannerPromptPayload()`
  - `buildComposerPromptPayload()`
  - `buildPreferredStarterAssetBindings()`

Data path:

- [asset-pipeline-starter.json](/home/mrgbiryu/clonellm/data/normalized/asset-pipeline-starter.json)

### 2.3 Planner Budget Hardening

Status: implemented

What exists:

- planner budget is now driven by `interventionLayer`
- prompt bullet counts were made scope-aware
- normalize and markdown generation also follow scope-aware budget rules
- duplicate planner requests are blocked in admin UI

Code paths:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `buildPlannerBudgetProfile()`
  - `buildPlannerSystemPrompt()`
  - `normalizePlannerResult()`
  - `buildRequirementPlanMarkdownDocs()`
  - `buildSectionBlueprints()`
  - `buildProposalSectionSpecs()`
- [web/admin-research.html](/home/mrgbiryu/clonellm/web/admin-research.html)
  - planner run-state / duplicate request prevention logic

### 2.4 Builder Split: Composer -> Detailer -> Fix

Status: implemented

What exists:

- builder is no longer a single-pass design call
- composer creates composition intent
- detailer generates executable operations
- structural critic can request retry
- fixer creates targeted corrective operations

Code paths:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `handleLlmCompose()`
  - `buildComposerSystemPrompt()`
  - `buildComposerUserPrompt()`
  - `normalizeComposerResult()`
  - `handleLlmBuildOnData()`
  - `handleLlmFix()`
  - `buildFixSystemPrompt()`
  - `buildFixUserPrompt()`

### 2.5 Structural Critic + Retry Trigger

Status: implemented

What exists:

- structural critic computes retry trigger
- before/after page snapshots are passed into critic
- build flow can re-run through fix pass when critic flags failure

Code paths:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `buildBuilderCriticReport()`
  - `handleLlmBuildOnData()`
- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `/api/llm/build` route save pipeline with snapshotData

### 2.6 Multimodal Visual Critic

Status: implemented

What exists:

- before / after / reference screenshots are compared by a vision-capable critic call
- visual critic output is merged into draft critic report
- retry trigger now reflects visual failure as well as structural failure

Code paths:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `handleLlmVisualCritic()`
  - `buildVisualCriticSystemPrompt()`
  - `buildVisualCriticUserPrompt()`
  - `normalizeVisualCriticResult()`
- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `runVisualCriticForDraft()`
  - `captureUrlAsScreenshotDataUrl()`
  - `captureReferenceAssetDataUrl()`
  - `buildInternalVisualCriticPreviewUrl()`

## 3. Partially Implemented

### 3.1 Component Runtime Renderer Coverage

Status: partial

What exists:

- home hero / quickmenu and some home family compositions can render through runtime composition sections
- component composition can be stored in draft reports and interpreted by runtime

Code paths:

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `renderHomeHeroCompositionSection()`
  - `renderHomeQuickmenuCompositionSection()`
  - family render logic around `normalizeRuntimeComponentCompositionList()` and `applyDraftBuild*` flow

What is still missing:

- renderer coverage is not complete across the 58 rebuild-core target-component entries
- many family renderers still fall back to old DOM / old visual material
- this is one major reason redesign strength remains weak

### 3.2 Asset Pipeline

Status: partial

What exists:

- starter schema and bundle ids exist
- builder can mention and carry asset ids
- component / family / page defaults are now present

What is still missing:

- actual rich asset stock is not filled deeply enough
- icon sets, visual sets, badge sets, thumbnail sets are still starter-level, not production-complete
- no strong asset upload / curation / replacement workflow exists yet

Primary files:

- [asset-pipeline-starter.json](/home/mrgbiryu/clonellm/data/normalized/asset-pipeline-starter.json)
- [admin-full-redesign-delivery-gates-2026-04-17.md](/home/mrgbiryu/clonellm/docs/admin-full-redesign-delivery-gates-2026-04-17.md)

### 3.3 Reference Use Strength

Status: partial

What exists:

- references are now structured
- screenshots are now attached
- composer / detailer / critic can now see those screenshots

What is still missing:

- reference use does not yet guarantee a visibly stronger redesign
- current output can still stay too close to original
- reference-driven style and composition decisions need stronger enforcement at detailer / renderer level

Primary files:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
- [server.js](/home/mrgbiryu/clonellm/server.js)

### 3.4 Quality Gate

Status: partial

What exists:

- critic reports exist
- retry triggers exist
- visual failure is now measurable

What is still missing:

- failure does not yet block acceptance strongly enough
- build can still complete while being visually too close to the original
- changed-pixel or visible-delta threshold is not yet a hard release gate

## 4. Not Yet Completed

### 4.1 Group Composition Renderer

Status: not completed

Needed outcome:

- upper / middle / lower zone redesign should be rendered as one coordinated shell, not only slot-by-slot replacement

Main code area to extend:

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - runtime composition renderer layer
  - current family renderer routing

### 4.2 Page Composition Renderer

Status: not completed

Needed outcome:

- page full redesign should be rendered as a page shell, not reduced to local patching

Main code area to extend:

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - draft runtime rendering path
  - page-level composition tree application

### 4.3 Scoped Style Execution

Status: not completed

Needed outcome:

- renderer output should carry stronger scoped style execution
- not only patch values, but a richer style contract should be reflected safely

Main code area to extend:

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - composition section HTML/CSS generation
- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - styleContract production and stricter token mapping

### 4.4 Stronger Visual Retry Loop

Status: not completed

Needed outcome:

- visual critic failure should drive a stronger targeted fix or rebuild pass
- not just report failure
- especially when hierarchy / alignment / changeStrength are low

Main code area to extend:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `handleLlmVisualCritic()`
  - `handleLlmFix()`
  - `handleLlmBuildOnData()`
- [server.js](/home/mrgbiryu/clonellm/server.js)
  - build route orchestration after visual critic result

### 4.5 Hard Visual Delta Gate

Status: not completed

Needed outcome:

- if redesign is visually too close to the original, the system should treat it as failed quality output
- current build can still end in success even when the screen barely changes

Suggested implementation area:

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - after visual critic save pipeline
- possible helper:
  - screenshot diff utility or changed-area threshold logic

## 5. Current Practical Diagnosis

Current diagnosis from recent runs:

- pipeline execution works
- reference / composer / detailer / structural critic / visual critic all run
- but redesign strength is still too weak in the rendered result
- the strongest current bottlenecks are:
  - incomplete renderer strength
  - starter-level asset depth
  - weak post-critic correction power
  - missing hard visual delta gate

In short:

- architecture hardening has progressed substantially
- design quality hardening is not finished yet
- current codebase is in `working architecture / insufficient visual convergence` state

## 6. Next Implementation Order

Recommended order from here:

1. strengthen post-visual-critic fix loop
2. add hard visual delta gate
3. deepen component renderer output for the most important families
4. add section-group composition renderer
5. add page composition renderer
6. expand asset pipeline beyond starter level
7. strengthen scoped style execution

## 7. Minimum Open-Readiness Conditions

Before design quality can be treated as open-ready, the following should be true:

- reference screenshots materially affect output
- redesign output is visibly different from original in targeted scope
- critic failure can trigger effective correction, not only logging
- component renderer coverage is strong on major home / homestyle / care surfaces
- group/page redesign no longer collapses back into weak local patching
- asset bundles are no longer only starter-level
- visual-delta failure is treated as a blocker
