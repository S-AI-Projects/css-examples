import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const EVIDENCE = path.join(ROOT, "work/R56-T007");
const PAGE_PATH = "/tools/box-shadow-generator/";

fs.mkdirSync(EVIDENCE, { recursive: true });

const results = {
  task: "R56-T007",
  page: PAGE_PATH,
  nodeVersion: process.version,
  playwrightVersion: JSON.parse(
    fs.readFileSync(
      new URL("../../node_modules/playwright/package.json", import.meta.url),
      "utf8",
    ),
  ).version,
  scenarios: {},
  browserErrors: [],
};

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

let server;
let browser;
let context;
let page;
let exitCode = 0;

try {
  // Start a small local static HTTP server.
  server = http.createServer((req, res) => {
    try {
      const requestPath = decodeURIComponent(
        new URL(req.url, "http://127.0.0.1").pathname,
      );
      const relativePath = requestPath.endsWith("/")
        ? `${requestPath}index.html`
        : requestPath;
      const filePath = path.resolve(ROOT, `.${relativePath}`);

      if (
        filePath !== ROOT &&
        !filePath.startsWith(ROOT + path.sep)
      ) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type":
          mimeTypes[path.extname(filePath)] || "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}`;

  // Confirm the local server is ready.
  const response = await fetch(`${baseURL}${PAGE_PATH}`);
  if (!response.ok) {
    throw new Error(`Local server returned HTTP ${response.status}`);
  }

  results.server = "READY";
  results.chromiumVersion = chromium.executablePath();

  browser = await chromium.launch({ headless: true });
  results.chromiumVersion = browser.version();

  // Use a fresh browser context for a clean baseline.
  context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  page = await context.newPage();

  page.on("pageerror", (error) => {
    results.browserErrors.push(error.message);
  });

  await page.goto(`${baseURL}${PAGE_PATH}`, {
    waitUntil: "load",
  });

  await page.locator("#container").waitFor({ state: "visible" });
  await page.locator("#layer_manager").waitFor({ state: "visible" });
  await page.locator("#preview_zone").waitFor({ state: "visible" });

  // Baseline layout assertions.
  const baseline = await page.evaluate(() => {
    const container = document.querySelector("#container");
    const preview = document.querySelector("#obj-element");
    const output = document.querySelector(
      '#output [data-topic="element"]',
    );

    return {
      title: document.title,
      containerWidth: container.getBoundingClientRect().width,
      previewWidth: preview.getBoundingClientRect().width,
      previewHeight: preview.getBoundingClientRect().height,
      initialLayerCount: document.querySelectorAll(
        '#stack_container [data-type="layer"]',
      ).length,
      initialBoxShadow: getComputedStyle(preview).boxShadow,
      outputExists: Boolean(output),
    };
  });

  if (baseline.title !== "Box-shadow generator") {
    throw new Error(`Unexpected page title: ${baseline.title}`);
  }
  if (baseline.containerWidth <= 0 || baseline.previewWidth <= 0) {
    throw new Error("Main layout or preview has no rendered width");
  }
  if (baseline.previewHeight <= 0) {
    throw new Error("Preview has no rendered height");
  }
  if (baseline.initialLayerCount !== 0) {
    throw new Error("Expected an empty layer manager at baseline");
  }
  if (!baseline.outputExists) {
    throw new Error("Element CSS output section was not found");
  }

  results.baseline = baseline;
  results.scenarios.baselineLayout = "PASSED";

  await page.screenshot({
    path: path.join(EVIDENCE, "baseline.png"),
    fullPage: true,
  });

  // Add exactly one shadow layer.
  await page.locator('#layer_manager [data-type="add"]').click();

  const layer = page.locator(
    '#stack_container [data-type="layer"]',
  );

  await layer.waitFor({ state: "visible" });
  await layer.first().waitFor();

  const layerDetails = await layer.first().evaluate((node) => ({
    text: node.textContent.trim(),
    type: node.getAttribute("data-type"),
    active: node.getAttribute("data-active"),
  }));

  if (!/^shadow\s+\d+$/.test(layerDetails.text)) {
    throw new Error(`Unexpected layer label: ${layerDetails.text}`);
  }
  if (layerDetails.type !== "layer") {
    throw new Error("New item is not marked as a shadow layer");
  }

  results.layerCreated = layerDetails;
  results.scenarios.addLayer = "PASSED";

  // Select the new layer and inspect the generated CSS.
  await layer.first().click();

  // Wait for the temporary selection glow to finish.
  await page.waitForFunction(() => {
    const preview = document.querySelector("#obj-element");
    return (
      preview &&
      getComputedStyle(preview).boxShadow === preview.style.boxShadow
    );
  }, null, { timeout: 5000 });

  const generated = await page.evaluate(() => {
    const preview = document.querySelector("#obj-element");
    const output = document.querySelector(
      '#output [data-topic="element"]',
    );
    const propertyRows = [...output.querySelectorAll(".css-property")];

    const shadowRow = propertyRows.find((row) =>
      row.querySelector(".name")?.textContent
        .trim()
        .startsWith("box-shadow"),
    );

    return {
      computedBoxShadow: getComputedStyle(preview).boxShadow,
      inlineBoxShadow: preview.style.boxShadow,
      outputValue: shadowRow?.querySelector(".value")?.textContent.trim(),
      outputRowDisplay: shadowRow
        ? getComputedStyle(shadowRow).display
        : null,
      layerCount: document.querySelectorAll(
        '#stack_container [data-type="layer"]',
      ).length,
    };
  });

  if (generated.layerCount !== 1) {
    throw new Error(`Expected one layer, found ${generated.layerCount}`);
  }
  if (!generated.computedBoxShadow || generated.computedBoxShadow === "none") {
    throw new Error("Preview did not receive a computed box-shadow");
  }
  if (!generated.inlineBoxShadow) {
    throw new Error("Preview inline box-shadow was not updated");
  }
  if (generated.computedBoxShadow !== generated.inlineBoxShadow) {
    throw new Error("Computed and inline box-shadow values do not match");
  }
  if (!generated.outputValue || !generated.outputValue.includes("px")) {
    throw new Error("Generated CSS output does not contain a shadow value");
  }
  if (generated.outputRowDisplay === "none") {
    throw new Error("Generated box-shadow output row is hidden");
  }

  results.generatedCSS = generated;
  results.scenarios.generatedCSSAndPreview = "PASSED";

  await page.screenshot({
    path: path.join(EVIDENCE, "shadow-added.png"),
    fullPage: true,
  });

  if (results.browserErrors.length > 0) {
    throw new Error(
      `Unexpected browser errors: ${results.browserErrors.join("; ")}`,
    );
  }

  results.scenarios.browserErrors = "NONE";
  results.status = "ALL CHECKS PASSED";
} catch (error) {
  exitCode = 1;
  results.status = "FAILED";
  results.failure = error.stack || error.message;

  if (page) {
    try {
      await page.screenshot({
        path: path.join(EVIDENCE, "failure.png"),
        fullPage: true,
      });
    } catch {
      // Preserve the original test failure.
    }
  }
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  fs.writeFileSync(
    path.join(EVIDENCE, "results.json"),
    JSON.stringify(results, null, 2) + "\n",
  );

  console.log(JSON.stringify(results, null, 2));
  console.log(`Evidence saved in: ${EVIDENCE}`);

  if (exitCode !== 0) {
    process.exitCode = 1;
  }
}
