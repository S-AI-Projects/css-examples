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

async function getFooterPositions(page) {
  return await page.evaluate(() => {
    const footers = Array.from(document.querySelectorAll(".card footer"));
    return footers.map((f, i) => {
      const rect = f.getBoundingClientRect();
      return { index: i, top: rect.top, bottom: rect.bottom, height: rect.height };
    });
  });
}

async function run() {
  const workDir = path.join(repoRoot, "work/R56-T037");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/flexbox/use-cases/cards.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
  });
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const evidence = {
    taskId: "R56-T037",
    issue: 37,
    entryPoint: "flexbox/use-cases/cards.html",
    setupCommand: "node tests/course/r56-t037.mjs",
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original cards example demonstrated flex column card layout with footer alignment, but lacked an automated verified walkthrough.",
    changedBehavior:
      "Documented and executed a verified interactive walkthrough: initial footer alignment, unaligned state upon flex-grow removal, and complete restoration via reset.",
    walkthroughSteps: [],
    checks: [],
    status: "FAIL",
  };

  try {
    const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, "Page must return HTTP 200");
    evidence.checks.push({ check: "http_200", passed: true });

    // Step 1: Initial aligned layout observation
    const initialFooters = await getFooterPositions(page);
    assert.equal(initialFooters.length, 2, "Expected 2 card footers");
    const deltaInitial = Math.abs(initialFooters[0].top - initialFooters[1].top);
    assert.ok(
      deltaInitial < 2,
      `Footers must be vertically aligned in initial state; delta=${deltaInitial}`,
    );

    const shot1 = "walkthrough-1-initial-aligned.png";
    await page.screenshot({ path: path.join(workDir, shot1) });
    evidence.walkthroughSteps.push({
      step: 1,
      name: "initial_layout_observation",
      description: "Card 1 and Card 2 footers align at the bottom because .content has flex: 1 1 auto.",
      delta: deltaInitial,
      screenshot: shot1,
      passed: true,
    });

    // Step 2: Interactive observation — change flex to 0
    const cssTextarea = page.locator(".playable-css");
    await cssTextarea.fill(".card { display: flex; flex-direction: column; }\n.card .content { flex: 0; }");
    await page.waitForTimeout(100);

    const editedFooters = await getFooterPositions(page);
    assert.ok(
      editedFooters[0].top < editedFooters[1].top - 20,
      `Card 1 footer must move up when flex is removed; footer1.top=${editedFooters[0].top}, footer2.top=${editedFooters[1].top}`,
    );

    const shot2 = "walkthrough-2-unaligned-edited.png";
    await page.screenshot({ path: path.join(workDir, shot2) });
    evidence.walkthroughSteps.push({
      step: 2,
      name: "interactive_flex_removal",
      description: "When flex is 0, card 1 footer follows the short text immediately and is no longer pushed to bottom.",
      footer1Top: editedFooters[0].top,
      footer2Top: editedFooters[1].top,
      screenshot: shot2,
      passed: true,
    });

    // Step 3: Recovery via Reset button
    const resetBtn = page.locator("#reset");
    await resetBtn.click();
    await page.waitForTimeout(100);

    const restoredFooters = await getFooterPositions(page);
    const deltaRestored = Math.abs(restoredFooters[0].top - restoredFooters[1].top);
    assert.ok(
      deltaRestored < 2,
      `Footers must align again after clicking Reset; delta=${deltaRestored}`,
    );

    const shot3 = "walkthrough-3-restored.png";
    await page.screenshot({ path: path.join(workDir, shot3) });
    evidence.walkthroughSteps.push({
      step: 3,
      name: "reset_recovery",
      description: "Clicking Reset restores original CSS and footers re-align at the bottom.",
      delta: deltaRestored,
      screenshot: shot3,
      passed: true,
    });

    // Check no uncaught page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T037 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T037

**Task:** Publish a tested walkthrough: flexbox/use-cases  
**Status:** ${evidence.status}  
**Timestamp:** ${evidence.timestamp}  

## Walkthrough Specification
- **Entry Point:** \`${evidence.entryPoint}\`
- **Setup Command:** \`${evidence.setupCommand}\`
- **Source Anchors:** \`#code\`, \`#reset\`, \`.playable-css\`, \`.cards\`, \`.card\`, \`footer\`

## Tool Versions
- **Node.js:** ${evidence.toolVersions.node}
- **Playwright:** ${evidence.toolVersions.playwright}
- **Chromium:** ${evidence.toolVersions.browser}

## Walkthrough Steps & Layout Observations
${evidence.walkthroughSteps
  .map(
    (s) =>
      `### Step ${s.step}: ${s.name}
- **Description:** ${s.description}
- **Screenshot:** \`${s.screenshot}\`
- **Result:** PASSED`,
  )
  .join("\n\n")}

## Baseline vs Changed Behavior
- **Baseline:** ${evidence.baselineBehavior}
- **Changed:** ${evidence.changedBehavior}
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
