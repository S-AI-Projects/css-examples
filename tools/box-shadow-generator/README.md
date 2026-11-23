# CSS Box-Shadow Generator Tool

This tool provides a graphical user interface for interactively generating complex CSS `box-shadow` rules, including inset shadows, multi-layer shadows, spread, blur, and offsets.

## Components & Pages
- `index.html`: Interactive box-shadow editor with dynamic layer manager and preview.
- `text-companion.html`: Isolated text-rendering companion example demonstrating safe fixture rendering using standard `.textContent`.

## Automated Verification & Testing
To run the automated Playwright regression test suite for safe text rendering:

```bash
node tests/course/r56-t048.mjs
```

### Verified Checks:
- Verified presence of source anchors `#container`, `#layer_manager`, `#stack_container`, and `#preview_zone`.
- Tested HTML payload injection (`<img src=x onerror=...>`) in dynamic layer creation and companion input.
- Ensured test strings appear strictly as plain text, create zero injected DOM elements, and execute zero event handlers.
- Zero unexpected page errors.
