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

function createStaticServer(simulateMissingAssets = false) {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === "/") pathname = "/index.html";

    if (simulateMissingAssets && pathname.endsWith("grain.png")) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Simulated missing asset");
      return;
    }

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
  const { server, port } = await createStaticServer(false);
  const pageUrl = `http://127.0.0.1:${port}/tools/color-picker/index.html`;

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

    // 1. Verify source anchors
    const container = page.locator("#container");
    const palette = page.locator("#palette");
    const colorPalette = page.locator("#color-palette");
    const colorInfo = page.locator("#color-info");

    await assert.doesNotReject(async () => {
      await container.waitFor({ state: "visible" });
      await palette.waitFor({ state: "visible" });
      await colorPalette.waitFor({ state: "attached" });
      await colorInfo.waitFor({ state: "visible" });
    }, "Source anchors #container, #palette, #color-palette, #color-info must exist");

    // 2. Exercise empty state on #color-palette
    // Clear palette to exercise the empty fixture state
    await page.evaluate(() => {
      document.getElementById("color-palette").innerHTML = "";
    });

    // Check pseudo-element content when empty
    const emptyNotice = await colorPalette.evaluate((el) => {
      const beforeStyle = window.getComputedStyle(el, "::before");
      return {
        content: beforeStyle.content,
        display: beforeStyle.display,
        color: beforeStyle.color,
      };
    });

    assert.ok(
      emptyNotice.content.includes("No color palettes") ||
        emptyNotice.content.includes("Pick a color"),
      `Empty state notice must be visible on #color-palette:empty::before, got: ${emptyNotice.content}`
    );
    assert.equal(emptyNotice.display, "block", "Empty fallback indicator should be display: block");

    // 3. Verify color-info title renders readable header
    const infoTitle = await colorInfo.locator(".title").innerText();
    assert.equal(infoTitle.trim(), "CSS Color", "#color-info .title should display 'CSS Color'");

    // 4. Test missing asset resilience (exercise missing image fallback)
    const { server: errServer, port: errPort } = await createStaticServer(true);
    const errPage = await context.newPage();
    const errPageErrors = [];
    errPage.on("pageerror", (e) => errPageErrors.push(e.message));

    await errPage.goto(`http://127.0.0.1:${errPort}/tools/color-picker/index.html`, {
      waitUntil: "networkidle",
    });

    // Page must still render canvas without crashing even when grain.png returns 404
    const canvas = errPage.locator("#canvas");
    assert.ok(await canvas.isVisible(), "#canvas should remain visible under failed asset condition");

    const canvasBg = await canvas.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        width: s.width,
        height: s.height,
        position: s.position,
      };
    });
    assert.ok(parseInt(canvasBg.height, 10) >= 200, "Canvas height should remain intact with readable fallback");

    await errPage.close();
    errServer.close();

    // 5. Ensure no unexpected runtime JS errors on base page
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T013 empty and error display checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T013 check failed:", err);
  process.exit(1);
});
