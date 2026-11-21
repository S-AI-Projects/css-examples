# Box Alignment: Overview Examples

Interactive examples demonstrating CSS Box Alignment properties, including grid and flex gap.

## Running Tests

To verify empty-state fallback handling and recovery in `grid-gap.html`:

```bash
node tests/course/r56-t033.mjs
```

This runs Playwright checks verifying:
- Correct initial rendering of 6 grid items.
- Empty-state fallback presentation when HTML input is empty.
- Immediate recovery and preview re-render upon clicking Reset or entering valid HTML.
- Absence of uncaught page errors.
