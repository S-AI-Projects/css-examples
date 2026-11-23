# Multicol Basics Examples

This directory contains examples demonstrating CSS Multi-column Layout basics, column counting, column gaps, and column rules.

## Examples
- `column-count.html`: Interactive demonstration of `column-count: 3;` on multi-paragraph containers with live CSS editing and reset functionality.
- `column-gap.html`: Demonstrates column spacing.
- `column-rule.html`: Demonstrates border styling between columns.

## Automated Verification & Testing
To run the automated Playwright regression test suite for repeat initialization and DOM lifecycle stability:

```bash
node tests/course/r56-t044.mjs
```

### Verified Checks:
- Verified presence of source anchors `#code` and `#reset`.
- Idempotent script initialization (`initDemo()`) preventing duplicate event handlers.
- Multi-cycle interaction and reset verification.
- Preservation of DOM structure with zero duplicated containers or paragraphs.
- Zero unexpected page errors.
