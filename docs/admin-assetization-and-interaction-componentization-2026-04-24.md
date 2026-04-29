# Assetization and Interaction Componentization Direction

Date: 2026-04-24

Related baseline:

- `docs/admin-runtime-checkpoint-2026-04-22.md`
- `docs/admin-design-runtime-guardrails-2026-04-22.md`
- `docs/admin-asset-role-policy-rollout-2026-04-22.md`
- `docs/admin-quickmenu-icon-generation-contract-2026-04-22.md`
- `docs/interaction-implementation-plan.md`

## 1. Why This Worked

The biggest reason the recent runtime work succeeded was not only better HTML generation.

The turning point was that visual material became structured assets:

1. Banner assets were no longer treated as arbitrary images.
2. Icon assets were no longer treated as cropped promo thumbnails.
3. Asset role policy told the author what can and cannot be reused.
4. Runtime validation blocked wrong reuse before it reached the preview.

This means the next phase should not be "generate better pages" first.

The next phase should be:

1. turn image assets into reusable design assets
2. turn icon groups into reusable asset families
3. turn interactions into reusable code components
4. expose all three to the builder through a registry and validation contract

## 2. Core Principle

Assets are not files.

Assets are reusable capabilities with rules.

An assetized item must have:

1. identity
2. role
3. allowed usage
4. restricted usage
5. viewport compatibility
6. runtime integration method
7. validation gates
8. rollback or replacement path
9. LLM-readable description

For interactions, this means a carousel is not just JavaScript attached to a section.

It is a code component with:

1. state schema
2. trigger contract
3. target slots
4. responsive behavior
5. verification rules
6. LLM-editable controls

## 3. Asset Types

### 3.1 Image Asset

Image assets cover still visual material.

Examples:

- hero background
- banner background
- product object cut
- lifestyle image
- card media
- promo-complete surface
- reference-only captured image

Required metadata:

```json
{
  "assetId": "home-hero-background-warm-living-v1",
  "assetKind": "image",
  "role": "background-only",
  "sourceType": "captured|generated|imported|derived",
  "sourceRef": "data/raw/assets/...",
  "pageFamily": "home",
  "slotFamily": "hero",
  "viewportProfiles": ["pc", "mo"],
  "containsText": false,
  "textDensity": "none",
  "visualTone": "warm-neutral",
  "semanticRole": "editorial living-room background for premium home story",
  "llmDescription": "Text-free warm living-room scene. Safe as a calm full-bleed hero background behind new copy.",
  "llmDo": ["use as background for premium editorial hero", "pair with restrained copy and simple CTA"],
  "llmDont": ["use as icon", "use as small card thumbnail", "add conflicting sale badge copy"],
  "allowedUsage": ["full-bleed-background"],
  "restrictedUsage": ["icon", "promo-reoverlay"],
  "validationTags": ["no-embedded-copy", "safe-background"],
  "createdAt": "2026-04-24T00:00:00.000Z"
}
```

### 3.2 Icon Family Asset

Icon family assets cover grouped icon systems.

The unit of reuse is the family, not an individual SVG.

Examples:

- quickmenu icon family
- benefit icon family
- support shortcut icon family
- PDP option icon family

Required metadata:

```json
{
  "familyId": "home-quickmenu-soft-line-v1",
  "assetKind": "icon-family",
  "role": "icon-only",
  "memberCount": 9,
  "styleSummary": "soft rounded mono outline with restrained appliance tone",
  "semanticRole": "quick access navigation icon family",
  "llmDescription": "A consistent icon-only family for quickmenu navigation. Use the whole family together, not as isolated decorative images.",
  "llmDo": ["map members by label", "preserve family consistency", "keep icons secondary to labels"],
  "llmDont": ["mix with promo thumbnails", "use members as hero art", "invent missing member ids"],
  "viewportProfiles": ["pc", "mo"],
  "slotFamilies": ["quickmenu", "shortcut"],
  "members": [
    {
      "memberId": "subscription-days",
      "label": "구독 Days",
      "assetId": "home-quickmenu-soft-line-v1-subscription-days"
    }
  ],
  "validationTags": ["family-consistent", "no-text", "same-stroke-language"]
}
```

### 3.3 Motion / Interaction Asset

Interaction assets cover behavior that should be reusable as code.

Examples:

- carousel
- tab switch
- accordion
- sticky CTA
- gallery thumbnail sync
- product option select
- filter drawer
- compare bar
- quickmenu pagination

The unit of reuse is an interaction component.

Required metadata:

```json
{
  "interactionId": "carousel.snap.basic-v1",
  "assetKind": "interaction-component",
  "componentType": "carousel",
  "runtimeModule": "interaction-components/carousel.snap.basic-v1",
  "semanticRole": "stateful horizontal content rotation",
  "llmDescription": "Reusable carousel behavior with active index, indicators, optional timer, and cleanup. Select this when a slot needs controlled horizontal rotation.",
  "llmDo": ["choose timing and controls", "keep active state inspectable", "use only on supported slot families"],
  "llmDont": ["write inline JavaScript", "replace DOM selectors", "attach global listeners directly"],
  "slotFamilies": ["hero", "banner", "quickmenu", "gallery"],
  "viewportProfiles": ["pc", "mo"],
  "stateSchema": {
    "activeIndex": "number",
    "paused": "boolean",
    "itemCount": "number"
  },
  "triggerSchema": {
    "click": true,
    "swipe": true,
    "timer": true,
    "hoverPause": true
  },
  "controlSchema": {
    "showPrevNext": "boolean",
    "showIndicator": "boolean",
    "intervalMs": "number",
    "transitionMs": "number"
  },
  "verificationSchema": {
    "activeItemVisible": true,
    "indicatorSync": true,
    "noHorizontalOverflow": true
  }
}
```

## 4. Registry Model

The system should move toward three registries.

### 4.1 Image Asset Registry

Purpose:

- store reusable image assets
- classify role and usage
- prevent wrong reuse

Candidate path:

- `data/normalized/image-asset-registry.json`

### 4.2 Icon Family Registry

Purpose:

- store icon families as package-level assets
- preserve family consistency
- let builder select the whole family instead of isolated icons

Candidate path:

- `data/normalized/icon-family-registry.json`

### 4.3 Interaction Component Registry

Purpose:

- store reusable interaction code components
- connect interaction modules to slot families
- let the builder attach behavior through a stable contract

Candidate path:

- `data/normalized/interaction-component-registry.json`

Candidate code path:

- `web/interaction-components/`
- or `design-runtime/interaction-components/` if runtime code is separated later

## 5. LLM-Readable Description Contract

The registry is not only for code.

The registry must also teach the LLM what each asset means.

The LLM should receive a compact asset card, not just an id and URL.

### 5.1 Required LLM Fields

Each asset or interaction registry entry should include:

```json
{
  "semanticRole": "what this asset/component means in design terms",
  "llmDescription": "short plain-language explanation for authoring",
  "llmDo": ["approved use case 1", "approved use case 2"],
  "llmDont": ["blocked use case 1", "blocked use case 2"],
  "selectionHints": ["when to choose this"],
  "conflictHints": ["what it conflicts with"]
}
```

Field intent:

1. `semanticRole` tells the LLM the design meaning.
2. `llmDescription` tells the LLM how to think about the item.
3. `llmDo` gives positive usage guidance.
4. `llmDont` gives negative constraints.
5. `selectionHints` help choose between similar assets.
6. `conflictHints` prevent visual or semantic collisions.

### 5.2 Prompt Card Shape

The author prompt should receive assets in this form:

```md
Asset: home-hero-background-warm-living-v1
Role: background-only
Meaning: editorial living-room background for premium home story
Use when: the section needs a calm text-free full-bleed hero background
Do: use behind new headline, keep copy restrained
Do not: use as icon, use as promo badge, overlay sale-heavy copy
Viewport: pc, mo
```

For icon families:

```md
Asset Family: home-quickmenu-soft-line-v1
Role: icon-only family
Meaning: quick access navigation icon system
Use when: quickmenu or shortcut section needs a consistent navigation icon set
Do: map members by label, use the family together
Do not: mix with promo thumbnails, invent missing asset ids
Members: 구독 Days, 혜택/이벤트, 웨딩&이사, 다품목 할인, 라이브, 카드혜택, 가전 구독, 소모품, SALE 홈스타일
```

For interactions:

```md
Interaction Component: carousel.snap.basic-v1
Meaning: controlled horizontal rotation with active state and indicators
Use when: hero, banner, quickmenu, or gallery needs carousel behavior
Do: choose controls and timing only
Do not: write inline JavaScript or replace selectors
Editable controls: showPrevNext, showIndicator, intervalMs, transitionMs
```

### 5.3 Prompt Injection Rule

The LLM should receive:

1. only assets valid for the current `pageId + viewportProfile + slotId`
2. only the fields needed for design reasoning
3. positive and negative usage guidance together
4. exact ids that must be used in placeholders
5. no raw file path unless the runtime requires it

The LLM should not receive:

1. the full global asset registry
2. unrelated page assets
3. ambiguous assets without role and usage notes
4. validation bypass flags

### 5.4 Why This Matters

The previous failure mode was not "LLM did not see the image."

The failure mode was:

1. the LLM saw an asset without knowing its semantic role
2. a `promo-complete` banner looked like a usable background
3. a promo thumbnail looked like a quickmenu icon
4. the generated HTML used the right file in the wrong role

So asset descriptions must be part of the runtime contract.

The desired behavior is:

1. LLM understands what the asset is
2. LLM understands what it must not do with it
3. runtime validates the same rules
4. preview and compare expose violations clearly

## 6. Runtime Contract

### 6.1 Image Assets

The author can request:

- `background-only`
- `object-only`
- `icon-only`
- `card-media`
- `reference-only`

The runtime decides:

- final URL
- placement
- responsive sizing
- fallback
- validation

The author should not invent image paths.

### 6.2 Icon Families

The author can request:

- a required family role
- member labels
- style direction

The runtime decides:

- selected family
- member mapping
- SVG path or image URL
- size normalization
- runtime fit

The author should not mix icons from unrelated families unless explicitly allowed.

### 6.3 Interaction Components

The author can request:

- interaction type
- behavior level
- control visibility
- timing preference

The runtime decides:

- module attachment
- DOM scope
- state initialization
- event cleanup
- verification

The author should not generate arbitrary inline JavaScript inside authored section HTML.

## 7. Interaction as Code Component

Interaction code should be componentized with a stable adapter shape.

Proposed module interface:

```js
export function mount(root, options = {}) {
  return {
    update(nextOptions = {}) {},
    getState() {},
    verify() {},
    destroy() {}
  };
}
```

Required behavior:

1. `mount` attaches only inside the provided root.
2. `update` changes options without replacing the full DOM.
3. `getState` returns serializable state.
4. `verify` returns pass/fail diagnostics.
5. `destroy` removes listeners and timers.

This prevents interaction code from becoming one-off page scripts.

## 8. Builder Handoff

The design author output should eventually include an interaction plan.

Example:

```json
{
  "slotId": "hero",
  "interactionPlan": {
    "interactionId": "carousel.snap.basic-v1",
    "sourceId": "home.hero.carousel.pc-v1",
    "controls": {
      "showPrevNext": true,
      "showIndicator": true,
      "intervalMs": 5000,
      "transitionMs": 420
    }
  }
}
```

The runtime renderer should treat this like asset placeholders:

1. validate the interaction component exists
2. verify the slot supports the component
3. mount the component after final HTML render
4. record verification result in the draft report

## 9. Validation Gates

### 9.1 Image Asset Gate

Fail if:

- `promo-complete` is used as a new background for overlaid copy
- text-heavy image is reused as generic object art
- icon slot receives PNG promo thumbnail
- viewport-incompatible asset is used without fallback

### 9.2 Icon Family Gate

Fail if:

- family members mix unrelated stroke or fill languages
- text is embedded in icons
- icon complexity fails runtime size
- generated member count does not match required labels

### 9.3 Interaction Component Gate

Fail if:

- component attaches global listeners without cleanup
- timer exists without pause or destroy path
- state cannot be inspected
- verification cannot prove active state
- interaction causes horizontal overflow
- component changes unrelated DOM outside its root

## 10. LLM Editable Boundary

LLM can edit:

- asset role preference
- asset family selection
- image tone preference
- interaction component selection among approved components
- interaction timing
- control visibility
- default active index
- trigger policy

LLM should not edit directly:

- raw asset file paths
- arbitrary selectors
- global event listener logic
- runtime module code
- validation bypass flags

## 11. Implementation Phases

### Phase A1. Registry Skeleton

1. create image asset registry schema
2. create icon family registry schema
3. create interaction component registry schema
4. map existing successful banner/icon assets into the registries

Exit:

- builder can read structured asset candidates from registries

### Phase A2. Runtime Asset Resolver

1. move image role resolution into registry-backed lookup
2. keep current `asset-role-policies.json` as policy source
3. add registry diagnostics to draft report

Exit:

- wrong asset reuse is blocked with clear diagnostics

### Phase A3. Interaction Component Skeleton

1. create interaction component module shape
2. implement `carousel.snap.basic-v1`
3. implement `accordion.disclosure.basic-v1`
4. implement `tabs.switch.basic-v1`
5. add verifier hooks

Exit:

- at least three interaction components can mount, verify, and destroy in isolation
- current status: `carousel.snap.basic-v1`, `accordion.disclosure.basic-v1`, and `tabs.switch.basic-v1` are approved with runtime adapter files under `web/interaction-components/`

### Phase A4. Slot Binding

1. connect interaction components to `slotId`
2. store active interaction source per page variant
3. support `pc/mo` variant-specific binding

Exit:

- `home:pc` and `home:mo` can use different interaction options without overwriting each other

### Phase A5. Admin UX

1. show image assets by role
2. show icon family as a package
3. show attached interaction component per slot
4. expose safe controls only
5. show validation result next to preview/compare

Exit:

- user can inspect assets and interactions without reading code

## 12. First Targets

Start with the cases that already proved value.

### Image / Banner

1. `home.hero`
2. service hero/stage banners
3. PLP banner
4. PDP summary stage

### Icon Family

1. `home.quickmenu`
2. support shortcut icons
3. benefit/service hub icons

### Interaction Component

1. `home.hero.carousel`
2. `home.quickmenu.carousel`
3. `support.accordion.open`
4. `plp.filter.drawer`
5. `pdp.gallery.carousel`
6. `pdp.sticky.buybox`

## 13. Operating Rule

Do not treat assetization as a later cleanup.

For each new successful design pattern:

1. identify what made it work
2. extract it into an asset or interaction component
3. write its role and validation rules
4. register it
5. use the registry in the next build

This is how the project moves from one successful page to a repeatable design system.
