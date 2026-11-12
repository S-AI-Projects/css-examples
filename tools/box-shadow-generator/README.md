# Box-shadow Generator

This example is an interactive CSS box-shadow generator.

## Page entry point

Open `index.html` through a local HTTP server:

http://127.0.0.1:8000/tools/box-shadow-generator/

## Run locally

From the repository root, run:

    python3 -m http.server 8000

Then open the URL above in your browser.

## Walkthrough: Add a shadow layer

1. Open the Box-shadow Generator page.
2. Find the layer manager (`#layer_manager`).
3. Click the Add (`+`) button.
4. A new layer, such as `shadow 0`, should appear inside `#stack_container`.
5. Select the new layer.
6. The preview should display the generated shadow, and the CSS output should show a `box-shadow` declaration.

Expected result: one shadow layer is visible, the preview has a computed box shadow, and the CSS output contains the corresponding declaration.

## Automated browser test

Prerequisites: Node.js and Playwright with Chromium installed.

From the repository root, run:

    node tests/course/r56-t007.mjs

The test starts its own local HTTP server and a fresh Chromium browser context. It checks the baseline layout, adding a shadow layer, generated CSS, preview styling, and browser errors. It saves screenshots and JSON results in `work/R56-T007/`.
