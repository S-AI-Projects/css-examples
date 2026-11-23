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

async function captureDomMetrics(page) {
  return page.evaluate(() => {
    const box = document.querySelector(".box");
    const img = document.querySelector(".box img");
    const p = document.querySelector(".box p");
    const boxStyle = window.getComputedStyle(box);
    const imgStyle = window.getComputedStyle(img);

    const boxRect = box.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    const pRect = p.getBoundingClientRect();

    return {
      styles: {
        boxInlineSize: boxStyle.inlineSize,
        boxWritingMode: boxStyle.writingMode,
        imgFloat: imgStyle.float,
        imgMarginRight: imgStyle.marginRight,
        imgMarginBottom: imgStyle.marginBottom,
      },
      geometry: {
        boxWidth: Math.round(boxRect.width),
        boxHeight: Math.round(boxRect.height),
        imgWidth: Math.round(imgRect.width),
        imgHeight: Math.round(imgRect.height),
        pWidth: Math.round(pRect.width),
      },
    };
  });
}

async function runTest() {
  const { server, port } = await createStaticServer();
  const pageUrl = `http://127.0.0.1:${port}/learn/writing-modes/float.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // === Context 1: Fresh browser context with locked viewport ===
    const context1 = await browser.newContext({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 1,
    });
    const page1 = await context1.newPage();
    page1.on("pageerror", (err) => pageErrors.push(`[Context1] ${err.message}`));

    await page1.goto(pageUrl, { waitUntil: "networkidle" });
    const reset1 = page1.locator("#reset");
    await reset1.waitFor({ state: "visible" });
    const metrics1 = await captureDomMetrics(page1);

    // === Context 2: Independent fresh browser context with identical locked fixtures ===
    const context2 = await browser.newContext({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 1,
    });
    const page2 = await context2.newPage();
    page2.on("pageerror", (err) => pageErrors.push(`[Context2] ${err.message}`));

    await page2.goto(pageUrl, { waitUntil: "networkidle" });
    const reset2 = page2.locator("#reset");
    await reset2.waitFor({ state: "visible" });
    const metrics2 = await captureDomMetrics(page2);

    // Assert computed styles are deterministic
    assert.deepEqual(
      metrics1.styles,
      metrics2.styles,
      "Computed styles must be identical across both fresh contexts"
    );

    // Assert logical property values
    assert.equal(metrics1.styles.boxInlineSize, "200px", "Inline size must be 200px");
    assert.equal(metrics1.styles.boxWritingMode, "horizontal-tb", "Writing mode must be horizontal-tb");
    assert.ok(
      metrics1.styles.imgFloat === "inline-start" || metrics1.styles.imgFloat === "left",
      `Float inline-start must compute to inline-start or left, got: ${metrics1.styles.imgFloat}`
    );
    assert.equal(metrics1.styles.imgMarginRight, "10px", "Margin inline-end must compute to 10px");
    assert.equal(metrics1.styles.imgMarginBottom, "10px", "Margin block-end must compute to 10px");

    // Assert layout geometry matches identically between contexts
    assert.deepEqual(
      metrics1.geometry,
      metrics2.geometry,
      "Rendered layout geometry must be completely deterministic across independent browser contexts"
    );

    // Test #reset interaction in Context 1
    const cssTextarea = page1.locator(".playable-css");
    await cssTextarea.fill(".box { inline-size: 300px; }");
    await cssTextarea.dispatchEvent("input");

    const modifiedWidth = await page1.locator(".box").evaluate((el) =>
      Math.round(el.getBoundingClientRect().width)
    );
    assert.equal(modifiedWidth, 300, "Box width should update to 300px on edit");

    await reset1.click();
    const restoredMetrics = await captureDomMetrics(page1);
    assert.equal(
      restoredMetrics.geometry.boxWidth,
      metrics1.geometry.boxWidth,
      "Reset button must restore deterministic initial layout"
    );

    await context1.close();
    await context2.close();

    // Verify 0 unexpected page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T045 deterministic browser fixture checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T045 check failed:", err);
  process.exit(1);
});
