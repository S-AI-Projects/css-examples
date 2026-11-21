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
  const workDir = path.join(repoRoot, "work/R56-T033");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/box-alignment/overview/grid-gap.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const evidence = {
    taskId: "R56-T033",
    issue: 33,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Clearing the HTML textarea left an empty white section with no user feedback or fallback message.",
    changedBehavior:
      "Displays a helpful empty-state fallback message with role='status' when HTML content is empty, and cleanly recovers upon valid input or Reset.",
    checks: [],
    status: "FAIL",
  };

  try {
    const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, "Page must return HTTP 200");
    evidence.checks.push({ check: "http_200", passed: true });

    // 1. Initial render verification
    const initialBoxCount = await page.locator("section .box > div").count();
    assert.equal(initialBoxCount, 6, "Expected 6 items in initial grid preview");
    evidence.checks.push({ check: "initial_render_6_items", passed: true });

    // 2. Empty input / fixture test
    const htmlTextarea = page.locator("#code");
    await htmlTextarea.fill("");
    await page.waitForTimeout(100);

    const emptyState = page.locator("section .empty-state");
    const emptyStateVisible = await emptyState.isVisible();
    assert.ok(emptyStateVisible, "Empty state fallback must be visible when editor is empty");

    const emptyText = await emptyState.textContent();
    assert.ok(
      emptyText.includes("No HTML content to preview"),
      `Expected empty message, got: ${emptyText}`,
    );
    evidence.checks.push({
      check: "empty_state_displayed",
      passed: true,
      emptyText: emptyText.trim(),
    });

    // 3. Recovery via Reset button
    const resetBtn = page.locator("#reset");
    await resetBtn.click();
    await page.waitForTimeout(100);

    const restoredBoxCount = await page.locator("section .box > div").count();
    assert.equal(
      restoredBoxCount,
      6,
      "Expected 6 items restored after clicking Reset",
    );
    const restoredEmptyVisible = await emptyState.isVisible();
    assert.ok(!restoredEmptyVisible, "Empty state should not be visible after reset");
    evidence.checks.push({ check: "recovery_via_reset", passed: true });

    // 4. Recovery via valid input entry
    await htmlTextarea.fill('<div class="box"><div>Custom A</div><div>Custom B</div></div>');
    await page.waitForTimeout(100);
    const customCount = await page.locator("section .box > div").count();
    assert.equal(customCount, 2, "Expected 2 items from custom HTML input");
    evidence.checks.push({ check: "recovery_via_valid_input", passed: true });

    // Reset back to original
    await resetBtn.click();
    await page.waitForTimeout(100);

    // 5. Ensure no uncaught page errors occurred
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T033 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T033

**Task:** Exercise empty/error display: box-alignment/overview  
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

    await context.close();
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
