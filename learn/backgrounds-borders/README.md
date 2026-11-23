# Learn CSS Backgrounds and Borders

This directory contains examples and interactive editors exploring CSS backgrounds, borders, box styling, gradients, and blend modes.

## Examples
- `size.html`: Interactive demonstration of the `background-size` property (`background-size: 100px 10em;`) with fallback colors and reset functionality.
- `background-image.html`: Demonstrates basic and multiple background images.
- `borders.html`: Demonstrates border styles, widths, and radius.

## Automated Verification & Testing
To run the automated Playwright regression test suite for empty and error fallback handling:

```bash
node tests/course/r56-t043.mjs
```

### Verified Checks:
- Anchor `#reset` functionality and DOM stability.
- Fallback background color (`#e2e8f0`) display when external image asset fails to load.
- Seamless state recovery when `#reset` is triggered following an empty/corrupted CSS input.
- Zero unexpected console or page errors.
