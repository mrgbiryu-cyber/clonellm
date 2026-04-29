# Asset Registry Implementation Checkpoint

Date: 2026-04-24

Related:

- `docs/admin-assetization-and-interaction-componentization-2026-04-24.md`
- `docs/admin-asset-role-policy-rollout-2026-04-22.md`
- `docs/admin-home-top-asset-spec-2026-04-22.md`
- `docs/admin-quickmenu-icon-generation-contract-2026-04-22.md`

## Purpose

The first assetization implementation separates assets into registries that can be read by the Design Author.

The registry is not a file picker.

It is a design contract that records:

- source and provenance
- license or rights profile
- processing history
- role and usage boundaries
- LLM-readable meaning
- validation tags
- approval status

## PC/MO Variant Rule

Image assets must be recorded as a logical asset with viewport-specific variants when the crop, ratio, safe area, or overlay risk differs between PC and mobile.

Required shape:

```json
{
  "assetId": "home.hero.lge.sofa-object.v1",
  "variantPolicy": "viewport-specific",
  "viewportProfiles": ["pc", "mo"],
  "variants": {
    "pc": {
      "variantId": "home.hero.lge.sofa-object.v1.pc",
      "status": "approved",
      "aspectRatio": "1760:500",
      "safeArea": {
        "copyZone": "left-center",
        "primarySubjectZone": "right-center"
      }
    },
    "mo": {
      "variantId": "home.hero.lge.sofa-object.v1.mo",
      "status": "candidate",
      "aspectRatio": "430:560",
      "safeArea": {
        "copyZone": "top",
        "primarySubjectZone": "middle-bottom"
      }
    }
  }
}
```

Important:

- PC approval does not imply MO approval.
- A text-removed PC banner does not automatically become a safe mobile hero asset.
- The Design Author receives only the variant matching the current `viewportProfile`.
- If a mobile variant is missing or candidate-only, the builder must not silently reuse the PC crop as final mobile output.

## Added Registries

### Image Asset Registry

Path:

- `data/normalized/image-asset-registry.json`

Initial seed:

- `home.hero.lge.sofa-object.v1`
  - approved LGE-derived object-only hero visual for PC
  - mobile variant exists as candidate until a real mobile crop or derivative is approved
- `home.hero.generated.premium-stage.candidate-a`
  - generated background candidate, not allowed for final author output until approved
- `home.hero.lge.promo-complete.blocked-main`
  - blocked promo-complete reference asset

Bulk LGE clone import:

- Import script: `scripts/import-lge-assets-to-registry.js`
- Latest report: `data/normalized/lge-asset-import-report.json`
- Imported from `data/raw/archive-index.json` and `data/normalized/site-document.json`
- Current imported LGE-derived batch:
  - `287` LGE displayObject assets added/updated
  - imported assets are page + slot scoped
  - imported assets are not componentId-locked, so current and future section ids can still match by slot
  - `promo-complete` assets default to `blocked`
  - non-promo assets default to `candidate`

Current image registry total after import:

- `290` image registry entries
- status distribution at import time:
  - `approved`: `1`
  - `candidate`: `50`
  - `blocked`: `239`

Source profiles:

- `lge-derived`
- `external-stock`
- `generated`
- `imported`

### Icon Family Registry

Path:

- `data/normalized/icon-family-registry.json`

Initial seed:

- `home.quickmenu.icon.family.v1`
  - approved icon-only family package
  - maps to `data/normalized/generated-asset-families.json`

The family is the reusable unit, not each isolated SVG.

### Interaction Component Registry

Path:

- `data/normalized/interaction-component-registry.json`

Initial interaction set:

- `carousel.snap.basic-v1`
- `tabs.switch.basic-v1`
- `accordion.disclosure.basic-v1`
- `drawer.filter.basic-v1`
- `sticky.buybox.basic-v1`

All current interaction cards now have scoped runtime modules and are approved:

- `carousel.snap.basic-v1`
- `tabs.switch.basic-v1`
- `accordion.disclosure.basic-v1`
- `drawer.filter.basic-v1`
- `sticky.buybox.basic-v1`
- `modal.dialog.basic-v1`
- `tooltip.popover.basic-v1`
- `compare.slider.basic-v1`
- `segmented.control.basic-v1`

## Design Author Wiring

New resolver:

- `design-pipeline/asset-registry.js`

Connected in:

- `design-pipeline/author-input.js`
- `design-pipeline/author-llm.js`

Each section packet now receives:

```json
{
  "assetRegistry": {
    "images": [],
    "iconFamilies": [],
    "interactionComponents": []
  }
}
```

Only entries matching `pageId + slotId + componentId + viewportProfile` are injected.

## Viewport Handoff

The left page list's selected mode is now carried through the full local authoring path:

- requirements form/save payload
- local planning preview and saved concept plan
- builder execution payload
- concept package
- Design Author packet
- section-level asset registry resolver
- LLM prompt contract

The packet fields are:

- `viewportProfile`
- `viewportMode`
- `viewportLabel`
- `assetVariantPolicy`
- `viewportGuidance`

This makes PC/MO a first-class authoring constraint instead of a UI-only filter. The builder must treat `mo` and `pc` as separate design surfaces, even when they share the same pageId and slotId.

The LLM rules now explicitly state:

- approved images are preferred when role matches
- candidate images are not automatic final assets
- blocked images must not be used except as reference context
- icon-family slots should use approved family packages
- registered interactions should not be implemented as arbitrary inline JavaScript
- PC-approved assets do not imply MO approval, and MO-approved assets do not imply PC approval

## Approval Model

### candidate

Collected or generated, but not safe for final builder use.

Required before promotion:

- source checked
- license or rights profile recorded
- role classified
- text/trademark/people/property risk checked
- runtime fit checked

### approved

Can be exposed to Design Author as a reusable asset card.

### blocked

Can be exposed as a warning/reference card, but must not be used as a final visual.

### retired

Kept for audit but hidden from new authoring choices.

## Next Implementation Step

Completed in this checkpoint:

- Registry-backed diagnostics were added to `author-validation`.
- Candidate or blocked image registry assets now block runtime delivery if used in authored HTML.
- Registry image variant viewport mismatch now blocks runtime delivery.
- Candidate interaction components now block runtime delivery if selected as final runtime behavior.
- `/api/workspace/asset-registry-cards` exposes current PC/MO section cards for the admin.
- `/admin` now shows a read-only asset registry panel for the selected page and viewport.
- `/api/workspace/asset-registry-status` can promote or block image variants and interaction components with review notes.
- The admin asset registry panel now exposes approve/block actions for candidate image variants and interaction components.
- `carousel.snap.basic-v1` now has a runtime adapter at `web/interaction-components/carousel.snap.basic-v1.js` and is approved in the interaction registry.
- `tabs.switch.basic-v1` now has a runtime adapter at `web/interaction-components/tabs.switch.basic-v1.js` and is approved in the interaction registry.
- `accordion.disclosure.basic-v1` now has a runtime adapter at `web/interaction-components/accordion.disclosure.basic-v1.js` and is approved in the interaction registry.
- `modal.dialog.basic-v1` now has a runtime adapter at `web/interaction-components/modal.dialog.basic-v1.js` and is approved in the interaction registry.
- `tooltip.popover.basic-v1` now has a runtime adapter at `web/interaction-components/tooltip.popover.basic-v1.js` and is approved in the interaction registry.
- `compare.slider.basic-v1` now has a runtime adapter at `web/interaction-components/compare.slider.basic-v1.js` and is approved in the interaction registry.
- `segmented.control.basic-v1` now has a runtime adapter at `web/interaction-components/segmented.control.basic-v1.js` and is approved in the interaction registry.
- `/runtime-draft/:draftBuildId` now injects a small registry-backed interaction loader for `after` HTML only:
  - scans `data-registry-interaction-id` / `data-interaction-id`
  - loads only approved modules under `/interaction-components/`
  - leaves `before` clone HTML untouched for compare parity
- LGE image candidate review script was added at `scripts/review-lge-asset-candidates.js`.
- Latest automated review report is stored at `data/normalized/lge-asset-review-queue.json`.
- The first automated review applied a narrow promotion/block pass:
  - `4` PC `home.hero` LGE-derived `background-only` 1760x500 assets promoted to `approved`
  - `8` embedded-copy/logo/small-label assets moved to `blocked`
  - `40` candidate variants left for manual review
- Image registry distribution after this pass:
  - root assets: `approved 5`, `candidate 38`, `blocked 247`
  - variants: `approved 5`, `candidate 40`, `blocked 248`
- Asset registry card resolution now sorts cards by status before slicing:
  - `approved` first
  - then `candidate`
  - then `blocked`
  - then `retired`
- This prevents approved hero assets from being pushed out of the LLM/admin packet by older blocked or candidate entries.
- Mobile source asset collection now reads the captured origin HTML:
  - script: `scripts/capture-lge-mobile-reference-assets.js`
  - source: `data/raw/reference-live/*.mobile.html`
  - report: `data/normalized/lge-mobile-reference-assets.json`
  - latest extraction: `499` mobile-reference URLs, `414` downloaded assets, `85` failed downloads
- `scripts/import-lge-assets-to-registry.js` now also reads the mobile extraction report.
- Import guardrails added for the mobile pass:
  - `gnb` assets are excluded before `banner` classification
  - source filenames that clearly indicate `pc` / `1760x` / `1380x` stay in the `pc` variant even if seen in mobile HTML
  - existing `approved` and `blocked` variant decisions are preserved across repeated imports
- External/free image source profiles were added at `data/normalized/external-free-image-source-profiles.json`.
- Wikimedia Commons collection script was added at `scripts/collect-external-free-image-assets.js`.
- External/free import now has `23` `external-stock` image candidates:
  - `46` viewport variants total (`pc` and `mo`)
  - all remain `candidate`
  - source URL, page URL, license profile, license URL, checked timestamp, and attribution metadata are recorded
  - source profiles were expanded beyond home living into wide home interiors, kitchen/refrigerator stages, TV/media stages, laundry/utility, and support/care surfaces
  - the collector now supports `max-per-profile`, duplicate source URL skipping, lower `thumb-width`, and `delay-ms` to avoid one profile dominating the import and to reduce Wikimedia rate limits
  - latest report: `data/normalized/external-free-image-asset-collection-report.json`
- External stock review workflow was added:
  - review pack script: `scripts/build-external-stock-review-pack.js`
  - metadata backfill script: `scripts/backfill-external-stock-metadata.js`
  - decision apply script: `scripts/apply-external-stock-review-decisions.js`
  - review pack: `docs/snapshots/2026-04-24-external-stock-review/index.html`
  - browser route: `/review-packs/2026-04-24-external-stock-review/`
  - decisions are applied per `assetId + viewportProfile`; approving `pc` does not approve `mo`
  - `review-decisions.template.json` starts with `pending` decisions only, so it is safe to dry-run before applying
  - conservative review pass applied `44` decisions from `review-decisions.json`
  - external-stock variants after review: `10` approved, `36` blocked, `0` candidate
  - approved external variants are object-only living/kitchen/laundry interiors; weak historical/document/exterior/person/reference-page assets were blocked
- Icon and interaction diversity expansion was added:
  - seed script: `scripts/seed-diverse-icon-interaction-assets.js`
  - icon registry now has `13` approved icon families with `107` generated SVG members
  - generated icon packages are also registered in `data/normalized/generated-asset-families.json`
  - starter family usage is mapped in `data/normalized/asset-pipeline-starter.json`
  - interaction registry now has `9` components: `9` approved, `0` candidate
  - approved adapters include:
    - `drawer.filter.basic-v1` at `web/interaction-components/drawer.filter.basic-v1.js`
    - `sticky.buybox.basic-v1` at `web/interaction-components/sticky.buybox.basic-v1.js`
    - `modal.dialog.basic-v1` at `web/interaction-components/modal.dialog.basic-v1.js`
    - `tooltip.popover.basic-v1` at `web/interaction-components/tooltip.popover.basic-v1.js`
    - `compare.slider.basic-v1` at `web/interaction-components/compare.slider.basic-v1.js`
    - `segmented.control.basic-v1` at `web/interaction-components/segmented.control.basic-v1.js`
  - additional icon families added for home quickmenu, home story cues, support status badges, PLP product signals, PDP benefit chips, care wellness categories, and mobile gesture controls
  - concrete page IDs were mapped, not only abstract `plp` / `pdp`, so category/PDP/support pages actually receive matching cards
  - scope matching now supports exact plus normalized alias matching, so editable slots such as `productGrid` can match registry scopes such as `product-grid`
- Design diversity profiles were added because asset count alone still makes outputs converge:
  - profile registry: `data/normalized/design-diversity-profiles.json`
  - sample registry: `data/normalized/design-diversity-sample-library.json`
  - resolver: `design-pipeline/design-diversity.js`
  - profiles describe style language, layout moves, typography moves, color moves, motion intent, asset fit, and avoid rules
  - samples provide compact visual direction cards (`designIntent`, `layoutSketch`, `htmlSketch`, `interactionCue`, `assetCue`) so the author can vary structure without copying a fixed template
  - `buildDesignAuthorInput` now attaches matching diversity profiles per section
  - `author-llm` now preserves `assetRegistry` and `designDiversityProfiles` when building section prompts
  - section prompts now instruct the author to pick one diversity profile, use attached reference samples only as non-verbatim inspiration, and make that layout language visible in the HTML
  - this fixes a previous bottleneck where `assetRegistry` existed in the author packet but was dropped before the section-level LLM prompt
- GNB image noise introduced by the first mobile import was removed from the registry.
- Current image registry distribution after mobile import, review, text-removed additions, and external/free expansion:
  - root assets: `approved 16`, `candidate 134`, `blocked 65`
  - variants: `approved 21`, `candidate 158`, `blocked 87`
  - viewport variants: `pc approved 16`, `pc candidate 38`, `pc blocked 56`, `mo approved 5`, `mo candidate 120`, `mo blocked 31`
- Current mobile cards are intentionally candidate-only:
  - `home / mo / hero`: `8` candidate images exposed in the admin/LLM packet
  - `home / mo / marketing-area`: `8` candidate images exposed
  - `care-solutions / mo / careBanner`: `8` candidate images exposed
  - no MO image has been promoted to `approved` yet because mobile safe-area review is still required
- Text-removal derivative workflow was added for blocked LGE assets:
  - queue script: `scripts/build-lge-text-removal-queue.js`
  - queue report: `data/normalized/lge-text-removal-queue.json`
  - review pack script: `scripts/build-lge-text-removal-review-pack.js`
  - review pack: `docs/snapshots/2026-04-24-lge-text-removal-review/index.html`
  - registration script: `scripts/register-lge-text-removed-assets.js`
  - registration report: `data/normalized/lge-text-removed-registration-report.json`
- The text-removal queue does not mutate original blocked assets.
- Text-removed output files must be written under `data/raw/assets/text-removed/`.
- `scripts/register-lge-text-removed-assets.js` registers only existing output files as new candidate derivative assets.
- Registered derivatives keep provenance:
  - `parentAssetId`
  - `parentVariantId`
  - `derivativeType: text-removed`
  - `processing: derived-from-lge / text-removed`
  - `status: candidate`
- Latest text-removal queue result after visual spot-check and first generation pass:
  - `14` direct text-removal candidates remaining
  - `5` heavy derivative candidates where promo message is central
  - `32` excluded variants
  - `2` output files already exist
  - excluded reasons: `23` local source missing, `9` small label/badge not worth inpainting
- Latest registration result:
  - `2` registered as candidate derivative assets
  - `17` skipped because output files do not exist yet
  - `0` failed
- First generated text-removed derivative assets:
  - `lge.home.hero.herobanner-mo-20260421-151809.c9065cc50b.text-removed.mo.v1`
  - `lge.care-solutions.hero.event-hero-banner-pc-20260409-172043.decf2e52c8.text-removed.pc.v1`
- One queued MO hero item was visually spot-checked and reclassified instead of regenerated:
  - `lge.home.hero.mo-home-main-herobanner-20260309-155028.1385d7798d`
  - moved from `blocked promo-complete` to `candidate object-only`
  - reason: local image had no visible embedded copy
- Final approval ownership:
  - human reviewer approval is required for `candidate -> approved`
  - automation can collect, classify, generate derivatives, and recommend review checks
  - automation must not silently promote text-removed or MO candidates to approved
- Admin approval UX was improved:
  - image registry cards now show thumbnails when a local `data/raw/assets/...` source is available
  - text-removed derivative cards show `derivativeType`, `parentAssetId`, and approval checklist
  - `/raw-assets/...` safely exposes nested raw asset files for admin previews, including `data/raw/assets/text-removed/...`
- Verified admin/API state:
  - `home / mo / hero` asset cards include the text-removed candidate
  - text-removed preview URL returns HTTP `200`
  - preview image dimensions are `780x780`
- LGE source collection is now considered consumed enough to move to derivative generation:
  - direct text-removal review pack contains `14` remaining work orders
  - heavy derivative review pack contains `5` work orders
  - contact sheets:
    - `docs/snapshots/2026-04-24-lge-text-removal-review/contact-sheets/direct-text-removal-candidates.jpg`
    - `docs/snapshots/2026-04-24-lge-text-removal-review/contact-sheets/heavy-derivative-candidates.jpg`

Next implementation step:

1. Continue generating remaining text-removed outputs from the review pack.
2. Add visual review evidence capture to the promotion workflow.
3. Promote selected text-removed and MO candidates only after viewport-safe crop and overlay review.
4. Review remaining PC/MO object/card/icon-like candidates and move true icon assets into the icon-family registry instead of approving them as generic images.
5. Implement the next adapters: `drawer.filter.basic-v1` and `sticky.buybox.basic-v1`.
