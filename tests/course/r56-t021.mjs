import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/learn/values-units/calc.html";
const workDir = path.join(root, "work", "R56-T021");

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
      throw new Error(`Server exited with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error("Server did not become ready.");
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(url, { waitUntil: "load" });

  const cssEditor = page.locator("textarea.playable-css");
  const htmlEditor = page.locator("textarea.playable-html");
  const resetButton = page.locator("#reset");

  await cssEditor.waitFor({ state: "visible" });
  await htmlEditor.waitFor({ state: "visible" });
  await resetButton.waitFor({ state: "visible" });
  console.log("PASS: editors and Reset button are visible.");

  const positiveTabIndices = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("[tabindex]"));
    return elements
      .filter((el) => {
        const val = parseInt(el.getAttribute("tabindex"), 10);
        return !isNaN(val) && val > 0;
      })
      .map((el) => el.outerHTML);
  });
  assert.equal(
    positiveTabIndices.length,
    0,
    `Found elements with positive tabindex: ${positiveTabIndices.join(", ")}`
  );
  console.log("PASS: no positive tabindex introduced.");

  const originalCss = await cssEditor.inputValue();
  const originalHtml = await htmlEditor.inputValue();

  const previewBox = page.locator(".preview .box");
  assert.equal((await previewBox.textContent()).trim(), "My width is calculated.");

  const layout = await previewBox.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      width: style.width,
      borderTopWidth: style.borderTopWidth,
      borderTopStyle: style.borderTopStyle,
      backgroundColor: style.backgroundColor,
    };
  });

  assert.equal(layout.width, "180px");
  assert.equal(layout.borderTopWidth, "5px");
  assert.equal(layout.borderTopStyle, "solid");
  assert.equal(layout.backgroundColor, "rgb(173, 216, 230)");
  console.log("PASS: preview content and computed layout are correct.");

  await page.screenshot({ path: path.join(workDir, "calc-initial.png") });

  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.matches("textarea.playable-css")
    ),
    true
  );

  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.matches("textarea.playable-html")
    ),
    true
  );

  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "reset"
  );
  console.log("PASS: Tab order is correct.");

  await page.screenshot({ path: path.join(workDir, "calc-focused-reset.png") });

  // After Tab order check, Reset is currently focused. Move backwards twice to CSS editor.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");

  for (const selector of [
    "textarea.playable-css",
    "textarea.playable-html",
    "#reset",
  ]) {
    const focusInfo = await page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        focused: element.matches(":focus-visible"),
        visibleIndicator:
          (style.outlineStyle !== "none" && style.outlineWidth !== "0px") ||
          style.boxShadow !== "none",
      };
    });

    assert.ok(
      focusInfo.focused && focusInfo.visibleIndicator,
      `No visible keyboard focus on ${selector}`
    );

    if (selector !== "#reset") {
      await page.keyboard.press("Tab");
    }
  }
  console.log("PASS: all three controls show visible keyboard focus.");

  async function changeEditorContents() {
    await cssEditor.fill(".box { background: rgb(255, 255, 0); width: 300px; }");
    await htmlEditor.fill('<div class="box">Keyboard test</div>');

    assert.equal((await previewBox.textContent()).trim(), "Keyboard test");

    const modified = await previewBox.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        width: style.width,
      };
    });
    assert.equal(modified.backgroundColor, "rgb(255, 255, 0)");
    assert.equal(modified.width, "300px");
  }

  async function tabFromCssToReset() {
    await cssEditor.focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.matches("textarea.playable-html")
      ),
      true
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "reset"
    );
  }

  await changeEditorContents();
  console.log("PASS: editing updates the preview.");

  await tabFromCssToReset();
  await page.keyboard.press("Space");

  assert.equal(await cssEditor.inputValue(), originalCss);
  assert.equal(await htmlEditor.inputValue(), originalHtml);
  assert.equal((await previewBox.textContent()).trim(), "My width is calculated.");
  assert.equal(
    await previewBox.evaluate((element) => getComputedStyle(element).width),
    "180px"
  );
  assert.equal(
    await previewBox.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(173, 216, 230)"
  );
  console.log("PASS: Space activates Reset.");

  await changeEditorContents();
  await tabFromCssToReset();
  await page.keyboard.press("Enter");

  assert.equal(await cssEditor.inputValue(), originalCss);
  assert.equal(await htmlEditor.inputValue(), originalHtml);
  assert.equal((await previewBox.textContent()).trim(), "My width is calculated.");
  assert.equal(
    await previewBox.evaluate((element) => getComputedStyle(element).width),
    "180px"
  );
  assert.equal(
    await previewBox.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(173, 216, 230)"
  );
  console.log("PASS: Enter activates Reset.");

  await page.screenshot({ path: path.join(workDir, "calc-restored.png") });

  await context.close();
  assert.deepEqual(
    pageErrors,
    [],
    `Unexpected page errors: ${pageErrors.join("\n")}`
  );
  console.log("PASS: no unexpected page errors.");
  console.log("\nAll R56-T021 checks passed.");
} catch (error) {
  console.error("\nR56-T021 test failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await stopServer(server);
}
