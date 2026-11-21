# Tools: Color Mixer

Utility for testing and exploring CSS `color-mix()` combinations.

## Running Tests

To verify repeat initialization and DOM lifecycle boundaries:

```bash
node tests/course/r56-t014.mjs
```

### Verified Behaviors
- Source anchors `#color-mixer`, `#color-one`, `#mixed-color`, and `#color-two` remain intact.
- Re-invoking `init()` cleanly dismantles previous Pickr instances and does not duplicate `.pcr-app` elements.
- Event listeners are attached once without stacking duplicate handlers on input controls.
- Interactive adjustments and live `color-mix()` generation function reliably across repeated calls.
