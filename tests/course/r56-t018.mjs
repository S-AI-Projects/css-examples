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
  const pageUrl = `http://127.0.0.1:${port}/grid/docs/autoplacement.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(pageUrl, { waitUntil: "networkidle" });

    // 1. Verify source anchor #reset
    const resetBtn = page.locator("#reset");
    await assert.doesNotReject(async () => {
      await resetBtn.waitFor({ state: "visible" });
    }, "Source anchor #reset must be present and visible");

    // 2. Locate companion text rendering inputs
    const captionInput = page.locator("#caption-input");
    const captionDisplay = page.locator("#caption-display");
    await captionInput.waitFor({ state: "visible" });
    await captionDisplay.waitFor({ state: "visible" });

    // 3. Test benign initial text rendering
    const initialText = await captionDisplay.innerText();
    assert.equal(initialText.trim(), "Sample Item", "Initial caption must render text content");

    // 4. Input XSS payload containing <img src=x onerror=...>
    const payload = `<img src=x onerror="window.__xssTriggered = true">`;
    await captionInput.fill(payload);
    await captionInput.dispatchEvent("input");

    // Allow time for any potential event/script execution
    await page.waitForTimeout(200);

    // 5. Assert that no script executed and window.__xssTriggered is not set
    const xssExecuted = await page.evaluate(() => window.__xssTriggered === true);
    assert.equal(xssExecuted, false, "Security assertion failed: payload executed script in page context");

    // 6. Assert that no <img> element was injected into the DOM
    const imgCount = await captionDisplay.evaluate((el) => el.querySelectorAll("img").length);
    assert.equal(imgCount, 0, "Security assertion failed: HTML element was injected into text container");

    // 7. Assert that payload is rendered strictly as inert literal text
    const renderedText = await captionDisplay.innerText();
    assert.equal(renderedText, payload, "Payload must be rendered strictly as literal text content");

    // 8. Test Reset functionality
    await resetBtn.click();
    const resetText = await captionDisplay.innerText();
    assert.equal(resetText.trim(), "Sample Item", "Reset button must restore default caption text");

    // 9. Verify zero page errors
    assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join("; ")}`);

    console.log("PASS: R56-T018 safe inert text rendering checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T018 check failed:", err);
  process.exit(1);
});
