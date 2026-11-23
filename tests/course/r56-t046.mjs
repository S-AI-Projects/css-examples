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

async function runTest() {
  const { server, port } = await createStaticServer();
  const pageUrl = `http://127.0.0.1:${port}/editable-samples/pages/font/index.html`;

  let browser;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
    });
    const page = await context.newPage();

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    // 1. Navigate to documented entry point
    await page.goto(pageUrl, { waitUntil: "networkidle" });

    // 2. Verify required source anchors
    const editor = page.locator("#editor");
    const reset = page.locator("#reset");
    const editorContent = page.locator("#editor-content");
    const output = page.locator("#output");
    const exampleElement = page.locator("#example-element");

    await assert.doesNotReject(async () => {
      await editor.waitFor({ state: "attached" });
      await reset.waitFor({ state: "attached" });
      await editorContent.waitFor({ state: "attached" });
      await output.waitFor({ state: "visible" });
      await exampleElement.waitFor({ state: "visible" });
    }, "Source anchors #editor, #reset, #editor-content, and #output must exist in DOM");

    // 3. Baseline observation: Reset button is initially hidden
    const initialResetHidden = await reset.evaluate((el) => el.classList.contains("hidden"));
    assert.ok(initialResetHidden, "Reset button must have .hidden class initially");

    // 4. Initial style check: italic font
    const initialFont = await exampleElement.evaluate((el) => el.style.font);
    assert.ok(
      initialFont.includes("italic") || initialFont.includes("cursive"),
      `Initial font should contain italic or cursive, got: ${initialFont}`
    );

    // 5. Complete interaction walkthrough: Edit CodeMirror content
    await page.waitForSelector(".CodeMirror");
    await page.evaluate(() => {
      window.cmEditor.setValue("font: bold 2em sans-serif;\n\n");
    });

    // 6. Observation after interaction: #reset becomes visible
    await page.waitForFunction(() => {
      const r = document.getElementById("reset");
      return r && !r.classList.contains("hidden");
    });
    const isResetVisible = await reset.isVisible();
    assert.ok(isResetVisible, "Reset button should become visible after editor content change");

    // Observation: font updated to bold sans-serif
    const updatedFont = await exampleElement.evaluate((el) => el.style.font);
    assert.ok(
      updatedFont.includes("sans-serif") && updatedFont.includes("bold"),
      `Updated font must reflect bold sans-serif, got: ${updatedFont}`
    );

    // 7. Save walkthrough screenshot
    const workDir = path.resolve(repoRoot, "work/R56-T046");
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(workDir, "walkthrough.png") });

    // 8. Interaction: Click #reset button
    await reset.click();

    // Observation: Reset button is hidden again
    await page.waitForFunction(() => {
      const r = document.getElementById("reset");
      return r && r.classList.contains("hidden");
    });
    const isResetHiddenAfter = await reset.evaluate((el) => el.classList.contains("hidden"));
    assert.ok(isResetHiddenAfter, "Reset button should be hidden again after reset");

    // Observation: Font is restored
    const restoredFont = await exampleElement.evaluate((el) => el.style.font);
    assert.ok(
      restoredFont.includes("italic") || restoredFont.includes("cursive"),
      `Restored font must return to initial cursive/italic, got: ${restoredFont}`
    );

    // 9. Verify 0 page errors
    assert.equal(
      pageErrors.length,
      0,
      `Unexpected page errors found: ${pageErrors.join("; ")}`
    );

    console.log("PASS: R56-T046 published walkthrough checks passed successfully.");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FAIL: R56-T046 check failed:", err);
  process.exit(1);
});
