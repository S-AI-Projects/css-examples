# Task R56-T023 — Baseline

## Task Information
- **Task ID:** R56-T023 (Task 3 of 10)
- **GitHub Issue:** #23
- **Page:** `learn/media-queries/or.html`
- **Branch:** `student-e26b07f0535-R56-T023`
- **Test:** `tests/course/r56-t023.mjs`

## Page Inspection
`learn/media-queries/or.html` illustrates the comma-separated (OR) CSS media query syntax:
```css
@media screen and (min-width: 600px), screen and (orientation: landscape) {
  body {
    color: blue;
  }
}
```
The main rendered content region consists of paragraphs documenting the Montgolfier brothers' paper balloon discovery.

## Baseline Observations
- Under portrait orientation with width < 600px (e.g., 500 × 800), the text renders with the default color (`rgb(0, 0, 0)`).
- When width reaches 600px or when orientation shifts to landscape (e.g., 500 × 350), the text turns blue (`rgb(0, 0, 255)`).
- The page is static and contains no external API dependencies.

## Failure & Recovery Scenario Tested
- **Failed Asset / Empty Result:** Simulated network failure on decorative/font assets via network request interception (`page.route`).
- **Fallback Verification:** Main content paragraphs remain completely visible and legible against the default background with zero uncaught errors.
- **Restoration / Recovery:** Serving a restored local SVG fixture restores full asset display without layout distortion or DOM degradation.
