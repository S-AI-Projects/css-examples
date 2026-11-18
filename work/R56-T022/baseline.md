# R56-T022 — Responsive Layout Baseline

## Task Information
- **Task ID:** R56-T022 (Task 2 of 10)
- **GitHub Issue:** #22
- **Page:** `houdini/css_painting_api/example-boxbg.html`
- **Branch:** `student/e26b07f0535`
- **Test:** `tests/course/r56-t022.mjs`

## Viewports Inspected
- **Mobile:** 360 × 800
- **Desktop:** 1280 × 800

## Initial Page Inspection
The page `houdini/css_painting_api/example-boxbg.html` is a CSS Houdini demonstration of the **CSS Painting API**.
It loads a paint worklet module `boxbg.js` via `CSS.paintWorklet.addModule("boxbg.js")`, which defines a custom painter named `boxbg`.
The CSS sets `background-image: paint(boxbg)` on `li` elements, alongside custom properties `--boxColor` and `--widthSubtractor`.

### Structure & Content
- Main content container: `<ul>` containing 18 `<li>` elements (`item 1` through `item 17`, and `item`).
- Viewport tag: `<meta name="viewport" content="width=device-width" />` is correctly configured.
- Interactive controls: None (this is a static visual rendering demo of paint worklets).

## Baseline Observations
1. **Horizontal Overflow:**
   - At 360 × 800: `scrollWidth = 360px`, `clientWidth = 360px`. No page-level horizontal overflow occurs.
   - At 1280 × 800: `scrollWidth = 1280px`, `clientWidth = 1280px`. No page-level horizontal overflow occurs.
2. **Element Boundaries:**
   - All 18 `<li>` items and the enclosing `<ul>` reside completely within the viewport bounds at both 360px and 1280px widths.
3. **Content Visibility & Ordering:**
   - All 18 list items are rendered and visible.
   - Items maintain monotonic vertical top-to-bottom layout order without overlapping.
4. **CSS Painting API:**
   - `CSS.paintWorklet` is supported in Chromium.
   - `boxbg.js` registers and paints the dynamic box background correctly.
5. **Errors:**
   - Zero JavaScript runtime errors, failed resource requests, or uncaught exceptions.

## Source Changes
No website source-code modifications were required for `houdini/css_painting_api/example-boxbg.html` or `boxbg.js`.
In accordance with coursework instructions ("If the page is already correct, do not manufacture a defect. Contribute the regression test and precise documentation instead"), we contribute comprehensive automated regression test coverage and documentation.

## Tool Versions
- Node.js: v24.16.0
- npm: 11.13.0
- Playwright: 1.63.0
- Chromium: Chrome for Testing 153.0.8010.12
- Python: 3.15.1
