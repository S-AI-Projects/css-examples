# Editable Samples

Interactive CSS editable code examples with live output previews.

## Running Regression Tests

To run the automated keyboard interaction and accessibility tests:

```bash
node tests/course/r56-t011.mjs
```

### Verified Behaviors
- Source anchors `#editor`, `#reset`, `#editor-content`, and `#output` exist and behave as specified.
- No elements with positive `tabindex` (`tabindex > 0`).
- Keyboard Tab navigation from CodeMirror editor to `#reset` button when visible.
- Visible focus indicator (`outline`) for interactive controls.
- Keyboard activation of `#reset` using Enter key, resetting styles and hiding the reset button.
- Clean execution with zero unhandled page errors.
