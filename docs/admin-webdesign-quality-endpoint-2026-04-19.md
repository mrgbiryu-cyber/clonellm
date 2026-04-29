# Web-Design Quality Endpoint

Date: 2026-04-19
Owner: Codex / mrgbiryu alignment draft
Status: Active end-state definition

Strategic quality decision:

- [admin-claude-quality-gap-and-rebuild-decision-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-claude-quality-gap-and-rebuild-decision-2026-04-19.md)
- [admin-track-b-webdesign-quality-rebuild-plan-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-track-b-webdesign-quality-rebuild-plan-2026-04-19.md)

## Purpose

This document fixes the end-point for the design-builder program.

From this point, the question is not:

- did one build look slightly better?

The question is:

- has the system reached a state where strong redesign requests can reliably produce web-design-grade results?

This document exists to stop premature quality judgment on partial architecture.

Quality should be judged after the required execution layers are completed, not after each local patch improvement.

## Final Endpoint

The builder can be treated as "web-design quality reached" only when all of the following are true.

### 1. Whole-Screen First-Pass Generation Is Mandatory

Strong/full redesign generation must begin from whole-screen context, not only local slot context.

Required first-pass input bundle:

- original full-page clone screenshot
- target-region overlay screenshot
- target-region focus crop
- structured reference screenshots
- starter/search/generated asset context

This must be true for both:

- planner/composer intent
- builder/detailer execution

Acceptance condition:

- the builder always receives full-page context assets for strong/full redesign
- target region is visually highlighted before generation
- the target component or group is also given as a focused crop

### 2. Reference And Asset Sufficiency Gate Runs Before Generation

The system must decide whether current visual inputs are sufficient before composing the redesign.

It should not jump directly into generation with weak reference support.

Required decision order:

1. starter assets
2. search-backed assets
3. generation-backed assets

The builder must know whether:

- current reference anchors are sufficient
- current asset plan is visually weak
- a generated visual is required for hero/banner/high-impact slots

Acceptance condition:

- missing or weak reference/asset states are detected before final generation
- hero/banner/icon-family redesign can be escalated into asset-assisted or generation-backed mode
- local redesign does not proceed blind when the main visual is missing

### 3. Quality-Primary Gate Replaces Delta-Primary Gate

The current system cannot treat visual delta as the main pass/fail signal.

Final pass/fail must be quality-first.

Required gate logic:

- critic available is required
- retry=no is required
- minimum visual scores by depth are required
- delta is only a secondary guard

Required dimensions:

- hierarchy
- alignment
- referenceAlignment
- brandFit
- changeStrength

Acceptance condition:

- a design does not pass only because it moved enough pixels
- a design is not rejected only because one block did not move position if overall quality is strong
- medium/strong/full each have explicit score floors and retry rules

### 4. Component-Scoped Replacement Becomes The Default Execution Surface

For supported families, redesign should default to full component replacement, not DOM-local patching.

This applies even when the requested change feels "element-level", because local CSS-only edits frequently create visual mismatch against the cloned source structure.

Execution rule:

- supported family -> regenerate component HTML + self-contained style
- unsupported family -> fallback patch path

Desired result:

- one component uses one coherent visual surface
- CSS is not partially applied across unrelated original DOM leftovers
- redesign feels intentional instead of patched-on

Acceptance condition:

- `hero`, `quickmenu`, `ranking`, `commerce`, `banner` families are replacement-first
- visual changes for those families are rendered through component-scoped HTML + style
- patch path is treated as fallback, not default

### 5. Concrete Style Contract Must Drive Runtime

The system must stop depending on descriptive style language alone.

Style contract must become execution-grade.

Required preset families:

- title scale
- line-height
- letter-spacing
- font family
- spacing rhythm
- contrast mode
- card density
- icon shell
- image treatment
- motion preset

Acceptance condition:

- composer/detailer outputs can be read as real runtime presets
- renderer consumes those presets directly
- the same request no longer produces weakly different typography each run

### 6. Strong Renderer Coverage Must Exist Beyond Hero

The system must not only support hero-level redesign.

It must support:

- component redesign families
- section-group redesign
- page-level redesign shell and rhythm

At minimum:

- `home`
- `homestyle-home`
- `care-solutions`

must reach dedicated group/page renderer coverage for their high-impact areas.

Acceptance condition:

- strong/full redesign no longer collapses back into weak component-only changes
- section-group requests visibly change rhythm, spacing, and grouping
- page requests visibly change shell and sequencing

### 7. Critic Must Route Recovery, Not Only Report Failure

When quality is weak, the system must choose the right recovery path:

- composition recovery
- asset-assisted recovery
- generation-backed recovery

Critic output must determine which path is chosen.

Acceptance condition:

- hierarchy failure can trigger stronger template / layout mode
- weak visual asset fit can trigger asset recovery
- hero/banner visual weakness can trigger generation-backed recovery

### 8. Execution Failure And Quality Failure Must Be Separated

The system must not mix runtime/tooling failure with design-quality failure.

These are execution failures:

- critic unavailable
- malformed JSON
- screenshot capture failure
- external model timeout / reset
- empty model response

These are quality failures:

- hierarchy too weak
- alignment too weak
- reference alignment too weak
- change strength too weak
- asset fit too weak

Acceptance condition:

- execution failures are recorded as execution failures
- quality failures are recorded as quality failures
- release judgment uses only quality failures, not infra noise

### 9. Full-Page And Focused-Area Critic Must Both Pass

The system must judge redesign quality on two planes.

1. full-page reading
2. target-area reading

The output should not pass if:

- the target area is still weak even though the whole page looks changed
- or the target area looks strong but the whole page rhythm collapses

Acceptance condition:

- critic stores and evaluates both full-page and focus-area judgment
- recovery routing can distinguish page-rhythm failure from local component failure

### 10. Depth Contracts Must Be Explicit

`medium`, `strong`, and `full` must not share the same implied quality logic.

Each depth needs its own contract for:

- expected structural movement
- minimum visual scores
- allowed recovery escalation
- allowed asset escalation

Acceptance condition:

- medium is not judged by full-depth expectations
- medium still cannot pass while visibly poor
- strong/full are required to look like clear redesign proposals

### 11. Supported Replacement Families Must Be Explicitly Enumerated

The system must clearly define which families are replacement-first.

This inventory must drive execution policy.

Acceptance condition:

- supported families are listed explicitly
- supported families default to component-scoped regeneration
- unsupported families are visibly treated as fallback patch paths

### 12. Asset Sufficiency Must Include Family Consistency

Asset sufficiency is not only about whether an image exists.

The system must also judge whether the asset family is visually coherent.

Required consistency checks:

- icon stroke / weight
- radius language
- contrast level
- crop / framing
- tone consistency

Acceptance condition:

- quickmenu icons, badges, thumbnails, and hero visuals are evaluated as families, not only one by one
- asset-assisted recovery can reject mismatched sets before runtime use

### 13. Final Quality Must Be Judged On A Fixed Representative Scenario Set

Final quality cannot be judged on arbitrary one-off builds.

The system must use a fixed evaluation set.

Minimum representative set:

- `home` hero + quickmenu
- `home` page full
- `homestyle-home`
- `care-solutions`

Acceptance condition:

- all major endpoint checks can be run against this fixed set
- release judgment is based on repeatable scenarios, not ad-hoc success

## What Should Not Be Used As Final Judgment Yet

The following are not enough to declare the system good or bad:

- one medium-depth pass
- one local component build
- one patch-looking draft
- one delta score
- one successful critic loop

These are implementation checks only.

Final quality judgment must happen only after the endpoint conditions above are implemented together.

## Current Position Against Endpoint

### Already In Place

- whole-page context injection exists
- reference anchor pipeline exists
- starter asset pipeline exists
- generation-backed hero path exists
- visual critic exists
- component replacement path exists

### Still Not Closed

- reference/asset sufficiency gate before generation
- quality-primary pass/fail
- replacement-first execution as the default for supported families
- concrete style contract runtime
- strong group/page renderer coverage
- critic-driven recovery routing strong enough to converge
- execution failure and quality failure separation
- full-page and focused-area dual quality judgment
- fixed representative scenario-set pass

## Work Order From This Point

The remaining work should be closed in this order.

1. `quality-primary gate`
2. `reference/asset sufficiency gate`
3. `replacement-first execution default`
4. `concrete style contract runtime`
5. `group/page renderer completion`
6. `critic recovery router`
7. `execution-fail vs quality-fail separation`
8. `full-page + focus dual critic gate`
9. `fixed representative scenario-set validation`

## Operational Rule

From this point:

- do not treat mid-build visual reactions as final judgment
- do not stop because one partial build still looks weak
- use the endpoint above as the real completion contract

This means the next quality review should happen after the execution layers listed above are closed, not before.
