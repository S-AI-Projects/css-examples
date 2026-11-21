# Responsive Web Design (RWD) Examples

Examples demonstrating responsive layout techniques and typography using modern CSS features.

## Running Tests

To verify responsive layout behavior at 360x800 and 1280x800 without horizontal overflow:

```bash
node tests/course/r56-t032.mjs
```

This runs Playwright checks verifying:
- No unintended horizontal overflow at 360px and 1280px widths.
- Proper content hierarchy and responsive column stacking.
- Visibility of all primary elements across viewports.
- Absence of uncaught page errors.
