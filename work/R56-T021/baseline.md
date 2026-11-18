# R56-T021 — Keyboard Accessibility Baseline

## Task Information

- Task ID: R56-T021
- Page: learn/values-units/calc.html
- Branch: student/e26b07f0535
- Test: tests/course/r56-t021.mjs

## Initial Page Inspection

The page `learn/values-units/calc.html` is an interactive CSS values and units demo illustrating the use of the `calc()` CSS function.
It links to `../styles.css` and `../playable.js`.

The page contains three keyboard-interactive controls:
1. CSS editor (`textarea.playable-css`)
2. HTML editor (`textarea.playable-html`)
3. Reset button (`input#reset`)

Because this page is an interactive live editor rather than a static demo, a skip-to-content link is not required.

## Target Control

The `#reset` anchor represents an `<input id="reset" type="button" value="Reset" />` element located in the `.playable-buttons` container.
Its teaching purpose is to reset the editable CSS and HTML back to the default code snippet:
- CSS:
  ```css
  .wrapper {
    width: 400px;
  }

  .box {
    width: calc(20% + 100px);
  }
  ```
- HTML:
  ```html
  <div class="wrapper">
    <div class="box">My width is calculated.</div>
  </div>
  ```

## Original Test Inputs

CSS editor test input:
```css
.box { background: rgb(255, 255, 0); width: 300px; }
```

HTML editor test input:
```html
<div class="box">Keyboard test</div>
```

## Expected Results

- Tab traversal reaches all relevant controls in logical DOM order: CSS editor → HTML editor → Reset button.
- Visible keyboard focus indicators are present on all three controls without suppression.
- No positive `tabindex` attributes are introduced (`tabindex <= 0`).
- Textarea input updates the live preview DOM and styles dynamically.
- Keyboard activation using the Space key on `#reset` restores both editor textareas and the preview.
- Keyboard activation using the Enter key on `#reset` restores both editor textareas and the preview.
- Initial and restored computed preview layout (at 1280 × 800 viewport):
  - `.box` width: 180px (`calc(20% + 100px)` inside 400px wrapper)
  - `.box` border: 5px solid rebeccapurple (`rgb(102, 51, 153)`)
  - `.box` background-color: lightblue (`rgb(173, 216, 230)`)
  - `.box` text: "My width is calculated."

## Baseline Observations

Manual and automated browser testing confirmed:
- Tab navigation traverses all three interactive controls in order.
- Each interactive element exhibits standard visible focus indicators (`:focus-visible` with outline/box-shadow).
- Space and Enter keys successfully trigger click events on `#reset`.
- Restoring via Reset returns both editors and the live rendered layout to the original demonstration state.
- No unexpected page errors or console exceptions occur.

No website source-code defect was established during baseline testing.

## Automated Test Results

All checks in `tests/course/r56-t021.mjs` passed cleanly.
The test verifies:
- Local HTTP server startup and page loading.
- Visibility of editors and Reset control.
- Verification that no positive `tabindex` is introduced.
- Initial preview content and computed layout.
- Sequential Tab navigation order.
- Visible keyboard focus on all controls.
- Live preview updates on textarea input.
- Space key activation of Reset.
- Enter key activation of Reset.
- Absence of unexpected page errors.

## Tool Versions

- Node.js: 24.16.0
- npm: 11.13.0
- Playwright: 1.63.0
- Python: 3.15.1
- Browser: Chromium (Playwright Headless)

## Conclusion

The existing page satisfies all keyboard accessibility and interaction requirements.
The contribution adds automated regression test coverage without manufacturing artificial defects.
