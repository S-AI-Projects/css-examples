import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/display/multi-keyword/span-flex.html";
const workDir = path.join(root, "work", "R56-T026");

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

    // Step 1: Baseline inspection
    const textareaCSS = page.locator(".playable-css");
    const textareaHTML = page.locator("#code");
    const resetButton = page.locator("#reset");
    const flexSpan = page.locator("section span.flex");

    await assert.doesNotReject(textareaCSS.waitFor({ state: "visible" }));
    await assert.doesNotReject(textareaHTML.waitFor({ state: "visible" }));
    await assert.doesNotReject(resetButton.waitFor({ state: "visible" }));
    await assert.doesNotReject(flexSpan.waitFor({ state: "visible" }));

    const initialStyle = await flexSpan.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        justifyContent: s.justifyContent,
      };
    });
    assert.equal(initialStyle.display, "flex", "Baseline display property should be flex");
    assert.equal(initialStyle.justifyContent, "space-between", "Baseline justify-content should be space-between");

    await page.screenshot({ path: path.join(workDir, "baseline-flex.png") });

    // Step 2: Interactive Walkthrough - Change CSS to inline-flex & justify-content center
    const modifiedCSS = `.flex {\n  border: 5px solid #ccc;\n  display: inline-flex;\n  justify-content: center;\n}`;
    await textareaCSS.fill(modifiedCSS);
    await textareaCSS.dispatchEvent("input");

    const modifiedStyle = await flexSpan.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        justifyContent: s.justifyContent,
      };
    });
    assert.equal(modifiedStyle.display, "inline-flex", "Updated display property should be inline-flex");
    assert.equal(modifiedStyle.justifyContent, "center", "Updated justify-content should be center");

    await page.screenshot({ path: path.join(workDir, "interaction-inline-flex.png") });

    // Step 3: Interactive Walkthrough - Reset functionality
    await resetButton.click();

    const restoredStyle = await flexSpan.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        justifyContent: s.justifyContent,
      };
    });
    assert.equal(restoredStyle.display, "flex", "Restored display property should return to flex");
    assert.equal(restoredStyle.justifyContent, "space-between", "Restored justify-content should return to space-between");

    await page.screenshot({ path: path.join(workDir, "reset-restored.png") });

    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join("; ")}`);
    console.log("R56-T026 span-flex walkthrough regression passed successfully.");
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
