
# R56-T004 Test Results

## Target
`editable-samples/pages/font/index.html`

## Test File
`tests/course/r56-t004.mjs`

## Environment
- Node.js: 24.19.0
- npm: 11.17.0
- Python: 3.15.2
- Playwright: 1.65.0
- Browser: Chromium (Playwright)

## Test Command
```bash
node tests/course/r56-t004.mjs
```

## Test Results

| Test | Expected Result | Actual Result |
|---|---|---|
| Initial editor | One editor | PASS |
| Initial output | One output element | PASS |
| Initial font styling | Correct italic font | PASS |
| Repeated initialization | No duplicate editor | PASS |
| First edit | One output update | PASS |
| First reset | One output update and original style restored | PASS |
| Second edit | One output update | PASS |
| Second reset | One output update and original style restored | PASS |
| Browser errors | No unexpected errors | PASS |

## Issues Found and Fixed

1. Repeated initialization created a duplicate CodeMirror editor.
2. Reset triggered two output updates instead of one.

Both issues were fixed in `editable-samples/js/editable.js`.

## Final Result

All Task 4 automated checks passed.

## Evidence

- `baseline.md` — Original page behavior.
- `font-demo.png` — Screenshot of the working font example.
