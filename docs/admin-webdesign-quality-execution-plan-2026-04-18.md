# Web-Design Quality Execution Plan

Date: 2026-04-18
Owner: Codex / mrgbiryu alignment draft
Status: Active implementation plan

## Purpose

This document defines the remaining implementation tracks required to move the current builder from:

- a technically working redesign pipeline

to:

- a repeatably strong web-design-grade output system

This is not a concept note.
It is an execution plan with code ownership and completion criteria.

Related endpoint definition:

- [admin-webdesign-quality-endpoint-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-webdesign-quality-endpoint-2026-04-19.md)

## Current Diagnosis

The system can now:

- run planner -> composer -> detailer -> critic -> fix
- attach reference screenshots
- attach starter asset bundles
- render component-level variants
- run visual critic and hard delta gate

But it still does not reliably produce a result that feels like a real web-design proposal.

The main reason is:

`the system can detect weak redesign more reliably than it can force strong redesign output`

Additional scheduling note:

- weak redesign recovery must now be routed between composition recovery, asset-assisted recovery, and generation-backed recovery instead of relying on patch-style retries alone

## Track 1. Stronger First-Pass Generation

### Goal

Make the initial build significantly stronger before the critic loop starts.

### Why

Current output is still too conservative.
The fix loop is then forced to repair a weak draft instead of refining a strong one.

### Required changes

- make strong/full requests prefer structural replacement over patch-first execution
- strengthen `templateId` selection and `assetPlan` selection in composer
- make detailer more aggressively preserve template replacement choices
- reduce generic safe outputs when reference anchors clearly imply stronger visual direction

### Primary code paths

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `buildDemoComposerResult()`
  - `normalizeComposerTreeEntry()`
  - `normalizeComposerStyleContractEntry()`
  - `buildBuilderUserPrompt()`
  - `handleLlmCompose()`
  - `handleLlmBuildOnData()`

### Done when

- strong/full requests consistently produce template-based changes on first pass
- component-level builds no longer default back to weak patch-only output
- visual critic `changeStrength` no longer starts in the single-digit range for major redesign requests

## Track 2. Concrete Style Contract

### Goal

Replace descriptive style language with execution-grade style contracts.

### Why

Terms like:

- `editorial-bright`
- `clean-card`
- `headline-dominant`

are directionally helpful but too abstract to guarantee strong visual execution.

### Required changes

- convert style contract into concrete token groups
- define explicit preset families for:
  - title scale
  - spacing rhythm
  - contrast mode
  - card density
  - icon shell
  - image treatment
- keep free-form interpretation low during detailer execution

### Primary code paths

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `buildAllowedTokenSets()`
  - `normalizeComposerStyleContractEntry()`
  - `buildBuilderPromptPayload()`
  - `buildBuilderUserPrompt()`
- [server.js](/home/mrgbiryu/clonellm/server.js)
  - renderer family functions that consume these hints

### Done when

- style contracts can be read as real execution presets, not only prose
- critic failures can map to concrete preset switches
- the same prompt produces visually consistent output more often

## Track 3. Template Variant Expansion

### Goal

Increase execution diversity so strong redesign requests have enough runtime shapes to land on.

### Why

Even after `replace_component_template` was wired end-to-end, the renderer family set is still too shallow.

Current variants are not enough for repeated high-quality redesign generation.

### Required changes

- expand hero family beyond:
  - carousel
  - editorial
  - premium-stage
- expand quickmenu family beyond:
  - grid
  - panel
  - editorial-strip
- add stronger variants for:
  - ranking
  - commerce cards
  - banner strips
- move from regex-ish interpretation toward template registry / enum resolution

### Primary code paths

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `resolveHeroTemplateVariant()`
  - `resolveQuickmenuTemplateVariant()`
  - `renderHomeHeroCompositionSection()`
  - `renderHomeQuickmenuCompositionSection()`
  - `renderHomeRankingCompositionSection()`
  - `renderHomeCommerceCompositionSection()`
  - `renderHomeImageBannerCompositionSection()`
- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - templateId contracts in builder/composer prompts

### Done when

- each high-value family has multiple visibly distinct renderer variants
- template choice produces major visual differences, not subtle restyling only
- LLM no longer invents unsupported template ids

## Track 4. Group/Page Renderer Completion

### Goal

Move group/page redesign out of shell-only treatment into real composition rendering.

### Why

Component variants alone are not enough for page-level web-design quality.
Top/mid/bottom and full page rhythm must also change.

### Required changes

- turn current shell classes into true renderer behavior
- add:
  - top-group renderer
  - mid-group renderer
  - full-page home composition renderer
- extend the same pattern to:
  - `homestyle-home`
  - `care-solutions`

### Primary code paths

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `readDraftHigherLayerCompositionState()`
  - `buildHomeHigherLayerCompositionStyleTag()`
  - `injectHomeReplacements()`
  - future group/page renderer functions

### Done when

- section-group requests visibly change section rhythm and shell layout
- page-level requests do not collapse back into weak component-only redesign
- full-page redesign has a dedicated renderer path

## Track 5. Critic-To-Redesign Convergence

### Goal

Make critic findings produce stronger structural correction instead of light patch cleanup.

### Why

The loop exists, but it still tends to produce narrow corrective behavior.
That is not enough for web-design-grade convergence.

### Required changes

- map critic failure dimensions to structural corrective actions
- examples:
  - `hierarchy` failure -> stronger template switch or title-scale preset escalation
  - `alignment` failure -> spacing rhythm preset switch
  - `referenceAlignment` failure -> reference-bound template or asset swap
  - `changeStrength` failure -> more aggressive redesign mode
- allow the visual fix pass to prefer template replacement when patch correction is too weak

### Primary code paths

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `handleLlmVisualCritic()`
  - `normalizeVisualCriticResult()`
  - `handleLlmFix()`
  - `buildBuilderCriticReport()`
- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `runVisualCriticForDraft()`
  - visual-fix loop inside `/api/llm/build`

### Done when

- critic failure leads to larger structural correction, not only patch accumulation
- repeated retries converge toward stronger redesign instead of oscillating near the original
- hierarchy/alignment failures become materially recoverable

## Implementation Order

The recommended order is:

1. Stronger first-pass generation
2. Concrete style contract
3. Template variant expansion
4. Group/page renderer completion
5. Critic-to-redesign convergence

Cross-track requirement:

- strong/full redesign work must use whole-page context injection
- original clone full-page screenshot + target-region overlay + focused crop should be treated as required generation/review inputs, not optional diagnostics

## Minimum Proof For Progress

The plan should not be treated as successful until all of the following are true on real builds:

- `home / hero + quickmenu` produces clearly stronger redesign than the current original
- `changeStrength` is materially higher than the current low single-digit results
- hierarchy is no longer stuck at `0`
- at least one second page family also produces a strong result
- strong redesign requests look like redesign, not patch-heavy restyling
- strong redesign requests are generated with whole-page original context, not only local slot scope

## Related Documents

- [admin-builder-visual-architecture-2026-04-17.md](/home/mrgbiryu/clonellm/docs/admin-builder-visual-architecture-2026-04-17.md)
- [admin-design-hardening-code-status-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-design-hardening-code-status-2026-04-18.md)
- [admin-external-ai-design-tool-gap-review-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-external-ai-design-tool-gap-review-2026-04-18.md)
- [admin-quality-recovery-and-generation-routing-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-quality-recovery-and-generation-routing-2026-04-19.md)
