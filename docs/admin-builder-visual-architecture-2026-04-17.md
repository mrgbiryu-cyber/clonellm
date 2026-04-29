# Admin Builder Visual Architecture

Date: 2026-04-17
Owner: Codex / mrgbiryu alignment draft
Status: Draft for implementation

Related status:

- [admin-design-hardening-code-status-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-design-hardening-code-status-2026-04-18.md)
- [admin-webdesign-quality-endpoint-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-webdesign-quality-endpoint-2026-04-19.md)
- [admin-claude-quality-gap-and-rebuild-decision-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-claude-quality-gap-and-rebuild-decision-2026-04-19.md)
- [admin-track-b-webdesign-quality-rebuild-plan-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-track-b-webdesign-quality-rebuild-plan-2026-04-19.md)

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

Related reference ingestion policy:

- `docs/admin-reference-source-policy-2026-04-17.md`
- `docs/admin-asset-pipeline-architecture-options-2026-04-19.md`
- `docs/admin-quality-recovery-and-generation-routing-2026-04-19.md`

Implementation note:

- external reference sources should be integrated as backend builder/planner/critic context during architecture rollout
- they should not be introduced as a separate end-user input UI track

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
- `referenceScreenshotAnchors`

Purpose:

- describe what successful visual change should feel like
- describe what must not happen
- express design intent in execution-ready form before builder starts
- anchor planning to actual visual references instead of text-only interpretation
- anchor strong/full redesign to whole-page hierarchy, not only local selected-slot context

Required reference behavior:

- when a reference URL is provided, capture a rendered screenshot
- attach that screenshot to planner and builder context as a visual anchor
- use text summaries as secondary support, not as the primary visual source
- capture the clone original as full-page visual context for strong/full redesign generation
- attach the current intervention region as a highlighted overlay or focused crop inside that whole-page context

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
- allowed token sets for generation

Purpose:

- constrain the builder into a strong design language
- prevent random output drift
- make redesign results feel authored instead of improvised

Required generation rule:

- token validation must not rely only on post-generation sanitize
- the builder should receive allowed token values directly in prompt/system context
- title sizes, color roles, surface values, spacing scales, and icon sizes should be constrained at generation time whenever possible

### 5.3 Execution Layer

The builder must be split both into execution modes and into generation passes.

Current effective mode:

- `Patch Executor`

Required target modes:

- `Patch Executor`
- `Composition Executor`
- `Style Executor`

Required target passes:

- `Composer Pass`
- `Detailer Pass`
- `Fix Pass`

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

Pass responsibilities:

- `Composer Pass`
  defines structure, hierarchy, grouping, and composition direction
- `Detailer Pass`
  defines token values, style contracts, and executable operations
- `Fix Pass`
  responds to critic feedback with narrow targeted corrections instead of full regeneration

Execution rule:

- do not ask one LLM call to decide composition, detailed styling, and corrective refinement at the same time
- the system should treat these as separate steps so each step can be inspected, corrected, and improved independently

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

This layer should be defined as a `Multimodal Comparison Critic`, not only a text rubric scorer.

Required loop:

1. render before
2. render after
3. capture before screenshot
4. capture after screenshot
5. capture reference screenshot when a reference exists
6. run multimodal comparison critic
7. trigger targeted refinement
8. store critic result in build report

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

Required critic inputs:

- before screenshot
- after screenshot
- reference screenshot when available
- approved plan summary
- design direction
- execution mode
- changed targets

Required critic outputs:

- comparative findings
- dimension-level failures
- fix targets
- targeted retry instructions
- retry priority

Required critic behavior:

- the critic must not only score quality
- the critic must explain what is visually wrong and what should be corrected
- the critic should produce targeted retry triggers, not only passive quality reporting

Purpose:

- judge the actual rendered result
- avoid relying only on operation success
- create a real quality gate before review
- accelerate convergence through visual comparison instead of vague textual scoring

## 5.6 Replacement Policy

The current clone system starts from a captured reference implementation and then applies modifications through editable structure and runtime rendering.

This base approach should remain.

The correct architecture is not:

- always rebuild the whole page
- always patch the whole page with CSS

The correct architecture is a hybrid replacement policy based on intervention layer.

### Base Rule

Keep the captured clone as the default base.

Then decide whether the requested change should be handled by:

- patching inside the current structure
- replacing a component-level slot
- replacing a section-group container
- replacing a page shell

### Replacement by Layer

#### Element-level changes

Use:

- patch operations
- scoped style execution
- text/image field replacement

Do not replace the whole component.

This is the correct mode when the structure remains valid and only the internal surface changes.

#### Component-level redesign

Use:

- component renderer replacement for that slot

Do not try to force component-level redesign through CSS-only overlays when the internal structure is changing.

If the request changes:

- icon/text arrangement
- internal card structure
- nested framing
- hover shell behavior
- image/text balance

then the slot should be replaced by a component composition renderer rather than patched through the old DOM only.

#### Section-group redesign

Use:

- group container replacement

Do not replace each component independently when the intended outcome depends on shared rhythm across multiple components.

If the request changes:

- upper / middle / lower zone rhythm
- section ordering inside a group
- shared background cadence
- repeated component density
- connected storytelling across several slots

then the system should replace the group-level shell, not only patch individual slots in isolation.

#### Page-level redesign

Use:

- page shell replacement

Do not attempt full-page redesign through distributed CSS patches over the original page DOM.

If the request changes:

- page-level information hierarchy
- page-level section order
- dominant visual narrative
- global rhythm and layout logic

then the system should render a page composition shell rather than keep the original page shell and over-style it.

### Why This Policy Is Required

If structural redesign is forced through CSS-only patching on top of the old clone DOM, the system tends to produce:

- broken alignment
- nested frame clutter
- incorrect image sizing
- weak hover behavior
- inconsistent spacing rhythm
- visually awkward results that look partially edited rather than intentionally redesigned

This is already visible in component cases like quickmenu, where the direction may be right but the remaining original DOM constraints make the final result feel over-layered or structurally confused.

### Runtime Principle

The runtime should follow this rule:

- weak change: preserve structure, patch surface
- component redesign: replace the slot shell
- group redesign: replace the group shell
- page redesign: replace the page shell

This replacement policy is a core requirement for launch-quality design visibility.

## 6. Concrete System Changes

### 6.1 LLM Layer

Files:

- `llm.js`

Required changes:

- expand planner output schema to include visual contract fields
- expand builder output schema beyond operations
- separate explanation metadata from visual rendering payload
- treat `compositionTree`, `styleContract`, and `interactionSpec` as primary build artifacts
- attach reference screenshots as multimodal builder/planner inputs when available
- support `Composer Pass`, `Detailer Pass`, and `Fix Pass`
- inject allowed token sets directly into builder generation context
- replace formula-based identity scoring with critic-model judgment

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
- pass before/after snapshots into critic input
- expose reference screenshots and runtime screenshots as first-class critic assets
- treat critic output as retry trigger, not only as report data

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
- show critic-triggered retry reasons separately from final result
- distinguish passive score from actionable fix recommendation

### 6.5 Asset Layer

Files:

- normalized asset pipeline documents and registries

Required changes:

- expand starter assets into production-grade asset sets
- define asset families by page type and component family
- support icon, badge, hero visual, thumbnail, and motion asset binding
- prevent fallback drift when required assets are missing

### 6.6 Critic Quality Corrections

The following corrections should be treated as immediate architecture-aligned fixes.

#### 6.6.1 Builder temperature scaling

Builder generation temperature should not remain constant across all design change levels.

Required correction:

- lower temperature for conservative refinement
- higher temperature for strong or full exploration

Example direction:

- `low` -> conservative
- `medium` -> balanced
- `high` -> more exploratory

Purpose:

- allow strong/high redesign requests to actually explore stronger design alternatives

#### 6.6.2 before/after snapshot injection into critic

The system already stores `beforePageSnapshot` and `pageSnapshot`.

Required correction:

- pass both snapshots into the critic input
- use them to evaluate actual visual delta, not only operation coverage

Purpose:

- determine whether the result changed enough
- measure change depth against approved intent
- support targeted retry decisions

#### 6.6.3 identityFit formula removal

Identity fit must not remain a hardcoded arithmetic formula derived from overlap counts.

Required correction:

- replace formula-based identity fit with critic-model judgment
- compare approved design direction, page identity, operations, token choices, and rendered result

Purpose:

- make identity scoring reflect actual design quality instead of metadata coincidence

#### 6.6.4 Retry trigger behavior

Critic scores and findings must be operational.

Required correction:

- a low critic result should trigger a retry path
- retry should focus on failed dimensions only
- retry should prefer narrow correction passes over full regeneration

Examples:

- low spacing rhythm -> patch spacing/gap/padding only
- low hierarchy clarity -> refine title size, weight, and copy emphasis only
- low asset fit -> replace or resize bound visual assets only

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
- composer/detailer/fix pass separation
- allowed token set injection

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
- multimodal comparison critic prompt and structured output schema
- iterative refinement loop
- quality gate report
- targeted retry trigger pipeline

## 8. Release Gate

Public launch should remain blocked until all of the following are true:

- component redesign renders are visually credible in runtime preview
- section-group redesign renders are visually credible in runtime preview
- page redesign renders are visually credible in runtime preview
- explanation metadata is fully separated from design output
- before/after comparison is trustworthy
- critic results are recorded for every strong/full redesign build
- critic failures trigger retry instead of passive logging only
- required assets are either bound or reported as blockers
- design output passes human review without requiring repeated manual cleanup for basic layout issues

## 9. Immediate Implementation Order

Recommended order:

1. builder temperature scaling
2. pass before/after snapshots into critic
3. replace formula identity scoring with critic-model judgment
4. strengthen constrained generation with allowed token set injection
5. add reference screenshot anchoring
6. split builder into composer/detailer/fix passes
7. add multimodal comparison critic
8. complete component composition renderer
9. add section-group composition renderer
10. add page composition renderer
11. strengthen asset pipeline
12. add release gate

## 10. Definition of Success

This architecture is successful only when:

- the builder output is not merely changed, but visually convincing
- redesign output can be reviewed as a real design proposal
- the system can explain why a result is blocked instead of showing weak fallback output
- the preview can be trusted as a launch-facing review artifact

Until then, the system should be treated as an internal drafting tool, not a launch-ready design builder.

Implementation tracking:

- [admin-webdesign-quality-execution-plan-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-webdesign-quality-execution-plan-2026-04-18.md)
