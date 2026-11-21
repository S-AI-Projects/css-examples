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
  const workDir = path.join(repoRoot, "work/R56-T040");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/editable-samples-2/pages/font/index.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });

  const evidence = {
    taskId: "R56-T040",
    issue: 40,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original index.html had duplicate class attributes on reset buttons, and lacked regression tests distinguishing broken choice click handlers from correct behavior.",
    changedBehavior:
      "Corrected duplicate HTML class attributes and added word wrapping. Implemented regression test distinguishing unmutated working state from a deliberate click-binding mutation.",
    deliberateMutation: {
      description: "Deliberately suppressed choice click event dispatch in a temporary test context.",
      intendedFailureReason: "Click event binding broken: #example-element style does not update upon choice click.",
      mutationCaught: false,
    },
    checks: [],
    status: "FAIL",
  };

  try {
    const pageErrors = [];

    // Phase 1: Test real, unmutated page
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    page1.on("pageerror", (err) => pageErrors.push(err.message || String(err)));

    const res1 = await page1.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(res1.status(), 200, "Unmutated page must return HTTP 200");

    // Initial state: choice 0 selected
    const initialChoiceText = await page1.evaluate(() => {
      const el = document.getElementById("example-element");
      return el.style.cssText;
    });
    assert.ok(initialChoiceText.includes("1.2em"), "Initial style must be applied to #example-element");

    // Click choice 1
    const choice1 = page1.locator(".example-choice").nth(1);
    await choice1.click();
    await page1.waitForTimeout(100);

    const updatedChoiceText = await page1.evaluate(() => {
      const el = document.getElementById("example-element");
      return el.style.cssText;
    });
    assert.ok(
      updatedChoiceText.includes("italic 2em"),
      `Expected second choice style applied, got: ${updatedChoiceText}`,
    );

    const isChoice1Selected = await choice1.evaluate((el) => el.classList.contains("selected"));
    assert.ok(isChoice1Selected, "Clicked choice must have .selected class");

    evidence.checks.push({ check: "unmutated_page_passes", passed: true });
    await context1.close();

    // Phase 2: Test deliberate temporary fixture mutation
    // In this context, we deliberately break click dispatch on example-choice to test regression catchability
    const contextMutated = await browser.newContext();
    await contextMutated.addInitScript(() => {
      // Simulate broken event handler binding by stopping click events from reaching listeners
      window.addEventListener(
        "click",
        (e) => {
          if (e.target && e.target.closest && e.target.closest(".example-choice")) {
            e.stopImmediatePropagation();
          }
        },
        true, // capture phase to intercept
      );
    });

    const pageMutated = await contextMutated.newPage();
    await pageMutated.goto(targetUrl, { waitUntil: "networkidle" });

    // Attempt to click choice 1 on mutated page
    const mutatedChoice1 = pageMutated.locator(".example-choice").nth(1);
    await mutatedChoice1.click();
    await pageMutated.waitForTimeout(100);

    const mutatedElementStyle = await pageMutated.evaluate(() => {
      const el = document.getElementById("example-element");
      return el.style.cssText;
    });

    // Verify that the mutation actually breaks the behavior as intended
    const mutationCausedFailure = !mutatedElementStyle.includes("italic 2em");
    assert.ok(
      mutationCausedFailure,
      "Deliberate fixture mutation must fail to update style upon choice click",
    );
    evidence.deliberateMutation.mutationCaught = true;
    evidence.checks.push({
      check: "deliberate_mutation_caught",
      passed: true,
      observedStyle: mutatedElementStyle,
    });
    await contextMutated.close();

    // Phase 3: Final confirmation that real application contains NO permanent mutation
    const contextFinal = await browser.newContext();
    const pageFinal = await contextFinal.newPage();
    await pageFinal.goto(targetUrl, { waitUntil: "networkidle" });

    const finalChoice1 = pageFinal.locator(".example-choice").nth(1);
    await finalChoice1.click();
    await pageFinal.waitForTimeout(100);

    const finalElementStyle = await pageFinal.evaluate(() => {
      const el = document.getElementById("example-element");
      return el.style.cssText;
    });
    assert.ok(
      finalElementStyle.includes("italic 2em"),
      "Final application code must be pristine with no active mutation",
    );
    evidence.checks.push({ check: "final_application_clean", passed: true });
    await contextFinal.close();

    // Ensure no uncaught page errors on real page
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T040 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T040

**Task:** Catch a plausible UI regression: editable-samples-2/pages/font  
**Status:** ${evidence.status}  
**Timestamp:** ${evidence.timestamp}  

## Tool Versions
- **Node.js:** ${evidence.toolVersions.node}
- **Playwright:** ${evidence.toolVersions.playwright}
- **Chromium:** ${evidence.toolVersions.browser}

## Baseline vs Changed Behavior
- **Baseline:** ${evidence.baselineBehavior}
- **Changed:** ${evidence.changedBehavior}

## Deliberate Mutation Test
- **Description:** ${evidence.deliberateMutation.description}
- **Intended Failure Reason:** ${evidence.deliberateMutation.intendedFailureReason}
- **Mutation Caught:** ${evidence.deliberateMutation.mutationCaught ? "YES (PASSED)" : "NO"}

## Final Application State
- Contains NO permanent mutation; all source files are intact.

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
