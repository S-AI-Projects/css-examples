# Task 10 — Browser regression results

## Environment
- Node.js: v24.19.0
- Playwright: 1.65.0
- Chromium: 158.0.8127.18
- Platform: darwin (arm64)

## Baseline
- Expected: page title is Multicol example - orphans.
- Actual: page loaded with the expected title.
- Expected: three paragraphs in the preview.
- Actual: three paragraphs.
- Expected computed layout: {"columnWidth":"200px","orphans":"3"}
- Actual computed layout: {"columnWidth":"200px","orphans":"3","width":700,"height":154}

## HTML editor test
- Input: <div class="container"><p id="edited-html">Edited preview marker</p></div>
- Expected: preview displays Edited preview marker.
- Actual: preview displayed Edited preview marker.

## CSS editor test
- Input: .container { column-width: 320px; orphans: 2; }
- Expected: {"columnWidth":"320px","orphans":"2"}
- Actual: {"columnWidth":"320px","orphans":"2"}

## Reset test
- Expected: original HTML and CSS values are restored.
- Actual HTML restored: true
- Actual CSS restored: true
- Actual computed styles: {"columnWidth":"200px","orphans":"3"}

## Negative control
- Mutation: removed the HTML editor input event listener in a temporary fixture.
- Input: edited HTML containing Edited preview marker.
- Expected: editor changes but preview does not update.
- Actual preview marker count: 0
- Result: missing event listener was detected.

## Overall result
All browser regression assertions passed.
The original example was not modified.
