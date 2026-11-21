# Flexbox Use Cases

Practical CSS layout recipes demonstrating common user-interface patterns built with CSS Flexible Box Layout.

## Interactive Walkthrough: Card Layout with Sticky Footers

- **Entry Point:** `flexbox/use-cases/cards.html`
- **Setup Command:** `node tests/course/r56-t037.mjs`

### Layout Observation
The card demo displays a multi-column card grid where each card has a varying amount of content. By applying `display: flex; flex-direction: column` to each `.card` and `flex: 1 1 auto` to `.card .content`, all card footers naturally align at the bottom of the grid row regardless of individual text lengths.

## Running Tests

To execute the automated walkthrough and verify layout observations:

```bash
node tests/course/r56-t037.mjs
```

This Playwright check executes the complete walkthrough:
1. Verifies initial vertical alignment of footers between unequal content cards.
2. Interacts with the CSS editor to disable flex-grow, verifying the footer detaches from the bottom.
3. Operates the Reset button and verifies full layout recovery.
4. Generates visual walkthrough screenshots in `work/R56-T037/`.
