# Share Reference Analysis

## Scope

- Reference file 1: [ux-share-reference.html](/mnt/c/Users/mrgbi/lge-site-analysis/docs/share-reference/ux-share-reference.html)
- Reference file 2: [pdp-share-reference.html](/mnt/c/Users/mrgbi/lge-site-analysis/docs/share-reference/pdp-share-reference.html)
- Purpose: compare the external share artifact approach with the current `clone` / `clone-product` approach and identify what should be reused for server-side integration.

## What These Files Actually Are

Both files are not plain page exports. They are `share wrapper + captured page` artifacts.

- The outer document is a very small share shell.
- The actual page is embedded as `iframe srcdoc="..."`.
- The share shell only handles:
  - loading state
  - error state
  - full-screen iframe
  - watermark

This means the share artifact is designed as a client-facing output, not as a workspace runtime page.

## Important Observation

`ux-share-reference.html` is named like a home/share example, but its embedded page is a refrigerator PDP.

`pdp-share-reference.html` is another share wrapper and its embedded page is a WashTower PDP:

- title inside srcdoc:
  - `LG 트롬 AI 오브제컬렉션 워시타워 | WA2525GEZF | 워시타워 | 생활가전 | 가전 구독 | LG전자`

So the meaningful pattern is not “home vs PDP”. The meaningful pattern is:

- small wrapper outside
- high-fidelity captured page inside

## Structural Pattern

### 1. Outer Share Wrapper

Common traits in both files:

- full viewport layout
- no business logic beyond load/error/share affordance
- no admin/workspace/version UI
- no visible system metadata for the viewer

The outer layer is intentionally generic and disposable.

### 2. Inner Page Delivery

Common traits in both files:

- original page HTML is embedded directly in `srcdoc`
- `base href="https://www.lge.co.kr"` is preserved
- original inline CSS is preserved
- original asset URLs are preserved

This is much closer to a frozen presentation artifact than to a live editable clone.

## Difference From Our Current Clone Approach

Current system behavior:

- `/clone/*` and `/clone-product*` are runtime pages
- they resolve account workspace
- they can read pinned view versions
- they can render account-specific patches
- they contain system-oriented shell/runtime logic

Reference share behavior:

- no account/workspace concept exposed to the viewer
- no draft/version workflow visible
- no admin/runtime controls in the page
- final output feels like a presentation deliverable

In short:

- current `clone` = working preview system
- reference share files = final share artifact

## PDP Custom Designed Area

The most important finding in `pdp-share-reference.html` is the inserted custom block around:

- `최적의 플랜을 설계해 드릴게요`
- `complete-next-section`
- `purchase-option-btns`
- `card-price-display`

This section is almost certainly not a minor text edit. It is a custom-designed inserted interaction block.

### Why It Looks Custom

1. The naming is not native LG PDP naming.

- `complete-next-section`
- `purchase-option-btns`
- `purchase-opt-btn`
- `card-price-display`

These look like feature-local custom ids/classes, not existing captured PDP structure names.

2. It uses dense inline styling.

- custom border radius
- custom button chips
- custom card spacing
- custom icon circles
- custom colors

This is not a simple patch to existing PDP copy. It is a locally designed module.

3. It includes local interaction logic.

- `handlePurchaseOptBtn(this)`
- switching between `구매` / `LG 라이프케어 구독` / `직접선택`
- dynamic updates to:
  - CTA text
  - price text
  - benefit text
  - care timeline visibility

So this is an inserted UI module with both design and behavior.

## What This Means For Our Builder

The current Builder is strong at:

- slot source switching
- component patching
- text/style adjustment
- version save / view pin

The reference artifact shows a stronger pattern:

- insertion of a custom decision-support block inside PDP
- local interaction state inside the inserted block
- purpose-specific UX layer added on top of the standard product summary flow

That implies our next-generation Builder should not be limited to “patch existing text and styles only”.

It should eventually support:

1. section-level insertion into allowed zones
2. predefined custom block templates
3. local interaction presets
4. stronger share-export output that hides system/runtime chrome

## Recommended Integration Direction

### A. Keep `clone` As Internal Working Runtime

Do not turn the existing `clone` runtime into the external share artifact directly.

Keep it for:

- account-specific preview
- pinned version verification
- admin-driven inspection
- iterative design/build workflow

### B. Add A Separate Share Export Layer

Add a separate export mode that produces:

- minimal wrapper
- loading/error fallback
- watermark or share marker if needed
- pinned version snapshot embedded as a clean artifact

This should look closer to the reference files than to the current runtime clone.

### C. Add Insertable Template Blocks For PDP

The reference PDP suggests a high-value pattern:

- recommendation / plan / quote assistance block
- option toggle block
- visual product card with action button

This should become a supported Builder capability through:

- allowed insertion zones
- approved template blocks
- structured data inputs
- controlled inline behavior

## Practical Server-Side Takeaways

For server integration, the most reusable ideas are:

1. export a pinned version as a self-contained share artifact
2. separate “share shell” from “workspace runtime shell”
3. support embedded page snapshots with minimal outer chrome
4. add PDP-specific insertable blocks instead of only patching captured nodes

## Bottom Line

These reference files are useful not because they are a better runtime system, but because they demonstrate a better final-share format.

The key lesson is:

- our current system is good for working
- the reference approach is better for presenting

And the PDP reference shows one more important thing:

- high-value design change may require custom inserted modules, not only text/style patching
