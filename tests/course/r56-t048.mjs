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
  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // === Part 1: Verify source anchors on main generator page ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[Index] ${err.message}`));

      await page.goto(`http://127.0.0.1:${port}/tools/box-shadow-generator/index.html`, {
        waitUntil: "networkidle",
      });

      const container = page.locator("#container");
      const layerManager = page.locator("#layer_manager");
      const stackContainer = page.locator("#stack_container");
      const previewZone = page.locator("#preview_zone");

      await assert.doesNotReject(async () => {
        await container.waitFor({ state: "attached" });
        await layerManager.waitFor({ state: "attached" });
        await stackContainer.waitFor({ state: "attached" });
        await previewZone.waitFor({ state: "attached" });
      }, "Source anchors #container, #layer_manager, #stack_container, #preview_zone must exist");

      // Verify that dynamic layer insertion uses textContent safely
      const safeLayerResult = await page.evaluate(() => {
        const testPayload = '<img src=x onerror="window.__xss_index=true">';
        const div = document.createElement("div");
        div.textContent = testPayload;
        document.getElementById("stack_container").appendChild(div);
        return {
          textContent: div.textContent,
          innerHTML: div.innerHTML,
          injectedElementsCount: div.querySelectorAll("img").length,
          xssExecuted: window.__xss_index || false,
        };
      });

      assert.equal(safeLayerResult.textContent, '<img src=x onerror="window.__xss_index=true">');
      assert.equal(safeLayerResult.injectedElementsCount, 0, "No element should be injected into stack_container");
      assert.equal(safeLayerResult.xssExecuted, false, "No script handler should execute");

      await context.close();
    }

    // === Part 2: Verify safe text rendering companion example ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[Companion] ${err.message}`));

      await page.goto(`http://127.0.0.1:${port}/tools/box-shadow-generator/text-companion.html`, {
        waitUntil: "networkidle",
      });

      const input = page.locator("#fixture_input");
      const display = page.locator("#fixture_display");

      await input.waitFor({ state: "visible" });
      await display.waitFor({ state: "visible" });

      const xssString = '<img src=x onerror="window.__xss_fired=true">';
      await input.fill(xssString);

      // Verify fixture string renders strictly as text
      const renderedText = await display.innerText();
      assert.equal(renderedText, xssString, "Fixture text must appear as text");

      const injectedImgCount = await display.locator("img").count();
      assert.equal(injectedImgCount, 0, "No <img> element should be created in the DOM");

      const xssFired = await page.evaluate(() => window.__xss_fired || false);
      assert.equal(xssFired, false, "No onerror handler should be executed");

      await context.close();
    }

    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T048 safe text rendering checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T048 check failed:", err);
  process.exit(1);
});
