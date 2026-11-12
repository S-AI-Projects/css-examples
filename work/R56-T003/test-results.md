
# R56-T003 — Test Results

## Environment

- Node.js: 24.19.0
- Python: 3.15.2
- Playwright: 1.65.0
- Chromium: 158.0.8127.18
- Browser: Chromium (headless)
- Local server: Python HTTP server
- Test command: `node tests/course/r56-t003.mjs`

## Test Inputs and Expected Results

| Test | Input / Action | Expected Result |
|---|---|---|
| Initial page | Open counter-style demo | 30 list items are displayed |
| Image failure | Simulate failure of decorative background image | Failed request is detected |
| Readable fallback | Inspect CSS code area after image failure | Code remains visible and readable |
| Style selection | Select `fixed` | List class and CSS code update |
| Image restoration | Restore image using test fixture | Image request succeeds |
| Recovery | Select `symbolic` after restoration | Demo continues to work |
| Browser errors | Monitor unexpected JavaScript errors | No unexpected errors |

## Actual Results

- PASS: Demo loads with 30 list items.
- PASS: Decorative background image failure simulated.
- PASS: CSS code remains readable after image failure.
- PASS: Dropdown updates list and CSS code.
- PASS: Background image restored successfully.
- PASS: Demo works after image restoration.
- PASS: No unexpected JavaScript errors.

## Summary

- Total checks: 7
- Passed: 7
- Failed: 0

## Evidence Files

- `baseline.md` — behavior before testing.
- `test-results.md` — test inputs, expected results, and actual results.
- `restored-demo.png` — screenshot after image restoration.

## Notes

This is a static CSS demonstration and does not use an API. The test simulates failure of its decorative background image and verifies that the teaching content remains usable.
