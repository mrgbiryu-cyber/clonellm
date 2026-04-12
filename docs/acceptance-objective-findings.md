# Acceptance Objective Findings

- note: visual acceptance is still manual. This report only separates structural mismatch from styling/shell mismatch.

## Home Lower

- `space-renewal`
  - mismatch: `6.43%`
  - live height: `616`
  - clone height: `633`
  - height delta: `17`
- `smart-life`
  - mismatch: `11.64%`
  - live height: `558`
  - clone height: `559`
  - height delta: `1`
- `subscription`
  - mismatch: `7.71%`
  - live height: `768`
  - clone height: `769`
  - height delta: `1`
- `summary-banner-2`
  - mismatch: `7.32%`
  - live height: `192`
  - clone height: `192`
  - height delta: `0`

## Interpretation

1. `space-renewal`
   - structure mismatch is still real
   - clone section is taller than live, so this should be treated as a layout/height fix first
2. `smart-life`, `subscription`, `summary-banner-2`
   - structure height is already near-equal
   - remaining diff is more likely caused by visual styling, spacing, image crop, or text rhythm

## PLP PC

- `category-tvs:pc`
  - mismatch: `30.37%`
  - representative count: `3`
  - representative rects/text match: `true`
- `category-refrigerators:pc`
  - mismatch: `21.54%`
  - representative count: `3`
  - representative rects/text match: `true`

## Interpretation

1. `category-tvs:pc` / `category-refrigerators:pc`
   - representative product metadata already matches
   - current high diff is more likely in page shell, banner, filter/sort block, spacing, or typography than in grid geometry

