# CSS Grid: Autoplacement

Demonstration of CSS Grid dense auto-placement and layout packing.

## Running Tests

To verify safe text rendering and injection immunity:

```bash
node tests/course/r56-t018.mjs
```

### Verified Behaviors
- Source anchor `#reset` exists and operates reliably.
- Text input rendering preserves payload strings as inert text via `textContent`.
- Markup strings such as `<img src=x onerror=...>` do not trigger script execution or DOM element creation.
- Reset action restores initial caption without errors.
