# Cascade Examples

Examples demonstrating the CSS cascade, specificity, and inheritance.

## Running Tests

To verify repeat initialization and idempotency in `learn/cascade/all.html`:

```bash
node tests/course/r56-t034.mjs
```

This runs Playwright checks verifying:
- Deduplication of generated DOM nodes during repeated initialization.
- Idempotent repeated interaction via the Reset button.
- Clean process and listener cleanup.
- Absence of uncaught page errors.
