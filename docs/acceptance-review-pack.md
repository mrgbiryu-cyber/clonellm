# Acceptance Review Pack

- generatedAt: `2026-04-12T04:49:17.214Z`
- workspaceUser: `testuser1`
- baseUrl: `http://localhost:3000`

## Home Core

- bundleId: `home-core`
- pageId: `home`
- status: `pass`
- note: auto verification
- compare: `http://localhost:3000/compare/home`

### Compare Entry

- Use the page compare and acceptance bundle in `/admin`.

## Home Lower Primary

- bundleId: `home-lower-primary`
- pageId: `home`
- status: `pending`
- note: manual review: space-renewal has reference-artifact caveat; smart-life/subscription are acceptance-ready
- compare: `http://localhost:3000/compare/home`
- review-note: bundle is ready for manual acceptance review
- review-note: space-renewal requires artifact caveat when judging screenshot diff

### Section Artifacts

- `space-renewal`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/space-renewal/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/space-renewal/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/space-renewal/metadata.json`
  note: geometry is aligned to live mixed-card layout
  note: background/context alignment reduced latest mismatch back to acceptance-range
  note: final step is manual visual acceptance, not another structural rewrite
- `subscription`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/subscription/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/subscription/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/subscription/metadata.json`
  note: stable baseline is preferred over forced image injection
  note: structure is acceptance-ready; review visually
- `brand-showroom`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/brand-showroom/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/brand-showroom/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/brand-showroom/metadata.json`
- `latest-product-news`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/latest-product-news/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/latest-product-news/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/latest-product-news/metadata.json`
- `smart-life`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/smart-life/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/smart-life/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/smart-life/metadata.json`
  note: current live story card data is synced
  note: remaining diff is minor visual tuning territory; acceptance-ready

## Home Lower Secondary

- bundleId: `home-lower-secondary`
- pageId: `home`
- status: `unreviewed`
- compare: `http://localhost:3000/compare/home`
- review-note: summary-banner-2 is acceptance-ready
- review-note: focus on visual continuity across lower banners/guides

### Section Artifacts

- `summary-banner-2`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/summary-banner-2/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/summary-banner-2/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/summary-banner-2/metadata.json`
  note: structure is acceptance-ready
  note: remaining review is visual only
- `missed-benefits`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/missed-benefits/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/missed-benefits/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/missed-benefits/metadata.json`
- `lg-best-care`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/lg-best-care/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/lg-best-care/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/lg-best-care/metadata.json`
- `bestshop-guide`
  live: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/bestshop-guide/live-reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/bestshop-guide/working.png`
  metadata: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/home-lower/bestshop-guide/metadata.json`

## Support PC/MO

- bundleId: `support-pcmo`
- pageId: `support`
- status: `unreviewed`
- compare: `http://localhost:3000/compare/support`

### Page Artifacts

- `pc`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/support/pc/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/support/pc/working.png`
- `mo`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/support/mo/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/support/mo/working.png`

## Bestshop PC/MO

- bundleId: `bestshop-pcmo`
- pageId: `bestshop`
- status: `unreviewed`
- compare: `http://localhost:3000/compare/bestshop`

### Page Artifacts

- `pc`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/bestshop/pc/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/bestshop/pc/working.png`
- `mo`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/bestshop/mo/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/bestshop/mo/working.png`

## Care Solutions PC/MO

- bundleId: `care-solutions-pcmo`
- pageId: `care-solutions`
- status: `unreviewed`
- compare: `http://localhost:3000/compare/care-solutions`
- review-note: duplicate header auto-check is resolved
- review-note: final review should focus on overall page compare only

### Page Artifacts

- `pc`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/care-solutions/pc/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/care-solutions/pc/working.png`
- `mo`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/care-solutions/mo/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/service-pages/care-solutions/mo/working.png`

## Category TVs PC/MO

- bundleId: `category-tvs-pcmo`
- pageId: `category-tvs`
- status: `unreviewed`
- compare: `http://localhost:3000/compare/category-tvs`
- review-note: PLP shell/filter/sort alignment is largely closed
- review-note: final review should focus on page-level visual acceptance

### Page Artifacts

- `pc`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/plp/category-tvs/pc/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/plp/category-tvs/pc/working.png`
- `mo`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/plp/category-tvs/mo/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/plp/category-tvs/mo/working.png`

## Category Refrigerators PC/MO

- bundleId: `category-refrigerators-pcmo`
- pageId: `category-refrigerators`
- status: `unreviewed`
- compare: `http://localhost:3000/compare/category-refrigerators`
- review-note: PLP shell/filter/sort alignment is largely closed
- review-note: mobile still deserves a closer visual pass than PC

### Page Artifacts

- `pc`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/plp/category-refrigerators/pc/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/plp/category-refrigerators/pc/working.png`
- `mo`
  reference: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/plp/category-refrigerators/mo/reference.png`
  working: `/mnt/c/Users/mrgbi/lge-site-analysis/data/visual/plp/category-refrigerators/mo/working.png`

