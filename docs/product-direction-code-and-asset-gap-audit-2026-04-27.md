# Product Direction / Journey / Asset Execution Plan (2026-04-27)

Source direction:

- `docs/product-direction-journey-design-2026-04-24.md`
- `docs/asset-first-builder-fallback-strategy-2026-04-27.md`

Validation inputs:

- `data/normalized/admin-design-target-audit-final.json`
- `data/normalized/admin-design-target-runtime-http-check.json`
- current code search in `server.js`, `web/admin-research.html`, `design-pipeline/*`

This document supersedes the older direction-only document for execution planning. The older document remains useful as source research, but implementation should follow this consolidated plan because it corrects stale runtime paths and adds asset/fallback policy.

## 0. Consolidated Product Direction

### 0-1. Product essence

The product is an AI design runtime that analyzes a reference website by page/section/slot, accepts natural-language design requirements, generates a concept package and authored Tailwind HTML, then previews and compares the result through a canonical runtime shell.

Current mainline is not the older `POST /api/build` Planner → Composer → Builder → Fixer → Critic route. The current execution path is:

```text
POST /api/workspace/plan-local-preview
  -> local planning preview
POST /api/workspace/plan
  -> persisted plan / concept package handoff
POST /api/workspace/build-local-draft
  -> Design Author input/output
  -> runtime draft
/runtime-draft/:draftBuildId
/runtime-compare/:draftBuildId
```

The current design runtime principle is:

- Markdown-first requirements and concept context.
- Preserve source truth through requirement → saved plan → concept package → author input.
- Render authored Tailwind HTML only inside Tailwind-enabled runtime shells.
- Use `runtime-draft` and `runtime-compare` as the main UI paths.

### 0-2. Product expansion scenarios

The original product direction identified three agency/subscription use cases. They remain valid, but they should be staged after runtime and asset sufficiency are stable.

| scenario | value | current stance |
|---|---|---|
| proposal-stage design automation | clone client/reference site and produce several directions quickly | partially possible, currently LGE-centered |
| seasonal/campaign variation | generate repeated seasonal home/PLP/PDP variations | possible after asset/fallback coverage improves |
| A/B material production | generate hero/quickmenu/section variants and compare | technically possible, needs quality and asset diversity |

Longer-term subscription directions:

| priority | direction | reason |
|---:|---|---|
| 1 | autonomous design optimization loop | strongest ROI story because conversion data can pick winners |
| 2 | competitor design intelligence | customers already pay for monitoring; structure-level response generation is differentiated |
| 3 | campaign calendar automation | clear e-commerce demand, but depends on robust asset and journey reuse |

These are not immediate implementation items. They become realistic only after the three execution workstreams in section 6 are stable.

### 0-3. Journey design concept

The key product shift is from page-level generation to journey-level design consistency.

| axis | current page unit | journey design target |
|---|---|---|
| work unit | one page build | one concept package across pages |
| sidebar | page list | page list + journey map |
| request input | technical parameters visible first | natural-language direction first |
| result checking | page-level preview/compare | full journey preview |
| consistency | manual | DNA consistency score |

Concept package means a design DNA object created from a page, usually home, and assigned across related pages.

```json
{
  "conceptId": "editorial-cinematic-v2",
  "createdFrom": "home",
  "dna": {
    "tone": "cinematic",
    "surfaceRhythm": "dark-with-light-accent",
    "hierarchy": "visual-first",
    "density": "spacious",
    "imageRole": "immersive-dominant"
  },
  "journeyPages": ["home", "category-tvs", "category-refrigerators", "pdp-tv-general"]
}
```

Same DNA should not be applied with the same intensity everywhere.

| page role | DNA application |
|---|---|
| home | strong brand-world entry; hero/quickmenu/major sections can be expressive |
| category / PLP | discovery and comparison; keep DNA in rhythm/color while preserving grid clarity |
| PDP | persuasion and trust; product clarity wins over heavy atmosphere |
| cart | conversion decision; use minimal DNA, prioritize trust and scanability |
| checkout | completion and anxiety removal; DNA should be subtle |

### 0-4. Admin UX direction

The Admin UI direction from the source document is still valid, but it must be implemented without breaking current `runLocalPlanningPreview()` and `runBuilderExecution()` payloads.

Target Admin changes:

- Sidebar: `[페이지 목록 | 여정 맵]` tabs.
- Page list: keep existing PC/MO/status filters, add journey labels and consistency badges.
- Journey map: show general purchase, care subscription, brand, support journeys.
- Topbar: show journey breadcrumb and active concept package.
- Main column: add journey concept section above page identity.
- Requirements: natural-language direction first; advanced technical settings collapsed.
- Builder: keep current approve/save/preview/compare behavior.
- Aside: add journey preview panel; combine concept history and version history where possible.

Implementation priority for Admin UX:

| priority | item | dependency |
|---:|---|---|
| 1 | requirements section simplification | none, layout only if payload shape preserved |
| 2 | sidebar tab shell | none, page list behavior must remain |
| 3 | topbar journey breadcrumb | needs journey definitions |
| 4 | journey concept section | needs concept package storage |
| 5 | aside journey preview panel | needs consistency data |
| 6 | visual journey map | needs journey graph data |
| 7 | `/journey-preview` route | needs canonical runtime page outputs |

### 0-5. Conversion pages strategy

`cart`, `checkout`, and `order-complete` should be treated as reference-based journey pages, not live LGE clones.

Reasons:

- They require login/session/product state.
- Checkout can depend on external payment gateway flow.
- They are not reliably sitemap-crawlable.
- They can still be designed from Baymard/Mobbin/Pageflows-style reference patterns with LGE brand DNA applied.

Conversion targets:

| target | source type | purpose |
|---|---|---|
| `cart` | reference-based | basket review, cross-sell, trust, pricing clarity |
| `checkout` | reference-based | shipping/payment/form confidence |
| `order-complete` | reference-based | completion, next action, membership/service follow-up |

These pages should enter `journey-definitions.json`, not the live LGE clone baseline, until an authenticated capture path exists.

### 0-6. Page coverage framing

The original source document framed LGE as roughly 22 reusable templates across a much larger sitemap. That framing remains directionally useful, but current implementation status must be read from the runtime/admin audit instead of the older blueprint table.

Current important correction:

- `care-solutions-pdp`, `homestyle-home`, and `homestyle-pdp` are no longer treated as pure renderer-missing work.
- Their current blocker is asset coverage / blueprint status alignment / quality readiness, not basic route existence.
- The Admin target catalog is currently 29 page/viewport targets, wider than the older "16 page" shorthand.

## 1. Direction Document vs Current Code

### Confirmed current state

- Admin target catalog is already wider than the old "16 page" framing: 29 targets are wired in `web/admin-research.html`.
- Runtime generation path is not `POST /api/build` anymore. Current mainline is:
  - `POST /api/workspace/plan-local-preview`
  - `POST /api/workspace/plan`
  - `POST /api/workspace/build-local-draft`
  - `/runtime-draft/:draftBuildId`
  - `/runtime-compare/:draftBuildId`
- `care-solutions-pdp`, `homestyle-home`, `homestyle-pdp` are not purely "renderer missing" anymore. They are present in routes, admin target catalog, page identity briefs, editable components, final acceptance bundles, and runtime draft generation passed.
- `conceptPackage` exists only as page-level Design Author input/output preservation. There is no persisted journey-level concept package, active DNA assignment, journey consistency score, or journey preview route.
- `cart`, `checkout`, `pdp_to_cart`, `cart_to_checkout`, `purchase_flow` exist only as design reference tags/classification, not as workspace pageIds or admin targets.

### Document drift to update

- `product-direction-journey-design-2026-04-24.md` still says `POST /api/build` and Planner → Composer → Builder → Critic as the current route. That should be rewritten to the current `workspace/plan-local-preview` + `workspace/build-local-draft` mainline.
- P0-1/P0-2 says `care-solutions-pdp`, `homestyle-home`, `homestyle-pdp` need renderer/prototype implementation. Current code says the remaining blocker is no longer basic rendering; it is asset coverage and blueprint status alignment.
- Section 5-4 `blueprint-only` table is stale for runtime behavior. `page-builder-prompt-blueprints.json` may still mark them blueprint-only, but generated runtime drafts and HTTP checks are passing.

## 2. Code Modification Candidates

### P0. Align stale status and docs with current runtime

- Update `data/normalized/page-builder-prompt-blueprints.json` statuses for pages that now pass runtime generation, or create a separate status layer that distinguishes `runtime-pass` from `blueprint-only`.
- Treat this document as the execution source of truth. Keep `docs/product-direction-journey-design-2026-04-24.md` as historical source research unless it is later rewritten to match this plan.
- Keep guardrail distinction: "runtime path passes" does not mean "assets are sufficient".

### P1. Asset coverage workflow

Current asset matching is strict scope matching in `design-pipeline/asset-registry.js`.

- `matchesScope()` requires page/slot/component/viewport scope to match.
- `/api/workspace/asset-registry-cards` exposes empty sections when `includeEmpty=1`.
- This is good for preventing wrong role reuse, but many pages have zero scoped assets.

Required code/data work:

- Add a page/slot asset gap report script as a first-class script, not only ad-hoc audit output.
- Add an asset intake queue grouped by `pageId + viewportProfile + slotId + requiredRole`.
- Register or reclassify existing captured assets for missing page/slot scopes where safe.
- Add role-specific fallback only at registry-candidate level, not runtime injection level. Do not allow `promo-complete` to become hero background or icon substitute.

### P2. Journey model

There is no current persisted journey model.

Required files/API:

- New runtime file: `data/runtime/concept-packages.json`
- New normalized static file: `data/normalized/journey-definitions.json`
- Server APIs:
  - `GET /api/concept-packages`
  - `POST /api/concept-packages`
  - `PUT /api/concept-packages/:id/assign`
  - `GET /api/concept-packages/:id/consistency`
  - `GET /api/journeys`
- Admin UI:
  - sidebar tabs: page list / journey map
  - topbar journey breadcrumb
  - journey concept section above page identity
  - aside journey preview panel

### P3. Conversion pages

`cart` and `checkout` are only reference tags today.

Required work:

- Add `cart`, `checkout`, `order-complete` as page-like targets with reference-based shells.
- Do not pretend these are live LGE clones. Mark source as `reference-based`.
- Add them to journey definitions, not to the LGE clone baseline unless a reliable authenticated capture path exists.
- Build `/journey-preview` after these targets can render at least placeholder shells.

### P4. Admin requirements UX

The document's UX direction is still valid.

Required work in `web/admin-research.html`:

- Move natural-language direction/request input to the top of the requirements section.
- Put `mode`, `interventionLayer`, `patchDepth`, `rendererSurface`, `builderProvider` inside advanced settings.
- Add UI-only "apply to entire journey" checkbox after concept package storage exists.
- Preserve current `runLocalPlanningPreview()` and `runBuilderExecution()` payload shape. This should be layout/UX refactor first, not pipeline rewrite.

## 3. Asset Coverage Summary

Overall registry inventory:

- image assets: 215
- image variants: 266
- approved image variants: 21
- approved PC image variants: 16
- approved MO image variants: 5
- icon families: 13 approved
- interaction components: 9 approved

Generation/runtime structure is currently passing, but asset coverage is not. Support is the only fully covered page family by current strict registry matching.

## 4. Asset Gap By Page

| pageId | empty / editable | gap | available assets | missing slots |
|---|---:|---:|---|---|
| home | 36 / 42 | 86% | img 226 / icon 12 / interaction 6 | header-top, header-bottom, md-choice, timedeal, best-ranking, subscription, brand-showroom, latest-product-news, smart-life, lg-best-care, bestshop-guide, hero, quickmenu, marketing-area |
| support | 0 / 8 | 0% | img 8 / icon 14 / interaction 6 | none |
| bestshop | 8 / 8 | 100% | img 0 / icon 0 / interaction 0 | hero, shortcut, review, brandBanner |
| care-solutions | 2 / 10 | 20% | img 92 / icon 14 / interaction 10 | benefit |
| care-solutions-pdp | 8 / 8 | 100% | img 0 / icon 0 / interaction 0 | visual, detailInfo, noticeBanner, reviewInfo |
| homestyle-home | 6 / 6 | 100% | img 0 / icon 0 / interaction 0 | quickMenu, labelBanner, brandStory |
| homestyle-pdp | 12 / 12 | 100% | img 0 / icon 0 / interaction 0 | detailInfo, bestProduct, review, qna, guides, seller |
| category-tvs | 4 / 12 | 33% | img 9 / icon 8 / interaction 10 | firstRow, firstProduct |
| category-refrigerators | 4 / 12 | 33% | img 10 / icon 8 / interaction 10 | firstRow, firstProduct |
| pdp-tv-general | 6 / 14 | 43% | img 8 / icon 4 / interaction 8 | price, option, review |
| pdp-tv-premium | 6 / 14 | 43% | img 8 / icon 0 / interaction 8 | price, option, review |
| pdp-refrigerator-general | 6 / 14 | 43% | img 0 / icon 4 / interaction 8 | price, option, review |
| pdp-refrigerator-knockon | 6 / 14 | 43% | img 0 / icon 0 / interaction 8 | price, option, review |
| pdp-refrigerator-glass | 6 / 14 | 43% | img 0 / icon 0 / interaction 8 | price, option, review |

## 5. Asset Gap Priority

### Critical: zero scoped assets

- `bestshop` PC/MO
- `care-solutions-pdp` PC/MO
- `homestyle-home` PC/MO
- `homestyle-pdp` PC/MO
- `home/ta`

These can render, but the builder has no scoped registry assets. Designs will be generic or rely on safe fallback surfaces.

### High: many empty commerce/home slots

- `home/pc`
- `home/mo`

The top hero/quickmenu have some assets, but most lower sections are empty. This limits diversity across long home pages.

### Medium: PLP/PDP partial gaps

- `category-tvs`
- `category-refrigerators`
- all PDP variants

The repeated missing slots are commerce utility slots: `firstRow`, `firstProduct`, `price`, `option`, `review`.

### Low: mostly covered

- `care-solutions` only lacks `benefit`.
- `support` is currently covered.

## 6. Reorganized Product Workstreams

The next phase should be tracked as three workstreams, with asset fallback treated as part of the assetization foundation rather than a separate late-stage patch.

### A. Current-state cleanup / baseline alignment

Purpose:

- Prevent stale docs, legacy routes, or old blueprint statuses from sending implementation back toward already-solved renderer work.
- Keep the current completed PC/MO runtime path intact while new journey and asset work is added.

Work:

- Keep this consolidated document aligned with the current mainline:
  - `POST /api/workspace/plan-local-preview`
  - `POST /api/workspace/plan`
  - `POST /api/workspace/build-local-draft`
  - `/runtime-draft/:draftBuildId`
  - `/runtime-compare/:draftBuildId`
- Treat `docs/product-direction-journey-design-2026-04-24.md` as archived source research unless we later decide to rewrite or deprecate it explicitly.
- Split page status into at least two states:
  - `runtime-pass`
  - `asset-insufficient`
- Keep `care-solutions-pdp`, `homestyle-home`, `homestyle-pdp` out of the old "renderer missing" bucket if runtime generation is passing.
- Keep `/admin` buttons and labels on the current `runtime-draft` / `runtime-compare` flow, not legacy clone draft URLs.

Exit criteria:

- The execution source of truth no longer conflicts with current code.
- Runtime pass and asset sufficiency are not treated as the same signal.
- Admin default UI does not expose old build vocabulary as the main path.

### B. Assetization + builder fallback foundation

Purpose:

- Ensure every page can produce a complete, non-empty, non-repetitive design even when approved assets are missing.
- Grow reusable PC/MO assets without allowing wrong-role reuse.

Reference:

- `docs/asset-first-builder-fallback-strategy-2026-04-27.md`

Work:

- Add a reproducible asset-gap report script from current registry data.
- Add an intake queue grouped by `pageId + viewportProfile + slotId + requiredRole`.
- Fill zero-scoped-asset pages first:
  - `bestshop`
  - `care-solutions-pdp`
  - `homestyle-home`
  - `homestyle-pdp`
  - `home/ta`
- Add `data/normalized/asset-fallback-policies.json`.
- Add `design-pipeline/asset-fallback-policy.js`.
- Extend `design-pipeline/author-input.js` with section-level `assetFallbackPolicy`.
- Extend `design-pipeline/author-llm.js` so the author understands:
  - use approved registry assets when available
  - request image-router fallback only for image-critical sections
  - use CSS/Tailwind composition fallback for utility/content sections
- Add a provider-neutral image router wrapper instead of hard-coding a single provider into authoring logic.
- Surface section fallback state in Admin:
  - `approved asset used`
  - `draft generated image`
  - `css fallback`
  - `unresolved`

Fallback split:

| section type | preferred path | fallback path |
|---|---|---|
| hero / visual / brandBanner / labelBanner / brandStory | approved `background-only` asset | image-router, then CSS composition |
| quickmenu / shortcut / tabs | approved `icon-only family` | generated icon family, then CSS chips/glyphs |
| commerce grids / card media | approved scoped card media | CSS composition first; image-router only when safe |
| price / option / qna / guides / seller / notice / benefit | CSS/Tailwind composition | no image generation by default |

Exit criteria:

- Missing assets no longer cause empty or broken sections.
- PC/MO asset isolation remains enforced.
- Generated images are stored as `draft-generated` or `candidate`, not silently promoted to approved reusable assets.
- Final HTML validation still blocks wrong role, wrong viewport, and untrusted image URLs.

### C. Customer journey feature

Purpose:

- Move from single-page generation to journey-level consistency across requirement → concept → page build → comparison → preview.
- Allow related pages to share a concept package without duplicating manual work.
- Turn the original "journey design" direction into persisted data and Admin behavior instead of a static UX idea.

Work:

- Add `data/runtime/concept-packages.json`.
- Add `data/normalized/journey-definitions.json`.
- Add APIs:
  - `GET /api/concept-packages`
  - `POST /api/concept-packages`
  - `PUT /api/concept-packages/:id/assign`
  - `GET /api/concept-packages/:id/consistency`
  - `GET /api/journeys`
- Add Admin UI:
  - page list / journey map switch
  - journey breadcrumb
  - journey concept package panel
  - consistency status per page
  - "apply to entire journey" only after concept package persistence exists
- Add reference-based conversion targets:
  - `cart`
  - `checkout`
  - `order-complete`
- Add `/journey-preview` only after journey pages render through the same canonical runtime-draft/compare shell.

Concept package minimal schema:

```json
{
  "conceptPackages": [
    {
      "conceptId": "editorial-cinematic-v2",
      "label": "Editorial Cinematic v2",
      "createdAt": "2026-04-27",
      "createdFrom": "home",
      "dna": {
        "tone": "cinematic",
        "surfaceRhythm": "dark-with-light-accent",
        "hierarchy": "visual-first",
        "density": "spacious",
        "imageRole": "immersive-dominant"
      },
      "journeyAssignments": {
        "journey": "general-purchase",
        "pages": {
          "home": { "applied": true, "consistency": 100 },
          "category-tvs": { "applied": true, "consistency": 82 },
          "pdp-tv-general": { "applied": true, "consistency": 71 },
          "cart": { "applied": false, "consistency": null },
          "checkout": { "applied": false, "consistency": null }
        }
      }
    }
  ]
}
```

Journey definitions should start with these flows:

| journey | pages | note |
|---|---|---|
| general-purchase | home → category-tvs/category-refrigerators → PDP → cart → checkout → order-complete | conversion pages are reference-based |
| care-subscription | home → care-solutions → care-solutions-pdp → application/checkout → complete | subscription flow differs from product purchase |
| brand-discovery | home → brand/homestyle → homestyle-pdp/PDP | stronger visual DNA allowed |
| support-as | home → support → support detail/action | clarity and task completion first |

Exit criteria:

- Journey concept data persists independently from a single page build.
- A journey can show which pages are aligned, missing, or stale.
- `/journey-preview` does not introduce a second rendering truth.

## 7. Recommended Execution Order

1. Baseline cleanup: fix stale status/docs and confirm the current `design-runtime-v1` path remains the only mainline.
2. Reproducible asset gap reporting: turn the current audit table into a script/output we can rerun.
3. Fallback policy foundation: add fallback policy data, decision module, author-input packet, and author prompt rules.
4. CSS/Tailwind fallback rollout: make all missing utility/content sections render without image dependency.
5. Zero-asset page assetization: fill or generate candidates for `bestshop`, `care-solutions-pdp`, `homestyle-home`, `homestyle-pdp`, and `home/ta`.
6. Image-router fallback: connect provider-neutral image generation only for hero/banner/visual/icon-family sections.
7. Asset candidate approval flow: show generated/candidate assets in Admin and allow promote/discard.
8. Journey model/API: add persisted concept packages and journey definitions.
9. Journey Admin UX: add journey map, breadcrumb, concept package panel, and consistency indicators.
10. Conversion pages: add reference-based `cart`, `checkout`, and `order-complete`.
11. Journey preview: create `/journey-preview` using canonical runtime render output only.

## 8. Execution Log

### 2026-04-27 baseline/fallback foundation

Completed:

- Added runtime status reporting script:
  - `npm run report:runtime-status`
  - output: `data/normalized/page-runtime-status.json`
  - output: `data/normalized/page-runtime-status.md`
- Added asset gap reporting script:
  - `npm run report:asset-gaps`
  - output: `data/normalized/asset-gap-report.json`
  - output: `data/normalized/asset-gap-report.md`
- Added fallback policy data:
  - `data/normalized/asset-fallback-policies.json`
- Added fallback policy resolver:
  - `design-pipeline/asset-fallback-policy.js`
- Extended Design Author input packets with section-level `assetFallbackPolicy`.
- Extended Design Author prompt rules so the model can distinguish:
  - approved asset-first usage
  - image-router/icon-family fallback request
  - CSS/Tailwind composition fallback

Current generated baseline:

- page count: 14
- runtime status: `runtime-pass` 14
- asset status:
  - `asset-empty` 4
  - `asset-insufficient` 9
  - `asset-sufficient` 1
- asset authoring contract status:
  - `asset-contract-pass` 14
  - review targets 0
- admin target count: 29
- editable sections: 188
- empty asset sections: 110
- empty asset ratio: 59%

Validation:

- `node --check` passed for changed JS/MJS files.
- `npm run design-pipeline:test-author-flow` passed.
- `npm run design-pipeline:test-preview-flow` passed.
- `npm run design-pipeline:local -- --scenario home-top-stage --pretty` returned a valid local planning scenario.

Important interpretation:

- `blueprint-only` is now treated as a stale blueprint signal when the runtime audit says the page is already `runtime-pass`.
- `asset-empty` / `asset-insufficient` means strict source/registry assets are sparse. It is not the same as build-blocking authoring readiness.
- `asset-contract-pass` means the section can proceed through approved assets or allowed CSS/image-router fallback policy without violating asset role rules.
- Fallback policy does not inject runtime assets. It only tells Design Author which strategy is allowed for each section.
- Generated images remain `draft-generated` or `candidate` until a separate approval flow promotes them.

Next:

- Full `home/mo` 12-section Gemini/Claude comparison after the route/status baseline is stable.
- PC/MO share compare parity check for `/share/:token/compare`.
- Zero-asset page visual assetization for richer output quality, not because the runtime is blocked.
- Provider-neutral image-router wrapper after full-page quality checks are stable.

### 2026-04-27 CSS/Tailwind fallback rollout

Completed:

- Extended local Design Author output so missing-asset sections no longer collapse to one generic card.
- Added slot-specific CSS/Tailwind fallback renderers:
  - visual/banner/story sections: `visual`, `brandBanner`, `labelBanner`, `brandStory`, `marketing-area`, `brand-showroom`
  - icon/navigation sections: `quickmenu`, `quickMenu`, `shortcut`, `tabs`
  - commerce/card sections: `md-choice`, `timedeal`, `best-ranking`, `bestProduct`, `firstRow`, `firstProduct`, `latest-product-news`, `subscription`
  - utility/content sections: `price`, `option`, `review`, `reviewInfo`, `qna`, `guides`, `seller`, `benefit`, `noticeBanner`, `detailInfo`, `header-top`, `header-bottom`, `smart-life`, `lg-best-care`, `bestshop-guide`
- Preserved section identifiers through `data-codex-slot` and `data-codex-component-id`.
- Added `data-asset-fallback-mode` to locally authored fallback sections for later Admin visibility.
- Kept fallback as authored HTML composition only; no untrusted image URLs or generated assets are injected.

Validation:

- `node --check design-pipeline/author-output.js design-pipeline/author-input.js design-pipeline/author-llm.js` passed.
- `npm run design-pipeline:test-author-flow` passed.
- `npm run design-pipeline:test-preview-flow` passed.
- Representative local package test generated non-empty HTML for:
  - `visual`
  - `detailInfo`
  - `noticeBanner`
  - `reviewInfo`
  - `quickMenu`
  - `labelBanner`
  - `brandStory`
  - `bestProduct`
  - `qna`
  - `seller`

Next:

- Run targeted runtime draft builds for zero-asset pages and visually inspect that fallback sections are distinct enough.
- Start zero-asset page assetization with `bestshop`, `care-solutions-pdp`, `homestyle-home`, `homestyle-pdp`, and `home/ta`.

### 2026-04-27 status alignment and home/mo model comparison

Completed:

- Updated `scripts/report_runtime_status.mjs` so runtime status now separates:
  - strict source/registry asset sufficiency
  - authoring contract readiness from `asset-authoring-contract-audit`
  - runtime pass/fail
- Regenerated:
  - `data/normalized/asset-authoring-contract-audit.json`
  - `data/normalized/asset-authoring-contract-audit.md`
  - `data/normalized/page-runtime-status.json`
  - `data/normalized/page-runtime-status.md`

Current PC/MO status:

- page count: 14
- runtime status: `runtime-pass` 14
- strict asset status:
  - `asset-empty` 4
  - `asset-insufficient` 9
  - `asset-sufficient` 1
- asset authoring contract status:
  - `asset-contract-pass` 14
- review targets: 0

Model comparison result for `home/mo`:

- A single 12-section Claude build through the synchronous `/api/workspace/build-local-draft` path failed with repeated `fetch failed`.
- The same `home/mo` 12 sections passed when split into three 4-section batches.
- All batch comparisons used OpenRouter without demo fallback.

Batch reports:

| batch | sections | Gemini draft | Claude draft | result | Claude delta |
|---|---|---|---|---|---|
| top | `hero`, `quickmenu`, `md-choice`, `timedeal` | `runtime-draft-1777265336223` | `runtime-draft-1777265624888` | pass | html +22823, text +816, classes +120, CTA +3 |
| commerce | `best-ranking`, `marketing-area`, `subscription`, `brand-showroom` | `runtime-draft-1777265724266` | `runtime-draft-1777265999801` | pass | html +26015, text +621, classes +210, CTA +9 |
| content | `latest-product-news`, `smart-life`, `lg-best-care`, `bestshop-guide` | `runtime-draft-1777266103224` | `runtime-draft-1777266343949` | pass | html +21412, text +331, classes +258, CTA +7 |

Interpretation:

- Claude quality remains stronger by structural richness and operational copy volume.
- Full-page Claude generation should move to an async/batched orchestration path instead of one long synchronous HTTP request.
- The immediate next engineering item is not asset-contract debugging. It is batch orchestration and preview/version assembly for full-page outputs.

Batch composition:

- Added reusable script:
  - `npm run design-pipeline:compose-drafts`
  - source: `scripts/compose_batched_draft_builds.mjs`
- The script takes multiple batch draft IDs, merges their authored sections in order, and saves one composed `runtime-draft`.
- If the reference shell cannot accept page-level insertion, the script writes a standalone composed `afterHtml` while preserving canonical `runtime-draft` / `runtime-compare` access.
- Added end-to-end orchestration script:
  - `npm run design-pipeline:batched-compose`
  - source: `scripts/run_batched_model_compare_and_compose.mjs`
  - default `home/mo` behavior: split the 12 body sections into 3 batches of 4, run Gemini vs Claude comparison per batch, collect the Claude challenger draft IDs, then compose one final draft.
  - use `--dry-run` to confirm batch grouping without model calls.
- Current composed `home/mo` Claude draft:
  - `runtime-draft-composed-1777266682340`
  - sections: 12/12
  - render mode: `standalone-composed-main`
  - preview: `/runtime-draft/runtime-draft-composed-1777266682340`
  - compare: `/runtime-compare/runtime-draft-composed-1777266682340?viewportProfile=mo`

Canonical command shape:

```bash
npm run design-pipeline:batched-compose -- \
  --page home \
  --viewport mo \
  --batch-size 4 \
  --base-url http://34.27.99.82:3000 \
  --login mrgbiryu
```

Admin/API integration:

- Added server-side async job API:
  - `POST /api/workspace/batched-compose`
  - `GET /api/workspace/batched-compose/:jobId`
- Added Admin action:
  - `Claude 배치 전체 생성`
  - starts the async job, polls status, then reloads the page so the composed draft becomes the latest builder result.
- The orchestration script now falls back to `data/normalized/admin-design-target-audit-final.json` editable slots when a page/viewport does not have a hardcoded component preset. This makes the same batch path usable beyond `home/mo`.
- `--dry-run` / `{ "dryRun": true }` is available for validating batch grouping without model calls.

Version/share flow:

- The composed draft remains a normal `design-runtime-v1` draft.
- Existing `현재 결과 저장` promotes it to a saved version.
- Runtime compare and shared compare both support share/copy flows with HTTP-safe clipboard fallback.

Journey model/API foundation:

- Added static journey definitions:
  - `data/normalized/journey-definitions.json`
- Added runtime concept package store:
  - `data/runtime/concept-packages.json`
- Added APIs:
  - `GET /api/journeys`
  - `GET /api/concept-packages`
  - `POST /api/concept-packages`
  - `PUT /api/concept-packages/:id/assign`
  - `GET /api/concept-packages/:id/consistency`
- `cart`, `checkout`, and `order-complete` are represented as `reference-based` journey pages, not live LGE clone baselines.

## 9. Guardrail Notes

- Do not solve missing assets by broadening scope matching too far. That would reintroduce wrong-role reuse.
- Do not use `promo-complete` as a hero background or icon substitute.
- Journey preview should reuse canonical `runtime-draft` / `runtime-compare` rendering. It should not create a second preview truth.
- Conversion pages must be labeled `reference-based` until authenticated live clone capture exists.
- Builder fallback must not hide preservation failures. If section identifiers or target scope disappear before authoring, fix the handoff first.
- Image-router output is not automatically an approved reusable asset. It remains `draft-generated` or `candidate` until reviewed.
