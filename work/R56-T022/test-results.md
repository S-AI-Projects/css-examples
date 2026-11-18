# R56-T022 — Automated Test Results

## Test Command
`node tests/course/r56-t022.mjs`

## Environment
- **Operating System:** macOS (Darwin arm64)
- **Node.js:** v24.16.0
- **npm:** 11.13.0
- **Playwright:** 1.63.0
- **Browser:** Chromium (Headless)
- **Python:** 3.15.1 (Local HTTP Server)

## Viewport Matrix & Actual Results

| Check / Assertion | Viewport 360 × 800 | Viewport 1280 × 800 | Status |
|---|---|---|---|
| Local HTTP Server Startup | Serves dynamically allocated port | Serves dynamically allocated port | PASS |
| List Item Count | Exactly 18 `<li>` elements rendered | Exactly 18 `<li>` elements rendered | PASS |
| Horizontal Overflow | `scrollWidth (360) <= clientWidth (360)` | `scrollWidth (1280) <= clientWidth (1280)` | PASS |
| Container Bounds | `<ul>` within bounds `[0, 360]` | `<ul>` within bounds `[0, 1280]` | PASS |
| Individual Elements Bounds | 0 / 18 `<li>` elements overflow | 0 / 18 `<li>` elements overflow | PASS |
| Logical Vertical Ordering | Top coordinates strictly monotonic | Top coordinates strictly monotonic | PASS |
| CSS Painting API Worklet | `CSS.paintWorklet` loads `boxbg.js` | `CSS.paintWorklet` loads `boxbg.js` | PASS |
| Paint Properties | `paint(boxbg)` & `--boxColor` active | `paint(boxbg)` & `--boxColor` active | PASS |
| Static Demo Integrity | 0 unexpected interactive controls | 0 unexpected interactive controls | PASS |
| Full-Page Screenshots | Saved: `baseline-360x800.png`, `after-360x800.png` | Saved: `baseline-1280x800.png`, `after-1280x800.png` | PASS |
| Page Error Check | 0 unhandled console/page errors | 0 unhandled console/page errors | PASS |

## Final Output
```
PASS: local server started.
PASS: 18 items rendered at 360x800.
PASS: no page-level horizontal overflow at 360x800.
PASS: main content container is within viewport bounds at 360x800.
PASS: all 18 list elements remain within viewport at 360x800.
PASS: content maintains logical vertical order at 360x800.
PASS: CSS Painting API properties verified at 360x800.
PASS: static demo confirmed (0 interactive controls) at 360x800.
PASS: screenshots saved for 360x800.
PASS: no unexpected page errors at 360x800.
PASS: 18 items rendered at 1280x800.
PASS: no page-level horizontal overflow at 1280x800.
PASS: main content container is within viewport bounds at 1280x800.
PASS: all 18 list elements remain within viewport at 1280x800.
PASS: content maintains logical vertical order at 1280x800.
PASS: CSS Painting API properties verified at 1280x800.
PASS: static demo confirmed (0 interactive controls) at 1280x800.
PASS: screenshots saved for 1280x800.
PASS: no unexpected page errors at 1280x800.

All R56-T022 checks passed.
```

## Conclusion
The automated responsive layout regression test passed all criteria across both mobile (360 × 800) and desktop (1280 × 800) viewports with exit code 0.
