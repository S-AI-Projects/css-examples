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
  const pageUrl = `http://127.0.0.1:${port}/learn/values-units/calc.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // === 1. Test standard preferences & visible focus ===
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Verify anchor #reset
      const resetBtn = page.locator("#reset");
      const cssEditor = page.locator(".playable-css");
      const htmlEditor = page.locator(".playable-html");

      await assert.doesNotReject(async () => {
        await resetBtn.waitFor({ state: "visible" });
        await cssEditor.waitFor({ state: "visible" });
        await htmlEditor.waitFor({ state: "visible" });
      }, "Source anchor #reset and playable editors must be present and visible");

      // Verify static layout calculation: width of .box should be 180px
      // 400px wrapper, width: calc(20% + 100px) -> 80 + 100 = 180px
      const initialBoxWidth = await page.locator(".box").evaluate((el) => {
        return Math.round(el.getBoundingClientRect().width);
      });
      assert.equal(initialBoxWidth, 180, "Initial calculated box width must be exactly 180px");

      // Verify focus visibility on interactive controls
      for (const selector of [".playable-css", ".playable-html", "#reset"]) {
        await page.focus(selector);
        const focusOutline = await page.locator(selector).evaluate((el) => {
          const s = window.getComputedStyle(el);
          return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
        });
        assert.notEqual(
          focusOutline.outlineStyle,
          "none",
          `Element ${selector} must have visible focus outline on keyboard focus`
        );
      }

      // Verify interactive editing and reset
      await cssEditor.fill(`.wrapper { width: 500px; } .box { width: calc(50% + 50px); }`);
      await cssEditor.dispatchEvent("input");

      const modifiedWidth = await page.locator(".box").evaluate((el) => {
        return Math.round(el.getBoundingClientRect().width);
      });
      assert.equal(modifiedWidth, 300, "Modified box width should calculate to 300px (500*0.5 + 50)");

      // Click Reset and verify restored to 180px
      await resetBtn.click();
      const restoredWidth = await page.locator(".box").evaluate((el) => {
        return Math.round(el.getBoundingClientRect().width);
      });
      assert.equal(restoredWidth, 180, "Reset must restore box width back to 180px");

      await context.close();
    }

    // === 2. Test prefers-reduced-motion preference ===
    {
      const context = await browser.newContext({
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(`[reduced-motion] ${err.message}`));

      await page.goto(pageUrl, { waitUntil: "networkidle" });

      // Verify prefers-reduced-motion media query matches
      const matchesReduce = await page.evaluate(() => {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      });
      assert.equal(matchesReduce, true, "prefers-reduced-motion: reduce media query should be active");

      // Verify no unexpected animations are active
      const animationsCount = await page.evaluate(() => {
        return document.getAnimations().length;
      });
      assert.equal(animationsCount, 0, "No active CSS animations should be running");

      // Verify static layout calculation remains identical under reduced motion
      const boxWidth = await page.locator(".box").evaluate((el) => {
        return Math.round(el.getBoundingClientRect().width);
      });
      assert.equal(boxWidth, 180, "Box width under reduced motion must calculate to 180px");

      await context.close();
    }

    assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join("; ")}`);
    console.log("PASS: R56-T019 motion and focus preferences checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T019 check failed:", err);
  process.exit(1);
});
