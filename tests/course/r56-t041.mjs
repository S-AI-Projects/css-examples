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
  const pageUrl = `http://127.0.0.1:${port}/shapes/overview/box.html`;

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
    const codeTextarea = page.locator("#code");
    const resetBtn = page.locator("#reset");
    const cssTextarea = page.locator(".playable-css");

    await assert.doesNotReject(async () => {
      await codeTextarea.waitFor({ state: "attached" });
      await resetBtn.waitFor({ state: "attached" });
      await cssTextarea.waitFor({ state: "attached" });
    }, "Source anchors #code, #reset and .playable-css must exist in DOM");

    // 2. Check that no positive tabindex exists on the page
    const positiveTabindex = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("[tabindex]"));
      return elements
        .filter((el) => {
          const val = parseInt(el.getAttribute("tabindex"), 10);
          return !isNaN(val) && val > 0;
        })
        .map((el) => el.outerHTML);
    });
    assert.equal(
      positiveTabindex.length,
      0,
      `No elements should have positive tabindex, found: ${positiveTabindex.join(", ")}`
    );

    // 3. Tab traversal from css textarea -> html textarea (#code) -> reset button (#reset)
    await cssTextarea.focus();
    let activeId = await page.evaluate(() => document.activeElement.className);
    assert.ok(activeId.includes("playable-css"), "playable-css should be focused first");

    await page.keyboard.press("Tab");
    activeId = await page.evaluate(() => document.activeElement.id);
    assert.equal(activeId, "code", "Tab navigation should move focus from playable-css to #code");

    await page.keyboard.press("Tab");
    activeId = await page.evaluate(() => document.activeElement.id);
    assert.equal(activeId, "reset", "Tab navigation should move focus from #code to #reset");

    // 4. Verify visible focus on #reset
    const focusStyle = await resetBtn.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    assert.notEqual(
      focusStyle.outlineStyle,
      "none",
      "Reset button must have a visible outline when focused"
    );

    // 5. Test keyboard activation of #reset
    // First edit playable-css
    await cssTextarea.fill(".shape { background-color: rgb(255, 0, 0); }");
    await cssTextarea.dispatchEvent("input");

    // Verify change took effect in editable style
    const updatedBg = await page.locator(".shape").evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    assert.equal(updatedBg, "rgb(255, 0, 0)", "Shape background should be updated to red");

    // Focus reset button and activate via Enter key
    await resetBtn.focus();
    await page.keyboard.press("Enter");

    // Verify reset restored original CSS (rebeccapurple: rgb(102, 51, 153))
    const restoredBg = await page.locator(".shape").evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    assert.equal(
      restoredBg,
      "rgb(102, 51, 153)",
      "Reset button activated via keyboard should restore original shape background"
    );

    // 6. Verify no unexpected page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T041 keyboard interaction and regression checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T041 check failed:", err);
  process.exit(1);
});
