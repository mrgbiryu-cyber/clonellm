# LLM Composition Design

## Goal

LLM is not a free-form HTML generator.

LLM must act as:

1. `reference-aware composition planner`
2. `slot / variant / rule patch editor`
3. `component authoring assistant`
4. `change report generator`

It operates on the captured-first architecture of this project.

---

## Core Principles

1. `captured` is baseline only.
   - LLM does not directly edit captured baseline artifacts.
   - All edits happen in `custom` or `figma-derived` variants.

2. LLM works inside the component contract.
   - It may update existing variants.
   - It may create new variants.
   - It does not use arbitrary full-page HTML generation as the default editing path.

3. `pc` and `mo` are separate.
   - LLM must always know the target `viewportProfile`.
   - If a request affects both, the patch must explicitly include both.

4. Every LLM change is:
   - planned
   - validated
   - previewed
   - approved
   - replayed
   before becoming active.

5. Final truth remains browser-rendered view.
   - LLM output is valid only after workbench replay against browser baseline.

---

## Input Modes

### 1. Reference URL mode

User provides a concrete URL.

System behavior:
1. Open URL in Chrome + CDP.
2. Capture actual rendered view.
3. Extract:
   - zones
   - slots
   - groups
   - interactions
   - visual tokens
4. Match extracted structure against our slot/component registry.
5. Build a composition proposal.

### 2. Natural-language mode

User provides design intent without URL.

System behavior:
1. Interpret design intent.
2. Search internal component library.
3. Build a composition proposal from known component types and variants.

### 3. Hybrid mode

User provides:
- URL
- natural-language brief

System behavior:
1. Extract structure from URL
2. Apply requested intent as a variation on top of that reference

### 4. Workbench selection mode

User selects:
- page
- viewport
- state
- slot

Then enters an instruction.

System behavior:
1. Use current workbench selection as primary context.
2. Build a slot-scoped plan and patch.

---

## LLM Input Contract

LLM should receive structured input, not raw page HTML dumps.

Example note:
1. external URLs use reserved-domain samples so they are not mistaken for live production defaults
2. sample JSON should prefer representative values over empty placeholder objects

```json
{
  "mode": "reference-driven",
  "pageContext": {
    "pageId": "home",
    "viewportProfile": "pc",
    "stateId": "default"
  },
  "selection": {
    "zoneId": "content-zone",
    "slotId": "quickmenu",
    "componentType": "quickmenu-grid"
  },
  "reference": {
    "url": "https://reference.example.invalid/premium-home",
    "groups": {
      "hero": { "headlineCount": 1, "ctaCount": 2 },
      "quickmenu": { "itemCount": 10 }
    },
    "checks": [
      { "id": "hero-dominant-visual", "status": "pass" },
      { "id": "dense-icon-grid", "status": "pass" }
    ]
  },
  "working": {
    "activeSourceId": "custom-home-quickmenu-pc-v1",
    "availableSourceIds": [
      "captured-home-quickmenu-pc",
      "custom-home-quickmenu-pc-v1",
      "figma-home-quickmenu-pc-v1"
    ],
    "groups": {
      "quickmenu": { "itemCount": 8, "layout": "4-column" }
    },
    "checks": [
      { "id": "slot-editable", "status": "pass" },
      { "id": "source-switch-available", "status": "pass" }
    ]
  },
  "instruction": "퀵메뉴를 좀 더 촘촘하고 아이콘 중심으로 바꿔줘"
}
```

---

## LLM Output Contract

LLM output must always be structured into:

1. `plan`
2. `patch`
3. `report`

```json
{
  "plan": {
    "affectedSlots": ["quickmenu"],
    "changeMode": "create_variant",
    "reason": "reference uses a denser icon-first quick menu"
  },
  "patch": {
    "action": "create_variant",
    "pageId": "home",
    "slotId": "quickmenu"
  },
  "report": {
    "summary": "퀵메뉴를 아이콘 중심 5열 변형안으로 제안",
    "assumptions": [
      "기존 quickmenu component contract 유지"
    ]
  }
}
```

### Plan

Explains:
- which slots are affected
- whether a new variant is required
- whether the change is token-only, layout-only, source-switch, or new composition

### Patch

Allowed patch categories:
- `update_slot`
- `update_rule`
- `create_variant`
- `switch_source`
- `update_interaction`
- `update_tokens`
- `update_scoped_css`

Example:

```json
{
  "action": "create_variant",
  "pageId": "home",
  "viewportProfile": "pc",
  "slotId": "quickmenu",
  "componentType": "quickmenu-grid",
  "baseVariantId": "custom-home-quickmenu-pc-v1",
  "newVariantId": "custom-home-quickmenu-pc-v2",
  "changes": {
    "layout": {
      "columns": 5,
      "gap": 12,
      "paddingInline": 20
    },
    "tokens": {
      "iconSize": 44,
      "titleSize": 13,
      "titleWeight": 600
    }
  }
}
```

### Report

Must explain:
- what changed
- why it changed
- what reference or design intent was used
- assumptions
- affected slots / rules
- replay result

---

## Component Authoring Rules

### Allowed

1. update an existing `custom` variant
2. create a new `custom` variant from a base variant
3. switch active source between:
   - `captured`
   - `custom`
   - `figma-derived`
4. patch layout rules
5. patch design tokens
6. patch scoped CSS
7. add or remove slot items if the component type supports repeated items

### Not allowed

1. global arbitrary CSS rewrite
2. direct mutation of captured baseline HTML
3. arbitrary page-wide DOM regeneration
4. creating unknown component types without review

---

## CSS Editing Policy

LLM must prefer token-driven editing over raw CSS.

### Preferred: token patch

Examples:
- `fontSize`
- `fontWeight`
- `lineHeight`
- `color`
- `backgroundColor`
- `borderColor`
- `borderRadius`
- `shadow`
- `iconSize`
- `paddingBlock`
- `paddingInline`
- `gap`

### Allowed when necessary: scoped CSS patch

Scoped CSS patch is allowed only when:
1. token patch cannot express the change
2. selector scope is limited to the current component variant
3. no global layout side effects are introduced

Required fields:
- `variantId`
- `scopeSelector`
- `cssText`

---

## Approval Flow

Required flow:
1. generate plan
2. generate patch
3. preview patch
4. user approves
5. apply patch
6. replay workbench validation
7. store report

UI actions:
- `Approve`
- `Hold`
- `Rollback`
- `Activate`

---

## Source Lifecycle for LLM

- `draft`
- `validated`
- `active`
- `deprecated`
- `rolled-back`

Typical flow:
1. LLM creates `custom-*` variant in `draft`
2. replay passes -> `validated`
3. user activates -> `active`
4. old active variant -> `deprecated`
5. rollback returns previous variant to `active`

---

## Replay and Validation

Every LLM patch must run replay after application.

Replay targets:
- current page / viewport / state
- related page-group targets if rule-level changes were made

Validation uses:
- `blocker > 4px`
- `warning 2px ~ 4px`
- `cosmetic <= 2px`

Final standard:
- browser-rendered view should be visually indistinguishable for normal users

---

## Workbench Requirements for LLM

Workbench must provide:
1. `reference image`
2. `working image`
3. `diff image`
4. `group metadata`
5. `checks`
6. `available variants`
7. `active source`
8. `report history`

---

## Minimal Implementation Order

1. `LLM input builder`
2. `plan / patch / report schema`
3. `patch validator`
4. `preview renderer`
5. `approval actions`
6. `replay integration`
7. `report persistence`

---

## Non-goals

1. fully free HTML generation
2. direct captured baseline mutation
3. invisible auto-apply without approval
4. mixing `pc` and `mo` into a single untyped patch
