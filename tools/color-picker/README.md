# Tools: Color Picker

Interactive color palette generator and color picker tool.

## Running Tests

To verify empty state rendering and asset failure fallback:

```bash
node tests/course/r56-t013.mjs
```

### Verified Behaviors
- Source anchors `#container`, `#palette`, `#color-palette`, and `#color-info` exist and render properly.
- Empty state indicator `#color-palette:empty::before` provides readable user guidance when no palettes exist.
- Missing background asset (404) does not disrupt layout geometry or crash runtime scripts.
- No unexpected console or page errors.
