
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const TARGET = path.join(ROOT, "multicol/fragmentation/orphans.html");
const TARGET_URL = "/multicol/fragmentation/orphans.html";
const FIXTURE_URL = "/__fixture/orphans.html";
const EVIDENCE = path.join(ROOT, "work/R56-T010");

function startServer(fixturePath) {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;

    let filePath;

    if (pathname === TARGET_URL) {
      filePath = TARGET;
    } else if (pathname === FIXTURE_URL) {
      filePath = fixturePath;
    } else {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    try {
      const content = fs.readFileSync(filePath);

      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });

      response.end(content);
    } catch (error) {
      response.writeHead(500);
      response.end(error.message);
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      resolve({
        server,
        baseURL: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function watchPageErrors(page) {
  const errors = [];

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  return errors;
}

function assertNoPageErrors(errors, label) {
  assert.deepEqual(
    errors,
    [],
    `${label}: unexpected browser page errors`,
  );
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const originalHTML = fs.readFileSync(TARGET, "utf8");

  const listener =
    'textareaHTML.addEventListener("input", fillCode);';

  assert.equal(
    originalHTML.split(listener).length - 1,
    1,
    "The expected HTML input listener must occur exactly once",
  );

  // Create a temporary broken fixture without changing the real example.
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "r56-t010-"),
  );

  const fixturePath = path.join(
    tempDirectory,
    "orphans-broken.html",
  );

  fs.writeFileSync(
    fixturePath,
    originalHTML.replace(
      listener,
      "// Temporary regression: HTML input listener removed.",
    ),
  );

  let server;
  let browser;

  try {
    // Start a local HTTP server and wait until it is ready.
    const running = await startServer(fixturePath);

    server = running.server;

    const baseURL = running.baseURL;

    browser = await chromium.launch({
      headless: true,
    });
    const browserVersion = browser.version();

    // --------------------------------------------------
    // Test 1: Original page baseline
    // --------------------------------------------------

    const context = await browser.newContext({
      viewport: {
        width: 1280,
        height: 900,
      },
    });

    const page = await context.newPage();
    const pageErrors = watchPageErrors(page);

    await page.goto(`${baseURL}${TARGET_URL}`, {
      waitUntil: "load",
    });

    assert.equal(
      await page.title(),
      "Multicol example - orphans",
    );

    await page.locator("#code").waitFor();
    await page.locator("#reset").waitFor();
    await page.locator(".playable-css").waitFor();

    const htmlEditor = page.locator("#code");
    const cssEditor = page.locator(".playable-css");
    const preview = page.locator("section");
    const container = preview.locator(".container");

    const originalHTMLValue = await htmlEditor.inputValue();
    const originalCSSValue = await cssEditor.inputValue();

    assert.match(originalHTMLValue, /Veggies/);
    assert.match(originalCSSValue, /column-width:\s*200px/);
    assert.match(originalCSSValue, /orphans:\s*3/);

    assert.equal(
      await container.locator("p").count(),
      3,
    );

    const baselineStyle = await container.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return {
        columnWidth: style.columnWidth,
        orphans: style.orphans,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });

    assert.equal(baselineStyle.columnWidth, "200px");
    assert.equal(baselineStyle.orphans, "3");

    assert.ok(baselineStyle.width > 0);
    assert.ok(baselineStyle.height > 0);

    await page.screenshot({
      path: path.join(EVIDENCE, "baseline.png"),
      fullPage: true,
    });

    console.log("PASS: original page baseline and computed layout");

    // --------------------------------------------------
    // Test 2: HTML editor updates the preview
    // --------------------------------------------------

    const changedHTML =
      '<div class="container"><p id="edited-html">Edited preview marker</p></div>';

    await htmlEditor.fill(changedHTML);

    await page.locator("#edited-html").waitFor();

    assert.equal(
      await page.locator("section #edited-html").textContent(),
      "Edited preview marker",
    );

    console.log("PASS: HTML editor updates the preview");

    // --------------------------------------------------
    // Test 3: CSS editor updates computed styles
    // --------------------------------------------------

    const changedCSS =
      ".container { column-width: 320px; orphans: 2; }";

    await cssEditor.fill(changedCSS);

    const changedStyle = await container.evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        columnWidth: style.columnWidth,
        orphans: style.orphans,
      };
    });

    assert.equal(changedStyle.columnWidth, "320px");
    assert.equal(changedStyle.orphans, "2");

    console.log("PASS: CSS editor updates computed styles");

    // --------------------------------------------------
    // Test 4: Reset restores the original page
    // --------------------------------------------------

    await page.locator("#reset").click();

    assert.equal(
      await htmlEditor.inputValue(),
      originalHTMLValue,
    );

    assert.equal(
      await cssEditor.inputValue(),
      originalCSSValue,
    );

    assert.equal(
      await page.locator("#edited-html").count(),
      0,
    );

    assert.equal(
      await container.locator("p").count(),
      3,
    );

    const resetStyle = await container.evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        columnWidth: style.columnWidth,
        orphans: style.orphans,
      };
    });

    assert.equal(resetStyle.columnWidth, "200px");
    assert.equal(resetStyle.orphans, "3");

    await page.screenshot({
      path: path.join(EVIDENCE, "after-reset.png"),
      fullPage: true,
    });

    assertNoPageErrors(pageErrors, "Original page");

    console.log("PASS: Reset restores original content and styles");

    const htmlRestored =
  (await htmlEditor.inputValue()) === originalHTMLValue;

const cssRestored =
  (await cssEditor.inputValue()) === originalCSSValue;
    await context.close();

    // --------------------------------------------------
    // Test 5: Negative control
    // --------------------------------------------------

    const brokenContext = await browser.newContext({
      viewport: {
        width: 1280,
        height: 900,
      },
    });

    const brokenPage = await brokenContext.newPage();
    const brokenErrors = watchPageErrors(brokenPage);

    await brokenPage.goto(`${baseURL}${FIXTURE_URL}`, {
      waitUntil: "load",
    });

    await brokenPage.locator("#code").fill(changedHTML);

    // The editor changes, but the preview must not update
    // because its input event listener was removed.
    assert.equal(
      await brokenPage.locator("section #edited-html").count(),
      0,
      "Negative control failed: removing the HTML input listener should prevent preview updates",
    );

    assert.match(
      await brokenPage.locator("#code").inputValue(),
      /Edited preview marker/,
    );

    assertNoPageErrors(brokenErrors, "Broken fixture");

    console.log(
      "PASS: negative control detected the missing HTML input listener",
    );

    const brokenPreviewMarkerCount =
  await brokenPage.locator("section #edited-html").count();
    await brokenContext.close();

    // --------------------------------------------------
    // Save evidence
    // --------------------------------------------------


const results = [
  "# Task 10 — Browser regression results",
  "",
  "## Environment",
  `- Node.js: ${process.version}`,
  `- Playwright: ${require("playwright/package.json").version}`,
  `- Chromium: ${browserVersion}`,
  `- Platform: ${process.platform} (${process.arch})`,
  "",
  "## Baseline",
  "- Expected: page title is Multicol example - orphans.",
  "- Actual: page loaded with the expected title.",
  "- Expected: three paragraphs in the preview.",
  "- Actual: three paragraphs.",
  `- Expected computed layout: ${JSON.stringify({
    columnWidth: "200px",
    orphans: "3",
  })}`,
  `- Actual computed layout: ${JSON.stringify(baselineStyle)}`,
  "",
  "## HTML editor test",
  `- Input: ${changedHTML}`,
  "- Expected: preview displays Edited preview marker.",
  "- Actual: preview displayed Edited preview marker.",
  "",
  "## CSS editor test",
  `- Input: ${changedCSS}`,
  `- Expected: ${JSON.stringify({
    columnWidth: "320px",
    orphans: "2",
  })}`,
  `- Actual: ${JSON.stringify(changedStyle)}`,
  "",
  "## Reset test",
  "- Expected: original HTML and CSS values are restored.",
  `- Actual HTML restored: ${htmlRestored}`,
`- Actual CSS restored: ${cssRestored}`,
  `- Actual computed styles: ${JSON.stringify(resetStyle)}`,
  "",
  "## Negative control",
  "- Mutation: removed the HTML editor input event listener in a temporary fixture.",
  "- Input: edited HTML containing Edited preview marker.",
  "- Expected: editor changes but preview does not update.",
  `- Actual preview marker count: ${brokenPreviewMarkerCount}`,
  "- Result: missing event listener was detected.",
  "",
  "## Overall result",
  "All browser regression assertions passed.",
  "The original example was not modified.",
  "",
];


    fs.writeFileSync(
      path.join(EVIDENCE, "results.md"),
      results.join("\n"),
    );

    console.log("\nAll Task 10 checks passed.");
    console.log(`Evidence saved in: ${EVIDENCE}`);
  } finally {
    if (browser) {
      await browser.close();
    }

    if (server) {
      await closeServer(server);
    }

    fs.rmSync(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

main().catch((error) => {
  console.error("\nTask 10 regression test failed:");
  console.error(error);
  process.exitCode = 1;
});
