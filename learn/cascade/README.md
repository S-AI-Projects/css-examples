# Learn: Cascade Examples

Examples demonstrating CSS cascade and `all` property behavior.

## Running Tests

To test feature-present and feature-absent fallback handling:

```bash
node tests/course/r56-t016.mjs
```

### Verified Behaviors
- Source anchor `#reset` exists and operates correctly.
- Feature-present path: `CSS.supports('all', 'unset')` applies `all: unset` styling; fallback notice stays hidden.
- Feature-absent path: Unsupported browser simulation displays `#support-notice` banner without crashing.
- Zero unexpected page errors across both environments.
