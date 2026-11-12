import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const pagePath = "/multicol/spanning/h2-span.html";

async function getAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
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
let context;
const pageErrors = [];

try {
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
  context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(url, { waitUntil: "load" });

  const textInput = page.locator("#plain-text-input");
  const textPreview = page.locator("#plain-text-preview");
  const previewContainer = page.locator(".text-example-container");

  await textInput.waitFor({ state: "visible" });

  assert.equal(
    await textPreview.textContent(),
    "Type your text here."
  );
  console.log("PASS: initial text appears in the preview.");

  const testText = "Hello from Task 8";
  await textInput.fill(testText);

  assert.equal(await textPreview.textContent(), testText);
  console.log("PASS: typing updates the text preview.");

  const layout = await previewContainer.evaluate((element) => {
    const heading = element.querySelector("h2");
    return {
      columnWidth: getComputedStyle(element).columnWidth,
      headingSpan: getComputedStyle(heading).columnSpan,
    };
  });

  assert.equal(layout.columnWidth, "200px");
  assert.equal(layout.headingSpan, "all");
  console.log("PASS: companion preview has multicolumn layout and spanning heading.");

  const htmlLikeText =
    '<img src=x onerror="window.__r56T008HandlerRan = true">';

  await textInput.fill(htmlLikeText);

  assert.equal(await textPreview.textContent(), htmlLikeText);
  assert.equal(await textPreview.locator("img").count(), 0);

  const handlerRan = await page.evaluate(
    () => window.__r56T008HandlerRan === true
  );
  assert.equal(handlerRan, false);

  console.log("PASS: HTML-like input stays text; no image or event handler is created.");

  const htmlEditor = page.locator("#code");
  const resetButton = page.locator("#reset");

  await htmlEditor.fill("<p>Original playground still works</p>");

  assert.equal(
    (await page.locator("section").first().textContent()).trim(),
    "Original playground still works"
  );

  await resetButton.click();

  assert.match(await htmlEditor.inputValue(), /A heading/);
  console.log("PASS: original HTML playground and Reset still work.");

  await page.screenshot({
    path: "work/R56-T008/text-rendering.png",
    fullPage: true,
  });

  await context.close();
  context = null;

  assert.deepEqual(
    pageErrors,
    [],
    `Unexpected page errors: ${pageErrors.join("\n")}`
  );

  console.log("PASS: no unexpected page errors.");
  console.log("\nAll R56-T008 checks passed.");
} catch (error) {
  console.error("\nR56-T008 test failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  await stopServer(server);
}
