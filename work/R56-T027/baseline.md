# R56-T027 Baseline & Investigation Report

## Page Under Test
- **Path:** `grid/subgrid/gap.html`
- **Source Anchors:** `#reset`
- **Demonstrated Feature:** CSS Subgrid inheriting row and column gaps from parent grid container.

## Baseline Analysis
- The existing page features interactive textareas for HTML and CSS editing of the subgrid demo.
- Prior to this task, the page did not provide an isolated companion component demonstrating safe text rendering for dynamic fixture or user input without invoking HTML parsing.

## Resolution
- Added an isolated companion section `.text-companion` with `#safe-text-input` and `.safe-text-preview` using safe `textContent` assignment.
- Authored Playwright test suite `tests/course/r56-t027.mjs` injecting HTML-like payloads (`<img src=x onerror=...>`) and strictly verifying:
  1. The string is rendered verbatim as a safe text node.
  2. No injected DOM elements are created (`locator('img').count() === 0`).
  3. No inline or handler scripts execute (`window.__xssTriggered === undefined`).
  4. The primary subgrid layout and reset controls remain unaffected.
