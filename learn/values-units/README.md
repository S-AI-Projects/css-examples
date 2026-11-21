# Values and Units: calc()

Interactive demonstration of the CSS `calc()` functional notation.

## Running Tests

To verify keyboard focus styling, static layout stability, and reduced-motion adherence:

```bash
node tests/course/r56-t019.mjs
```

### Verified Behaviors
- Source anchor `#reset` exists and operates reliably.
- `:focus-visible` styling provides clear, high-contrast outlines for all interactive editors and buttons.
- Static layout accurately calculates `.box` width as `calc(20% + 100px) = 180px` inside a `400px` container.
- `prefers-reduced-motion: reduce` preference is respected with zero running animations.
- Live CSS editing dynamically updates calculations and `#reset` properly restores the original layout.
