# Implementation Schedule

> 먼저 읽을 기준 문서:
> `docs/project-purpose-reference.md`

## Goal

Build the pre-LLM foundation end-to-end:

1. Chrome + CDP reads real pages and states.
2. State-aware captures are stored as reusable artifacts.
3. A workbench compares reference vs clone per page/state/zone.
4. Clone rendering uses captured-first slot sources.
5. Layout/state differences are normalized into JSON and used to fit the clone.
6. Page coverage expands from home to category, search, PLP, PDP, support/Q&A, and other key flows.
7. PC and MO are handled as separate source sets on the same shared schema.

LLM integration starts only after this foundation is stable.

This schedule targets a production-ready foundation, not an MVP or a PoC.
The schema and pipeline must absorb newly discovered:
- pages
- zones
- overlays / floating surfaces
- interaction states
- Figma variants
without reworking the base model.

Implementation rule:
- do not start from a single responsive renderer
- keep `pc` and `mo` as separate captured/custom/figma-derived source sets
- use `hybrid` only as a zone resolver where required
- execute page groups in `pc + mo` together, not `pc first then mo later`

---

## Operating Model

### Capture pipeline

1. Open target page in Chrome.
2. Trigger the target state.
3. Save:
   - screenshot
   - DOM/CDP snapshot
   - extracted structure JSON
   - interaction/state JSON
4. Register artifacts into slot/state registries.
5. Compare against working clone in workbench.
6. Fit clone using measured deltas.

Representative target selection rule:
- PLP representative set = first visible product row for each target category
- PDP representative set = every product reachable from that first PLP row
- target URLs are auto-extracted first, then reviewed for omissions or priority changes

### Core artifacts

- `reference screenshot`
- `working screenshot`
- `DOM snapshot`
- `structure snapshot`
- `interaction snapshot`
- `zone registry`
- `surface registry`
- `slot registry`
- `variant/source registry`
- `rule registry`
- `validation replay result`
- `coverage status`
- `viewport-specific source sets`

### Success rule

No manual CSS-only tuning unless the current page/state has:

1. valid reference open-state
2. valid working open-state
3. stable extractor output
4. workbench diff available

### Expansion rule

When a new structure is discovered:
1. do not patch one page ad hoc
2. register it as `unknown-pattern`
3. create provisional zone/slot if needed
4. promote it into a reusable type/rule after review
5. replay validation on existing pages/states before continuing
6. replay validation on both `pc` and `mo` source sets before continuing

---

## Phase 0. Extractor Hardening

### Objective

Make the capture system trustworthy before expanding scope.

### Work items

1. Harden Chrome + CDP state capture.
2. Separate `structure` from `open-state`.
3. Add strict open-state validity rules.
4. Retry hover/click/focus sequences until state actually opens.
5. Mark invalid captures as invalid instead of using them for comparison.
6. Register unknown patterns instead of dropping them.

### Deliverables

- stable `extract_gnb_state`
- open-state validity flag
- invalid-open guard in workbench

### Exit criteria

- `referenceOpenStateValid = true` for `home / gnb-product-open`
- `workingOpenStateValid = true` for `home / gnb-product-open`

---

## Phase 1. Workbench Generalization

### Objective

Turn the current compare flow into a repeatable workbench.

### Work items

1. Keep `compare/home` for default state view.
2. Expand dedicated workbenches:
   - GNB workbench
   - quickmenu workbench
   - PDP summary workbench
   - viewport-specific variants where needed
3. Standardize output by:
   - page
   - state
   - zone
   - surface
4. Save:
   - `reference`
   - `working`
   - `diff`
   - `meta`
5. Add validation replay status.
6. Add unknown-pattern review queue.

### Deliverables

- `/workbench/gnb`
- `/workbench/quickmenu`
- `/workbench/pdp`
- standard artifact layout in `data/debug` and `data/visual`

### Exit criteria

- every workbench shows valid source artifacts
- diff is based on valid state captures, not stale or invalid snapshots

---

## Phase 2. Home Baseline Completion

### Objective

Finish `home` as the template baseline page.

### Scope

- `header-top`
- `header-bottom`
- `hero`
- `quickmenu`
- first content blocks

### States

- `default`
- `gnb-product-open`
- `gnb-care-open`
- `gnb-support-open`
- `gnb-benefits-open`
- `gnb-story-open`
- `gnb-bestshop-open`
- `gnb-lgai-open`
- `hero-slide-*`

### Work items

home-specific remediation details follow `docs/home-remediation-plan.md`.

1. Finalize hybrid rule:
   - header/hero = desktop-like source
   - content = mobile-like source
2. Complete captured-first clone rendering.
3. Fit by workbench deltas, not ad hoc tweaks.
4. Record slot grouping and source variants.
5. Promote repeated home discoveries into reusable rules or component types.
6. Split home source sets into `pc` and `mo` variants under the same slot ids.
7. Validate and fit `pc` and `mo` in the same phase, not as separate later tracks.

### Exit criteria

- `home` page status = `captured`
- `home` interaction status = `captured`
- GNB panel structure matches reference baseline by workbench

### Post-home handoff

When `home` reaches visual acceptance, immediately continue with:

1. link wiring from `home` into each target clone page
2. per-page scope recovery from history docs
3. `pc/mo` source confirmation per page
4. visual implementation and browser verification for both `pc` and `mo`
5. code-level review of the accepted page
6. extraction of non-LLM-ready areas
7. conversion of those areas into an `LLM-editable` list
8. slot/source/variant/component hardening
9. transition into LLM implementation only after the above closes

---

## Phase 3. Global Header / GNB Template

### Objective

Extract the reusable top template used across pages.

### Work items

1. Formalize `header-top` component.
2. Formalize `header-bottom` component.
3. Formalize `mega-menu` component:
   - background layer
   - depth-2 tab strip
   - depth-3 panels
   - banners / hashtags
4. Add responsive source rules per slot.
5. Keep source rules as `pc` / `mo` sets first, responsive resolver second.

### Deliverables

- reusable `mega-menu` structure model
- slot groups:
   - `header-top`
   - `header-bottom`
   - `gnb-panel`

### Exit criteria

- top template can be applied to home, category, support, bestshop, care pages
- top template has both `pc` and `mo` source variants

---

## Phase 4. Category / PLP Baseline

### Objective

Build captured-first coverage for representative listing pages.

### Initial targets

- `category-tvs`
- `category-refrigerators`

Execution rule:
- for each category target, capture and fit both `pc` and `mo` before moving to the next category

### Expanded scope

- category tabs
- filter bar
- sort
- product card grid
- pagination/load more
- quick banners

### States

- `default`
- `filter-open`
- `sort-open`
- representative tab-selected states

### Exit criteria

- representative PLPs are `captured`
- workbench can compare `default` and filter/sort states
- newly discovered category-only structures are registered without schema breakage

---

## Phase 5. Search / Search Result Coverage

### Objective

Cover search entry and search result behavior before LLM.

### Scope

- header search open
- search suggestions
- search result list
- search filters

### Exit criteria

- search open state captured
- result page captured
- filter/sort/search states included in interaction inventory
- search suggest / overlay panels are mapped into dedicated zone/surface entries

---

## Phase 6. PDP Template Inventory

### Objective

Cover detail pages by template, not by SKU.

### Rule

Each top-level category gets at least one representative PDP template.

Execution rule:
- when a PDP template is chosen, inventory and baseline both `pc` and `mo` variants together

### Coverage targets

- TV PDP
- refrigerator PDP
- washer/dryer PDP
- aircare / AC PDP
- accessory / consumable PDP
- subscription PDP

### Slot groups

- `product-gallery`
- `product-summary`
- `price-box`
- `option-selector`
- `sticky-purchase`
- `comparison / wishlist`
- `review-summary`
- `Q&A`

### Exit criteria

- PDP templates are inventoried
- each template has captured baseline and slot map

---

## Phase 7. PDP Interaction Coverage

### Objective

Record real detail interactions as structured states.

### Required states

- image/gallery change
- option change
- color change
- purchase mode change
- pricing/benefit change
- sticky CTA state
- compare / wishlist state
- review tab
- Q&A tab

### Exit criteria

- PDP interaction inventory is complete for representative templates

---

## Phase 8. Support / 상담 / Q&A / Bestshop / Care

### Objective

Cover non-commerce but critical operational flows.

### Targets

- `support`
- 상담 flow
- Q&A flow
- `bestshop`
- `care-solutions`
- representative brand/story pages

### Work items

1. Baseline route detection.
2. Slot extraction.
3. Interaction extraction.
4. Workbench compare.

### Exit criteria

- support/Q&A/bestshop/care each have baseline coverage and captured-first slots

---

## Phase 9. Slot / Variant Registry Completion

### Objective

Make replacement and editing explicit before Figma/LLM.

### Model

Each slot stores:

- `captured`
- `custom`
- `figma-derived`
- `activeSourceId`

### Work items

1. Register slot groups across all covered page families.
2. Keep current custom variants as reusable assets.
3. Mark captured-first as baseline.
4. Add status labels:
   - `captured`
   - `partial`
   - `missing`
   - `replaced`
   - `figma-derived`

### Exit criteria

- source switching is stable across representative pages

---

## Phase 10. Figma Pre-Integration Readiness

### Objective

Prepare the structure Figma will plug into.

### Work items

1. Define component field schema:
   - text fields
   - image fields
   - CTA fields
   - layout fields
2. Define repeated group semantics.
3. Define editable region maps.
4. Keep captured source paired with editable source.

### Exit criteria

- slot/component structure is ready for figma-derived variants

---

## Phase 11. Minimal Auth / Workspace

### Objective

Add the smallest possible user layer before LLM without introducing a full permission system.

### Scope

1. login only
2. account identity
3. per-account workspace separation
4. per-account usage log
5. per-account work history
6. new account starts from shared default view

### Explicit non-goals

1. no complex role matrix yet
2. no budget controls yet
3. no heavy admin system yet

### Work items

1. add minimal login/session flow
2. define `shared default` vs `user workspace`
3. persist per-account work history
4. persist per-account LLM usage history
5. always open new accounts into shared default baseline first

### Exit criteria

- account identity exists
- user workspace is separated from shared default
- usage and work history are stored per account

---

## Phase 12. LLM Entry Gate

### LLM starts only when all below are true

1. extractor is stable
2. workbench is reusable
3. home baseline is complete
4. category/PLP baseline is complete
5. PDP template baseline is complete
6. search/support/Q&A coverage exists
7. slot registry and variant registry are stable
8. captured/custom/figma-derived switching works
9. minimal login/workspace layer exists
10. baseline interaction implementation is complete
11. interaction inventory and editable list exist

### LLM implementation model

LLM enters as:
1. reference-aware composition planner
2. slot / variant / rule patch editor
3. component authoring assistant inside component schema
4. report generator

Required contracts:
- URL-driven reference intake
- natural-language-only intake
- workbench selection intake
- `plan / patch / report` output
- approval before apply
- replay after apply

Reference:
- `docs/llm-composition-design.md`
- `docs/interaction-implementation-plan.md`

## Phase 11.5. Interaction Baseline And LLM-editable Prep

### Objective

Close interaction gaps before LLM and define how interaction changes become editable patches.

### Work items

1. Build `interaction inventory` for:
   - home
   - PLP
   - PDP
   - support/search
2. Implement baseline interactions:
   - GNB open / panel switching
   - hero carousel
   - quickmenu / lower sliders
   - PDP gallery / options / sticky
   - support accordion / tabs
3. Verify interaction states in browser and by code/state checks.
4. Create `interaction editable list`.
5. Define interaction patch schema for future LLM/workspace edits.
6. Add section-group screenshot compare loop before final visual acceptance.

### Exit criteria

1. 핵심 interaction baseline pass
2. interaction inventory exists
3. interaction editable list exists
4. replay / rollback rule exists for interaction changes
5. section-group screenshot compare artifacts exist

Reference:
- `docs/interaction-implementation-plan.md`

---

## Immediate next sequence

1. Fix `reference` GNB open-state extraction until valid.
2. Use GNB workbench to finish `home` mega-menu.
3. Lock `home` top template.
4. Move to category/PLP.
5. Move to PDP templates.
6. Move to support/Q&A/bestshop/care.
7. Add minimal login/workspace layer.
8. Start LLM implementation.

---

## Scheduling note

This plan assumes captured-first implementation for every major page family before LLM.

The correct order is:

1. extractor
2. workbench
3. baseline
4. slot/variant registry
5. figma-ready structure
6. minimal login/workspace
7. LLM

Reference history:
- `docs/decision-history.md`

Priority freeze:
- backend capture / extractor / workbench foundation first
- LLM implementation after backend foundation is stable
