# R56-T002 Automated Test Results

## Command
`node tests/course/r56-t002.mjs`

## Environment
- Node.js: 24.19.0
- npm: 11.17.0
- Python: 3.15.2
- Playwright: 1.65.0
- Browser: Chromium

## Viewports tested
- 360 × 800
- 1280 × 800

## Expected results
- Main content and controls remain visible and within the viewport.
- No unintended page-level horizontal overflow.
- Content remains in the expected vertical order.
- Editing HTML updates the preview.
- Reset restores the original CSS, HTML, and preview.
- No unexpected browser page errors.

## Actual results
All assertions passed at both viewport sizes.
The test exited successfully and printed:
`All R56-T002 checks passed.`

## Screenshots
- `360x800.png`
- `1280x800.png`

## Source changes
No page-source changes were required because the baseline behavior already met the tested requirements.
