# Learn CSS Media Queries

This folder contains educational demonstrations and examples illustrating CSS media queries, responsive designs, orientation checks, and conditional stylesheets.

## Examples
- `or.html`: Demonstrates comma-separated media query list (`screen and (min-width: 600px), screen and (orientation: landscape)`).

## Automated Verification & Testing
To run the automated Playwright regression test suite for responsive layout and width checks:

```bash
node tests/course/r56-t042.mjs
```

### Verified Checks:
- Verified viewport at 360×800 (mobile portrait): zero horizontal overflow, default text color preserved.
- Verified viewport at 1280×800 (desktop landscape): zero horizontal overflow, blue color applied via media query.
- Content integrity and paragraph order preserved across viewports.
- Zero uncaught page errors.
