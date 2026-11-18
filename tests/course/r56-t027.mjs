import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/grid/subgrid/gap.html";
const workDir = path.join(root, "work", "R56-T027");

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
      if (msg.type() === "error") pageErrors.push(`ConsoleError: ${msg.text()}`);
    });

    await page.goto(`${origin}${pagePath}`, { waitUntil: "networkidle" });

    // Verify subgrid page structure
    const grid = page.locator(".preview .grid");
    const item = page.locator(".preview .grid .item");
    const resetButton = page.locator("#reset");
    const safeTextInput = page.locator("#safe-text-input");
    const safeTextPreview = page.locator(".safe-text-preview");

    await assert.doesNotReject(grid.waitFor({ state: "visible" }));
    await assert.doesNotReject(item.waitFor({ state: "visible" }));
    await assert.doesNotReject(resetButton.waitFor({ state: "visible" }));
    await assert.doesNotReject(safeTextInput.waitFor({ state: "visible" }));
    await assert.doesNotReject(safeTextPreview.waitFor({ state: "visible" }));

    // Verify baseline subgrid CSS
    const subgridDisplay = await item.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        gridTemplateColumns: s.gridTemplateColumns,
      };
    });
    assert.equal(subgridDisplay.display, "grid", "Item should display as grid");

    // Safe Text Rendering Verification
    const maliciousPayload = `<img src=x onerror="window.__xssTriggered=true">`;
    await safeTextInput.fill(maliciousPayload);
    await safeTextInput.dispatchEvent("input");

    // Assert text appears as text
    const renderedText = await safeTextPreview.textContent();
    assert.equal(renderedText, maliciousPayload, "Rendered text should match the payload literally");

    // Assert no injected element was created
    const imgCount = await safeTextPreview.locator("img").count();
    assert.equal(imgCount, 0, "No img element should be injected into the preview");

    // Assert no script handler was executed
    const xssTriggered = await page.evaluate(() => window.__xssTriggered);
    assert.equal(xssTriggered, undefined, "Payload script handler must not execute");

    // Verify playground Reset functionality
    await resetButton.click();
    assert.equal(await item.locator(".subitem").count(), 1, "Subitem should still be present after reset");

    await page.screenshot({ path: path.join(workDir, "safe-text-rendering.png"), fullPage: true });

    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join("; ")}`);
    console.log("R56-T027 safe text rendering regression passed successfully.");
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
