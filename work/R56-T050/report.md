# R56-T050 Verification Report

## Task Overview
- **Student:** Aryan Raj
- **Enrollment:** E26B07F0733
- **Task ID:** R56-T050
- **Target Page:** `learn/backgrounds-borders/size.html`
- **Source Anchors:** `#reset`
- **Objective:** Handle an unsupported browser feature — identify the feature demonstrated (`background-size`) and test both feature-present and feature-absent paths with explicit fallback.

## Baseline Findings
- The page demonstrates `background-size: 100px 10em` applied to a `balloons.jpg` background.
- No fallback existed for browsers that don't support `background-size`.
- The interactive editor uses `../playable.js` with a Reset button.

## Changes Implemented

### Source Changes (`size.html`)
1. **Base fallback color** (`background-color: #e2e8f0`) added to the non-editable `<style>` block — always present regardless of editor state.
2. **`@supports not (background-size: cover)` block** added to the editable style and textarea:
   - Applies a distinct fallback color `#cbd5e1`
   - Displays an informational `::after` message: *"Your browser does not support background-size."*
3. **Textarea height** increased to `220px` to accommodate the `@supports` block.

### Test Design
- **Feature-present path:** Verifies `background-size` is computed, `background-image` references `balloons.jpg`, fallback `background-color` is set (non-transparent), and `::after` has no content.
- **Feature-absent simulation:** Injects CSS to remove `background-size`/`background-image` and apply fallback styles, then verifies the fallback color and informational message appear.
- **Reset check:** Modifies the textarea, clicks Reset, and verifies `background-size` is restored.
- **Source integrity:** Confirms the source file still contains the `@supports` block and fallback color.

## Checks Performed
1. ✅ Feature-present: `background-size` is applied (100px × em-value)
2. ✅ Feature-present: `background-image` references `balloons.jpg`
3. ✅ Feature-present: fallback `background-color` is non-transparent
4. ✅ Feature-present: `::after` content is `none` (no fallback message shown)
5. ✅ Feature-absent: fallback `background-color` is `#cbd5e1`
6. ✅ Feature-absent: `::after` contains "does not support background-size"
7. ✅ Feature-absent: `background-image` is `none`
8. ✅ Reset restores `background-size` to original computed value
9. ✅ Source file contains `@supports` block and fallback color

## Test Command
```bash
node tests/course/r56-t050.mjs
```

## Result
**PASS** — All checks passed.
