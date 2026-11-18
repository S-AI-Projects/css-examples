import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/learn/box-model/block.html";
const workDir = path.join(root, "work", "R56-T028");

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

async function testViewport(browser, origin, width, height, label) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (err) => errors.push(`PageError: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`ConsoleError: ${msg.text()}`);
  });

  await page.goto(`${origin}${pagePath}`, { waitUntil: "networkidle" });

  // Verify reduced-motion query matches
  const hasReducedMotion = await page.evaluate(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  assert.equal(hasReducedMotion, true, `prefers-reduced-motion should match on ${label}`);

  // Document and assert that page is static / non-animated
  const motionStyles = await page.evaluate(() => {
    const el = document.querySelector(".preview");
    const s = window.getComputedStyle(el);
    return {
      animationName: s.animationName,
      transitionProperty: s.transitionProperty,
    };
  });
  assert.equal(motionStyles.animationName, "none", "Preview element should not have animations");

  // Verify visible keyboard focus on #reset
  const resetButton = page.locator("#reset");
  await resetButton.focus();

  const focusStyle = await resetButton.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return {
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      outlineColor: s.outlineColor,
    };
  });
  assert.notEqual(focusStyle.outlineStyle, "none", `Reset button must have visible outline style on ${label}`);
  assert.notEqual(focusStyle.outlineWidth, "0px", `Reset button outline width must be non-zero on ${label}`);

  // Test interactive editing and reset
  const textareaCSS = page.locator(".playable-css");
  await textareaCSS.focus();
  await textareaCSS.fill("p { border: 5px solid red; }");
  await textareaCSS.dispatchEvent("input");

  const modifiedPBorder = await page.locator(".preview p").first().evaluate((el) => window.getComputedStyle(el).borderTopWidth);
  assert.equal(modifiedPBorder, "5px", "Paragraph border should update to 5px");

  await resetButton.click();
  const resetPBorder = await page.locator(".preview p").first().evaluate((el) => window.getComputedStyle(el).borderTopWidth);
  assert.equal(resetPBorder, "2px", "Paragraph border should restore to 2px after reset");

  await page.screenshot({
    path: path.join(workDir, `${label}-focus-reduced-motion.png`),
    fullPage: true,
  });

  await context.close();
  assert.equal(errors.length, 0, `Errors encountered on ${label}: ${errors.join("; ")}`);
}

async function run() {
  await fs.mkdir(workDir, { recursive: true });

  const port = await getAvailablePort();
  const server = spawn("python3", ["-m", "http.server", String(port)], {
    cwd: root,
    stdio: "ignore",
  });

  let browser;

  try {
    const origin = `http://127.0.0.1:${port}`;
    await waitForServer(server, `${origin}${pagePath}`);

    browser = await chromium.launch({ headless: true });

    // Test Desktop (1280x800)
    await testViewport(browser, origin, 1280, 800, "desktop");

    // Test Mobile (360x800)
    await testViewport(browser, origin, 360, 800, "mobile");

    console.log("R56-T028 motion and focus preferences regression passed successfully.");
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
