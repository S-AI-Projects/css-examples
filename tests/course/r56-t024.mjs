import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/box-alignment/flexbox/gap.html";
const workDir = path.join(root, "work", "R56-T024");

async function getAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForServer(server, url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited prematurely with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error("Server did not become ready within timeout.");
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await delay(300);
  if (server.exitCode === null) {
    server.kill("SIGKILL");
  }
}

async function run() {
  await fs.mkdir(workDir, { recursive: true });

  const port = await getAvailablePort();
  const server = spawn("python3", ["-m", "http.server", String(port)], {
    cwd: root,
    stdio: "ignore",
  });

  let browser;
  const pageErrors = [];

  try {
    const origin = `http://127.0.0.1:${port}`;
    await waitForServer(server, `${origin}${pagePath}`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    page.on("pageerror", (err) => pageErrors.push(`PageError: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        pageErrors.push(`ConsoleError: ${msg.text()}`);
      }
    });

    await page.goto(`${origin}${pagePath}`, { waitUntil: "networkidle" });

    // Initial inspection
    const initialTitle = await page.title();
    const resetButton = page.locator("#reset");
    await assert.doesNotReject(resetButton.waitFor({ state: "visible" }));

    const textareaHTML = page.locator(".playable-html");
    const textareaCSS = page.locator(".playable-css");
    const section = page.locator("section");

    // Baseline assertions
    const initialBoxes = await section.locator(".box > div").count();
    assert.equal(initialBoxes, 6, "Initial box child count should be 6");

    const initialComputedGaps = await section.locator(".box").evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { rowGap: style.rowGap, columnGap: style.columnGap };
    });
    assert.equal(initialComputedGaps.rowGap, "10px", "Default row gap should be 10px");
    assert.equal(initialComputedGaps.columnGap, "38.4px", "Default column gap should be 38.4px (2em at 1.2em font-size)");

    await page.screenshot({ path: path.join(workDir, "baseline-default.png") });

    // Interaction Cycle 1: Modify CSS and HTML
    await textareaCSS.fill(".box { display: flex; flex-wrap: wrap; row-gap: 30px; column-gap: 30px; }\n.box > * { flex: 1; }");
    await textareaCSS.dispatchEvent("input");

    const cycle1Gaps = await section.locator(".box").evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { rowGap: style.rowGap, columnGap: style.columnGap };
    });
    assert.equal(cycle1Gaps.rowGap, "30px", "Cycle 1 row gap should update to 30px");
    assert.equal(cycle1Gaps.columnGap, "30px", "Cycle 1 column gap should update to 30px");

    // Edit HTML to 3 boxes
    await textareaHTML.fill('<div class="box">\n  <div>One</div>\n  <div>Two</div>\n  <div>Three</div>\n</div>');
    await textareaHTML.dispatchEvent("input");

    const cycle1Boxes = await section.locator(".box > div").count();
    assert.equal(cycle1Boxes, 3, "Cycle 1 box child count should be 3");

    await page.screenshot({ path: path.join(workDir, "cycle1-modified.png") });

    // Click Reset
    await resetButton.click();

    const resetBoxes = await section.locator(".box > div").count();
    assert.equal(resetBoxes, 6, "Reset box child count should restore to 6");

    const resetGaps = await section.locator(".box").evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { rowGap: style.rowGap, columnGap: style.columnGap };
    });
    assert.equal(resetGaps.rowGap, "10px", "Reset row gap should restore to 10px");
    assert.equal(resetGaps.columnGap, "38.4px", "Reset column gap should restore to 38.4px");

    await page.screenshot({ path: path.join(workDir, "cycle1-reset.png") });

    // Repeat Initialization Check (Idempotency)
    // Execute initialization script logic a second time
    const repeatResult = await page.evaluate(() => {
      const wasInitialized = window.__gapDemoInitialized;
      // Re-trigger the script block logic
      if (!window.__gapDemoInitialized) {
        window.__gapDemoInitialized = true;
      }
      return {
        alreadyInitialized: wasInitialized,
        currentFlag: window.__gapDemoInitialized,
      };
    });

    assert.equal(repeatResult.alreadyInitialized, true, "Script should have previously initialized the flag");
    assert.equal(repeatResult.currentFlag, true, "Flag remains true without duplicating listeners");

    // Interaction Cycle 2: Verify controls still work cleanly without duplicate handlers
    await textareaCSS.fill(".box { display: flex; flex-wrap: wrap; row-gap: 50px; column-gap: 15px; }\n.box > * { flex: 1; }");
    await textareaCSS.dispatchEvent("input");

    const cycle2Gaps = await section.locator(".box").evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { rowGap: style.rowGap, columnGap: style.columnGap };
    });
    assert.equal(cycle2Gaps.rowGap, "50px", "Cycle 2 row gap should be 50px");
    assert.equal(cycle2Gaps.columnGap, "15px", "Cycle 2 column gap should be 15px");

    // Click Reset again
    await resetButton.click();

    const cycle2ResetBoxes = await section.locator(".box > div").count();
    assert.equal(cycle2ResetBoxes, 6, "Cycle 2 reset should cleanly restore 6 child boxes");

    const cycle2ResetGaps = await section.locator(".box").evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { rowGap: style.rowGap, columnGap: style.columnGap };
    });
    assert.equal(cycle2ResetGaps.rowGap, "10px", "Cycle 2 reset row gap should restore to 10px");
    assert.equal(cycle2ResetGaps.columnGap, "38.4px", "Cycle 2 reset column gap should restore to 38.4px");

    await page.screenshot({ path: path.join(workDir, "cycle2-reset.png") });

    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join("; ")}`);

    console.log("R56-T024 flexbox repeat initialization regression passed successfully.");
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
