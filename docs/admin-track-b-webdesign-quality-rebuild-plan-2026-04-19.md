# Track B Web-Design Quality Rebuild Plan

Date: 2026-04-19
Owner: Codex / mrgbiryu alignment draft
Status: Primary implementation direction

Related:
- `docs/admin-builder-v2-isolation-plan-2026-04-19.md`
- `docs/admin-builder-v2-hard-switch-plan-2026-04-19.md`

## Purpose

This document defines the main implementation path for reaching web-design-grade quality.

From this point:

- Track A hardening remains necessary
- but Track A is not the main product goal

The main goal is:

- rebuild the builder execution surface until it can reliably produce web-design-grade output

This document is the Track B plan for that rebuild.

## Product Target

The builder must be able to produce outputs that are:

- visually strong on first pass
- coherent at whole-page level
- structurally different from the original clone when requested
- asset-complete enough to look intentional
- quality-gated by visual quality, not only pixel delta

The system must not stop at:

- technically valid preview output
- patch-rich output
- "good enough for internal testing" output

The target is:

- customer-facing web-design proposal quality

## Core Principle

The current patch-first builder must be replaced by a renderer-native composition builder.

That means:

- generation outputs composition primitives first
- server renders allowlisted component/group/page compositions
- style is applied as component-scoped runtime contract
- assets are first-class execution inputs
- critic evaluates whole-page and focus-area results before pass/fail

## Target Architecture

The end-state architecture is:

1. `Intent Layer`
2. `Reference / Asset Sufficiency Layer`
3. `Composition Layer`
4. `Style Contract Layer`
5. `Renderer Layer`
6. `Asset Runtime Layer`
7. `Dual Critic Layer`
8. `Recovery Router`

### 1. Intent Layer

Purpose:

- translate user scope and change depth into redesign intent that is whole-page aware

Required outputs:

- `interventionLayer`
- `patchDepth`
- `visualGoals`
- `negativeConstraints`
- `targetComponents`
- `targetGroupId`
- `successRubric`

### 2. Reference / Asset Sufficiency Layer

Purpose:

- decide whether the build has enough references and assets before composition starts

Required decisions:

- `starter sufficient`
- `search required`
- `generation required`

Required inputs:

- whole-page clone context
- target overlay
- focus crop
- structured reference anchors
- starter assets
- optional search/generation assets

### 3. Composition Layer

Purpose:

- generate the target structure as primitives, not patches

Required output:

- allowlisted composition tree

Example primitive families:

- `Stack`
- `Cluster`
- `Grid`
- `SplitHero`
- `LeadCardRail`
- `EditorialStrip`
- `PosterCard`
- `CTACluster`
- `FeatureList`
- `PromoBand`

The builder should not describe redesign only as:

- patch this title
- increase padding
- change badge

It must describe redesign as:

- a real structure tree

### 4. Style Contract Layer

Purpose:

- turn design intent into execution-grade style presets

Required preset groups:

- type scale
- line-height scale
- letter-spacing scale
- font family pair
- spacing rhythm
- surface tone
- contrast mode
- elevation
- card density
- icon shell
- image treatment
- motion preset

Required property form:

- allowlisted preset values
- token overrides only where explicitly supported

### 5. Renderer Layer

Purpose:

- render component/group/page composition trees into real HTML + scoped style

Required renderer levels:

- `component renderer`
- `group renderer`
- `page renderer`

Required rule:

- supported families are replacement-first
- patch path is fallback-only

### 6. Asset Runtime Layer

Purpose:

- provide complete visual surfaces instead of placeholder-grade visuals

Required sources:

1. starter registry
2. search-backed assets
3. generation-backed assets

Required checks:

- geometry fit
- family consistency
- reference fit
- critic fit

### 7. Dual Critic Layer

Purpose:

- evaluate the result both as a whole page and as a focused redesign target

Required critic views:

- full-page before/after/reference
- focus-area before/after/reference

Required dimensions:

- hierarchy
- alignment
- referenceAlignment
- brandFit
- changeStrength
- typographicHarmony
- spacingRhythm
- assetFit

### 8. Recovery Router

Purpose:

- choose the correct next action when quality is weak

Recovery modes:

- `composition recovery`
- `asset-assisted recovery`
- `generation-backed recovery`

The router must not always run the same fix loop.

## Build Outcome Definition

A build is considered successful only when all of the following are true:

- critic is available
- execution did not fail
- full-page quality passes
- focus-area quality passes
- quality thresholds for the selected depth pass
- retry is no longer required
- the output is visually strong enough to read as redesign

## Representative Validation Set

Track B is not complete until the following scenarios pass as a fixed set:

1. `home` hero + quickmenu
2. `home` page full
3. `homestyle-home`
4. `care-solutions`

These are the release-quality validation set.

## Implementation Waves

### Wave 1. Quality Control Rebase

Goal:

- stop weak designs from passing

Required:

- quality-primary gate
- execution-fail vs quality-fail separation
- dual critic storage

Primary code areas:

- `server.js`
- `llm.js`
- `web/admin-research.html`

### Wave 2. Pre-Generation Sufficiency Gate

Goal:

- ensure redesign starts with enough visual context and assets

Required:

- reference sufficiency evaluation
- asset sufficiency evaluation
- search/generation escalation decision

Primary code areas:

- `server.js`
- `llm.js`
- asset registry files under `data/normalized`

### Wave 3. Primitive Composition Builder

Goal:

- replace patch-first generation with primitive composition generation

Required:

- allowlisted primitive schema
- composer primitive output
- builder execution from primitive tree

Primary code areas:

- `llm.js`
- `server.js`
- new primitive catalog / schema files

### Wave 4. Replacement-First Renderer Coverage

Goal:

- make supported families render through full replacement by default

Required:

- component renderer inventory
- group renderer inventory
- page renderer inventory
- patch fallback only for unsupported families

Primary code areas:

- `server.js`
- renderer helper functions

### Wave 5. Concrete Style Runtime

Goal:

- make style execution token-driven, not prose-driven

Required:

- runtime token presets
- style contract preset mapping
- scoped style compiler behavior

Primary code areas:

- `llm.js`
- `server.js`

### Wave 6. Asset Runtime Completion

Goal:

- ensure visuals feel designed, not placeholder-grade

Required:

- starter depth expansion
- search-backed asset path
- generation-backed asset path
- family consistency checks

Primary code areas:

- `server.js`
- `llm.js`
- asset registry JSON files

### Wave 7. Recovery Router Completion

Goal:

- route quality failure into the correct recovery strategy

Required:

- composition recovery
- asset-assisted recovery
- generation-backed recovery

Primary code areas:

- `server.js`
- `llm.js`

### Wave 8. Representative Scenario Pass

Goal:

- prove web-design quality on the fixed scenario set

Required:

- repeated pass on all four representative scenarios
- no dependence on ad-hoc lucky outputs

## Definition Of Done

Track B is done only when:

- the fixed scenario set passes
- the results are visually strong on first pass or converge in a small number of retries
- outputs no longer feel like clone restyling
- quality is enforced by critic logic rather than by manual inspection

## Operational Rule

From now on:

- do not judge the final system by partial patch improvements
- do not stop at the current architecture ceiling
- do not accept lower quality to preserve current structure

Track B is the main route to the required product quality.
