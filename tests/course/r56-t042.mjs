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
  const pageUrl = `http://127.0.0.1:${port}/learn/media-queries/or.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // === Viewport 1: 360 x 800 (Mobile Portrait) ===
    {
      const context = await browser.newContext({
        viewport: { width: 360, height: 800 },
      });
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[360x800] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Verify main content region anchor
      const mainContent = page.locator("main, .main-content");
      await mainContent.waitFor({ state: "visible" });

      const metrics360 = await page.evaluate(() => {
        const doc = document.documentElement;
        const main = document.querySelector("main") || document.body;
        const bodyStyle = window.getComputedStyle(document.body);
        const pElements = Array.from(document.querySelectorAll("p"));
        return {
          docScrollWidth: doc.scrollWidth,
          docClientWidth: doc.clientWidth,
          mainScrollWidth: main.scrollWidth,
          mainClientWidth: main.clientWidth,
          bodyColor: bodyStyle.color,
          paragraphsCount: pElements.length,
          firstPText: pElements[0]?.textContent?.trim().slice(0, 30),
        };
      });

      // Assert no horizontal overflow at 360px
      assert.ok(
        metrics360.docScrollWidth <= metrics360.docClientWidth + 1,
        `No horizontal overflow on document at 360x800: scrollWidth (${metrics360.docScrollWidth}) <= clientWidth (${metrics360.docClientWidth})`
      );
      assert.ok(
        metrics360.mainScrollWidth <= metrics360.mainClientWidth + 1,
        `No horizontal overflow on main content at 360x800`
      );

      // At 360x800 portrait (<600px width), body color should be default black (rgb(0, 0, 0))
      assert.equal(
        metrics360.bodyColor,
        "rgb(0, 0, 0)",
        "At 360x800 portrait, media query should not trigger; color must remain default"
      );

      assert.equal(metrics360.paragraphsCount, 2, "Both paragraphs must be present");
      assert.ok(metrics360.firstPText.startsWith("One November night"), "First paragraph order preserved");

      await context.close();
    }

    // === Viewport 2: 1280 x 800 (Desktop Landscape) ===
    {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[1280x800] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      const mainContent = page.locator("main, .main-content");
      await mainContent.waitFor({ state: "visible" });

      const metrics1280 = await page.evaluate(() => {
        const doc = document.documentElement;
        const main = document.querySelector("main") || document.body;
        const bodyStyle = window.getComputedStyle(document.body);
        const pElements = Array.from(document.querySelectorAll("p"));
        return {
          docScrollWidth: doc.scrollWidth,
          docClientWidth: doc.clientWidth,
          mainScrollWidth: main.scrollWidth,
          mainClientWidth: main.clientWidth,
          bodyColor: bodyStyle.color,
          paragraphsCount: pElements.length,
          firstPText: pElements[0]?.textContent?.trim().slice(0, 30),
        };
      });

      // Assert no horizontal overflow at 1280px
      assert.ok(
        metrics1280.docScrollWidth <= metrics1280.docClientWidth + 1,
        `No horizontal overflow on document at 1280x800: scrollWidth (${metrics1280.docScrollWidth}) <= clientWidth (${metrics1280.docClientWidth})`
      );
      assert.ok(
        metrics1280.mainScrollWidth <= metrics1280.mainClientWidth + 1,
        `No horizontal overflow on main content at 1280x800`
      );

      // At 1280x800 landscape (>=600px width), body color should be blue (rgb(0, 0, 255))
      assert.equal(
        metrics1280.bodyColor,
        "rgb(0, 0, 255)",
        "At 1280x800 desktop, media query must trigger; color must be blue"
      );

      assert.equal(metrics1280.paragraphsCount, 2, "Both paragraphs must be present");
      assert.ok(metrics1280.firstPText.startsWith("One November night"), "First paragraph order preserved");

      await context.close();
    }

    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T042 responsive layout checks at 360x800 and 1280x800 passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T042 check failed:", err);
  process.exit(1);
});
