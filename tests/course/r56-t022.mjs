import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/houdini/css_painting_api/example-boxbg.html";
const workDir = path.join(root, "work", "R56-T022");

async function getAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForServer(server, url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited prematurely with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error("Server did not become ready within timeout.");
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    delay(3000).then(() => {
      if (server.exitCode === null) server.kill("SIGKILL");
    }),
  ]);
}

let server;
let browser;

try {
  await fs.mkdir(workDir, { recursive: true });

  const port = await getAvailablePort();
  const url = `http://127.0.0.1:${port}${pagePath}`;

  server = spawn(
    "python3",
    ["-m", "http.server", String(port), "--bind", "127.0.0.1"],
    { cwd: root, stdio: "ignore" }
  );

  await waitForServer(server, url);
  console.log("PASS: local server started.");

  browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "mobile", width: 360, height: 800 },
    { name: "desktop", width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    const pageErrors = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(url, { waitUntil: "load" });

    // Allow CSS painting worklet module to register and paint
    await delay(500);

    const ul = page.locator("ul");
    await ul.waitFor({ state: "visible" });
    const liElements = page.locator("ul > li");
    const count = await liElements.count();
    assert.equal(count, 18, `Expected 18 list items, found ${count} at ${vp.width}x${vp.height}`);
    console.log(`PASS: 18 items rendered at ${vp.width}x${vp.height}.`);

    // Verify layout and overflow
    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const ulEl = document.querySelector("ul");
      const lis = Array.from(document.querySelectorAll("ul > li"));

      const ulRect = ulEl.getBoundingClientRect();
      const liData = lis.map((li, index) => {
        const rect = li.getBoundingClientRect();
        const style = getComputedStyle(li);
        return {
          index,
          text: li.textContent.trim(),
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          bgImage: style.backgroundImage,
          boxColor: style.getPropertyValue("--boxColor").trim(),
          widthSubtractor: style.getPropertyValue("--widthSubtractor").trim(),
        };
      });

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        ulRect: {
          left: ulRect.left,
          right: ulRect.right,
          width: ulRect.width,
        },
        hasPaintWorklet: "paintWorklet" in CSS,
        liData,
      };
    });

    // 1. Unintended page-level horizontal overflow check
    assert.ok(
      layout.scrollWidth <= layout.viewportWidth,
      `Unintended page horizontal overflow at ${vp.width}x${vp.height}: scrollWidth (${layout.scrollWidth}) > viewportWidth (${layout.viewportWidth})`
    );
    console.log(`PASS: no page-level horizontal overflow at ${vp.width}x${vp.height}.`);

    // 2. Main content container stays within viewport
    assert.ok(
      layout.ulRect.left >= 0 && layout.ulRect.right <= layout.viewportWidth,
      `UL container overflows viewport at ${vp.width}x${vp.height}: left=${layout.ulRect.left}, right=${layout.ulRect.right}`
    );
    console.log(`PASS: main content container is within viewport bounds at ${vp.width}x${vp.height}.`);

    // 3. Individual element boundary check
    const overflowingElements = layout.liData.filter(
      (item) => item.left < 0 || item.right > layout.viewportWidth
    );
    assert.equal(
      overflowingElements.length,
      0,
      `Found ${overflowingElements.length} overflowing LI items at ${vp.width}x${vp.height}`
    );
    console.log(`PASS: all 18 list elements remain within viewport at ${vp.width}x${vp.height}.`);

    // 4. Logical vertical ordering check
    for (let i = 1; i < layout.liData.length; i++) {
      assert.ok(
        layout.liData[i].top > layout.liData[i - 1].top,
        `Item ${i} top (${layout.liData[i].top}) is not greater than item ${i - 1} top (${layout.liData[i - 1].top}) at ${vp.width}x${vp.height}`
      );
    }
    console.log(`PASS: content maintains logical vertical order at ${vp.width}x${vp.height}.`);

    // 5. CSS Painting API verification
    assert.ok(
      layout.hasPaintWorklet,
      `CSS.paintWorklet is not supported in the test environment at ${vp.width}x${vp.height}`
    );
    for (const item of layout.liData) {
      assert.ok(
        item.bgImage.includes("paint(boxbg)") || item.bgImage.includes("paint"),
        `Item ${item.index} missing paint(boxbg) background at ${vp.width}x${vp.height}`
      );
      assert.ok(
        item.boxColor.length > 0,
        `Item ${item.index} missing --boxColor custom property at ${vp.width}x${vp.height}`
      );
    }
    console.log(`PASS: CSS Painting API properties verified at ${vp.width}x${vp.height}.`);

    // 6. Interactive controls verification (static demo check)
    const interactiveControls = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll("button, input, select, textarea, a[href]")
      );
      return controls.map((c) => c.outerHTML);
    });
    assert.equal(
      interactiveControls.length,
      0,
      `Expected no interactive controls on static demo, found: ${interactiveControls.join(", ")}`
    );
    console.log(`PASS: static demo confirmed (0 interactive controls) at ${vp.width}x${vp.height}.`);

    // 7. Capture screenshots (baseline and after-change)
    const baseShot = path.join(workDir, `baseline-${vp.width}x${vp.height}.png`);
    const afterShot = path.join(workDir, `after-${vp.width}x${vp.height}.png`);
    await page.screenshot({ path: baseShot, fullPage: true });
    await page.screenshot({ path: afterShot, fullPage: true });
    console.log(`PASS: screenshots saved for ${vp.width}x${vp.height}.`);

    // 8. Page error check
    assert.deepEqual(
      pageErrors,
      [],
      `Unexpected page errors at ${vp.width}x${vp.height}: ${pageErrors.join("\n")}`
    );
    console.log(`PASS: no unexpected page errors at ${vp.width}x${vp.height}.`);

    await context.close();
  }

  console.log("\nAll R56-T022 checks passed.");
} catch (error) {
  console.error("\nR56-T022 test failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await stopServer(server);
}
