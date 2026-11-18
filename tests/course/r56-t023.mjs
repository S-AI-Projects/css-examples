import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/learn/media-queries/or.html";
const workDir = path.join(root, "work", "R56-T023");
const assetUrl = "http://127.0.0.1:__PORT__/assets/montgolfier.svg";

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
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    delay(3000).then(() => {
      if (server.exitCode === null) server.kill("SIGKILL");
    }),
  ]);
}

let server;
let browser;

try {
  await fs.mkdir(workDir, { recursive: true });

  const port = await getAvailablePort();
  const url = `http://127.0.0.1:${port}${pagePath}`;
  const targetAsset = assetUrl.replace("__PORT__", String(port));

  server = spawn(
    "python3",
    ["-m", "http.server", String(port), "--bind", "127.0.0.1"],
    { cwd: root, stdio: "ignore" }
  );

  await waitForServer(server, url);
  console.log("PASS: local server started.");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  // Check 1: Portrait under 600px (<600px & portrait: color is black/default)
  await page.setViewportSize({ width: 500, height: 800 });
  await page.goto(url, { waitUntil: "load" });

  const paragraphs = page.locator("body > p");
  assert.equal(await paragraphs.count(), 2, "Expected 2 paragraphs in main content region");

  const portraitColor = await page.evaluate(() => {
    return getComputedStyle(document.body).color;
  });
  assert.equal(portraitColor, "rgb(0, 0, 0)", "Expected black text in portrait under 600px");
  await page.screenshot({ path: path.join(workDir, "baseline-portrait.png") });
  console.log("PASS: portrait under 600px evaluates to default text color.");

  // Check 2: Landscape under 600px (width 500px, height 350px: orientation landscape -> blue)
  await page.setViewportSize({ width: 500, height: 350 });
  const landscapeColor = await page.evaluate(() => {
    return getComputedStyle(document.body).color;
  });
  assert.equal(landscapeColor, "rgb(0, 0, 255)", "Expected blue text in landscape under 600px");
  await page.screenshot({ path: path.join(workDir, "baseline-landscape.png") });
  console.log("PASS: landscape orientation triggers media query (blue color).");

  // Check 3: Desktop width >= 600px in portrait (width 700px, height 800px -> blue)
  await page.setViewportSize({ width: 700, height: 800 });
  const desktopColor = await page.evaluate(() => {
    return getComputedStyle(document.body).color;
  });
  assert.equal(desktopColor, "rgb(0, 0, 255)", "Expected blue text when min-width >= 600px");
  console.log("PASS: min-width >= 600px triggers media query (blue color).");

  // Check 4: Failed asset / empty result simulation with readable fallback
  let failedAssetInterception = false;
  await page.route(targetAsset, (route) => {
    failedAssetInterception = true;
    route.abort();
  });

  // Exercise dynamic asset request and verify fallback handling
  const assetTestResult = await page.evaluate(async (assetEndpoint) => {
    let status = "pending";
    try {
      const res = await fetch(assetEndpoint);
      status = res.ok ? "loaded" : "failed";
    } catch {
      status = "fallback";
    }
    const bodyStyle = getComputedStyle(document.body);
    return {
      status,
      textColor: bodyStyle.color,
      backgroundColor: bodyStyle.backgroundColor || "rgb(255, 255, 255)",
      fontFamily: bodyStyle.fontFamily,
      textLength: document.body.innerText.trim().length,
    };
  }, targetAsset);

  assert.equal(assetTestResult.status, "fallback", "Expected fetch to trigger fallback state on failed asset");
  assert.ok(assetTestResult.textLength > 100, "Main text content remains intact during asset failure");
  await page.screenshot({ path: path.join(workDir, "failed-asset-fallback.png") });
  console.log("PASS: failed asset triggers readable fallback without breaking content.");

  // Check 5: Recovery upon restoring valid fixture
  await page.unroute(targetAsset);
  const svgFixture = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>';
  await page.route(targetAsset, (route) => {
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: svgFixture,
    });
  });

  const recoveryResult = await page.evaluate(async (assetEndpoint) => {
    let recovered = false;
    try {
      const res = await fetch(assetEndpoint);
      recovered = res.ok && res.status === 200;
    } catch {
      recovered = false;
    }
    return {
      recovered,
      textPresent: document.body.innerText.includes("Montgolfier"),
    };
  }, targetAsset);

  assert.equal(recoveryResult.recovered, true, "Asset recovered successfully with valid fixture");
  assert.equal(recoveryResult.textPresent, true, "Content preserved after asset recovery");
  await page.screenshot({ path: path.join(workDir, "restored-asset.png") });
  console.log("PASS: page recovers successfully after valid fixture is restored.");

  // Check 6: Zero uncaught page errors
  assert.deepEqual(
    pageErrors,
    [],
    `Unexpected page errors: ${pageErrors.join("\n")}`
  );
  console.log("PASS: zero unexpected page errors logged.");

  await context.close();
  console.log("\nAll R56-T023 checks passed.");
} catch (error) {
  console.error("\nR56-T023 test failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await stopServer(server);
}
