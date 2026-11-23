# Editable Samples CSS

This module supplies shared CSS styles and CodeMirror integration themes for the interactive editable code examples across MDN CSS documentation.

## Entry Points
- `editable-samples/pages/font/index.html`: Interactive font shorthand editor featuring live CSS preview and reset functionality.

## Automated Verification & Walkthrough
To run the documented walkthrough verification test:

```bash
node tests/course/r56-t046.mjs
```

### Walkthrough Steps Verified:
1. Navigation to `editable-samples/pages/font/index.html`.
2. Verification of DOM anchors `#editor`, `#reset`, `#editor-content`, and `#output`.
3. Initial state observation: `#reset` has `.hidden` class and font is initial cursive.
4. User interaction: CodeMirror text replaced with `font: bold 2em sans-serif;`.
5. Post-interaction observation: `#reset` becomes visible, output updates font style.
6. Reset action: `#reset` clicked, font restored, `#reset` hidden.
7. Walkthrough screenshot captured at `work/R56-T046/walkthrough.png`.
8. Zero unexpected page errors.
