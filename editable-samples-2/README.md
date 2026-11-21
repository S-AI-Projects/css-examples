# Editable Samples 2

Interactive CSS examples with editable code blocks and live preview rendering.

## Running Tests

To verify keyboard interaction and accessibility for the editable sample controls:

```bash
node tests/course/r56-t031.mjs
```

This starts a local test server and runs Playwright browser checks verifying:
- Tab navigation through `.example-choice` items (`tabindex="0"`, no positive tabindex).
- Keyboard activation with `Enter` and `Space`.
- Visible focus outline styles.
- Reset button keyboard operation.
- Absence of uncaught page errors.
