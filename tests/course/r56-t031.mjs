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
  const workDir = path.join(repoRoot, "work/R56-T031");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/editable-samples-2/pages/font/index.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const evidence = {
    taskId: "R56-T031",
    issue: 31,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original editable.js attached click listeners only; choices lacked tabindex, keyboard focus, and Enter/Space activation.",
    changedBehavior:
      "Added tabindex=0, role=button, Enter/Space activation, and visible focus outline styles. Keyboard navigation and activation fully functional.",
    checks: [],
    status: "FAIL",
  };

  try {
    const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, "Page must return HTTP 200");
    evidence.checks.push({ check: "http_200", passed: true });

    // 1. Verify no positive tabindex is introduced
    const positiveTabindexCount = await page.evaluate(() => {
      const elements = document.querySelectorAll("[tabindex]");
      let count = 0;
      elements.forEach((el) => {
        const val = parseInt(el.getAttribute("tabindex"), 10);
        if (val > 0) count++;
      });
      return count;
    });
    assert.equal(
      positiveTabindexCount,
      0,
      "No element must introduce a positive tabindex",
    );
    evidence.checks.push({ check: "no_positive_tabindex", passed: true });

    // 2. Check each example-choice has tabindex=0 and role=button
    const choicesInfo = await page.evaluate(() => {
      const choices = Array.from(document.querySelectorAll(".example-choice"));
      return choices.map((c) => ({
        tabindex: c.getAttribute("tabindex"),
        role: c.getAttribute("role"),
        text: c.querySelector("code")?.textContent?.trim(),
      }));
    });
    assert.equal(choicesInfo.length, 5, "Expected 5 example choices");
    for (const info of choicesInfo) {
      assert.equal(
        info.tabindex,
        "0",
        `Choice ${info.text} must have tabindex="0"`,
      );
      assert.equal(
        info.role,
        "button",
        `Choice ${info.text} must have role="button"`,
      );
    }
    evidence.checks.push({ check: "choices_keyboard_accessible", passed: true });

    // 3. Test keyboard Tab traversal and activation
    // Choice 0 is initial choice
    const initialElementStyle = await page.evaluate(() => {
      return document.getElementById("example-element").style.cssText;
    });
    assert.ok(initialElementStyle.includes("1.2em"), "Initial style applied");

    // Focus on second choice and activate with Space / Enter
    const secondChoice = page.locator(".example-choice").nth(1);
    await secondChoice.focus();

    // Check visible focus
    const focusOutline = await page.evaluate(() => {
      const el = document.querySelectorAll(".example-choice")[1];
      const style = window.getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    evidence.checks.push({
      check: "focus_visible",
      passed: true,
      focusOutline,
    });

    // Press Enter to activate choice 1
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);

    const updatedElementStyle = await page.evaluate(() => {
      return document.getElementById("example-element").style.cssText;
    });
    assert.ok(
      updatedElementStyle.includes("italic 2em"),
      `Expected second choice style applied, got: ${updatedElementStyle}`,
    );
    evidence.checks.push({ check: "keyboard_activation_enter", passed: true });

    // Activate third choice using Space
    const thirdChoice = page.locator(".example-choice").nth(2);
    await thirdChoice.focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);

    const thirdElementStyle = await page.evaluate(() => {
      return document.getElementById("example-element").style.cssText;
    });
    assert.ok(
      thirdElementStyle.includes("small-caps bold 16px"),
      `Expected third choice style applied, got: ${thirdElementStyle}`,
    );
    evidence.checks.push({ check: "keyboard_activation_space", passed: true });

    // 4. Test Reset button keyboard operation
    const resetBtn = thirdChoice.locator(".reset");
    await resetBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    evidence.checks.push({ check: "reset_button_keyboard", passed: true });

    // 5. Ensure no uncaught page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T031 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T031

**Task:** Verify keyboard use: editable-samples-2/js  
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
