# Claude-Quality Gap And Rebuild Decision

Date: 2026-04-19
Owner: Codex / mrgbiryu alignment draft
Status: Strategic decision document

## Purpose

This document records one explicit decision:

- the builder must not stop at the current architecture ceiling
- if the current execution surface cannot reach Claude-level public design quality, the architecture must be rebuilt until it can

This is not a note about incremental improvement only.
It is a decision that quality is the hard requirement, and architecture is negotiable.

## External Comparison Summary

Public Claude-quality examples and official Anthropic guidance show a consistent pattern.

The highest-quality outputs are not produced by:

- weak patching
- local slot-only editing
- shallow variant switching

They are produced by:

- strong whole-layout generation
- richer execution surfaces
- reusable design system or skill layers
- modern component/tooling stacks
- repeated visual refinement with strong references

Relevant sources:

- Anthropic, `Improving frontend design through Skills`
  - https://claude.com/blog/improving-frontend-design-through-skills
- Anthropic, `Create a custom webpage`
  - https://claude.com/resources/use-cases/create-a-custom-webpage
- Anthropic, `Build responsive web layouts`
  - https://claude.com/blog/build-responsive-web-layouts
- Community gallery of Claude artifacts
  - https://madewithclaude.com/
- VoltAgent design-system reference set
  - https://github.com/VoltAgent/awesome-claude-design

## What Those External Examples Imply

The gap is not only "prompt quality".

The gap is structural.

Public Claude-quality outputs typically assume one or more of:

- full HTML/CSS layout generation
- richer component primitives
- stronger design-system guidance
- broader renderer freedom
- asset-aware visual composition
- stronger iteration loops

This means our current builder should not be judged only against:

- whether the wiring exists
- whether critic loops run
- whether patch replacement is partially available

It must be judged against:

- whether it can actually produce design output at that quality level

## Current System Position

The current system already has important foundations:

- planner -> composer -> detailer -> critic -> fix
- whole-page context injection
- structured reference anchors
- starter asset pipeline
- generated asset path
- component template replacement
- visual critic and hard quality blocking

These are necessary.

But they do not yet guarantee Claude-level design output.

The main remaining gap is execution freedom.

Current limitations still include:

- patch-first behavior surviving in too many paths
- supported renderer families still being too shallow
- style contract still not fully execution-grade
- group/page redesign still not fully renderer-native
- quality gate still not fully quality-primary

## Decision

The team should not accept the statement:

- "the current architecture can only go this far"

That is not an allowed endpoint.

The accepted endpoint is:

- the builder must guarantee web-design-grade output quality
- if the current architecture cannot do that, the architecture must be replaced

This means:

- Track A hardening is still valid
- but Track A is not the final commitment
- if Track A reaches a visible ceiling, Track B rebuild becomes mandatory

## Required Strategic Rule

Quality is the invariant.

Architecture is not.

When there is a conflict:

- keep quality
- replace architecture

Not the reverse.

## Implication For Current Roadmap

The current hardening roadmap remains useful because it closes obvious missing execution layers:

- quality-primary gate
- reference / asset sufficiency gate
- replacement-first execution default
- concrete style contract runtime
- group/page renderer completion
- critic recovery router

But this roadmap must now be treated as:

- the final attempt to prove the current architecture can still stretch far enough

If it cannot, the next move is not to accept lower quality.

The next move is to rebuild the execution surface.

## Rebuild Trigger

The system must be considered to have hit the current-architecture ceiling if:

- whole-page context is complete
- quality-primary gate is complete
- supported families are replacement-first
- style contract is execution-grade
- group/page renderer coverage exists for core pages
- critic recovery routing exists

and after all of that:

- core representative scenarios still do not reach web-design-grade output

At that point, further patch-family tuning is not the answer.

At that point, the answer is structural replacement.

## Rebuild Direction

If rebuild is triggered, the preferred direction is:

- primitive-kit or component-kit based composition rendering
- server-side allowlisted JSON tree generation
- component-scoped style/runtime generation
- asset pipeline as a first-class execution layer
- whole-page + focus dual critic as the final gate

This is consistent with the previously discussed `Track B` direction:

- replace patch-first execution with a renderer-native composition system

## Non-Negotiable Outcome

The builder must eventually be able to do all of the following on core pages:

- generate clearly different first-pass redesigns
- preserve page identity while changing structure strongly
- use sufficient references and assets before generation
- reject weak designs for quality reasons, not only delta reasons
- converge toward strong output through critic routing

If the current codebase cannot provide that through hardening alone, then the codebase must change until it can.

## Final Statement

The project does not accept:

- a lower ceiling because of current structure

The project accepts only:

- whatever architectural change is required to make the builder itself quality-reliable

That is the operating rule from this point forward.

Primary rebuild execution plan:

- [admin-track-b-webdesign-quality-rebuild-plan-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-track-b-webdesign-quality-rebuild-plan-2026-04-19.md)
