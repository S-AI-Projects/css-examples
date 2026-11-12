
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "blueprint.svg"
);

const evidenceDir = path.join(projectRoot, "work", "R56-T005");

fs.mkdirSync(evidenceDir, { recursive: true });

const blueprint = fs.readFileSync(fixturePath, "utf8");

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, "http://localhost").pathname
  );

  const filePath = path.resolve(projectRoot, `.${pathname}`);

  if (
    !filePath.startsWith(projectRoot + path.sep) ||
    !fs.existsSync(filePath) ||
    !fs.statSync(filePath).isFile()
  ) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const contentType =
    mimeTypes[path.extname(filePath)] || "application/octet-stream";

  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(response);
});

let browser;
let imageFixtureRequests = 0;

const evidence = {
  task: "R56-T005",
  viewport: { width: 1280, height: 800 },
  fontFixture: "Arial, sans-serif",
  imageFixture: "tests/course/fixtures/blueprint.svg",
  contexts: [],
  checks: [],
};

try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl =
    `http://127.0.0.1:${address.port}/counter-style-demo/index.html`;

  browser = await chromium.launch();

  evidence.versions = {
    node: process.version,
    playwright: (
      await import("playwright/package.json", {
        with: { type: "json" },
      })
    ).default.version,
    chromium: browser.version(),
  };

  let referenceSnapshot;

  for (let run = 1; run <= 2; run++) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });

    const page = await context.newPage();
    const pageErrors = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route(
      "https://developer.cdn.mozilla.net/**",
      async (route) => {
        imageFixtureRequests++;

        await route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: blueprint,
        });
      }
    );

    await page.goto(baseUrl, { waitUntil: "networkidle" });

    await page.addStyleTag({
      content: `
        body, .header h1, .notes-section {
          font-family: Arial, sans-serif !important;
        }
      `,
    });

    await page.evaluate(() => document.fonts.ready);

    const itemCount = await page.locator("#demo-list li").count();
    assert.equal(itemCount, 30, "The demo must show 30 list items.");

    const select = page.locator("#style-select");
    const code = page.locator("#code");
    const demoList = page.locator("#demo-list");

    const initialValue = await select.inputValue();
    const initialCode = (await code.textContent()).trim();
    const initialClass = await demoList.getAttribute("class");

    assert.equal(initialValue, "cyclic");
    assert.equal(initialClass, "demo-cyclic");
    assert.ok(initialCode.includes("system: cyclic"));

    const options = await select.locator("option").evaluateAll(
  (elements) =>
    elements
      .filter((element) => !element.disabled && element.value)
      .map((element) => element.value)
);

    const snapshot = {
      itemCount,
      initialValue,
      initialClass,
      initialCode,
      options,
    };

    if (run === 1) {
      referenceSnapshot = snapshot;
    } else {
      assert.deepEqual(
        snapshot,
        referenceSnapshot,
        "Fresh browser contexts must start with identical DOM state."
      );
    }

    await page.screenshot({
      path: path.join(evidenceDir, `baseline-context-${run}.png`),
      fullPage: true,
    });

    evidence.contexts.push(snapshot);

    for (const value of options) {
      await select.selectOption(value);

      const actualClass = await demoList.getAttribute("class");
      const actualCode = (await code.textContent()).trim();

      assert.equal(
        actualClass,
        `demo-${value}`,
        `Incorrect list class for option: ${value}`
      );

      assert.ok(
        actualCode.length > 0,
        `CSS example is empty for option: ${value}`
      );

      evidence.checks.push({
        context: run,
        option: value,
        expectedClass: `demo-${value}`,
        actualClass,
        codeIsNotEmpty: actualCode.length > 0,
        passed: true,
      });
    }

    const imageBackground = await page.locator("#code").evaluate(
      (element) => getComputedStyle(element).backgroundImage
    );

    assert.ok(
      imageBackground.includes("blueprint-dark.png"),
      "The demo should retain its background image styling."
    );

    assert.deepEqual(
      pageErrors,
      [],
      "The page must not produce unexpected JavaScript errors."
    );

    await context.close();
  }

  assert.equal(
    imageFixtureRequests,
    2,
    "The local image fixture should load once in each fresh context."
  );

  evidence.imageFixtureRequests = imageFixtureRequests;
  evidence.result = "PASS";

  fs.writeFileSync(
    path.join(evidenceDir, "results.json"),
    JSON.stringify(evidence, null, 2)
  );

  console.log("R56-T005: ALL CHECKS PASSED");
  console.log(`Contexts tested: ${evidence.contexts.length}`);
  console.log(`Dropdown checks: ${evidence.checks.length}`);
  console.log(`Image fixtures loaded: ${imageFixtureRequests}`);
  console.log(`Evidence saved in: ${evidenceDir}`);
} catch (error) {
  evidence.result = "FAIL";
  evidence.error = error.message;

  fs.writeFileSync(
    path.join(evidenceDir, "results.json"),
    JSON.stringify(evidence, null, 2)
  );

  console.error("R56-T005 FAILED:", error);
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }

  if (server.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
}
