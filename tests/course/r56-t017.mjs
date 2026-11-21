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
  const pageUrl = `http://127.0.0.1:${port}/multicol/balancing/auto.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Walkthrough Step 1: Navigate to the documented entry point
    await page.goto(pageUrl, { waitUntil: "networkidle" });

    // Walkthrough Step 2: Verify source anchors
    const codeArea = page.locator("#code");
    const resetBtn = page.locator("#reset");
    const cssArea = page.locator(".playable-css");
    const container = page.locator(".container");

    await assert.doesNotReject(async () => {
      await codeArea.waitFor({ state: "visible" });
      await resetBtn.waitFor({ state: "visible" });
      await cssArea.waitFor({ state: "visible" });
      await container.waitFor({ state: "visible" });
    }, "Source anchors #code, #reset, .playable-css, and .container must exist and be visible");

    // Walkthrough Step 3: Layout observation in initial state
    const initialStyles = await container.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        columnWidth: s.columnWidth,
        columnFill: s.columnFill,
        height: s.height,
      };
    });

    assert.equal(initialStyles.columnWidth, "150px", "Initial column-width should be 150px");
    assert.equal(initialStyles.columnFill, "auto", "Initial column-fill should be auto");
    assert.equal(initialStyles.height, "250px", "Initial container height should be 250px");

    // Walkthrough Step 4: Perform interactive mutation
    const updatedCSS = `.container {\n  column-width: 200px;\n  column-fill: balance;\n  height: 200px;\n}`;
    await cssArea.fill(updatedCSS);
    await cssArea.dispatchEvent("input");

    // Observe updated layout
    const modifiedStyles = await container.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        columnWidth: s.columnWidth,
        columnFill: s.columnFill,
        height: s.height,
      };
    });

    assert.equal(modifiedStyles.columnWidth, "200px", "Modified column-width should be 200px");
    assert.equal(modifiedStyles.columnFill, "balance", "Modified column-fill should be balance");
    assert.equal(modifiedStyles.height, "200px", "Modified container height should be 200px");

    // Walkthrough Step 5: Test Reset button interaction
    await resetBtn.click();

    // Verify restored state matches initial observation
    const restoredStyles = await container.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        columnWidth: s.columnWidth,
        columnFill: s.columnFill,
        height: s.height,
      };
    });

    assert.equal(restoredStyles.columnWidth, "150px", "Restored column-width must be 150px");
    assert.equal(restoredStyles.columnFill, "auto", "Restored column-fill must be auto");
    assert.equal(restoredStyles.height, "250px", "Restored container height must be 250px");

    // Walkthrough Step 6: Verify zero unexpected page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T017 tested walkthrough checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T017 check failed:", err);
  process.exit(1);
});
