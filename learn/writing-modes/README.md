# learn/writing-modes

This directory contains interactive CSS examples demonstrating **CSS Writing Modes** and **logical properties**.

## Examples

| File | Demonstrates |
|------|-------------|
| `block-flow.html` | Block flow direction in different writing modes |
| `direction.html` | CSS `direction` property |
| `float.html` | Logical float values (`inline-start`, `inline-end`) with writing modes |
| `inline-size.html` | Logical `inline-size` property |
| `logical-bbr.html` | Logical border, background, and radius properties |
| `logical-margin-bfc.html` | Logical margins with block formatting context |
| `logical-mbp.html` | Logical margins, borders, and padding |
| `width.html` | Physical vs logical sizing |

## Key Concepts

- **Writing modes** (`horizontal-tb`, `vertical-rl`, `vertical-lr`) change the direction of block and inline flow.
- **Logical properties** (`inline-start`, `block-end`, etc.) adapt to the writing mode instead of physical directions (`left`, `top`).
- The `float: inline-start` property floats an element to the start of the inline axis, which is `left` in `horizontal-tb` LTR mode.

## Interactive Editor

Each page includes a live CSS/HTML editor powered by `../playable.js`. Edit the CSS or HTML textareas and see results immediately. Click **Reset** to restore the original code.
