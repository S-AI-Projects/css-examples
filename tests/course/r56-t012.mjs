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
  const pageUrl = `http://127.0.0.1:${port}/learn/images/form.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    const viewports = [
      { width: 360, height: 800, name: "Mobile" },
      { width: 1280, height: 800, name: "Desktop" },
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      page.on("pageerror", (err) => {
        pageErrors.push(`[${vp.name}] ${err.message}`);
      });

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Verify source anchors
      const nameInput = page.locator("#name");
      const emailInput = page.locator("#email");
      const resetBtn = page.locator("#reset");

      await assert.doesNotReject(async () => {
        await nameInput.waitFor({ state: "visible" });
        await emailInput.waitFor({ state: "visible" });
        await resetBtn.waitFor({ state: "visible" });
      }, `Source anchors #name, #email, #reset must be visible at ${vp.width}x${vp.height}`);

      // Verify no horizontal overflow
      const overflowMetrics = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        };
      });

      assert.ok(
        overflowMetrics.scrollWidth <= overflowMetrics.clientWidth,
        `[${vp.name}] Horizontal overflow detected: scrollWidth (${overflowMetrics.scrollWidth}) > clientWidth (${overflowMetrics.clientWidth})`
      );

      // Verify controls are not clipped horizontally
      const bounds = await page.evaluate(() => {
        const getBox = (id) => {
          const r = document.getElementById(id).getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, height: r.height };
        };
        return {
          name: getBox("name"),
          email: getBox("email"),
          reset: getBox("reset"),
          viewportWidth: window.innerWidth,
        };
      });

      assert.ok(
        bounds.name.left >= 0 && bounds.name.right <= bounds.viewportWidth,
        `[${vp.name}] #name input is clipped or horizontally overflowing: left=${bounds.name.left}, right=${bounds.name.right}, vp=${bounds.viewportWidth}`
      );
      assert.ok(
        bounds.email.left >= 0 && bounds.email.right <= bounds.viewportWidth,
        `[${vp.name}] #email input is clipped or horizontally overflowing: left=${bounds.email.left}, right=${bounds.email.right}, vp=${bounds.viewportWidth}`
      );

      // Verify content order (name comes before email, email comes before reset in vertical layout)
      const positions = await page.evaluate(() => {
        return {
          nameY: document.getElementById("name").getBoundingClientRect().top,
          emailY: document.getElementById("email").getBoundingClientRect().top,
          resetY: document.getElementById("reset").getBoundingClientRect().top,
        };
      });

      assert.ok(
        positions.nameY < positions.emailY,
        `[${vp.name}] #name should be positioned above #email`
      );
      assert.ok(
        positions.emailY < positions.resetY,
        `[${vp.name}] #email should be positioned above #reset`
      );

      // Verify Reset button is functional at this viewport
      await page.fill("#name", "Test User");
      assert.equal(await nameInput.inputValue(), "Test User");
      await resetBtn.click();
      assert.equal(await nameInput.inputValue(), "");

      await context.close();
    }

    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T012 responsive layout checks passed at 360x800 and 1280x800.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T012 check failed:", err);
  process.exit(1);
});
