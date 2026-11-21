# Editable Samples 2: Font Examples

Interactive font shorthand and typography demonstrations with live style rendering.

## Running Tests

To verify UI interaction regression detection and deliberate fixture mutation checks:

```bash
node tests/course/r56-t040.mjs
```

This runs Playwright checks verifying:
- Successful choice selection and style application on the unmutated page.
- Detection and failure confirmation under a deliberate temporary fixture mutation (broken event binding).
- Pristine final state of the application without persistent mutations.
- Absence of uncaught page errors.
