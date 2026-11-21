# Flexbox Order Examples

Examples demonstrating the `order` property in CSS Flexible Box Layout and its accessibility implications.

## Running Tests

To verify reduced-motion compatibility and visible keyboard focus at multiple viewports:

```bash
node tests/course/r56-t039.mjs
```

This runs Playwright checks verifying:
- Full accessibility and usable controls with `prefers-reduced-motion: reduce` active.
- Visible keyboard focus styling across links, buttons, and inputs at both 360px and 1280px widths.
- Correct CSS order values preserving the demonstrated teaching purpose.
- Absence of uncaught page errors.
