# R56-T008 Test Results

## Test input

Plain text:
Hello from Task 8

HTML-like input:
<img src=x onerror="window.__r56T008HandlerRan = true">

## Expected results

- Initial text appears in the preview.
- Typing updates the preview.
- The preview uses 200px columns.
- The heading spans all columns.
- HTML-like input is displayed as ordinary text.
- No image element is created.
- No event handler executes.
- The original HTML editor and Reset continue working.
- No unexpected JavaScript errors occur.

## Actual results

All expected results were observed.

## Test execution

Command:
node tests/course/r56-t008.mjs

Result:
PASS — All R56-T008 checks passed.

Screenshot:
text-rendering.png
