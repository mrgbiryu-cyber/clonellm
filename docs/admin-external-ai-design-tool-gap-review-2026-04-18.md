# External AI Design Tool Gap Review

Date: 2026-04-18

## Purpose

This document compares the current clonellm design-builder architecture against external AI design/code-generation tools and recent public research patterns, to identify why those tools often produce stronger visual results and what gaps remain in our system.

This is not a product marketing comparison.
It is a practical architecture gap review for the current `planner -> builder -> renderer -> critic` roadmap.

## Executive Summary

The current clonellm direction is broadly correct.
The system already has:

- reference anchoring
- composer -> detailer separation
- structural critic
- visual critic
- hard visual delta gate
- family-based component renderer variants

However, the system is still closer to a `clone-first + patch-first redesign engine` than to a `native visual composition system`.

The strongest external tools appear better not because their base LLM is magically better, but because they usually provide:

- richer visual context before generation
- direct connection to a design system or component library
- stronger structural replacement authority
- faster visual editing loops
- more native composition surfaces instead of patch-heavy execution

## External Patterns Observed

### 1. Figma Make

Relevant source:

- https://www.figma.com/solutions/ai-business-website-builder/

Observed pattern:

- Figma Make now emphasizes `Make kits` and `Make attachments`
- prototypes start from `real components, data, and constraints`

Implication:

- generation starts inside a richer design context than plain text
- AI is not reasoning from a generic blank canvas
- it is grounded in real components and real design inputs from the start

Gap vs clonellm:

- clonellm recently added screenshot/reference anchoring
- but the current build flow still relies heavily on textual summary + runtime patch surfaces
- design context is improving, but still weaker than native file/component-aware systems

### 2. Builder.io Visual Copilot

Relevant sources:

- https://www.builder.io/blog/visual-copilot
- https://site.builder.io/c/docs/figma-to-code-visual-editor

Observed pattern:

- explicit `Component Mapping`
- Figma components are mapped onto existing code components
- post-generation editing and prompting continue inside the generated result

Implication:

- the AI is not only generating raw code
- it is aligning generated structure to a known component system
- this produces more reusable and consistent output

Gap vs clonellm:

- clonellm has `component family` and `templateId`
- but execution is still partially patch-dominant
- `replace_component_template` exists, yet our runtime still does not behave like a full component-mapping system across the whole page family set

### 3. Relume Style Guide Builder

Relevant source:

- https://www.relume.io/style-guide

Observed pattern:

- style guide generation is treated as a first-class step
- the system builds on-brand concepts before implementation
- it centralizes style decisions rather than improvising them per screen

Implication:

- many visual decisions are solved upstream
- the build step inherits a stronger visual contract

Gap vs clonellm:

- clonellm has design reference seeds, token sets, and asset starter bundles
- but we do not yet have a truly strong `style-guide-first` execution contract
- too many visual decisions are still being made at generation time

### 4. v0 Design Mode

Relevant source:

- https://community.vercel.com/t/introducing-design-mode-on-v0/13225

Observed pattern:

- direct visual editing mode after generation
- quick edits to copy, typography, layout, colors, styling, and more
- marketed as no-wait, no-credit editing inside a Tailwind/shadcn-native stack

Implication:

- the refinement loop is not only LLM-based
- direct visual edits reduce the need for full regeneration

Gap vs clonellm:

- clonellm does not have an equivalent persistent visual design-edit layer
- we rely on re-running planner/builder/fix loops
- therefore refinement cost is higher and iteration feels slower

### 5. Open-source screenshot-to-code systems

Relevant sources:

- https://github.com/abi/screenshot-to-code
- https://github.com/leigest519/ScreenCoder

Observed pattern:

- screenshot-to-code pipelines start from visual input, not from DOM mutation
- ScreenCoder explicitly separates:
  - block detection
  - UI element detection
  - mapping
  - image replacement
- screenshot-to-code also experiments with video/screen-recording based capture

Implication:

- successful systems often decompose the problem
- they use segmentation, mapping, and visual alignment rather than one single monolithic text-to-code jump

Gap vs clonellm:

- clonellm still begins from an existing clone runtime and then mutates it
- this is safer for continuity, but weaker for bold redesign
- our composer/detailer split is a good start, but we still need stronger structural execution

### 6. Recent research patterns

Relevant sources:

- https://arxiv.org/abs/2602.05998
- https://arxiv.org/abs/2406.16386

Observed pattern:

- quality improves when systems compare rendered output against target visuals
- quality also improves when systems focus on smaller visual segments
- divide-and-conquer and visual self-refinement outperform naive one-shot generation

Implication:

- our move toward visual critic and family-level rendering is directionally correct
- but the refinement loop must be able to make stronger structural corrections, not only surface patches

## What These Tools Have That We Still Lack

### 1. Native composition surface

External tools usually work on:

- a real design canvas
- a Figma file
- a component-mapped code surface
- or a screenshot-derived composition surface

Current clonellm limitation:

- still strongly anchored to clone HTML and patch execution
- composition exists, but not everywhere as the primary execution mode

### 2. Stronger structural replacement authority

External tools often:

- regenerate full sections
- remap to code components
- rebuild from screenshot regions

Current clonellm limitation:

- structural redesign is still partially constrained by the patch system
- `replace_component_template` exists, but broader group/page composition is not yet equally strong

### 3. Better style-system grounding

External tools often start from:

- style guides
- design systems
- mapped components
- visual kits

Current clonellm limitation:

- token sets and assets exist
- but they do not yet function as a sufficiently strong pre-generation design contract

### 4. Faster visual refinement loop

External tools can often:

- visually edit directly
- keep the output stable while tweaking specific parts

Current clonellm limitation:

- refinement is mainly through builder/fix pass reruns
- critic can identify failure
- but the correction surface is still not strong enough

## Current clonellm Strengths

The current system already has several things many simpler tools do not:

- clone continuity
- page identity constraints
- editable scope governance
- asset registry
- structural critic plus visual critic
- hard visual delta gate
- family-based renderer strategy

This means the project is not conceptually behind.
The main issue is execution strength, not architecture direction.

## Main Practical Gap

The most important gap is this:

`We can now detect weak redesign, but we still cannot consistently force a stronger redesign into the runtime result.`

This is why current output can still feel too close to the original even when the pipeline technically succeeds.

## Priority Gaps To Close

### Gap 1. Component mapping behavior must become real runtime behavior

Needed:

- stronger `replace_component_template` usage
- more family-specific template variants
- clearer mapping between design intent and runtime family/template choice

Affected code areas:

- `/home/mrgbiryu/clonellm/llm.js`
- `/home/mrgbiryu/clonellm/server.js`

### Gap 2. Group/page composition must become true renderer execution

Needed:

- not only body-shell classes
- full group/page composition renderers with their own structure and style contracts

Affected code areas:

- `/home/mrgbiryu/clonellm/server.js`

### Gap 3. Style system must be stronger before generation

Needed:

- more explicit family style bundles
- clearer style-guide-first constraints
- stronger allowed-token and asset bundle contracts

Affected code/data:

- `/home/mrgbiryu/clonellm/llm.js`
- `/home/mrgbiryu/clonellm/server.js`
- `/home/mrgbiryu/clonellm/data/normalized/asset-pipeline-starter.json`
- `/home/mrgbiryu/clonellm/data/normalized/design-reference-source-seeds.json`

### Gap 4. Visual critic findings must produce stronger redesign corrections

Needed:

- critic findings must map to structural corrective actions
- not just patch-level refinement
- for example:
  - hierarchy failure -> stronger layout re-tiering
  - alignment failure -> rhythm/template adjustment
  - reference misalignment -> explicit template or asset change

Affected code areas:

- `/home/mrgbiryu/clonellm/llm.js`
- `/home/mrgbiryu/clonellm/server.js`

## Recommended Interpretation

External tools should not be treated as proof that clonellm needs a completely different architecture.

Instead, they show that:

- composition must become more native
- reference context must become more direct
- style guides must become more binding
- structural replacement must become easier than patching
- refinement must operate on visual structure, not only on token values

## Final Assessment

The current clonellm architecture is not fundamentally wrong.
It is already moving toward the same general shape as the strongest external AI design tools:

- more context
- more composition
- more visual comparison
- more structured refinement

But it still under-delivers in one critical way:

`the system can diagnose weak visual redesign more reliably than it can enforce strong redesign output`

That gap is now the main blocker between:

- a technically impressive AI-assisted clone editor
- and a genuinely strong AI web-design system

## Follow-up

This document should be read together with:

- `/home/mrgbiryu/clonellm/docs/admin-builder-visual-architecture-2026-04-17.md`
- `/home/mrgbiryu/clonellm/docs/admin-design-hardening-code-status-2026-04-18.md`
- `/home/mrgbiryu/clonellm/docs/admin-reference-source-policy-2026-04-17.md`
