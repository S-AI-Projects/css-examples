# R56-T001 — Keyboard Accessibility Baseline

## Task Information

- Task ID: R56-T001
- Page: learn/sizing/vw-vh.html
- Branch: student/e26b07f0643
- Test: tests/course/r56-t001.mjs

## Initial Page Inspection

The page contains three keyboard-interactive controls:

1. CSS textarea
2. HTML textarea
3. Reset button

The page is interactive. A skip-to-content link is not required for this task.

## Original Test Inputs

CSS editor test input:

.box {
  background: yellow;
}

HTML editor test input:

<div class="box">Keyboard test</div>

## Expected Results

- Tab order: CSS editor → HTML editor → Reset.
- All three controls display visible keyboard focus.
- Editing either textarea updates the preview.
- Pressing Space on Reset restores the original editors and preview.
- Pressing Enter on Reset restores the original editors and preview.
- Preview dimensions at 1280 × 800 viewport:
  - Width: 256px
  - Height: 160px
  - Border: 5px solid

## Baseline Observations

Manual browser testing confirmed:
- Correct Tab order.
- Visible focus indicators.
- Space activates Reset.
- Both editors and preview return to their original content.

No website source-code defect was established during baseline testing.

## Automated Test Results

All eight automated checks passed after correcting the test's focus-navigation logic.

The test verifies:
- Server startup and page loading.
- Visibility of controls.
- Initial preview content and layout.
- Keyboard traversal.
- Visible keyboard focus.
- Live preview updates.
- Space activation.
- Enter activation.

## Tool Versions

- Node.js: 24.19.0
- npm: 11.17.0
- Playwright: 1.65.0
- Python: 3.15.2

## Conclusion

The existing page passed the tested keyboard interaction checks.
The contribution adds automated regression coverage without inventing a website defect.
