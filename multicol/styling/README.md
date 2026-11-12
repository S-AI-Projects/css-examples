# Multicol Styling Examples

This directory contains examples demonstrating CSS multi-column styling.

## Column Gap Example

Open `column-gap.html` in a browser to explore the CSS `column-count` and `column-gap` properties.

The example includes:
- An editable CSS panel.
- An editable HTML panel.
- A live preview.
- A Reset button to restore the original example.

## Motion and Keyboard Accessibility

The `column-gap.html` example is static and does not use CSS animations or transitions.

The CSS editor, HTML editor, and Reset button support keyboard navigation and retain visible browser focus indicators.

## Running the Example

From the repository root, start a local server:

```bash
python3 -m http.server 8000
```

Open this URL in your browser:

`http://localhost:8000/multicol/styling/column-gap.html`

Stop the server with `Ctrl + C`.

## Running the R56-T009 Regression Test

Install the development dependency:

```bash
npm install
npx playwright install chromium
```

Run the automated test from the repository root:

```bash
node tests/course/r56-t009.mjs
```

The test checks reduced-motion emulation, static motion behavior, visible keyboard focus, layout, editing, and Reset behavior at desktop and mobile viewport widths.

Test results and screenshots are saved in `work/R56-T009/`.
