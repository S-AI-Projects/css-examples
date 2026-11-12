
# Font Editable Example

This example demonstrates how CSS font properties can be edited and applied to the sample text using CodeMirror.

## Running the Example

From the repository root, start a local server:

```bash
python3 -m http.server 8000
```

Open the following URL in your browser:

`http://localhost:8000/editable-samples/pages/font/index.html`

## Running the Regression Test

Install project dependencies if needed:

```bash
npm install
npx playwright install chromium
```

Run the automated regression test:

```bash
node tests/course/r56-t004.mjs
```

The test checks:

- Initial editor and output elements.
- Correct initial font styling.
- Repeated initialization without duplicate editors.
- Exactly one output update per edit and reset.
- Restoration of the original font styling.
- Unexpected browser errors.

Test evidence is stored in `work/R56-T004/`.
