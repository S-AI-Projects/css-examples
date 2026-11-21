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

function verifyWrappingLayout(itemPositions, boxMetrics) {
  // Items must be wrapped onto multiple rows: item 4 should be below item 1
  const isWrapped = itemPositions.item4Top > itemPositions.item1Top;
  const noHorizontalOverflow = boxMetrics.scrollWidth <= boxMetrics.clientWidth;
  return isWrapped && noHorizontalOverflow;
}

async function runTest() {
  const { server, port } = await createStaticServer();
  const pageUrl = `http://127.0.0.1:${port}/flexbox/wrapping/gaps.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // === 1. Test clean unmutated page ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[Clean] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Verify anchors #code, #reset
      const codeArea = page.locator("#code");
      const resetBtn = page.locator("#reset");
      const box = page.locator(".box");

      await assert.doesNotReject(async () => {
        await codeArea.waitFor({ state: "visible" });
        await resetBtn.waitFor({ state: "visible" });
        await box.waitFor({ state: "visible" });
      }, "Source anchors #code, #reset, and .box must exist and be visible");

      // Verify computed style has flex-wrap: wrap
      const computedFlexWrap = await box.evaluate((el) => window.getComputedStyle(el).flexWrap);
      assert.equal(computedFlexWrap, "wrap", "Default .box must have flex-wrap: wrap");

      // Record items positioning and check multi-line wrapping
      const itemMetrics = await page.evaluate(() => {
        const items = document.querySelectorAll(".box > div");
        const b = document.querySelector(".box");
        return {
          positions: {
            item1Top: items[0].getBoundingClientRect().top,
            item4Top: items[3].getBoundingClientRect().top,
          },
          boxMetrics: {
            clientWidth: b.clientWidth,
            scrollWidth: b.scrollWidth,
          },
        };
      });

      const isValidWrapping = verifyWrappingLayout(itemMetrics.positions, itemMetrics.boxMetrics);
      assert.equal(
        isValidWrapping,
        true,
        "Clean page must properly wrap items across multiple rows without overflow"
      );

      // Verify Reset interaction
      await page.locator(".playable-css").fill(".wrapper { width: 300px; }");
      await page.locator(".playable-css").dispatchEvent("input");
      await resetBtn.click();

      const restoredWrap = await box.evaluate((el) => window.getComputedStyle(el).flexWrap);
      assert.equal(restoredWrap, "wrap", "Reset must restore flexbox wrap rules");

      await context.close();
    }

    // === 2. Deliberately introduce temporary fixture mutation to verify regression detection ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[Mutated] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Introduce mutation in temporary fixture: break flex-wrap to nowrap
      await page.evaluate(() => {
        const style = document.createElement("style");
        style.id = "regression-test-mutation";
        style.textContent = ".box { flex-wrap: nowrap !important; }";
        document.head.appendChild(style);
      });

      const mutatedMetrics = await page.evaluate(() => {
        const items = document.querySelectorAll(".box > div");
        const b = document.querySelector(".box");
        return {
          positions: {
            item1Top: items[0].getBoundingClientRect().top,
            item4Top: items[3].getBoundingClientRect().top,
          },
          boxMetrics: {
            clientWidth: b.clientWidth,
            scrollWidth: b.scrollWidth,
          },
        };
      });

      // Verify assertion distinguishes the broken state
      const isMutatedValid = verifyWrappingLayout(mutatedMetrics.positions, mutatedMetrics.boxMetrics);
      assert.equal(
        isMutatedValid,
        false,
        "Assertion must fail when flex-wrap: wrap rule is broken in the test fixture"
      );

      await context.close();
    }

    assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join("; ")}`);
    console.log("PASS: R56-T020 UI regression check successfully verified wrapping behavior and mutation detection.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T020 check failed:", err);
  process.exit(1);
});
