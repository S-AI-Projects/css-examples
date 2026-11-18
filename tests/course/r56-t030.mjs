import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/grid/subgrid/gap.html";
const workDir = path.join(root, "work", "R56-T030");

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

async function runDeterministicCycle(browser, origin, cycleIndex) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
  });

  // Block any non-local external requests to guarantee zero external dependency
  await context.route("**/*", (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith(origin)) {
      route.continue();
    } else {
      route.abort("blockedbyclient");
    }
  });

  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (err) => errors.push(`PageError: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`ConsoleError: ${msg.text()}`);
  });

  await page.goto(`${origin}${pagePath}`, { waitUntil: "networkidle" });

  const grid = page.locator(".preview .grid");
  const item = page.locator(".preview .grid .item");
  const subitem = page.locator(".preview .grid .item .subitem");
  const textareaCSS = page.locator(".playable-css");
  const resetButton = page.locator("#reset");

  await assert.doesNotReject(grid.waitFor({ state: "visible" }));
  await assert.doesNotReject(item.waitFor({ state: "visible" }));
  await assert.doesNotReject(resetButton.waitFor({ state: "visible" }));

  // Capture baseline snapshot before interaction
  const snapshotBefore = await page.evaluate(() => {
    const sectionEl = document.querySelector("section.preview");
    const gridEl = document.querySelector(".preview .grid");
    const itemEl = document.querySelector(".preview .grid .item");
    const gridStyle = window.getComputedStyle(gridEl);
    const itemStyle = window.getComputedStyle(itemEl);

    return {
      html: sectionEl.innerHTML.trim(),
      gridDisplay: gridStyle.display,
      gridGap: gridStyle.gap,
      itemDisplay: itemStyle.display,
      elementCount: sectionEl.querySelectorAll("*").length,
    };
  });

  // Interactive step: modify CSS gap
  await textareaCSS.fill(
    `.grid { display: grid; grid-template-columns: repeat(9, 1fr); gap: 35px; }\n.item { display: grid; grid-template-columns: subgrid; grid-template-rows: subgrid; }`
  );
  await textareaCSS.dispatchEvent("input");

  const modifiedGap = await grid.evaluate((el) => window.getComputedStyle(el).gap);
  assert.equal(modifiedGap, "35px", "Modified grid gap must equal 35px");

  // Reset step
  await resetButton.click();

  // Capture restored snapshot
  const snapshotAfterReset = await page.evaluate(() => {
    const sectionEl = document.querySelector("section.preview");
    const gridEl = document.querySelector(".preview .grid");
    const itemEl = document.querySelector(".preview .grid .item");
    const gridStyle = window.getComputedStyle(gridEl);
    const itemStyle = window.getComputedStyle(itemEl);

    return {
      html: sectionEl.innerHTML.trim(),
      gridDisplay: gridStyle.display,
      gridGap: gridStyle.gap,
      itemDisplay: itemStyle.display,
      elementCount: sectionEl.querySelectorAll("*").length,
    };
  });

  await page.screenshot({
    path: path.join(workDir, `context${cycleIndex}-deterministic.png`),
    fullPage: true,
  });

  await context.close();
  assert.equal(errors.length, 0, `Context ${cycleIndex} page errors: ${errors.join("; ")}`);

  return { snapshotBefore, snapshotAfterReset };
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

    // Run in Context 1
    const context1Result = await runDeterministicCycle(browser, origin, 1);

    // Run in Fresh Context 2
    const context2Result = await runDeterministicCycle(browser, origin, 2);

    // Assert determinism across fresh browser contexts
    assert.deepEqual(
      context1Result.snapshotBefore,
      context2Result.snapshotBefore,
      "Baseline snapshot must be identical across independent browser contexts"
    );

    assert.deepEqual(
      context1Result.snapshotAfterReset,
      context2Result.snapshotAfterReset,
      "Post-reset snapshot must be identical across independent browser contexts"
    );

    assert.equal(
      context1Result.snapshotBefore.gridGap,
      "20px",
      "Baseline grid gap must be deterministic 20px"
    );

    console.log("R56-T030 deterministic browser fixtures regression passed successfully.");
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
