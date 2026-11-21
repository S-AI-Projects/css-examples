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
  const pageUrl = `http://127.0.0.1:${port}/tools/color-mixer/index.html`;

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

    // 1. Verify source anchors existence
    const colorMixer = page.locator("#color-mixer");
    const colorOne = page.locator("#color-one");
    const mixedColor = page.locator("#mixed-color");
    const colorTwo = page.locator("#color-two");

    await assert.doesNotReject(async () => {
      await colorMixer.waitFor({ state: "visible" });
      await colorOne.waitFor({ state: "visible" });
      await mixedColor.waitFor({ state: "visible" });
      await colorTwo.waitFor({ state: "visible" });
    }, "Source anchors #color-mixer, #color-one, #mixed-color, #color-two must exist");

    // 2. Measure baseline DOM node count for Pickr instances
    const initialPickrCount = await page.evaluate(() => {
      return document.querySelectorAll(".pcr-app").length;
    });
    assert.equal(initialPickrCount, 2, "Exactly 2 .pcr-app dialogs should exist initially");

    // 3. First round of user interaction
    await page.evaluate(() => {
      const slider = document.getElementById("percentage-one");
      slider.value = 75;
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const labelAfterFirst = await page.locator("#percentage-one-label").innerText();
    assert.equal(labelAfterFirst.trim(), "75%", "Slider label should update to 75% on first interaction");

    // 4. Trigger repeat initialization
    await page.evaluate(() => {
      window.init();
      window.updateColorMix();
    });

    // 5. Verify DOM node count does not multiply
    const pickrCountAfterReinit = await page.evaluate(() => {
      return document.querySelectorAll(".pcr-app").length;
    });
    assert.equal(
      pickrCountAfterReinit,
      2,
      `Repeat initialization must not duplicate .pcr-app elements (expected 2, found ${pickrCountAfterReinit})`
    );

    // 6. Second round of user interaction
    await page.evaluate(() => {
      const slider = document.getElementById("percentage-two");
      slider.value = 25;
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const labelTwoAfterSecond = await page.locator("#percentage-two-label").innerText();
    assert.equal(labelTwoAfterSecond.trim(), "25%", "Slider two label should update to 25% on second interaction");

    // 7. Verify color space changes properly update output text and DOM state
    await page.evaluate(() => {
      const cs = document.getElementById("color-space");
      cs.value = "srgb";
      cs.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const outputText = await page.locator("#mix-output-text").innerText();
    assert.ok(
      outputText.includes("color-mix(in srgb"),
      `Output text should reflect srgb color-mix, got: ${outputText}`
    );

    // 8. Verify no unhandled page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T014 repeat initialization checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T014 check failed:", err);
  process.exit(1);
});
