# R56-T028 Baseline & Investigation Report

## Page Under Test
- **Path:** `learn/box-model/block.html`
- **Source Anchors:** `#reset`
- **Demonstrated Feature:** CSS Box Model: Block layout vs. inline formatting.

## Baseline Analysis
- The example is a static interactive educational demo without animations or transitions.
- Evaluation of accessibility under user motion preferences confirms:
  1. `prefers-reduced-motion: reduce` emulation leaves all content, textareas, and controls fully functional without visual degradation.
  2. Keyboard focus indicators on `#reset` and interactive textareas remain distinct and visible across desktop (1280×800) and mobile (360×800) viewports.
  3. No invasive code modifications to the existing static layout were required since baseline accessibility conforms cleanly.

## Resolution
- Contributed precise automated regression test `tests/course/r56-t028.mjs` verifying reduced-motion queries, non-animated state assertions, visible keyboard focus indicators, interactive CSS manipulation, and reset integrity.
