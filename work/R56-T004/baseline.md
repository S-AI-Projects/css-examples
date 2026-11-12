# R56-T004 Baseline Report

## Target
`editable-samples/pages/font/index.html`

## Environment
- Browser: Chromium
- Local server: Python HTTP server
- Page: `/editable-samples/pages/font/index.html`

## Initial behavior observed
- CodeMirror editor loads successfully.
- Initial CSS is displayed in the editor.
- Reset button is initially hidden.
- Example text appears in the output area.
- Initial font styling is applied correctly.

## Interaction tested
Changed the editor CSS to:

```css
font: bold 2em sans-serif;
```

## Actual result
- Example text updates with the new font styling.
- Reset button becomes visible.
- No visible errors or unexpected behavior observed.

## Conclusion
The original example works correctly during normal use. No source-code defect was identified during the baseline check. A regression test will be added to check repeated interactions and prevent duplicate editor initialization or unintended DOM changes.