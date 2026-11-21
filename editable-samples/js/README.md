# Editable Samples JavaScript Harness

Documentation for deterministic testing of editable sample scripts.

## Running Tests

To verify deterministic test execution under locked viewport, clock, and network boundaries:

```bash
node tests/course/r56-t015.mjs
```

### Determinism Controls
- Fixed viewport dimensions: 800×600.
- Offline isolation: external domain network requests are blocked.
- Fixed deterministic timestamp clock fixture.
- Strict assertions confirming identical computed style and layout snapshots across multiple consecutive runs.
- Zero unexpected page or runtime exceptions.
