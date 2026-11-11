import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";

const port = 8765;
const baseURL = `http://127.0.0.1:${port}`;
const pageURL = `${baseURL}/learn/layers/layer-order.html`;

let server;
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(pageURL);
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }
    await delay(200);
  }
  throw new Error("Local server did not become ready.");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

async function runViewport(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
  });

  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(pageURL, { waitUntil: "load" });

    const preview = page.locator(".preview");
    const cssEditor = page.locator(".playable-css");
    const htmlEditor = page.locator(".playable-html");
    const reset = page.locator("#reset");
    const heading = page.locator("h1");

    for (const [name, locator] of [
      ["Preview", preview],
      ["CSS editor", cssEditor],
      ["HTML editor", htmlEditor],
      ["Reset button", reset],
      ["Preview heading", heading],
    ]) {
      assert(await locator.isVisible(), `${name} is visible at ${width}x${height}`);
    }

    const layout = await page.evaluate(() => {
      const selectors = [
        ".preview",
        "h4",
        ".playable-css",
        ".playable-html",
        ".playable-buttons",
      ];

      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        elements: selectors.map((selector) => {
          const element = document.querySelector(selector);
          const rect = element.getBoundingClientRect();

          return {
            selector,
            top: rect.top,
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        }),
      };
    });

    assert(
      layout.documentWidth <= layout.viewportWidth,
      `No unintended page-level horizontal overflow at ${width}x${height}`,
    );

    for (const element of layout.elements) {
      assert(
        element.left >= 0 && element.right <= width,
        `${element.selector} stays within the viewport at ${width}x${height}`,
      );
    }

    for (let index = 1; index < layout.elements.length; index++) {
      assert(
        layout.elements[index].top >= layout.elements[index - 1].top,
        "Page content remains in the expected vertical order",
      );
    }

    const originalCSS = await cssEditor.inputValue();
    const originalHTML = await htmlEditor.inputValue();

    await cssEditor.fill(`${originalCSS}\n/* regression test edit */`);
    await htmlEditor.fill("<h1>Temporary test heading</h1>");

    await assert(
      (await heading.textContent()) === "Temporary test heading",
      `HTML editor updates the preview at ${width}x${height}`,
    );

    await reset.click();

    assert(
      (await cssEditor.inputValue()) === originalCSS,
      `Reset restores original CSS at ${width}x${height}`,
    );

    assert(
      (await htmlEditor.inputValue()) === originalHTML,
      `Reset restores original HTML at ${width}x${height}`,
    );

    assert(
      (await heading.textContent()).trim() === "Is this heading underlined?",
      `Reset restores the original preview at ${width}x${height}`,
    );

    await page.screenshot({
      path: `work/R56-T002/${width}x${height}.png`,
      fullPage: true,
    });

    assert(
      pageErrors.length === 0,
      `No unexpected browser page errors at ${width}x${height}`,
    );
  } finally {
    await context.close();
  }

  if (pageErrors.length > 0) {
    throw new Error(pageErrors.join("\n"));
  }
}

async function main() {
  await mkdir("work/R56-T002", { recursive: true });

  server = spawn("python3", ["-m", "http.server", String(port)], {
    stdio: "ignore",
  });

  server.on("error", (error) => {
    console.error("Server error:", error.message);
  });

  try {
    await waitForServer();
    console.log("Local server is ready.");

    browser = await chromium.launch();

    await runViewport(360, 800);
    await runViewport(1280, 800);

    console.log("\nAll R56-T002 checks passed.");
  } finally {
    if (browser) await browser.close();

    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error("\nR56-T002 FAILED:", error);
  process.exitCode = 1;
});
