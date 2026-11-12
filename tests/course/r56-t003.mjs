
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORT = 8765;
const BASE_URL = `http://127.0.0.1:${PORT}/counter-style-demo/`;
const IMAGE_URL =
  "https://developer.cdn.mozilla.net/media/redesign/img/blueprint-dark.png";

const evidenceDir = path.join(ROOT, "work", "R56-T003");
fs.mkdirSync(evidenceDir, { recursive: true });

let server;
let browser;
const errors = [];
const results = [];

function record(name, passed, details) {
  results.push({ name, passed, details });
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // Server is not ready yet.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Local server did not become ready.");
}

async function main() {
  try {
    console.log("Starting local Python server...");

    server = spawn(
      "python3",
      ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"],
      { cwd: ROOT, stdio: "ignore" }
    );

    await waitForServer();

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on("pageerror", error => errors.push(error.message));

    // Test 1: Simulate the decorative image failing.
    let failedImageRequest = false;

    page.on("requestfailed", request => {
      if (request.url() === IMAGE_URL) {
        failedImageRequest = true;
      }
    });

    await page.route(IMAGE_URL, route => route.abort());

    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    const list = page.locator("#demo-list");
    const select = page.locator("#style-select");
    const code = page.locator("#code");

    assert.equal(await list.locator("li").count(), 30);
    assert.equal(await select.inputValue(), "cyclic");
    assert.ok((await code.innerText()).includes("@counter-style"));

    record("Demo loads with 30 list items", true, "30 items found.");

    // Test 2: Check that the image failure was simulated.
    assert.equal(failedImageRequest, true);
    record("Decorative background image failure simulated", true,
      "Image request was deliberately aborted.");

    // Test 3: Check that code remains readable.
    assert.equal(await code.isVisible(), true);
    assert.ok((await code.innerText()).includes("@counter-style"));

    const parentBackground = await code.evaluate(element =>
      getComputedStyle(element.parentElement).backgroundColor
    );

    assert.equal(parentBackground, "rgb(255, 255, 255)");

    record("CSS code remains readable after image failure", true,
      `Parent background: ${parentBackground}`);

    // Test 4: Check dropdown functionality during image failure.
    const originalCode = await code.innerText();

    await select.selectOption("fixed");

    assert.equal(await list.getAttribute("class"), "demo-fixed");
    assert.notEqual(await code.innerText(), originalCode);

    record("Dropdown updates list and CSS code", true,
      "Selected fixed counter style.");

    // Test 5: Restore the decorative image using a local SVG fixture.
    await page.unroute(IMAGE_URL);

    const svgFixture = `
      <svg xmlns="http://www.w3.org/2000/svg"
           width="20" height="20">
        <rect width="20" height="20" fill="#eeeeee"/>
      </svg>
    `;

    let restoredImageResponse = false;

    page.on("response", response => {
      if (response.url() === IMAGE_URL && response.status() === 200) {
        restoredImageResponse = true;
      }
    });

    await page.route(IMAGE_URL, route =>
      route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: svgFixture
      })
    );

    await page.reload({ waitUntil: "networkidle" });

    assert.equal(restoredImageResponse, true);
    assert.equal(await code.isVisible(), true);

    record("Background image restored successfully", true,
      "A local SVG fixture returned HTTP 200.");

    // Test 6: Check the dropdown after restoration.
    await select.selectOption("symbolic");

    assert.equal(await list.getAttribute("class"), "demo-symbolic");
    assert.ok((await code.innerText()).includes("@counter-style"));

    record("Demo works after image restoration", true,
      "Symbolic counter style selected.");

    // Test 7: Check for unexpected JavaScript errors.
    assert.deepEqual(errors, []);

    record("No unexpected JavaScript errors", true, "No page errors.");

    // Save a screenshot as supporting evidence.
    await page.screenshot({
      path: path.join(evidenceDir, "restored-demo.png"),
      fullPage: true
    });

    await context.close();

  } finally {
    if (browser) await browser.close();

    if (server && !server.killed) {
      server.kill();
    }

    const report = [
      "# R56-T003 Test Results",
      "",
      `Node.js: ${process.version}`,
      "",
      "## Results",
      "",
      ...results.map(result =>
        `- ${result.passed ? "PASS" : "FAIL"}: ${result.name}\n  - ${result.details}`
      ),
      "",
      `Total: ${results.filter(r => r.passed).length}/${results.length} passed.`,
      "",
      "## Unexpected JavaScript errors",
      "",
      errors.length ? errors.join("\n") : "None."
    ].join("\n");

    fs.writeFileSync(
      path.join(evidenceDir, "test-results.md"),
      report
    );
  }
}

main().catch(error => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});
