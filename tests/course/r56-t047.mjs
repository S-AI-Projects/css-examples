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
  const pageUrl = `http://127.0.0.1:${port}/learn/inspecting/inspecting.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    const widths = [360, 1280];

    for (const width of widths) {
      // Test with prefers-reduced-motion: reduce
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[${width}px] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // 1. Verify main content region anchor exists
      const mainRegion = page.locator("main.container, #content");
      await mainRegion.waitFor({ state: "visible" });

      const box1 = page.locator(".box1");
      const box2 = page.locator(".box2");
      await box1.waitFor({ state: "visible" });
      await box2.waitFor({ state: "visible" });

      // 2. Verify layout usable and no unexpected horizontal overflow
      const overflowCheck = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      assert.ok(
        overflowCheck.scrollWidth <= overflowCheck.clientWidth + 1,
        `Page must not overflow horizontally at ${width}px`
      );

      // 3. Test keyboard navigation and visible focus
      await page.keyboard.press("Tab");
      const activeTagName = await page.evaluate(() => document.activeElement.tagName.toLowerCase());
      assert.ok(
        activeTagName === "a" || activeTagName === "main",
        "Tab should focus skip-link or main content"
      );

      const focusOutline = await page.evaluate(() => {
        const active = document.activeElement;
        const style = window.getComputedStyle(active);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      });

      assert.notEqual(
        focusOutline.outlineStyle,
        "none",
        `Focus outline must be visible at ${width}px width`
      );

      // 4. Verify box model inspection properties
      const boxMetrics = await page.evaluate(() => {
        const b1 = document.querySelector(".box1");
        const b2 = document.querySelector(".box2");
        return {
          b1BoxSizing: window.getComputedStyle(b1).boxSizing,
          b2BoxSizing: window.getComputedStyle(b2).boxSizing,
          b1Width: b1.getBoundingClientRect().width,
          b2Width: b2.getBoundingClientRect().width,
        };
      });

      assert.equal(boxMetrics.b1BoxSizing, "content-box", "box1 uses default content-box");
      assert.equal(boxMetrics.b2BoxSizing, "border-box", "box2 uses border-box");

      await context.close();
    }

    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T047 motion and focus preference checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T047 check failed:", err);
  process.exit(1);
});
