# Learn CSS Writing Modes

This directory contains examples demonstrating CSS writing modes, logical properties and values, inline and block directions, and directional text wrapping.

## Examples
- `float.html`: Demonstrates logical properties (`writing-mode: horizontal-tb;`, `inline-size: 200px;`, `float: inline-start;`, `margin-inline-end`, `margin-block-end`) with interactive playable controls.
- `block-inline.html`: Compares physical vs logical block/inline dimensions.
- `simple-vertical.html`: Demonstrates vertical writing modes.

## Automated Verification & Testing
To run the automated Playwright regression test suite for deterministic fixtures:

```bash
node tests/course/r56-t045.mjs
```

### Verified Checks:
- Fully deterministic layout and geometry across independent fresh browser contexts.
- Pinned viewport, font, and local asset fixtures (`big-star.png`).
- Verification of logical properties and values.
- `#reset` interaction restoring exact baseline geometry.
- Zero unexpected page errors.
