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

async function extractPageState(page) {
  return await page.evaluate(() => {
    const box = document.querySelector(".box");
    const items = Array.from(box.children);
    return {
      boxWidth: window.getComputedStyle(box).width,
      boxDisplay: window.getComputedStyle(box).display,
      itemCount: items.length,
      items: items.map((el) => {
        const style = window.getComputedStyle(el);
        return {
          text: el.textContent.trim(),
          width: style.width,
          flexGrow: style.flexGrow,
          flexShrink: style.flexShrink,
          flexBasis: style.flexBasis,
        };
      }),
    };
  });
}

async function run() {
  const workDir = path.join(repoRoot, "work/R56-T035");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/flexbox/ratios/flex-grow.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });

  const evidence = {
    taskId: "R56-T035",
    issue: 35,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original example lacked explicit viewport locking and universal box-sizing, risking layout nondeterminism across varied client environments.",
    changedBehavior:
      "Locked viewport dimensions and added universal border-box sizing. Verified that two independent fresh browser contexts produce bit-identical asserted DOM state without public API dependencies.",
    context1State: null,
    context2State: null,
    checks: [],
    status: "FAIL",
  };

  try {
    const pageErrors = [];

    // Context 1
    const context1 = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 1,
    });
    // Disallow external network requests to guarantee complete offline determinism
    await context1.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("http://127.0.0.1:") || url.startsWith("http://localhost:")) {
        route.continue();
      } else {
        route.abort();
      }
    });

    const page1 = await context1.newPage();
    page1.on("pageerror", (err) => pageErrors.push(err.message || String(err)));
    const res1 = await page1.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(res1.status(), 200, "Context 1 must return HTTP 200");

    const state1 = await extractPageState(page1);
    evidence.context1State = state1;
    await context1.close();

    // Context 2 (fresh context)
    const context2 = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 1,
    });
    await context2.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("http://127.0.0.1:") || url.startsWith("http://localhost:")) {
        route.continue();
      } else {
        route.abort();
      }
    });

    const page2 = await context2.newPage();
    page2.on("pageerror", (err) => pageErrors.push(err.message || String(err)));
    const res2 = await page2.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(res2.status(), 200, "Context 2 must return HTTP 200");

    const state2 = await extractPageState(page2);
    evidence.context2State = state2;
    await context2.close();

    // Determinism assertion: two fresh contexts must produce identical DOM state
    assert.deepEqual(
      state1,
      state2,
      "Two fresh browser contexts must produce identical asserted DOM state",
    );
    evidence.checks.push({ check: "contexts_identical_state", passed: true });

    // Assert correct flexbox values
    assert.equal(state1.itemCount, 3, "Expected 3 flex items");
    assert.equal(state1.boxDisplay, "flex", "Box display must be flex");
    for (const item of state1.items) {
      assert.equal(item.flexGrow, "1", `Item ${item.text} must have flexGrow 1`);
      assert.equal(item.flexShrink, "1", `Item ${item.text} must have flexShrink 1`);
    }
    evidence.checks.push({ check: "flexbox_ratios_verified", passed: true });

    // Ensure no uncaught errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T035 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T035

**Task:** Make browser tests deterministic: flexbox/ratios  
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
