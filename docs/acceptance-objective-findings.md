# Acceptance Objective Findings

- note: visual acceptance is still manual. This report only separates structural mismatch from styling/shell mismatch.

## Home Lower

- `space-renewal`
  - mismatch: `5.66%`
  - live height: `616`
  - clone height: `633`
  - height delta: `17`
- `smart-life`
  - mismatch: `6.93%`
  - live height: `558`
  - clone height: `559`
  - height delta: `1`
- `subscription`
  - mismatch: `5.63%`
  - live height: `768`
  - clone height: `769`
  - height delta: `1`
- `summary-banner-2`
  - mismatch: `6.30%`
  - live height: `192`
  - clone height: `192`
  - height delta: `0`

## Interpretation

1. `space-renewal`
   - mixed-card geometry is aligned close to live
   - height delta is still `+17px`, but background/context alignment brought mismatch back into acceptance range
   - treat this as manual visual acceptance, not as an automatic layout-fix blocker
2. `smart-life`, `subscription`, `summary-banner-2`
   - structure height is already near-equal
   - remaining diff is more likely caused by visual styling, spacing, image crop, or text rhythm
   - these sections are acceptance-ready pending manual visual review

## PLP PC

- `category-tvs:pc`
  - mismatch: `4.66%`
  - representative count: `3`
  - representative rects/text match: `true`
- `category-refrigerators:pc`
  - mismatch: `5.09%`
  - representative count: `3`
  - representative rects/text match: `true`

## Interpretation

1. `category-tvs:pc` / `category-refrigerators:pc`
   - representative product metadata already matches
   - current high diff is more likely in page shell, banner, filter/sort block, spacing, or typography than in grid geometry

