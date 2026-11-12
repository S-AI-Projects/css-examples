
# Task R56-T003 — Baseline

## Page
`counter-style-demo/index.html`

## Initial observations
- The demo page loads successfully using a local HTTP server.
- The page displays 30 list items.
- The counter-style dropdown contains multiple counter-style options.
- The initial selected style is `cyclic`.
- The CSS code preview is visible.
- Selecting a different counter style updates the list class and CSS code preview.
- No source files were modified during baseline inspection.

## Failure scenario to test
The external decorative background image used by `.code` may fail to load.

## Expected behavior
- The CSS code remains readable when the background image fails.
- The counter-style dropdown continues to work.
- The list and code preview continue to update correctly.
