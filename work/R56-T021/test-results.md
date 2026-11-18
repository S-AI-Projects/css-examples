# R56-T021 — Automated Test Results

## Test Command

`node tests/course/r56-t021.mjs`

## Environment

- Operating System: macOS
- Node.js: 24.16.0
- npm: 11.13.0
- Playwright: 1.63.0
- Python: 3.15.1
- Browser: Playwright Chromium (Headless)
- Viewport: 1280 × 800

## Actual Results

| Test Check | Expected | Actual | Result |
|---|---|---|---|
| Local server startup | Server listens on available port | Server ready on 127.0.0.1 | PASS |
| Controls visibility | CSS, HTML editors and Reset visible | All 3 visible | PASS |
| Tabindex validation | No elements with tabindex > 0 | 0 elements with positive tabindex | PASS |
| Preview content & layout | Text: "My width is calculated.", width: 180px, border: 5px solid | Text: "My width is calculated.", width: 180px, border: 5px solid | PASS |
| Keyboard Tab order | CSS editor → HTML editor → Reset button | CSS editor → HTML editor → Reset button | PASS |
| Visible keyboard focus | `:focus-visible` with outline/box-shadow | Outline / focus ring visible on all 3 | PASS |
| Live preview update | Background turns yellow, width 300px, text updates | Preview reflects edits | PASS |
| Reset using Space | Editors & preview restored to original calc() state | Inputs and computed layout restored | PASS |
| Reset using Enter | Editors & preview restored to original calc() state | Inputs and computed layout restored | PASS |
| Page error check | 0 unexpected page errors | 0 errors | PASS |

## Final Output

```
PASS: local server started.
PASS: editors and Reset button are visible.
PASS: no positive tabindex introduced.
PASS: preview content and computed layout are correct.
PASS: Tab order is correct.
PASS: all three controls show visible keyboard focus.
PASS: editing updates the preview.
PASS: Space activates Reset.
PASS: Enter activates Reset.
PASS: no unexpected page errors.

All R56-T021 checks passed.
```

## Conclusion

The automated regression test executed with exit code 0. All 10 checks passed.
