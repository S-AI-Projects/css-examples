# Flexbox Ratios Examples

Examples demonstrating CSS flexible box sizing ratios using `flex-grow`, `flex-shrink`, and `flex-basis`.

## Running Tests

To verify deterministic browser rendering across independent browser contexts:

```bash
node tests/course/r56-t035.mjs
```

This runs Playwright checks verifying:
- Locked viewport and offline network routing with zero external API dependencies.
- Identical computed DOM state and layout metrics across multiple fresh browser contexts.
- Correct flex grow/shrink ratio application.
- Absence of uncaught page errors.
