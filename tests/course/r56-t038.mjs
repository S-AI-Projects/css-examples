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
  const workDir = path.join(repoRoot, "work/R56-T038");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/multicol/styling/column-gap.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const injectionPayload = '<img src="x" onerror="window.__xssFired=true">';

  const evidence = {
    taskId: "R56-T038",
    issue: 38,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original column-gap example had an HTML textarea with no dedicated text-only rendering input to verify safe text handling.",
    changedBehavior:
      "Added an isolated companion text-rendering example using textContent. HTML injection payloads render strictly as plain text with 0 injected elements and no handler execution.",
    injectionPayload,
    checks: [],
    status: "FAIL",
  };

  try {
    const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, "Page must return HTTP 200");
    evidence.checks.push({ check: "http_200", passed: true });

    // 1. Test text-rendering companion with injection string
    const textInput = page.locator("#companion-text-input");
    await textInput.fill(injectionPayload);
    await page.waitForTimeout(100);

    const checkResults = await page.evaluate(() => {
      const outputEl = document.getElementById("companion-text-output");
      return {
        textContent: outputEl.textContent,
        imgCount: outputEl.querySelectorAll("img").length,
        childElementCount: outputEl.children.length,
        xssExecuted: Boolean(window.__xssFired),
      };
    });

    // Verify string appears as literal text
    assert.ok(
      checkResults.textContent.includes('<img src="x" onerror='),
      `Expected literal text in output, got: ${checkResults.textContent}`,
    );
    // Verify no injected element was created
    assert.equal(checkResults.imgCount, 0, "No img element should be injected into the DOM");
    assert.equal(checkResults.childElementCount, 0, "No child elements should be created");
    // Verify no handler executed
    assert.equal(checkResults.xssExecuted, false, "Onerror handler must not execute");

    evidence.checks.push({
      check: "text_rendered_safely_as_text",
      passed: true,
      checkResults,
    });

    // 2. Test explicit rich HTML separate contract on #code
    const htmlTextarea = page.locator("#code");
    await htmlTextarea.fill('<div class="container"><p><strong>Bold column text</strong></p></div>');
    await page.waitForTimeout(100);

    const richContractResults = await page.evaluate(() => {
      const section = document.querySelector("section");
      return {
        hasStrong: section.querySelectorAll("strong").length > 0,
        strongText: section.querySelector("strong")?.textContent,
      };
    });
    assert.ok(richContractResults.hasStrong, "Rich HTML editor should support intended HTML markup");
    evidence.checks.push({
      check: "rich_html_separate_contract_preserved",
      passed: true,
      richContractResults,
    });

    // 3. Test Reset button clears companion text and restores HTML
    const resetBtn = page.locator("#reset");
    await resetBtn.click();
    await page.waitForTimeout(100);

    const postResetState = await page.evaluate(() => {
      return {
        companionVal: document.getElementById("companion-text-input").value,
        companionText: document.getElementById("companion-text-output").textContent,
        paragraphCount: document.querySelectorAll("section p").length,
      };
    });
    assert.equal(postResetState.companionVal, "", "Companion input must be cleared on reset");
    assert.equal(postResetState.companionText, "", "Companion output must be cleared on reset");
    assert.equal(postResetState.paragraphCount, 3, "Original 3 paragraphs must be restored on reset");
    evidence.checks.push({ check: "reset_recovery", passed: true, postResetState });

    // 4. Ensure no uncaught page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T038 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T038

**Task:** Keep fixture text as text: multicol/styling  
**Status:** ${evidence.status}  
**Timestamp:** ${evidence.timestamp}  

## Tool Versions
- **Node.js:** ${evidence.toolVersions.node}
- **Playwright:** ${evidence.toolVersions.playwright}
- **Chromium:** ${evidence.toolVersions.browser}

## Injection Test String
\`${evidence.injectionPayload}\`

## Baseline vs Changed Behavior
- **Baseline:** ${evidence.baselineBehavior}
- **Changed:** ${evidence.changedBehavior}

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
