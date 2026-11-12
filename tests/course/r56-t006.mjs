import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const version = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../node_modules/playwright/package.json"), "utf8")
).version;

const root = path.resolve(__dirname, "../..");
const evidenceDir = path.join(root, "work/R56-T006");
const pagePath = "/flexbox/alignment/intro.html";
const errors = [];

let server;
let browser;

async function startServer() {
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const filePath = path.resolve(root, `.${pathname}`);

    if (!filePath.startsWith(root + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404).end("Not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(content);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return `http://127.0.0.1:${server.address().port}`;
}

async function checkCentered(page) {
  const positions = await page.locator(".box").evaluate((box) => {
    const parent = box.getBoundingClientRect();
    const child = box.firstElementChild.getBoundingClientRect();

    return {
      parentCenterX: parent.left + parent.width / 2,
      parentCenterY: parent.top + parent.height / 2,
      childCenterX: child.left + child.width / 2,
      childCenterY: child.top + child.height / 2,
    };
  });

  assert.ok(
    Math.abs(positions.parentCenterX - positions.childCenterX) < 2,
    "Inner box should be horizontally centred",
  );

  assert.ok(
    Math.abs(positions.parentCenterY - positions.childCenterY) < 2,
    "Inner box should be vertically centred",
  );
}

async function run() {
  fs.mkdirSync(evidenceDir, { recursive: true });

  const baseURL = await startServer();
  browser = await chromium.launch({ headless: true });

  // Scenario 1: Browser reports Flexbox support.
  const supportedContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const supportedPage = await supportedContext.newPage();
  supportedPage.on("pageerror", (error) => errors.push(error.message));

  await supportedPage.goto(baseURL + pagePath);
  await supportedPage.locator(".box").waitFor();

  assert.equal(
    await supportedPage.locator(".box").evaluate(
      (box) => getComputedStyle(box).display,
    ),
    "flex",
    "Supported browser should use Flexbox",
  );

  assert.equal(
    await supportedPage.locator("#feature-status").isVisible(),
    false,
    "Supported browser should not show a warning",
  );

  await checkCentered(supportedPage);

  // Check that editing HTML updates the preview.
  await supportedPage.locator("#code").fill(
    '<div class="box"><div id="edited">Edited</div></div>',
  );

  await assert.doesNotReject(
    supportedPage.locator("#edited").waitFor(),
    "Editing HTML should update the preview",
  );

  // Check that Reset restores the original example.
  await supportedPage.locator("#reset").click();

  assert.match(
    await supportedPage.locator("#code").inputValue(),
    /<div><\/div>/,
    "Reset should restore the original HTML",
  );

  await checkCentered(supportedPage);

  await supportedPage.screenshot({
    path: path.join(evidenceDir, "supported.png"),
    fullPage: true,
  });

  await supportedContext.close();

  // Scenario 2: Stub CSS.supports to report no Flexbox support.
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
  unsupportedPage.on("pageerror", (error) => errors.push(error.message));

  await unsupportedPage.goto(baseURL + pagePath);
  await unsupportedPage.locator(".box").waitFor();

  assert.equal(
    await unsupportedPage.locator("#feature-status").isVisible(),
    true,
    "Unsupported browser should show a warning",
  );

  assert.match(
    await unsupportedPage.locator("#feature-status").textContent(),
    /does not support the Flexbox alignment features/i,
    "Fallback warning should explain the unsupported feature",
  );

  assert.equal(
    await unsupportedPage.locator("html").evaluate(
      (element) => element.classList.contains("no-flexbox"),
    ),
    true,
    "Unsupported browser should activate the fallback class",
  );

  assert.equal(
    await unsupportedPage.locator(".box").evaluate(
      (box) => getComputedStyle(box).display,
    ),
    "block",
    "Unsupported browser should use normal block layout",
  );

  await unsupportedPage.screenshot({
    path: path.join(evidenceDir, "unsupported.png"),
    fullPage: true,
  });

  await unsupportedContext.close();

  assert.deepEqual(
    errors,
    [],
    "There should be no unexpected browser JavaScript errors",
  );

  const results = {
    task: "R56-T006",
    page: pagePath,
    nodeVersion: process.version,
    playwrightVersion: version,
    chromiumVersion: browser.version(),
    scenarios: {
      supported: "PASSED",
      unsupported: "PASSED",
      htmlEditing: "PASSED",
      reset: "PASSED",
      browserErrors: "NONE",
    },
    note: "Unsupported behavior was simulated by stubbing CSS.supports. It was not tested on a physically unsupported browser.",
  };

  fs.writeFileSync(
    path.join(evidenceDir, "results.json"),
    JSON.stringify(results, null, 2) + "\n",
  );

  console.log("R56-T006: ALL CHECKS PASSED");
  console.log(JSON.stringify(results, null, 2));
}

run()
  .catch((error) => {
    console.error("R56-T006 FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });
