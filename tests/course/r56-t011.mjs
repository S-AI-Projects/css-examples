import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

function createStaticServer() {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === "/") pathname = "/index.html";

    const filePath = path.join(repoRoot, pathname);
    if (!filePath.startsWith(repoRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(`Not found: ${pathname}`);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function runTest() {
  const { server, port } = await createStaticServer();
  const pageUrl = `http://127.0.0.1:${port}/editable-samples/pages/font/index.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(pageUrl, { waitUntil: "networkidle" });

    // 1. Verify required source anchors exist
    const editor = page.locator("#editor");
    const reset = page.locator("#reset");
    const editorContent = page.locator("#editor-content");
    const output = page.locator("#output");

    await assert.doesNotReject(async () => {
      await editor.waitFor({ state: "attached" });
      await reset.waitFor({ state: "attached" });
      await editorContent.waitFor({ state: "attached" });
      await output.waitFor({ state: "visible" });
    }, "Source anchors #editor, #reset, #editor-content, #output must exist in DOM");

    // 2. Check that no positive tabindex exists on the page
    const positiveTabindexElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("[tabindex]"));
      return elements
        .filter((el) => {
          const val = parseInt(el.getAttribute("tabindex"), 10);
          return !isNaN(val) && val > 0;
        })
        .map((el) => el.outerHTML);
    });
    assert.equal(
      positiveTabindexElements.length,
      0,
      `No elements should have positive tabindex, found: ${positiveTabindexElements.join(", ")}`
    );

    // 3. Reset button is initially hidden
    const initialResetClasses = await reset.getAttribute("class");
    assert.ok(
      initialResetClasses && initialResetClasses.includes("hidden"),
      "Reset button must initially have hidden class"
    );

    // 4. Focus CodeMirror editor and enter text to trigger change
    const cmElement = page.locator(".CodeMirror");
    await cmElement.waitFor({ state: "visible" });

    // Focus CodeMirror textarea
    const cmTextarea = page.locator(".CodeMirror textarea");
    await cmTextarea.focus();

    // Verify visible focus outline on CodeMirror
    const cmFocused = await cmElement.evaluate((el) =>
      el.classList.contains("CodeMirror-focused")
    );
    assert.ok(cmFocused, "CodeMirror should gain focused class upon focus");

    // Type new font declaration
    await page.evaluate(() => {
      window.cmEditor.setValue("font: bold 2em sans-serif;\n\n");
    });

    // 5. Verify reset button becomes visible
    await page.waitForFunction(() => {
      const r = document.getElementById("reset");
      return r && !r.classList.contains("hidden");
    });
    const isResetVisible = await reset.isVisible();
    assert.ok(isResetVisible, "Reset button should become visible after editor change");

    // 6. Test Tab traversal from editor to Reset button
    await cmTextarea.focus();
    await page.keyboard.press("Tab");

    // Verify Reset button is focused
    const isResetFocused = await reset.evaluate((el) => document.activeElement === el);
    assert.ok(isResetFocused, "Reset button should receive focus via Tab navigation");

    // Check visible focus on reset button
    const resetFocusStyle = await reset.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    assert.notEqual(resetFocusStyle.outlineStyle, "none", "Reset button must have visible outline on focus");

    // Verify output element got the updated font style
    const updatedFont = await page.locator("#example-element").evaluate((el) => el.style.font);
    assert.ok(
      updatedFont.includes("sans-serif") || updatedFont.includes("bold"),
      `Output element font should update to bold sans-serif, got: ${updatedFont}`
    );

    // 7. Activate Reset button via keyboard (Enter or Space)
    await page.keyboard.press("Enter");

    // Verify Reset button becomes hidden again
    await page.waitForFunction(() => {
      const r = document.getElementById("reset");
      return r && r.classList.contains("hidden");
    });
    const isResetHiddenAfter = await reset.evaluate((el) => el.classList.contains("hidden"));
    assert.ok(isResetHiddenAfter, "Reset button should be hidden after reset");

    // Verify font is restored to initial
    const restoredFont = await page.locator("#example-element").evaluate((el) => el.style.font);
    assert.ok(
      restoredFont.includes("cursive") || restoredFont.includes("italic"),
      `Output element font should be restored to initial cursive, got: ${restoredFont}`
    );

    // 8. Verify no unexpected page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T011 keyboard interaction and regression checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T011 check failed:", err);
  process.exit(1);
});
