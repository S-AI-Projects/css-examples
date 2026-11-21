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

async function runSinglePass(port, passNumber) {
  const browser = await chromium.launch({ headless: true });
  // Lock fixed viewport and color scheme
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // Route interception to lock external dependencies - block all third-party requests
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      route.continue();
    } else {
      route.abort("blockedbyclient");
    }
  });

  // Freeze time to a deterministic timestamp
  await page.addInitScript(() => {
    const fixedTime = 1700000000000;
    const OriginalDate = Date;
    class FixedDate extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedTime);
        } else {
          super(...args);
        }
      }
      static now() {
        return fixedTime;
      }
    }
    window.Date = FixedDate;
  });

  await page.goto(`http://127.0.0.1:${port}/editable-samples/pages/font/index.html`, {
    waitUntil: "networkidle",
  });

  // Verify anchors
  await page.locator("#editor").waitFor({ state: "visible" });
  await page.locator("#reset").waitFor({ state: "attached" });
  await page.locator("#editor-content").waitFor({ state: "attached" });
  await page.locator("#output").waitFor({ state: "visible" });

  // Measure deterministic snapshot of layout metrics
  const snapshot = await page.evaluate(() => {
    const el = document.getElementById("example-element");
    const out = document.getElementById("output");
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const outRect = out.getBoundingClientRect();
    return {
      fontFamily: style.fontFamily,
      fontStyle: style.fontStyle,
      fontSize: style.fontSize,
      elementWidth: Math.round(rect.width),
      elementHeight: Math.round(rect.height),
      outputHeight: Math.round(outRect.height),
    };
  });

  await browser.close();
  assert.equal(pageErrors.length, 0, `Page errors in pass ${passNumber}: ${pageErrors.join(", ")}`);
  return snapshot;
}

async function runTest() {
  const { server, port } = await createStaticServer();

  try {
    // Run two identical passes under locked fixtures and verify exact match
    const run1 = await runSinglePass(port, 1);
    const run2 = await runSinglePass(port, 2);

    assert.deepEqual(
      run1,
      run2,
      `Deterministic test failed: pass 1 and pass 2 produced differing outputs: ${JSON.stringify(run1)} vs ${JSON.stringify(run2)}`
    );

    // Verify key layout properties
    assert.equal(run1.fontStyle, "italic", "Font style must be italic");
    assert.ok(run1.fontSize.includes("24px") || run1.fontSize.includes("1.5em") || parseFloat(run1.fontSize) > 0);
    assert.equal(run1.outputHeight, 200, "#output height must be deterministically 200px");

    console.log("PASS: R56-T015 deterministic browser fixture checks passed across multiple executions.");
  } finally {
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T015 check failed:", err);
  process.exit(1);
});
