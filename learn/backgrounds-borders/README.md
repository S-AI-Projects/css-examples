# learn/backgrounds-borders

This directory contains interactive CSS examples demonstrating **CSS Backgrounds and Borders** properties.

## Examples

| File | Demonstrates |
|------|-------------|
| `background-attachment.html` | `background-attachment` (scroll, fixed, local) |
| `background-origin.html` | `background-origin` (border-box, padding-box, content-box) |
| `background-size.html` | `background-size` with keyword and length values |
| `border.html` | Border shorthand and individual properties |
| `border-radius.html` | `border-radius` for rounded corners |
| `gradients.html` | CSS gradient backgrounds |
| `multiple-background-image.html` | Layering multiple background images |
| `size.html` | `background-size` with `@supports` fallback for unsupported browsers |

## Feature Fallback (`size.html`)

The `size.html` example includes an `@supports not (background-size: cover)` block that provides:
- A fallback `background-color: #cbd5e1` when `background-size` is not available.
- An informational `::after` pseudo-element message telling users their browser doesn't support the feature.
- A base fallback color (`#e2e8f0`) in the non-editable style as a safety net.

## Interactive Editor

Each page includes a live CSS/HTML editor powered by `../playable.js`. Edit the CSS or HTML textareas and see results immediately. Click **Reset** to restore the original code.
