# Runtime And Visual Audit

Date: 2026-04-12

> Document status:
> This document is a dated runtime/visual audit snapshot.
> Findings here are useful as historical context, but they should not be treated as the latest live status without re-checking current code and runtime behavior.

## Scope

- server runtime routes
- clone metadata APIs
- visual asset reachability
- route/data consistency against current repository state

## Snapshot Summary

At the time of this audit, the runtime was not failing because of a broad image outage. The main problems observed were data coverage gaps and route/runtime inconsistency.

- `editable-prototype.json` currently contains only the `home` page.
- README and runtime summary code describe more pages than the live data actually provides.
- several clone-related APIs return `page_not_found` for pages that are presented as supported
- clone page rendering ignores section `visible` state
- image URLs sampled from the home clone content mostly resolve correctly through LG CDN redirects

## What Was Verified At That Time

### Server availability

- app listens on `0.0.0.0:3000`
- local and external HTTP access were both confirmed

### Data payload shape at audit time

File checked:

- `data/normalized/editable-prototype.json`

Observed state:

- `pages.length === 1`
- only page id present: `home`
- no slot registries
- no component patches

At that time, this meant the runtime data model was centered on a single-page prototype, not the broader route set described elsewhere in the repo.

### Clone API results

Checked endpoint:

- `/api/clone-page?id=<pageId>`

Observed:

- `home`: returns valid payload
- `support`: `page_not_found`
- `bestshop`: `page_not_found`
- `care-solutions`: `page_not_found`
- `category-tvs`: `page_not_found`
- `category-refrigerators`: `page_not_found`
- `lg-signature-info`: `page_not_found`
- `objet-collection-story`: `page_not_found`

### Clone content routes

Checked endpoint:

- `/clone-content/<pageId>`

Observed:

- `home`: returns clone content HTML
- `support`: returns HTML
- `bestshop`: returns HTML
- `care-solutions`: returns HTML
- `category-tvs`: returns `Clone not found`

This shows the metadata API and the clone-content rendering path are not aligned.

### Preview data

Checked endpoint:

- `/api/data`

Observed:

- `pageCount` returned was `1`
- `heroMapCount` returned was `1`
- preview grid therefore only renders the `home` card

### Image reachability

Checked:

- local asset URL from clone payload
- sampled external image URLs extracted from `/clone-content/home`

Observed:

- local asset `/assets/home__0e543daa3aa8__005.png`: `200 OK`
- sampled LG image URLs: mostly `302 -> 200`
- no broad pattern of `404` image failures was found in the sampled set

Conclusion at audit time:

- current evidence does not point to a large-scale broken-image problem
- current evidence points to route/data incompleteness as the primary issue

## Code Findings

### 1. Data coverage was narrower than the declared runtime scope

Relevant files:

- `data/normalized/editable-prototype.json`
- `server.js`

The repository README declares multiple core pages, info pages, PLP pages, and a PDP route. The actual editable data contains only `home`. Any API path that depends on `data.pages` will therefore fail for most page ids.

Impact:

- preview only shows one card
- clone metadata APIs fail for most documented pages
- admin/editor features tied to page data cannot operate on the missing pages

### 2. Runtime page summary overstated supported pages

Relevant function:

- `buildRuntimePageSummary()` in `server.js`

Issue:

- `corePages` are filtered by existing data
- `infoPageIds` and `plpPageIds` are still emitted into the route catalog without verifying they exist in `data.pages`

Impact:

- API consumers can infer support for routes that are not actually backed by current data
- documentation and runtime introspection drift apart

### 3. Clone page rendering ignored section visibility

Relevant file:

- `web/clone.html`

Issue:

- `page.sections` are rendered after sort without filtering on `visible`

Impact:

- editor toggles can diverge from the actual clone page output
- hidden sections may still appear in the clone UI

### 4. Clone content route support is inconsistent across page families

Relevant function:

- `sendCloneContent()` in `server.js`

Issue:

- some service page routes return content HTML
- some category routes return `Clone not found`

Impact:

- route support is partial and uneven
- category/PLP expectations are not met in the current runtime

## Practical Interpretation

If the immediate goal is to make the project look correct from the outside, the first fix is not visual polish. The first fix is to restore or rebuild the missing multi-page data layer so that runtime, preview, and clone metadata all reference the same page inventory.

Only after that should visual acceptance focus on:

- missing sections
- duplicated shells or headers
- card/gallery composition
- spacing and layout drift
- per-page image fidelity

## Recommended Fix Order

1. Restore `editable-prototype.json` to a multi-page state that matches the intended runtime scope.
2. Make `buildRuntimePageSummary()` emit only pages that actually exist in current data.
3. Make `web/clone.html` honor section `visible`.
4. Re-test `/api/data`, `/api/clone-page`, and `/clone-content/*` for all declared page ids.
5. Run browser-based visual regression checks after Playwright system dependencies are installed.

## Test Limitations

Browser rendering validation was attempted with Playwright, but Chromium could not launch in this environment because a system library was missing:

- `libnspr4.so`

Because of that, this audit is based on:

- API responses
- generated HTML inspection
- asset URL reachability checks

## Reference Paths

- `README.md`
- `server.js`
- `web/clone.html`
- `web/preview.html`
- `data/normalized/editable-prototype.json`
