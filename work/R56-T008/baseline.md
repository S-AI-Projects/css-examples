# R56-T008 Baseline

## Original page
- File: multicol/spanning/h2-span.html
- The page loads successfully.
- Paragraphs flow across multiple columns.
- The heading spans across all columns.
- The HTML and CSS editors are visible.
- Editing the HTML editor updates the preview.
- Clicking Reset restores the original HTML and CSS.

## Existing implementation
- CSS: column-width: 200px
- CSS: column-span: all
- HTML editor: #code
- Reset button: #reset
- Preview update: section.innerHTML = textareaHTML.value
- CSS update: editable.innerHTML = textareaCSS.value

## Important decision
Keep the original HTML playground functionality unchanged.
Add an isolated companion example for displaying user-provided text safely.
