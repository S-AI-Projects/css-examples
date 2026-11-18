# CSS Painting API: Box Background Example

This directory demonstrates the **CSS Painting API** (part of CSS Houdini).

## What the Example Demonstrates

`example-boxbg.html` registers a custom paint worklet (`boxbg.js`) using `CSS.paintWorklet.addModule("boxbg.js")`. The worklet dynamically paints styled rectangles as background images for list items (`<li>`) using custom CSS properties (`--boxColor` and `--widthSubtractor`).

## Responsive Behavior

- The page uses a standard `<meta name="viewport" content="width=device-width" />` configuration.
- List items adapt fluidly across mobile (360px) and desktop (1280px) viewports without horizontal clipping or overflow.
- No intentionally scrollable regions are present; the layout reflows naturally within the viewport.

## Running the Example

Serve the directory using any static HTTP server (the CSS Painting API requires a secure context or localhost):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/houdini/css_painting_api/example-boxbg.html` in a browser that supports CSS Houdini Paint API (e.g., Chromium / Chrome).

## Running the Regression Test

From the repository root:

```bash
node tests/course/r56-t022.mjs
```

### What the Test Verifies

The Playwright regression test (`tests/course/r56-t022.mjs`):
1. Starts a temporary local HTTP server automatically.
2. Evaluates the page at both mobile (`360 × 800`) and desktop (`1280 × 800`) viewports.
3. Asserts zero unintended page-level or element-level horizontal overflow (`scrollWidth <= clientWidth`).
4. Verifies all 18 `<li>` items remain within viewport boundaries and preserve vertical ordering.
5. Verifies CSS Painting API paint worklet registration and custom property styles.
6. Asserts zero unexpected console errors or uncaught page errors.
7. Saves review screenshots and execution logs to `work/R56-T022/`.
