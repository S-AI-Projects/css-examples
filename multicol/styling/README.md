# Multi-column Styling Examples

Examples demonstrating CSS Multi-column layout properties, including `column-gap` and `column-rule`.

## Running Tests

To verify safe text rendering and injection prevention in `column-gap.html`:

```bash
node tests/course/r56-t038.mjs
```

This runs Playwright checks verifying:
- Safe rendering of untrusted text payloads using `textContent` without element injection or script execution.
- Maintenance of the explicit separate rich HTML contract for the primary code editor.
- Complete reset behavior restoring initial states.
- Absence of uncaught page errors.
