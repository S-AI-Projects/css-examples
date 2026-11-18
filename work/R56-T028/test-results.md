# R56-T028 Test Results

## Automated Check
- **Command:** `node tests/course/r56-t028.mjs`
- **Result:** PASSED (Exit Code 0)

## Verified Acceptance Criteria
1. `prefers-reduced-motion: reduce` matches and leaves all interactive controls functional.
2. Verified that page is non-animated (`animationName: none`).
3. Focus outline is visible and non-zero on `#reset` across both desktop and mobile viewports.
4. CSS updates and `#reset` button behave correctly.
5. Zero unhandled page errors or console warnings.

## Visual Evidence
- `desktop-focus-reduced-motion.png`: Desktop layout (1280×800) under reduced motion with visible focus.
- `mobile-focus-reduced-motion.png`: Mobile layout (360×800) under reduced motion with visible focus.
