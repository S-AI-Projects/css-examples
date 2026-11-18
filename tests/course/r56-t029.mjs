import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const TARGET_PATH = "/learn/tasks/grid/grid1.html";
const TARGET_FILE = path.join(ROOT, "learn/tasks/grid/grid1.html");
const FIXTURE_PATH = "/learn/tasks/grid/grid1-broken.html";
const WORK_DIR = path.join(ROOT, "work/R56-T029");

async function main() {
  fs.mkdirSync(WORK_DIR, { recursive: true });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "r56-t029-"));
  const brokenFixtureFile = path.join(tempDir, "grid1-broken.html");

  // Read original HTML and playable script
  const originalHTML = fs.readFileSync(TARGET_FILE, "utf8");
  const playableScript = fs.readFileSync(path.join(ROOT, "learn/playable.js"), "utf8");

  // Create broken fixture where CSS input listener is disabled/broken
  const brokenScript = playableScript.replace(
    'textareaCSS.addEventListener("input", fillCode);',
    '/* broken */ // textareaCSS.addEventListener("input", fillCode);'
  );

  // Embed broken script directly into the fixture to simulate broken binding
  const brokenHTML = originalHTML.replace(
    '<script src="../playable.js"></script>',
    `<script>${brokenScript}</script>`
  );
  fs.writeFileSync(brokenFixtureFile, brokenHTML, "utf8");

  // Start internal static server serving target, broken fixture, and assets
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, "http://localhost");
    const pathname = parsedUrl.pathname;

    let localPath;
    if (pathname === TARGET_PATH) {
      localPath = TARGET_FILE;
    } else if (pathname === FIXTURE_PATH) {
      localPath = brokenFixtureFile;
    } else {
      localPath = path.join(ROOT, pathname);
    }

    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      const ext = path.extname(localPath);
      const mimeTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".png": "image/png",
      };
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
      res.end(fs.readFileSync(localPath));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  let browser;
  const realPageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // ==========================================
    // Phase 1: Real Page Verification
    // ==========================================
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const realPage = await context1.newPage();
    realPage.on("pageerror", (err) => realPageErrors.push(err.message));

    await realPage.goto(`${origin}${TARGET_PATH}`, { waitUntil: "networkidle" });

    const grid = realPage.locator(".preview .grid");
    const textareaCSS = realPage.locator(".playable-css");
    const resetButton = realPage.locator("#reset");

    // Baseline: display should be block
    const initialDisplay = await grid.evaluate((el) => window.getComputedStyle(el).display);
    assert.equal(initialDisplay, "block", "Baseline .grid display should be block");

    // Modify CSS to grid layout
    const gridCSS = `.grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr 1fr;\n  gap: 20px;\n}`;
    await textareaCSS.fill(gridCSS);
    await textareaCSS.dispatchEvent("input");

    // Assert update occurs
    const updatedDisplay = await grid.evaluate((el) => window.getComputedStyle(el).display);
    const updatedGap = await grid.evaluate((el) => window.getComputedStyle(el).rowGap);
    assert.equal(updatedDisplay, "grid", "Real page must update .grid display to grid");
    assert.equal(updatedGap, "20px", "Real page must update .grid gap to 20px");

    await realPage.screenshot({ path: path.join(WORK_DIR, "grid-applied.png") });

    // Click Reset
    await resetButton.click();
    const restoredDisplay = await grid.evaluate((el) => window.getComputedStyle(el).display);
    assert.equal(restoredDisplay, "block", "Real page must restore .grid display to block on reset");

    await realPage.screenshot({ path: path.join(WORK_DIR, "baseline-restored.png") });
    await context1.close();

    // ==========================================
    // Phase 2: Deliberate Fixture Mutation Check
    // ==========================================
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const brokenPage = await context2.newPage();

    await brokenPage.goto(`${origin}${FIXTURE_PATH}`, { waitUntil: "networkidle" });

    const brokenGrid = brokenPage.locator(".preview .grid");
    const brokenTextarea = brokenPage.locator(".playable-css");

    await brokenTextarea.fill(gridCSS);
    await brokenTextarea.dispatchEvent("input");

    // On broken fixture, input listener was removed, so display stays "block"
    const brokenDisplay = await brokenGrid.evaluate((el) => window.getComputedStyle(el).display);
    assert.equal(
      brokenDisplay,
      "block",
      "Broken fixture must fail to update display to grid (catching regression)"
    );

    await brokenPage.screenshot({ path: path.join(WORK_DIR, "broken-fixture-regression.png") });
    await context2.close();

    assert.equal(realPageErrors.length, 0, `Page errors encountered: ${realPageErrors.join("; ")}`);
    console.log("R56-T029 UI regression detection check passed successfully.");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
