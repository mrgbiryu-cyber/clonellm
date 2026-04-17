# Admin Builder Visual Architecture

Date: 2026-04-17
Owner: Codex / mrgbiryu alignment draft
Status: Draft for implementation

## 1. Goal

The system must reach a level where AI-generated preview output is visually credible enough to be reviewed as a real customer-facing design proposal.

Current builder output is executable, but not yet consistently strong enough to support public launch quality.

This document defines the architecture changes required to move from a `patch-first preview builder` to a `design-visible builder system`.

## 2. Core Problem

The current system is good at:

- translating requirements into a planner document
- generating safe slot-level patch operations
- rendering partial preview output inside the existing clone structure

The current system is weak at:

- component-level redesign that feels intentional
- section-group or page-level redesign with real visual authority
- preserving design quality when the requested change is stronger than the patch surface
- separating explanation metadata from final visual output
- automatically judging whether the rendered result is visually acceptable

The result is a recurring failure pattern:

- the builder produces technically valid output
- the output is partially changed
- the output is not visually strong enough to use as a true design proposal

## 3. Working Diagnosis

The main issue is not only model quality.

The deeper issue is architecture.

Current builder behavior is constrained by:

- patch-schema-limited execution
- weak structure replacement capability
- limited styling surface
- weak asset binding
- no screenshot-based critic loop

This means the builder often has the right direction but not enough expressive power to turn that direction into a usable visual result.

## 4. Target Principle

The builder must no longer be treated as a single LLM that writes patches.

The system should be treated as five coordinated layers:

1. Intent Layer
2. Design System Layer
3. Execution Layer
4. Renderer Layer
5. Visual Critic Layer

The correct mental model is:

`Planner -> Builder -> Renderer -> Visual Critic -> Human Review`

## 5. Required Architecture

### 5.1 Intent Layer

The planner output must become a true visual contract, not only a requirement document.

Required additions to planner output:

- `visualGoals`
- `negativeConstraints`
- `interactionTone`
- `layoutPriority`
- `tokenHints`
- `assetIntent`
- `successRubric`

Purpose:

- describe what successful visual change should feel like
- describe what must not happen
- express design intent in execution-ready form before builder starts

Planner responsibility:

- define why the page should change
- define what visual outcome should be approved
- define allowed scope and allowed depth

Planner non-responsibility:

- no patch generation
- no renderer selection
- no version save logic

### 5.2 Design System Layer

The builder must not rely on free-form design intuition alone.

It needs a stronger system context than the current design markdown and starter asset shelf.

Required system inputs:

- page-family tokens
- component-family recipes
- spacing scale
- typography scale
- color roles
- icon rules
- hover/focus rules
- motion rules
- asset registry
- forbidden-pattern registry

Purpose:

- constrain the builder into a strong design language
- prevent random output drift
- make redesign results feel authored instead of improvised

### 5.3 Execution Layer

The builder must be split into execution modes.

Current effective mode:

- `Patch Executor`

Required target modes:

- `Patch Executor`
- `Composition Executor`
- `Style Executor`

Expected builder output should no longer stop at `operations`.

Required builder output schema:

- `operations`
- `compositionTree`
- `styleContract`
- `interactionSpec`
- `assetBindings`
- `report`

Purpose:

- patch what is safe
- define structural composition where patch alone is weak
- define styling and interaction separately from structural operations

### 5.4 Renderer Layer

The renderer must become a first-class architecture concern.

Current renderer strength:

- partial patch rendering
- limited component composition preview

Required renderer set:

- component composition renderer
- section-group composition renderer
- page composition renderer
- component-scoped style injection
- interaction renderer

Hard rule:

- explanation metadata must never appear in clone/design view
- explanation metadata may appear only in admin explanation panels

Visual result must contain:

- only customer-facing visual output
- only content, styles, motion, and layout intended for the preview

### 5.5 Visual Critic Layer

This is a mandatory addition.

Without screenshot-based critique, the system will continue producing technically valid but visually weak output.

Required loop:

1. render before
2. render after
3. capture screenshot
4. run structured visual critic
5. refine 1 to 3 times
6. store critic result in build report

Critic dimensions:

- hierarchy clarity
- alignment quality
- spacing rhythm
- component balance
- text/image balance
- asset fit
- visual noise
- interaction plausibility
- brand fit
- scope fidelity

Purpose:

- judge the actual rendered result
- avoid relying only on operation success
- create a real quality gate before review

## 6. Concrete System Changes

### 6.1 LLM Layer

Files:

- `llm.js`

Required changes:

- expand planner output schema to include visual contract fields
- expand builder output schema beyond operations
- separate explanation metadata from visual rendering payload
- treat `compositionTree`, `styleContract`, and `interactionSpec` as primary build artifacts

### 6.2 Server Layer

Files:

- `server.js`

Required changes:

- resolve builder mode from intervention layer + patch depth
- validate composition payloads
- validate style contracts
- validate asset bindings
- store critic results with draft builds
- enforce explanation/output separation at runtime

### 6.3 Runtime Renderer Layer

Files:

- `server.js` runtime render path
- future renderer modules if split

Required changes:

- render component rebuilds from structured composition data
- render section-group rebuilds from structured group composition data
- render page rebuilds from structured page composition data
- support scoped style execution without leaking to unrelated sections
- support interaction rules for hover/focus/active states

### 6.4 Admin Layer

Files:

- `web/admin-research.html`

Required changes:

- show builder explanation separately from design result
- show critic result separately from design result
- show asset gaps as explicit blockers
- never inject builder explanation strings into clone/design preview

### 6.5 Asset Layer

Files:

- normalized asset pipeline documents and registries

Required changes:

- expand starter assets into production-grade asset sets
- define asset families by page type and component family
- support icon, badge, hero visual, thumbnail, and motion asset binding
- prevent fallback drift when required assets are missing

## 7. Delivery Tracks

### Track A: Planner Contract Upgrade

Deliverables:

- planner visual contract schema
- updated requirement plan storage
- updated builder input payload

### Track B: Builder Execution Upgrade

Deliverables:

- patch executor refinement
- composition executor
- style executor
- interaction spec support

### Track C: Renderer Upgrade

Deliverables:

- component renderer coverage
- section-group renderer coverage
- page renderer coverage

### Track D: Asset Pipeline Upgrade

Deliverables:

- icon registry
- badge registry
- hero visual registry
- thumbnail registry
- asset binding rules

### Track E: Visual Critic Upgrade

Deliverables:

- screenshot capture pipeline
- critic prompt and scoring schema
- iterative refinement loop
- quality gate report

## 8. Release Gate

Public launch should remain blocked until all of the following are true:

- component redesign renders are visually credible in runtime preview
- section-group redesign renders are visually credible in runtime preview
- page redesign renders are visually credible in runtime preview
- explanation metadata is fully separated from design output
- before/after comparison is trustworthy
- critic scores are recorded for every strong/full redesign build
- required assets are either bound or reported as blockers
- design output passes human review without requiring repeated manual cleanup for basic layout issues

## 9. Immediate Implementation Order

Recommended order:

1. expand builder output schema
2. add style execution surface
3. complete component composition renderer
4. add section-group composition renderer
5. add page composition renderer
6. strengthen asset pipeline
7. add screenshot-based critic loop
8. add release gate

## 10. Definition of Success

This architecture is successful only when:

- the builder output is not merely changed, but visually convincing
- redesign output can be reviewed as a real design proposal
- the system can explain why a result is blocked instead of showing weak fallback output
- the preview can be trusted as a launch-facing review artifact

Until then, the system should be treated as an internal drafting tool, not a launch-ready design builder.
