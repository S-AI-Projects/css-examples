# Shapes Overview Examples

This directory contains introductory examples demonstrating CSS Shapes concepts, including box values, circle, clip-path, and threshold features.

## Examples
- `box.html`: Demonstrates `shape-outside: border-box;` and interactive live CSS/HTML editing.
- `circle.html`: Demonstrates `shape-outside: circle();`.
- `clip-path.html`: Demonstrates polygon clipping and shape interactions.

## Automated Verification & Testing
To run the automated Playwright regression test suite for keyboard accessibility and reset behavior:

```bash
node tests/course/r56-t041.mjs
```

### Verified Checks:
- Tab order traversal across playable CSS, `#code` HTML, and `#reset` controls.
- Explicit high-contrast `:focus-visible` outline indicators on interactive elements.
- Keyboard activation of the Reset control (`Enter` / `Space`).
- Strict absence of positive `tabindex` attributes.
