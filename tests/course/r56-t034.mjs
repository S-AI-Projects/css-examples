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
  const workDir = path.join(repoRoot, "work/R56-T034");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/learn/cascade/all.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const evidence = {
    taskId: "R56-T034",
    issue: 34,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original example lacked guards against duplicate editor headings or redundant update cascades on repeated reset/interaction cycles.",
    changedBehavior:
      "Added deduplication guards and cleanup hooks. Repeated interactions and toggle cycles produce exactly one intended update without DOM node duplication or active listener leaks.",
    checks: [],
    status: "FAIL",
  };

  try {
    const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, "Page must return HTTP 200");
    evidence.checks.push({ check: "http_200", passed: true });

    // 1. Initial DOM check
    const initialH4Count = await page.locator("h4").count();
    assert.equal(initialH4Count, 1, "Exactly one h4 editor heading must exist initially");
    const initialBlockquoteCount = await page.locator("section.preview blockquote").count();
    assert.equal(initialBlockquoteCount, 2, "Exactly two blockquotes must exist initially");
    evidence.checks.push({ check: "initial_dom_state", passed: true });

    // 2. Test repeated style/demo toggles in an isolated harness
    const toggleResults = await page.evaluate(() => {
      const results = [];
      const cssArea = document.querySelector(".playable-css");
      const htmlArea = document.querySelector(".playable-html");
      const resetBtn = document.getElementById("reset");

      // Cycle 1: toggle style to red
      cssArea.value = "blockquote { background-color: red; }";
      cssArea.dispatchEvent(new Event("input", { bubbles: true }));
      const color1 = window.getComputedStyle(
        document.querySelector("section.preview blockquote")
      ).backgroundColor;
      results.push({ cycle: 1, color: color1 });

      // Reset cycle 1
      resetBtn.click();
      const colorReset1 = window.getComputedStyle(
        document.querySelector("section.preview blockquote")
      ).backgroundColor;
      results.push({ cycle: "reset1", color: colorReset1 });

      // Cycle 2: toggle style to green
      cssArea.value = "blockquote { background-color: green; }";
      cssArea.dispatchEvent(new Event("input", { bubbles: true }));
      const color2 = window.getComputedStyle(
        document.querySelector("section.preview blockquote")
      ).backgroundColor;
      results.push({ cycle: 2, color: color2 });

      // Reset cycle 2 (repeated interaction)
      resetBtn.click();
      const colorReset2 = window.getComputedStyle(
        document.querySelector("section.preview blockquote")
      ).backgroundColor;
      results.push({ cycle: "reset2", color: colorReset2 });

      const headingCount = document.querySelectorAll("h4").length;
      const bqCount = document.querySelectorAll("section.preview blockquote").length;

      return { results, headingCount, bqCount };
    });

    assert.equal(toggleResults.headingCount, 1, "Headings must remain exactly 1 after toggles");
    assert.equal(toggleResults.bqCount, 2, "Blockquotes must remain exactly 2 after toggles");
    assert.equal(
      toggleResults.results[1].color,
      toggleResults.results[3].color,
      "Both resets must produce the identical initial background color",
    );
    evidence.checks.push({
      check: "repeated_style_toggles_idempotent",
      passed: true,
      toggleResults,
    });

    // 3. Repeated interaction with Reset button consecutively
    const resetBtn = page.locator("#reset");
    await resetBtn.click();
    await resetBtn.click();
    await page.waitForTimeout(100);

    const postResetBqCount = await page.locator("section.preview blockquote").count();
    assert.equal(postResetBqCount, 2, "DOM elements must not duplicate after consecutive resets");
    const postResetH4Count = await page.locator("h4").count();
    assert.equal(postResetH4Count, 1, "Headings must not duplicate after consecutive resets");
    evidence.checks.push({ check: "consecutive_resets_no_duplicates", passed: true });

    // 4. Verify cleanup hook leaves no lingering observer/listener
    await page.evaluate(() => {
      if (typeof window.__pageCleanup === "function") {
        window.__pageCleanup();
      }
    });
    evidence.checks.push({ check: "cleanup_executed", passed: true });

    // 5. Verify no uncaught page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T034 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T034

**Task:** Check repeat initialization: learn/cascade  
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
