# Flexbox: Wrapping

Demonstration of flexbox item wrapping and `gap` properties.

## Running Tests

To verify multi-line wrapping behavior and regression detection:

```bash
node tests/course/r56-t020.mjs
```

### Verified Behaviors
- Source anchors `#code` and `#reset` exist and operate correctly.
- Clean page verifies multi-row item wrapping (`item4.top > item1.top`) within the `500px` `.wrapper` container without horizontal overflow.
- A deliberate test mutation (`flex-wrap: nowrap`) is caught and rejected by the layout assertion, demonstrating sensitivity to wrapping regressions.
- The repository source files remain completely unmutated.
- Zero unexpected page or script errors.
