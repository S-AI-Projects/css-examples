# Multicolumn Layout: Balancing

Demonstration of CSS multi-column filling and balancing (`column-fill: auto`).

## Tested Walkthrough

### 1. Entry Point
- **Page:** `multicol/balancing/auto.html`
- **Interactive Anchors:** `#code` (HTML editor), `#reset` (Reset button), `.playable-css` (CSS editor)

### 2. Setup Command
To run the automated walkthrough test:
```bash
node tests/course/r56-t017.mjs
```

### 3. Step-by-Step Interaction and Layout Observations
1. **Initial State:**
   - The `.container` displays multi-column layout with `column-width: 150px`, `column-fill: auto`, and `height: 250px`.
   - Columns are filled sequentially according to content height without balancing.
2. **Editing:**
   - Modify the CSS editor (`.playable-css`) to change `column-width: 200px; column-fill: balance; height: 200px;`.
   - Content columns immediately re-balance to equal heights.
3. **Reset:**
   - Clicking `#reset` restores original CSS and HTML content.
   - The `.container` returns to `column-width: 150px` and `column-fill: auto`.
