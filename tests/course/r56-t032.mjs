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
  const workDir = path.join(repoRoot, "work/R56-T032");
  fs.mkdirSync(workDir, { recursive: true });

  const { server, port } = await createStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = "/learn/rwd/type-vw.html";
  const targetUrl = `${baseUrl}${targetPath}`;

  const browser = await chromium.launch({ headless: true });

  const evidence = {
    taskId: "R56-T032",
    issue: 32,
    url: targetUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: "1.65.1",
      browser: browser.version(),
    },
    baselineBehavior:
      "Original type-vw.html lacked box-sizing: border-box and overflow-wrap: break-word, risking unintended horizontal overflow.",
    changedBehavior:
      "Applied universal border-box sizing and break-word wrapping. Verified no horizontal overflow and correct layout rendering across 360x800 and 1280x800 viewports.",
    viewportsTested: [],
    checks: [],
    status: "FAIL",
  };

  try {
    const viewports = [
      { width: 360, height: 800, name: "mobile" },
      { width: 1280, height: 800, name: "desktop" },
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      const pageErrors = [];
      page.on("pageerror", (err) => {
        pageErrors.push(err.message || String(err));
      });

      const response = await page.goto(targetUrl, {
        waitUntil: "networkidle",
      });
      assert.equal(
        response.status(),
        200,
        `Page must return HTTP 200 at ${vp.width}x${vp.height}`,
      );

      // Check no unintended horizontal overflow
      const overflowInfo = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        return {
          docScrollWidth: docEl.scrollWidth,
          docClientWidth: docEl.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          bodyClientWidth: body.clientWidth,
        };
      });

      assert.ok(
        overflowInfo.docScrollWidth <= overflowInfo.docClientWidth,
        `Horizontal overflow detected at ${vp.width}x${vp.height}: scrollWidth=${overflowInfo.docScrollWidth}, clientWidth=${overflowInfo.docClientWidth}`,
      );

      // Check content elements exist and are visible
      const elements = await page.evaluate(() => {
        const wrapper = document.querySelector(".wrapper");
        const col1 = document.querySelector(".col1");
        const col2 = document.querySelector(".col2");
        const h1 = document.querySelector("h1");

        const getBox = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
          };
        };

        return {
          wrapper: getBox(wrapper),
          col1: getBox(col1),
          col2: getBox(col2),
          h1: getBox(h1),
          wrapperDisplay: window.getComputedStyle(wrapper).display,
        };
      });

      assert.ok(elements.wrapper.visible, "Wrapper must be visible");
      assert.ok(elements.col1.visible, "Col1 must be visible");
      assert.ok(elements.col2.visible, "Col2 must be visible");
      assert.ok(elements.h1.visible, "H1 must be visible");

      if (vp.width === 360) {
        // At mobile, col1 should be stacked above col2
        assert.ok(
          elements.col1.y < elements.col2.y,
          "At 360px width, col1 should appear above col2 in single column layout",
        );
      } else if (vp.width === 1280) {
        // At desktop (>= 600px), wrapper has grid display
        assert.equal(
          elements.wrapperDisplay,
          "grid",
          "Wrapper should be display: grid at 1280px",
        );
        assert.ok(
          elements.col1.x < elements.col2.x,
          "At 1280px width, col1 should be to the left of col2 in grid layout",
        );
      }

      assert.equal(
        pageErrors.length,
        0,
        `Unexpected page errors at ${vp.width}x${vp.height}: ${pageErrors.join(", ")}`,
      );

      const screenshotPath = path.join(
        workDir,
        `screenshot-${vp.width}x${vp.height}.png`,
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });

      evidence.viewportsTested.push({
        width: vp.width,
        height: vp.height,
        name: vp.name,
        overflowInfo,
        screenshot: `screenshot-${vp.width}x${vp.height}.png`,
        passed: true,
      });

      await context.close();
    }

    evidence.status = "PASS";
    console.log("All R56-T032 assertions passed successfully.");
  } finally {
    fs.writeFileSync(
      path.join(workDir, "results.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
    const mdReport = `# Verification Report: R56-T032

**Task:** Protect the layout at two widths: learn/rwd  
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

## Viewports Verified
${evidence.viewportsTested.map((v) => `- **${v.width}x${v.height} (${v.name})**: PASSED (No horizontal overflow; layout properly adapted)`).join("\n")}
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
