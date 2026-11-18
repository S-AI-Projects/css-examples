import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/editable-samples/pages/font/index.html";
const workDir = path.join(root, "work", "R56-T025");

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

    // ==========================================
    // Scenario 1: Supported Browser
    // ==========================================
    const supportedContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const supportedPage = await supportedContext.newPage();

    supportedPage.on("pageerror", (err) => pageErrors.push(`SupportedPageError: ${err.message}`));
    supportedPage.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(`SupportedConsoleError: ${msg.text()}`);
    });

    await supportedPage.goto(`${origin}${pagePath}`, { waitUntil: "networkidle" });

    // Ensure elements exist
    const editor = supportedPage.locator("#editor");
    const reset = supportedPage.locator("#reset");
    const exampleElement = supportedPage.locator("#example-element");
    const featureStatus = supportedPage.locator("#feature-status");

    await assert.doesNotReject(editor.waitFor({ state: "visible" }));
    await assert.doesNotReject(exampleElement.waitFor({ state: "visible" }));

    // Feature status must be hidden in supported environment
    const isWarningHidden = await featureStatus.evaluate((el) => el.hidden || window.getComputedStyle(el).display === "none");
    assert.equal(isWarningHidden, true, "Feature warning must remain hidden on supported browser");

    // Computed style check
    const supportedStyle = await exampleElement.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        fontStyle: s.fontStyle,
        fontFamily: s.fontFamily,
      };
    });
    assert.equal(supportedStyle.fontStyle, "italic", "Supported browser should apply italic font-style");
    assert.match(supportedStyle.fontFamily, /cursive/i, "Supported browser should apply cursive font-family");

    // Modify CodeMirror editor
    await supportedPage.evaluate(() => {
      if (window.cmEditor) {
        window.cmEditor.setValue("font: normal 2em monospace;\n");
      }
    });

    // Reset button should now be visible
    await assert.doesNotReject(reset.waitFor({ state: "visible" }));

    // Click reset
    await reset.click();

    // Reset restores initial cursive styling and hides reset button
    const restoredStyle = await exampleElement.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { fontStyle: s.fontStyle, fontFamily: s.fontFamily };
    });
    assert.equal(restoredStyle.fontStyle, "italic", "Reset should restore italic style");
    assert.match(restoredStyle.fontFamily, /cursive/i, "Reset should restore cursive font");

    await supportedPage.screenshot({ path: path.join(workDir, "supported.png") });
    await supportedContext.close();

    // ==========================================
    // Scenario 2: Unsupported Browser (Stubbed)
    // ==========================================
    const unsupportedContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    await unsupportedContext.addInitScript(() => {
      Object.defineProperty(window, "CSS", {
        configurable: true,
        value: {
          supports: () => false,
        },
      });
    });

    const unsupportedPage = await unsupportedContext.newPage();
    unsupportedPage.on("pageerror", (err) => pageErrors.push(`UnsupportedPageError: ${err.message}`));
    unsupportedPage.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(`UnsupportedConsoleError: ${msg.text()}`);
    });

    await unsupportedPage.goto(`${origin}${pagePath}`, { waitUntil: "networkidle" });

    const unsupportedWarning = unsupportedPage.locator("#feature-status");
    await assert.doesNotReject(unsupportedWarning.waitFor({ state: "visible" }));

    const warningText = await unsupportedWarning.textContent();
    assert.match(warningText, /does not support the CSS font shorthand syntax/i, "Warning text should explain unsupported feature");

    const htmlHasFallbackClass = await unsupportedPage.locator("html").evaluate((el) => el.classList.contains("no-font-support"));
    assert.equal(htmlHasFallbackClass, true, "Document element should have no-font-support class");

    await unsupportedPage.screenshot({ path: path.join(workDir, "unsupported.png") });
    await unsupportedContext.close();

    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join("; ")}`);
    console.log("R56-T025 font feature fallback regression passed successfully.");
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
