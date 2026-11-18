# R56-T030 Baseline & Investigation Report

## Page Under Test
- **Path:** `grid/subgrid/gap.html`
- **Source Anchors:** `#reset`
- **Demonstrated Feature:** CSS Subgrid gap inheritance tested under strict deterministic browser fixtures.

## Baseline Analysis
- Browser automation tests can be prone to flakiness if external font/resource requests, unpinned viewports, variable clocks, or asynchronous network calls alter rendering order across runs.
- The subgrid example is a self-contained static demo whose test harness must guarantee repeatable, deterministic assertions.

## Resolution
- Authored Playwright test suite `tests/course/r56-t030.mjs` establishing deterministic testing fixtures:
  1. Locked viewport (1280×800, deviceScaleFactor 1, UTC timezone, en-US locale).
  2. Network routing policy blocking external requests and isolating test runs from public internet dependencies.
  3. Execution across two completely fresh, independent browser contexts.
  4. Deep-equality assertions verifying that rendered DOM HTML, computed grid styles, and element counts are bit-for-bit identical between Context 1 and Context 2.
