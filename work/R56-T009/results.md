# R56-T009 — Test Results

## Target
- Example: `multicol/styling/column-gap.html`
- Test: `tests/course/r56-t009.mjs`
- Viewports: Desktop (1280px) and Mobile (375px)
- Browser: Playwright Chromium

## Test inputs and expected vs actual results

| Test | Input | Expected result | Actual result |
|---|---|---|---|
| Reduced motion | `prefers-reduced-motion: reduce` | Preference is active | PASS |
| Motion | Inspect animations and transitions | No animations or transitions | PASS |
| Initial layout | Original page | 3 columns, 40px gap | PASS |
| Keyboard focus | Tab through CSS editor, HTML editor and Reset | Visible keyboard focus | PASS |
| Desktop viewport | 1280px wide | All checks pass | PASS |
| Mobile viewport | 375px wide | All checks pass | PASS |
| CSS editing | 2 columns, 24px gap | Preview updates | PASS |
| HTML editing | Replace preview content | Preview updates | PASS |
| Reset | Click Reset | Original 3-column, 40px layout returns | PASS |
| JavaScript errors | Monitor page errors | No unexpected errors | PASS |

## Summary

All automated checks passed at both viewport sizes.

The existing example already has:
- No CSS animations or transitions.
- Visible keyboard focus indicators.
- A working static multicolumn layout.
- Working CSS and HTML editors.
- A working Reset control.

No source HTML or CSS changes were necessary.

## Screenshots

- `r56-t009-desktop.png`
- `r56-t009-mobile.png`
