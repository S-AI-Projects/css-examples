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
  const pageUrl = `http://127.0.0.1:${port}/multicol/basics/column-count.html`;

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
    const codeArea = page.locator("#code");
    const resetBtn = page.locator("#reset");
    const cssArea = page.locator(".playable-css");

    await assert.doesNotReject(async () => {
      await codeArea.waitFor({ state: "attached" });
      await resetBtn.waitFor({ state: "attached" });
      await cssArea.waitFor({ state: "attached" });
    }, "Source anchors #code, #reset, and .playable-css must exist");

    // 2. Initial state verification
    let counts = await page.evaluate(() => {
      const c = document.querySelector(".container");
      return {
        containerCount: document.querySelectorAll(".container").length,
        paragraphCount: document.querySelectorAll(".container p").length,
        columnCount: window.getComputedStyle(c).columnCount,
      };
    });

    assert.equal(counts.containerCount, 1, "Exactly one .container element must exist initially");
    assert.equal(counts.paragraphCount, 3, "Exactly three paragraphs must exist initially");
    assert.equal(counts.columnCount, "3", "Initial column-count must be 3");

    // 3. First Interaction Cycle: Modify column-count to 2, then Reset
    await cssArea.fill(".container { column-count: 2; }");
    await cssArea.dispatchEvent("input");

    let firstColumnCount = await page.locator(".container").evaluate((el) =>
      window.getComputedStyle(el).columnCount
    );
    assert.equal(firstColumnCount, "2", "First update must apply column-count: 2");

    await resetBtn.click();
    let afterFirstReset = await page.locator(".container").evaluate((el) =>
      window.getComputedStyle(el).columnCount
    );
    assert.equal(afterFirstReset, "3", "First reset must restore column-count: 3");

    // 4. Repeated Initialization (Trigger initDemo a second time)
    await page.evaluate(() => {
      if (typeof window.initDemo === "function") {
        window.initDemo();
      }
    });

    // 5. Second Interaction Cycle: Modify column-count to 4, then Reset
    await cssArea.fill(".container { column-count: 4; }");
    await cssArea.dispatchEvent("input");

    let secondColumnCount = await page.locator(".container").evaluate((el) =>
      window.getComputedStyle(el).columnCount
    );
    assert.equal(secondColumnCount, "4", "Second update must apply column-count: 4");

    await resetBtn.click();
    let afterSecondReset = await page.locator(".container").evaluate((el) =>
      window.getComputedStyle(el).columnCount
    );
    assert.equal(afterSecondReset, "3", "Second reset must restore column-count: 3");

    // 6. Verify DOM node stability: ensure no nodes were duplicated
    const finalCounts = await page.evaluate(() => {
      return {
        containerCount: document.querySelectorAll(".container").length,
        paragraphCount: document.querySelectorAll(".container p").length,
        buttonsCount: document.querySelectorAll("#reset").length,
      };
    });

    assert.equal(finalCounts.containerCount, 1, "Container count must remain exactly 1 after repeat initialization");
    assert.equal(finalCounts.paragraphCount, 3, "Paragraph count must remain exactly 3 after repeat initialization");
    assert.equal(finalCounts.buttonsCount, 1, "Reset button count must remain exactly 1");

    // 7. Verify no unexpected page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T044 repeat initialization and DOM lifecycle checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T044 check failed:", err);
  process.exit(1);
});
