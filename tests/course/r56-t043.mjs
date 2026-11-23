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
  const pageUrl = `http://127.0.0.1:${port}/learn/backgrounds-borders/size.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // === Test Case 1: Standard load with valid asset ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[Valid] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Verify anchor #reset
      const resetBtn = page.locator("#reset");
      await resetBtn.waitFor({ state: "visible" });

      const box = page.locator(".box");
      await box.waitFor({ state: "visible" });

      const styles = await box.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          bgImage: computed.backgroundImage,
          bgColor: computed.backgroundColor,
          bgSize: computed.backgroundSize,
        };
      });

      assert.ok(styles.bgImage.includes("balloons.jpg"), "Valid state must load balloons.jpg");
      assert.equal(styles.bgColor, "rgb(226, 232, 240)", "Fallback background color must be defined");
      assert.ok(styles.bgSize.includes("100px"), "background-size must be defined");

      await context.close();
    }

    // === Test Case 2: Failed asset simulation (exercise missing image fixture) ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[MissingAsset] ${err.message}`));

      // Intercept image asset and respond with 404 Not Found
      await page.route("**/balloons.jpg", (route) => {
        route.fulfill({
          status: 404,
          contentType: "text/plain",
          body: "Image asset not found",
        });
      });

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      const box = page.locator(".box");
      const bgColor = await box.evaluate((el) => window.getComputedStyle(el).backgroundColor);

      // Verify container remains visually meaningful with fallback background color
      assert.equal(
        bgColor,
        "rgb(226, 232, 240)",
        "When asset fails to load, fallback background-color must remain visible and stable"
      );

      await context.close();
    }

    // === Test Case 3: Empty/Corrupted state recovery via #reset ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[ResetRecovery] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      const cssTextarea = page.locator(".playable-css");
      const resetBtn = page.locator("#reset");
      const box = page.locator(".box");

      // Corrupt the style to empty
      await cssTextarea.fill(".box { background: none; }");
      await cssTextarea.dispatchEvent("input");

      let mutatedBg = await box.evaluate((el) => window.getComputedStyle(el).backgroundImage);
      assert.equal(mutatedBg, "none", "Box background should be cleared in empty state");

      // Click #reset to recover
      await resetBtn.click();

      // Verify recovered state
      const recoveredStyle = await box.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          bgImage: computed.backgroundImage,
          bgColor: computed.backgroundColor,
        };
      });

      assert.ok(
        recoveredStyle.bgImage.includes("balloons.jpg"),
        "Clicking #reset must recover the valid background-image fixture"
      );
      assert.equal(
        recoveredStyle.bgColor,
        "rgb(226, 232, 240)",
        "Clicking #reset must restore fallback background color"
      );

      await context.close();
    }

    // Assert 0 uncaught page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T043 empty and error display checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T043 check failed:", err);
  process.exit(1);
});
