# Multicolumn spanning examples

Open `h2-span.html` in a browser through a local server to explore
multicolumn layout and headings that span across columns.

The page also includes a separate text-rendering example.
Text entered there is displayed with `textContent`, so HTML-like input
is treated as ordinary text.

## Run locally

From the repository root:

    python3 -m http.server 8000 --bind 127.0.0.1

Open:

    http://127.0.0.1:8000/multicol/spanning/h2-span.html

## Run the R56-T008 regression test

Requirements: Node.js, Python 3, Playwright, and Playwright Chromium.

    node tests/course/r56-t008.mjs

The test starts and stops its own local server and browser.
It checks text rendering, HTML-like input, multicolumn layout,
the original HTML editor, Reset, and unexpected page errors.
