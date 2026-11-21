import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
};

function createStaticServer() {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === "/") pathname = "/index.html";

    const filePath = path.join(repoRoot, pathname);
    if (!filePath.startsWith(repoRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(`Not found: ${pathname}`);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function run() {
  const workDir = path.join(repoRoot, "work/R56-T036");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/font-features/font-kerning.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });

  const evidence = {
    taskId: "R56-T036",
    issue: 36,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original example assumed native font-kerning support without checking, leaving unsupported environments without fallback or disabled controls.",
    changedBehavior:
      "Added CSS @supports fallback and JS feature detection. In supported browsers, controls remain active; in stubbed unsupported environments, controls are disabled and informative fallback text is displayed.",
    checks: [],
    status: "FAIL",
  };

  try {
    const pageErrors = [];

    // Path 1: Supported browser path
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    page1.on("pageerror", (err) => pageErrors.push(err.message || String(err)));

    const res1 = await page1.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(res1.status(), 200, "Supported path: HTTP 200");

    const supportedState = await page1.evaluate(() => {
      const ctrl = document.getElementById("demo1_control");
      const fallback = document.querySelector(".fallback1");
      return {
        disabled: ctrl.disabled,
        checked: ctrl.checked,
        fallbackDisplay: window.getComputedStyle(fallback).display,
      };
    });

    assert.equal(supportedState.disabled, false, "Control must be enabled on supported path");
    assert.equal(supportedState.fallbackDisplay, "none", "Fallback text must be hidden on supported path");

    // Test toggle interaction on supported path
    const demo1Checkbox = page1.locator("#demo1_control");
    await demo1Checkbox.uncheck();
    await page1.waitForTimeout(50);
    const hasInactive = await page1.locator(".demo1").evaluate((el) => el.classList.contains("inactive"));
    assert.ok(hasInactive, "Unchecking demo1 must apply .inactive class");

    await demo1Checkbox.check();
    await page1.waitForTimeout(50);
    const hasInactiveAfterCheck = await page1.locator(".demo1").evaluate((el) => el.classList.contains("inactive"));
    assert.ok(!hasInactiveAfterCheck, "Checking demo1 must remove .inactive class");

    evidence.checks.push({ check: "supported_feature_path", passed: true, supportedState });
    await context1.close();

    // Path 2: Unsupported browser path (stubbed CSS.supports returning false for font-kerning)
    const context2 = await browser.newContext();
    await context2.addInitScript(() => {
      const origSupports = CSS.supports;
      CSS.supports = function (prop, val) {
        if (prop === "font-kerning" || (typeof prop === "string" && prop.includes("font-kerning"))) {
          return false;
        }
        return origSupports.apply(this, arguments);
      };
    });

    const page2 = await context2.newPage();
    page2.on("pageerror", (err) => pageErrors.push(err.message || String(err)));

    const res2 = await page2.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(res2.status(), 200, "Unsupported path: HTTP 200");

    const unsupportedState = await page2.evaluate(() => {
      const ctrl = document.getElementById("demo1_control");
      const fallback = document.querySelector(".fallback1");
      const label = document.querySelector("label[for='demo1_control']");
      return {
        disabled: ctrl.disabled,
        fallbackDisplay: window.getComputedStyle(fallback).display,
        fallbackText: fallback.textContent.trim(),
        labelText: label ? label.textContent.trim() : "",
      };
    });

    assert.equal(unsupportedState.disabled, true, "Control must be disabled on unsupported path");
    assert.notEqual(unsupportedState.fallbackDisplay, "none", "Fallback message must be visible on unsupported path");
    assert.ok(
      unsupportedState.fallbackText.includes("not supported"),
      `Expected fallback text, got: ${unsupportedState.fallbackText}`,
    );

    evidence.checks.push({
      check: "unsupported_feature_fallback_path",
      passed: true,
      unsupportedState,
    });
    await context2.close();

    // Ensure no uncaught page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T036 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T036

**Task:** Handle an unsupported browser feature: font-features  
**Status:** ${evidence.status}  
**Timestamp:** ${evidence.timestamp}  

## Tool Versions
- **Node.js:** ${evidence.toolVersions.node}
- **Playwright:** ${evidence.toolVersions.playwright}
- **Chromium:** ${evidence.toolVersions.browser}

## Baseline Behavior
${evidence.baselineBehavior}

## Changed Behavior
${evidence.changedBehavior}

## Checks Executed
${evidence.checks.map((c) => `- **${c.check}**: ${c.passed ? "PASSED" : "FAILED"}`).join("\n")}
`;
    fs.writeFileSync(path.join(workDir, "report.md"), mdReport, "utf8");

    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (evidence.status !== "PASS") {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
