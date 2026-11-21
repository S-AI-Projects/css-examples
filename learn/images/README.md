# Learn: Images and Forms

Examples demonstrating styling of forms and images.

## Running Tests

To verify the responsive layout at both mobile (360×800) and desktop (1280×800) viewports:

```bash
node tests/course/r56-t012.mjs
```

### Verified Behaviors
- Source anchors `#name`, `#email`, and `#reset` exist and display cleanly.
- No unintended horizontal overflow (`scrollWidth <= clientWidth`) at 360×800 or 1280×800.
- Controls remain fully unclipped and within viewport bounds.
- Content vertical ordering is preserved.
- Interactive controls and reset action operate without page errors.
