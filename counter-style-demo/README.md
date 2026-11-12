
# CSS @counter-style Demo

Demo for the [@counter-style documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/@counter-style) on Mozilla Developer Network.

See the live demo [here](https://mdn.github.io/css-examples/counter-style-demo/).

## Running the R56-T003 regression test

From the repository root, run:

```bash
node tests/course/r56-t003.mjs
```

The test uses Playwright to check the demo, simulate failure of its decorative background image, verify that the CSS code remains readable and the style selector works, and then restore the image using a test fixture.

Test evidence is saved in `work/R56-T003/`.

Prerequisites: Node.js, Python 3, Playwright, and Playwright Chromium.
