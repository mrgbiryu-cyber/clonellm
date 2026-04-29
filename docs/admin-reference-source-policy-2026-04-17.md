# Admin Reference Source Policy

Date: 2026-04-17
Owner: Codex / mrgbiryu alignment draft
Status: Draft for implementation

## 1. Goal

Reference sources must not be treated as a loose link list.

They should be ingested as structured visual anchors that can guide:

- planner direction
- builder composition
- critic comparison

The system should know:

- what kind of reference it is
- which target it applies to
- why it is useful
- what must not be copied from it

## 2. Source Classes

Reference sources should be classified before they are attached.

### 2.1 Page Mood Reference

Purpose:

- define overall tone
- define art direction
- define hierarchy feeling

Typical use:

- home full redesign
- hero direction
- editorial landing mood

Recommended sources:

- `Awwwards`
- selected `Dribbble`

Risk:

- can push output into showcase-only styling
- often weak as a real service UI baseline

### 2.2 Component Pattern Reference

Purpose:

- define how a specific component should be structured
- define card rhythm, navigation treatment, icon layout, ranking treatment

Typical use:

- hero
- quickmenu
- navigation
- ranking list
- card grid

Recommended sources:

- `Component Gallery`
- selected real-service examples from `Mobbin`

Risk:

- component may look good in isolation but not fit the page identity

### 2.3 Flow Pattern Reference

Purpose:

- define sequence logic across screens
- define user progression and screen-to-screen consistency

Typical use:

- login
- onboarding
- settings
- checkout

Recommended sources:

- `Mobbin`

Risk:

- useful mostly for flow pages, less useful for desktop homepage art direction

### 2.4 System Reference

Purpose:

- define reusable design language
- define tokens, card logic, surface treatment, rhythm

Typical use:

- design system alignment
- component family recipes
- critic comparison baseline

Recommended sources:

- internal `design md`
- curated in-house reference shelf

Risk:

- too generic if not tied to a concrete target

## 3. Priority By Current Product Need

For the current system, practical value is:

1. `Component Gallery`
2. `Mobbin`
3. `Awwwards`
4. `Dribbble`

Interpretation:

- `Component Gallery` is strongest for `component rebuild`
- `Mobbin` is strongest for `flow-pattern` and mobile UI logic
- `Awwwards` is useful for `page mood`
- `Dribbble` is useful only as a mood board, not as a production-pattern baseline

## 4. Per-Source Usage Rule

### 4.1 Awwwards

Allowed:

- page mood
- hero tone
- large-scale art direction

Avoid:

- direct layout copying
- service structure copying
- using it as a component production baseline

### 4.2 Dribbble

Allowed:

- visual mood
- shape language
- color contrast direction

Avoid:

- treating it as real production UX
- using it as a direct information architecture model

### 4.3 Mobbin

Allowed:

- flow logic
- mobile pattern references
- practical service UI sequence

Avoid:

- using mobile app patterns as-is for desktop homepage composition

### 4.4 Component Gallery

Allowed:

- hero variants
- nav structure
- quick links
- cards
- pricing layouts
- CTA treatment

Avoid:

- mixing unrelated component families into one page without page identity fit

## 5. Required Structured Input Schema

Every reference must be stored in structured form.

```json
{
  "id": "ref-home-hero-01",
  "label": "Awwwards hero tone reference",
  "sourceUrl": "https://example.com",
  "sourceName": "Awwwards",
  "sourceClass": "page-mood",
  "targetLayer": "component",
  "targetPageIds": ["home"],
  "targetComponents": ["home.hero"],
  "targetGroupId": "",
  "viewportProfile": "pc",
  "intentTags": ["hero-tone", "premium-density", "headline-contrast"],
  "why": [
    "hero hierarchy is clear",
    "background and copy rhythm feel premium",
    "CTA stands out without looking promotional"
  ],
  "avoid": [
    "do not copy exact layout",
    "do not use dark-only theme block",
    "do not introduce excessive motion"
  ],
  "captureMode": "screenshot",
  "priority": "high"
}
```

## 6. Required Fields

- `sourceClass`
  `page-mood | component-pattern | flow-pattern | system-reference`
- `targetLayer`
  `element | component | section-group | page`
- `targetPageIds`
  exact page targets
- `targetComponents`
  exact component targets when applicable
- `intentTags`
  what the reference is supposed to teach
- `why`
  why this reference is useful
- `avoid`
  what must not be copied or overfit
- `captureMode`
  `screenshot | url-only`
- `priority`
  `high | medium | low`

## 7. Intake Rules

The system should reject unstructured reference input as first-class execution guidance.

Link-only input may be accepted temporarily, but should be normalized into the schema above before planner/builder use.

Normalization rules:

1. classify source
2. assign target layer
3. assign target page or target component
4. extract why
5. extract avoid
6. capture screenshot if possible
7. attach screenshot to planner and builder as visual anchor

## 8. Attachment Rules

### 8.1 Planner

Planner should receive:

- structured metadata
- screenshot anchor when available
- why / avoid fields

Planner should use references to define:

- visualGoals
- negativeConstraints
- layoutPriority
- tokenHints

### 8.2 Builder

Builder should receive:

- only references relevant to selected scope
- component references for component rebuild
- page mood references for page or section redesign

Builder should not receive:

- unrelated global link lists
- references outside the selected page family

### 8.3 Critic

Critic should receive:

- before screenshot
- after screenshot
- selected reference screenshot

Critic should compare:

- hierarchy
- density
- spacing rhythm
- component balance
- asset fit
- brand fit

## 9. Selection Policy

Too many references lower quality.

Recommended max:

- `page mood`: up to 3
- `component pattern`: up to 3 per component family
- `flow pattern`: up to 3 per flow
- total per run: usually 3 to 5

## 10. Current Product Guidance

For current work:

- `home hero`
  prefer `page-mood + component-pattern`
- `home quickmenu`
  prefer `component-pattern`
- `ranking / commerce card sections`
  prefer `component-pattern`
- `login / onboarding / settings`
  prefer `flow-pattern`

## 11. Anti-Patterns

Do not:

- dump 10 to 20 links into one build
- mix desktop page mood with mobile flow patterns without classification
- use Dribbble-only input as production UI guidance
- use Awwwards-only input as component structure truth
- pass a link without stating why it matters

## 12. Admin Input Shape

Admin should eventually allow this form:

- `reference type`
- `source name`
- `target layer`
- `target page`
- `target component`
- `why this reference`
- `what not to copy`
- `capture screenshot`

That is the minimum input shape needed to make external references useful to planner, builder, and critic.
