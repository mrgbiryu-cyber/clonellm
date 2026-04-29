# Admin Quality Recovery And Generation Routing

Date: 2026-04-19
Owner: Codex / mrgbiryu alignment draft
Status: Active quality recovery strategy

Related endpoint definition:

- [admin-webdesign-quality-endpoint-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-webdesign-quality-endpoint-2026-04-19.md)

## 1. Purpose

This document defines how the builder should respond when redesign quality is still too weak.

The main question is no longer:

- "Did the pipeline run?"

The real question is:

- "When quality is weak, should the system retry as a stronger composition build, an asset-assisted redesign build, or a generation-heavy visual rebuild?"

This document also records a critical diagnosis:

- current weak output is not only a patch-surface problem
- it is also caused by the builder often generating from local slot context without enough whole-screen visual judgment

## 2. Current Diagnosis

The current system can:

- take requirement scope and depth correctly
- store and load approved plans
- run `planner -> composer -> detailer -> critic -> fix`
- attach reference screenshots
- attach starter asset bundles
- block weak output with the visual quality gate

But current weak results still happen because of two overlapping causes.

### 2.1 Local-first generation bias

The system still tends to generate from:

- selected slot scope
- component-level patch surface
- local structural intent

before it truly reasons about:

- top-level visual hierarchy of the full screen
- whole-page rhythm
- relationship between hero, quickmenu, banner, and following sections
- whether the result reads as a new design instead of a modified clone

This means:

- local slot generation can be technically correct
- but the full screen can still feel visually unchanged

### 2.2 Weak recovery routing after quality failure

Current quality failure often ends at:

- critic detects weak hierarchy / weak change strength
- fix pass retries
- result remains too close to the original

The missing step is routing.

The system still does not make a strong enough decision between:

- continue with stronger composition
- re-enter with stronger asset support
- escalate to generation-backed redesign

## 3. Core Principle

Quality recovery must be routed by failure type.

The system should not always solve quality failure the same way.

When output is weak, the next step must be selected based on:

- why it failed
- what kind of asset gap exists
- whether local patching is enough
- whether whole-screen hierarchy is missing

## 4. Failure Types

### 4.1 Local Structure Failure

Symptoms:

- `hierarchy=0`
- `alignment` weak
- visual delta exists but the screen still reads like the original
- component variants exist but whole composition still feels flat

Interpretation:

- the system is still seeing the page too locally
- stronger composition routing is required

Preferred recovery:

- escalate to stronger component/group/page composition
- prefer template replacement over patch cleanup
- run whole-screen critic again

### 4.2 Asset Weakness Failure

Symptoms:

- structure changed, but visual impression is still weak
- hero / banner / quickmenu icons feel placeholder-grade
- visual critic says `referenceAlignment` or `brandFit` is weak

Interpretation:

- structure alone is not enough
- existing asset pool is too shallow

Preferred recovery:

- resolve stronger starter assets first
- then search-backed assets
- then generation-backed assets for high-impact slots

### 4.3 Generation Strength Failure

Symptoms:

- output remains conservative even after template replacement
- `changeStrength` remains low
- patch count increases but visual impact remains weak

Interpretation:

- first-pass generation is still too safe

Preferred recovery:

- stronger first-pass template selection
- stronger style contract
- wider variant exploration
- when needed, generation-backed visual rebuild for hero/banner/icon families

## 5. Routing Decision

When the quality gate fails, the system should decide recovery mode by using the following rule.

### 5.1 Stay in Composition Recovery

Use this when:

- the result lacks hierarchy or rhythm
- structure is still too close to the original
- assets are not the main blocker

Recovery mode:

- stronger component composition
- section-group composition
- page composition

### 5.2 Escalate to Asset-Assisted Recovery

Use this when:

- structure is acceptable
- but visual intensity is weak
- existing hero/banner/icon imagery is too generic

Recovery mode:

- starter assets first
- search assets second
- generation assets only where impact is high

### 5.3 Escalate to Generation-Backed Recovery

Use this when:

- hero visual
- campaign banner visual
- quickmenu icon family
- badge/chip graphic language

must visibly change, and existing assets cannot produce that change.

Recovery mode:

- image generation API or model-backed asset creation
- generated output saved into the asset registry
- geometry and critic checks applied before runtime use

## 6. Whole-Screen Review Requirement

From this point forward, first-pass generation must not be treated as only slot-level execution.

Before finalizing a strong/full redesign build, the system must review:

- full-screen composition screenshot
- hero-to-quickmenu relationship
- top section shell rhythm
- whether the page still reads as the same brand/page identity
- whether the result is actually a redesign, not local restyling

This means:

- local slot generation remains useful
- but strong/full redesign must be judged and corrected at full-screen level

## 6.1 Whole-Page Context Injection

Strong/full redesign generation must begin with whole-page context, not only local slot context.

The system already has the clone original.
That should be treated as the primary visual baseline for generation and review.

Required context bundle:

- full-page screenshot of the clone original
- target-region highlight or overlay inside that full-page view
- optional focused crop of the target region
- reference screenshot anchors

Purpose:

- let the model understand the whole page hierarchy before generating
- let the model see where the current intervention area sits inside the original page rhythm
- prevent local redesign from ignoring global page balance

This means strong/full redesign should no longer start from:

- selected slot patch surface only

It should start from:

- original whole-page visual context
- current intervention region inside that whole page

## 6.2 Target Region Overlay

The current intervention region must be passed as a visible overlay, mask, or bbox-like highlight on the original page screenshot.

Required outcome:

- the model should not only know which slot ids are selected
- it should visually see where those regions live on the screen

Why:

- slot ids and component lists are not enough to preserve hierarchy
- visual placement relative to hero, quickmenu, header, and surrounding sections changes design decisions

Examples:

- if `hero + quickmenu` is selected, the model should see them as the whole top-stage cluster
- if a lower banner is selected, the model should see how much contrast it needs relative to the already-dense upper page

## 6.3 Full-Page + Focused-Crop Critic

Quality review should continue to use local crop checks, but they are not sufficient alone.

The visual critic should compare:

- full-page before
- full-page after
- focused target-region crop
- reference screenshot

This prevents a false pass where:

- the target component changed locally
- but the page still reads almost the same at full-screen level

It also prevents the opposite failure where:

- the local crop looks interesting
- but the overall page hierarchy is broken

## 7. Remaining Schedule Impact

This diagnosis changes the remaining schedule in one important way.

The project should no longer treat quality recovery as only:

- more fix loops

It must now include:

1. stronger first-pass generation
2. whole-screen review before final acceptance
3. routing between composition recovery and asset/generation recovery
4. generation-backed asset escalation for high-impact slots

## 8. Required Implementation Additions

### 8.1 Recovery Router

Required outcome:

- a dedicated decision step after visual critic
- routes failure into:
  - composition recovery
  - asset-assisted recovery
  - generation-backed recovery

Primary code paths:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - `handleLlmVisualCritic()`
  - `handleLlmFix()`
- [server.js](/home/mrgbiryu/clonellm/server.js)
  - `runVisualCriticForDraft()`
  - `/api/llm/build` recovery branch

### 8.2 Whole-Screen Composition Review

Required outcome:

- strong/full builds use whole-screen comparison, not only local component success
- strong/full builds receive whole-page original context before generation, not only after generation

Primary code paths:

- [server.js](/home/mrgbiryu/clonellm/server.js)
  - draft preview capture / screenshot pipeline
  - original clone full-page capture pipeline
  - target region highlight / overlay capture pipeline
  - visual critic request assembly
- [llm.js](/home/mrgbiryu/clonellm/llm.js)
  - composer prompt / payload
  - detailer prompt / payload
  - visual critic prompt / findings schema

### 8.3 Generation-Backed Asset Escalation

Required outcome:

- when asset shortage is the blocker, the system can escalate to image generation instead of endlessly re-patching structure

Primary code paths:

- future asset orchestration path in:
  - [server.js](/home/mrgbiryu/clonellm/server.js)
  - [llm.js](/home/mrgbiryu/clonellm/llm.js)

Related docs:

- [admin-asset-pipeline-architecture-options-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-asset-pipeline-architecture-options-2026-04-19.md)

## 9. Final Rule

If quality is weak:

- do not only ask the same patch-style fix loop to try harder
- first decide whether the failure is:
  - structure
  - asset depth
  - generation strength
- then route the system into the correct recovery path

This is required if the builder is expected to reach true web-design-grade output quality.
