# Font Features Examples

Examples demonstrating OpenType and CSS font feature properties including `font-kerning` and `font-feature-settings`.

## Running Tests

To verify feature detection and fallback handling for unsupported browser features:

```bash
node tests/course/r56-t036.mjs
```

This runs Playwright checks verifying:
- Normal operation and control interactivity when font features are supported.
- Clear fallback notice and disabled controls when feature support is absent or stubbed.
- Absence of uncaught page errors across supported and unsupported paths.
