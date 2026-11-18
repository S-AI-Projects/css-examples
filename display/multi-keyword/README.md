# Multi-Keyword Display Examples: Span as a Flex Container

## Entry Point
- **Page:** `display/multi-keyword/span-flex.html`

## Local Setup
To run the example locally:
```bash
# From repository root
python3 -m http.server 8000
```
Then navigate to: `http://localhost:8000/display/multi-keyword/span-flex.html`

## Tested Interactive Walkthrough
1. **Baseline Layout Observation:**
   - **Target element:** `section span.flex`
   - **Initial CSS:** `display: flex; justify-content: space-between;`
   - **Observation:** Span renders as a block-level flex container filling available width, distributing text nodes across the main axis with space between them.
2. **Interactive Modification:**
   - **Input:** Update `.playable-css` textarea with:
     ```css
     .flex {
       border: 5px solid #ccc;
       display: inline-flex;
       justify-content: center;
     }
     ```
   - **Trigger:** Dispatch `input` event on `.playable-css`.
   - **Observation:** Computed `display` transitions to `inline-flex` (conforming to inline flow formatting externally while behaving as a flex container internally) and `justify-content` centers child content.
3. **Reset Operation:**
   - **Action:** Click `input#reset`.
   - **Observation:** Editor code and rendered span revert cleanly to baseline `display: flex` and `justify-content: space-between`.

## Automated Check
Run the Playwright test:
```bash
node tests/course/r56-t026.mjs
```
Evidence and visual artifacts are recorded in `work/R56-T026/`.
