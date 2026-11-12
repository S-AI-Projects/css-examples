# Multicol fragmentation example

The `orphans.html` page demonstrates the CSS `orphans` property in a multi-column layout. Its HTML and CSS editors update the preview, and the Reset button restores the original example.

## Running the browser regression test

From the repository root, install the dependencies and Playwright Chromium:

    npm install
    npx playwright install chromium

Run the Task 10 regression test:

    node tests/course/r56-t010.mjs

The test starts a local HTTP server and checks the original page, HTML editor, CSS editor, and Reset button. It also verifies that a temporary fixture with the HTML input listener removed is detected as broken.

Screenshots and test results are saved in `work/R56-T010/`. The temporary broken fixture is removed after the test.
