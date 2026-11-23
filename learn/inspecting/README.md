# Learn Inspecting CSS Examples

This directory contains examples for inspecting the CSS Box Model, differences between standard and alternative box models (`box-sizing`), and element sizing.

## Examples
- `inspecting.html`: Demonstrates box model calculation differences between `content-box` (standard) and `border-box` (alternative), accessible skip navigation, and reduced-motion preferences.

## Automated Verification & Testing
To run the automated Playwright regression test suite for motion and focus preferences:

```bash
node tests/course/r56-t047.mjs
```

### Verified Checks:
- Verified behavior under `prefers-reduced-motion: reduce`.
- Keyboard focus accessibility and visible outline indicators on `#content` / skip-links at both 360px and 1280px viewport widths.
- Preserved box model inspection metrics (`content-box` vs `border-box`).
- Zero unexpected page errors.
