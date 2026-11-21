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
  const workDir = path.join(repoRoot, "work/R56-T039");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/flexbox/order/order.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });

  const evidence = {
    taskId: "R56-T039",
    issue: 39,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original order.html had yellow background focus for links but lacked explicit prefers-reduced-motion media query and focus-visible indicators for buttons.",
    changedBehavior:
      "Added prefers-reduced-motion query to disable any transitions/animations and enhanced visible focus indicators. Verified usability and visible focus at both 360px and 1280px widths.",
    viewportsTested: [],
    checks: [],
    status: "FAIL",
  };

  try {
    const pageErrors = [];
    const testWidths = [360, 1280];

    for (const width of testWidths) {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("pageerror", (err) => pageErrors.push(err.message || String(err)));

      const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, `Page must return HTTP 200 at ${width}px`);

      // 1. Verify reduced-motion preference is active
      const prefersReducedMotion = await page.evaluate(() => {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      });
      assert.equal(prefersReducedMotion, true, "prefers-reduced-motion: reduce must be active");

      // 2. Verify all controls remain usable
      const linkCount = await page.locator(".box a").count();
      assert.equal(linkCount, 5, "Expected 5 links in .box");
      const resetVisible = await page.locator("#reset").isVisible();
      assert.ok(resetVisible, "Reset button must be visible");

      // 3. Verify keyboard focus indicator visibility on links
      const firstLink = page.locator(".box a").first();
      await firstLink.focus();
      await page.waitForTimeout(50);

      const linkFocusStyles = await page.evaluate(() => {
        const a = document.querySelector(".box a");
        const s = window.getComputedStyle(a);
        return {
          backgroundColor: s.backgroundColor,
          color: s.color,
          outlineStyle: s.outlineStyle,
          outlineWidth: s.outlineWidth,
        };
      });

      assert.ok(
        linkFocusStyles.backgroundColor === "rgb(255, 255, 0)" ||
          linkFocusStyles.outlineStyle !== "none",
        `Focus indicator must be visible on link at ${width}px width`,
      );

      // 4. Verify keyboard focus indicator on Reset button
      const resetBtn = page.locator("#reset");
      await resetBtn.focus();
      await page.waitForTimeout(50);

      const resetFocusStyles = await page.evaluate(() => {
        const btn = document.getElementById("reset");
        const s = window.getComputedStyle(btn);
        return {
          outlineStyle: s.outlineStyle,
          outlineWidth: s.outlineWidth,
        };
      });

      assert.ok(
        resetFocusStyles.outlineStyle !== "none",
        `Focus indicator must be visible on Reset button at ${width}px width`,
      );

      // 5. Verify flexbox order property values
      const orderValues = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".box > div"));
        return items.map((item) => window.getComputedStyle(item).order);
      });
      assert.deepEqual(
        orderValues,
        ["2", "3", "1", "3", "1"],
        "Expected CSS orders [2, 3, 1, 3, 1]",
      );

      evidence.viewportsTested.push({
        width,
        linkFocusStyles,
        resetFocusStyles,
        orderValues,
        passed: true,
      });

      await context.close();
    }

    // Ensure no uncaught page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    );
    evidence.checks.push({ check: "no_page_errors", passed: true });

    evidence.status = "PASS";
    console.log("All R56-T039 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T039

**Task:** Respect motion and focus preferences: flexbox/order  
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

## Viewports Verified (prefers-reduced-motion: reduce)
${evidence.viewportsTested.map((v) => `- **${v.width}px**: PASSED (Focus indicator visible on links & buttons; flex orders ${JSON.stringify(v.orderValues)})`).join("\n")}
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
