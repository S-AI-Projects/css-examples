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
  const pageUrl = `http://127.0.0.1:${port}/learn/cascade/all.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // === 1. Test Feature-Present Path (Native Support) ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[Present] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Verify anchor #reset
      const resetBtn = page.locator("#reset");
      await assert.doesNotReject(async () => {
        await resetBtn.waitFor({ state: "visible" });
      }, "Source anchor #reset must exist and be visible");

      // Verify CSS.supports detects 'all: unset'
      const supportsAll = await page.evaluate(() => CSS.supports("all", "unset"));
      assert.equal(supportsAll, true, "Browser must report feature-present for all: unset");

      // In feature-present path, #support-notice should remain hidden
      const noticeVisible = await page.locator("#support-notice").isVisible();
      assert.equal(noticeVisible, false, "#support-notice must remain hidden when 'all' is supported");

      // Verify .fix-this does NOT have the orange background of the parent blockquote
      const fixThisBg = await page.locator("blockquote.fix-this").evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // In unset state, background-color is transparent / rgba(0, 0, 0, 0)
      assert.ok(
        fixThisBg.includes("rgba(0, 0, 0, 0)") || fixThisBg.includes("transparent"),
        `.fix-this background should be unset/transparent, got: ${fixThisBg}`
      );

      // Verify Reset button interaction
      await page.fill(".playable-css", "blockquote { background-color: red; }");
      await resetBtn.click();
      const restoredCSS = await page.locator(".playable-css").inputValue();
      assert.ok(restoredCSS.includes("background-color: orange;"), "Reset should restore CSS code");

      await context.close();
    }

    // === 2. Test Feature-Absent Path (Emulated Unsupported Environment) ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[Absent] ${err.message}`));

      // Stub CSS.supports to simulate unsupported environment
      await page.addInitScript(() => {
        const origSupports = window.CSS?.supports;
        window.CSS = window.CSS || {};
        window.CSS.supports = function (prop, val) {
          if (prop === "all") return false;
          return origSupports ? origSupports.call(CSS, prop, val) : false;
        };
      });

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Verify feature-absent notification is visibly rendered
      const noticeVisible = await page.locator("#support-notice").isVisible();
      assert.equal(noticeVisible, true, "#support-notice must be displayed when 'all' is not supported");

      const noticeText = await page.locator("#support-notice").innerText();
      assert.ok(
        noticeText.includes("not supported"),
        `Notice text should explain feature unavailability, got: ${noticeText}`
      );

      // Verify page still functions without JavaScript crashes
      const resetBtn = page.locator("#reset");
      assert.ok(await resetBtn.isVisible(), "#reset must remain operable in fallback path");

      await context.close();
    }

    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T016 feature-present and feature-absent fallback checks passed.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T016 check failed:", err);
  process.exit(1);
});
