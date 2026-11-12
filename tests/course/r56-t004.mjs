
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const PORT = 8765;
const URL = `http://127.0.0.1:${PORT}/editable-samples/pages/font/index.html`;

let server;
let browser;
let context;

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {
      // Server may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Local server did not become ready.");
}

async function main() {
  const errors = [];

  try {
    console.log("Starting local Python server...");

    server = spawn(
      "python3",
      ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"],
      { cwd: ROOT, stdio: "ignore" },
    );

    await waitForServer();

    console.log("Launching Chromium...");

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();

    const page = await context.newPage();

    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(URL, { waitUntil: "load" });

    // Check the original page.
    assert.equal(await page.locator(".CodeMirror").count(), 1);
    assert.equal(await page.locator("#output").count(), 1);
    assert.equal(await page.locator("#example-element").count(), 1);
    assert.equal(await page.locator("#reset").isVisible(), false);

    console.log("PASS: Initial page contains exactly one editor and output.");

    // Check initial font styling and output layout.
    const initialStyle = await page.locator("#example-element").evaluate(
      (element) => ({
        fontStyle: getComputedStyle(element).fontStyle,
        fontSize: getComputedStyle(element).fontSize,
      }),
    );

    assert.equal(initialStyle.fontStyle, "italic");
    assert.equal(initialStyle.fontSize, "24px");

    const outputHeight = await page.locator("#output").evaluate(
      (element) => getComputedStyle(element).height,
    );

    assert.equal(outputHeight, "200px");

    console.log("PASS: Initial font styling and output layout are correct.");

    // Deliberately execute the initialization script a second time.
    // This checks whether repeated initialization creates another editor.
    await page.addScriptTag({
      path: path.join(ROOT, "editable-samples/js/editable.js"),
    });

    assert.equal(
      await page.locator(".CodeMirror").count(),
      1,
      "Repeated initialization must not create a second CodeMirror editor.",
    );

    assert.equal(await page.locator("#output").count(), 1);

    console.log("PASS: Repeated initialization does not duplicate DOM.");

    // Observe how many times the output style is updated.
    await page.evaluate(() => {
      window.__styleMutations = [];

      const element = document.querySelector("#example-element");

      window.__styleObserver = new MutationObserver((records) => {
        window.__styleMutations.push(...records);
      });

      window.__styleObserver.observe(element, {
        attributes: true,
        attributeFilter: ["style"],
      });
    });

    // Perform two edit/reset cycles.
    for (let cycle = 1; cycle <= 2; cycle++) {
      await page.evaluate((number) => {
        window.__styleMutations = [];
        window.cmEditor.setValue(
          `font: bold ${number + 1}em sans-serif;`,
        );
      }, cycle);

      await page.waitForTimeout(50);

      assert.equal(
        await page.locator("#reset").isVisible(),
        true,
      );

      const editUpdates = await page.evaluate(
        () => window.__styleMutations.length,
      );

      assert.equal(
        editUpdates,
        1,
        `Cycle ${cycle}: one edit should produce exactly one output update.`,
      );

      console.log(`PASS: Edit cycle ${cycle} produces one update.`);

      await page.evaluate(() => {
        window.__styleMutations = [];
      });

      await page.locator("#reset").click();
      await page.waitForTimeout(50);

      const resetUpdates = await page.evaluate(
        () => window.__styleMutations.length,
      );

      assert.equal(
        resetUpdates,
        1,
        `Cycle ${cycle}: Reset should produce exactly one output update.`,
      );

      assert.equal(
        await page.locator("#reset").isVisible(),
        false,
      );

      const restoredStyle = await page.locator(
        "#example-element",
      ).evaluate((element) => ({
        fontStyle: getComputedStyle(element).fontStyle,
        fontSize: getComputedStyle(element).fontSize,
      }));

      assert.equal(restoredStyle.fontStyle, "italic");
      assert.equal(restoredStyle.fontSize, "24px");

      console.log(`PASS: Reset cycle ${cycle} restores the original style.`);
    }

    // Ensure no duplicate editor or output elements appeared.
    // Save a screenshot of the working font example.
await page.screenshot({
  path: path.join(ROOT, "work/R56-T004/font-demo.png"),
  fullPage: true,
});
    assert.equal(await page.locator(".CodeMirror").count(), 1);
    assert.equal(await page.locator("#output").count(), 1);
    assert.equal(await page.locator("#example-element").count(), 1);

    await page.evaluate(() => {
      window.__styleObserver.disconnect();
    });

    assert.deepEqual(errors, [], "Unexpected browser errors occurred.");

    console.log("PASS: No unexpected browser errors.");
    console.log("All Task 4 checks passed.");
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();

    if (server) {
      server.kill();
    }
  }
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
