# Asset Role Policy Rollout

Checkpoint:

- [Runtime Checkpoint (2026-04-22)](./admin-runtime-checkpoint-2026-04-22.md)

## Goal

Apply the asset-role guardrail system beyond `home.hero` / `home.quickmenu` so the same structural rules can be reused across the 15-page redesign surface.

## Canonical Rule

The system should not treat all image assets as interchangeable.

Each section must receive an asset usage policy that tells the author and validator:

- whether the section uses a full-bleed background, an icon family, card media, or no required image
- which asset roles are allowed in that mode
- whether promo-complete re-overlay is forbidden

## Central Policy Source

File:

- `data/normalized/asset-role-policies.json`

Runtime resolver:

- `design-pipeline/asset-role-policy.js`

## Current Coverage

### Stage / Hero-like sections

Policy:

- `stage-hero`

Covered slots:

- `hero`
- `service-intro`
- `visual`

Rules:

- full-bleed image must be `background-only`
- `object-only` can appear only as accent/logo/badge usage
- `promo-complete` re-overlay is blocked

### Quickmenu / tabs / shortcut entry families

Policy:

- `quickmenu-icon-family`

Covered slots:

- `quickmenu`
- `quickMenu`
- `tabs`
- `shortcut`

Rules:

- primary imagery must be `icon-only`
- promo thumbnails cannot be reused as icons
- generated family consistency is expected

### Banner stages

Policy:

- `banner-stage`

Covered slots:

- `summary-banner-2`
- `tipsBanner`
- `brandBanner`
- `careBanner`
- `labelBanner`
- `banner`
- `noticeBanner`

Rules:

- full-bleed banner background must be `background-only`
- `promo-complete` re-overlay is blocked

### Commerce grids

Policy:

- `commerce-grid`

Covered slots:

- `md-choice`
- `timedeal`
- `subscription`
- `space-renewal`
- `latest-product-news`
- `brand-showroom`
- `marketing-area`
- `bestProduct`
- `best-ranking`
- `ranking`

Rules:

- card media can be `background-only`, `object-only`, or `reference-only`
- promo-complete reuse is not globally blocked here because some commerce cards may legitimately be complete promo surfaces

### Benefit / service support hubs

Policy:

- `benefit-hub`

Covered slots:

- `benefit`
- `benefit-highlight`
- `mainService`
- `bestcare`
- `service-benefit`

Rules:

- visual treatment should be `icon-only` or `object-only`
- promo-complete reuse is blocked

### PDP summary / sticky

Policies:

- `pdp-summary-stage`
- `pdp-sticky-buybox`

Covered slots:

- `summary`
- `sticky`

Rules:

- summary stage uses `background-only` for full-bleed imagery
- sticky buybox should avoid decorative imagery unless explicitly needed

## Wired Systems

### Author input

File:

- `design-pipeline/author-input.js`

Now each section packet includes:

- `assetUsagePolicy`

### Author prompt

File:

- `design-pipeline/author-llm.js`

The author now receives policy-derived rules, for example:

- full-bleed backgrounds must use `background-only`
- icon-family sections must use `icon-only`

### Validation

File:

- `design-pipeline/author-validation.js`

Current enforcement:

- `promo-complete` re-overlay blocking where policy requires it
- full-bleed background asset role mismatch blocking
- quickmenu icon-family mismatch blocking

## Verified Result

The latest `home` build no longer uses `hero-image-1` (small label/object asset) as a full-bleed hero background.

Instead:

- `hero-image-2` is used as the stage background
- `hero-image-1` is used only as a small accent/logo image

This confirms the policy is affecting live author output, not just metadata.

## Remaining Gaps

### Asset-role classification still heuristic

We now use source URL + alt text to distinguish:

- `background-only`
- `object-only`
- `promo-complete`
- `icon-only`

This is better than slot-name-only classification, but still heuristic.

Next step:

- persist richer per-asset spec metadata for more sections

### Commerce card policy is intentionally softer

We do not yet hard-block promo-complete use in commerce grids, because some product/promo cards may legitimately be complete.

Next step:

- separate “card is complete promo surface” vs “promo art reused as background”

### More pages need real generated families

Quickmenu now has a generated icon family.

Equivalent generated/restricted families may still be needed for:

- service tabs / shortcut rows
- benefit hubs
- PDP support icons

## Rollout Principle

The system should expand by archetype, not by one-off page patch.

The asset-role policy layer should remain:

- centralized
- page-aware
- slot-aware
- reusable across all redesign pages
