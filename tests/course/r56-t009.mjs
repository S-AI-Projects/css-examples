
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../..");
const pageFile = path.join(
  projectRoot,
  "multicol/styling/column-gap.html"
);
const evidenceDir = path.join(
  projectRoot,
  "work/R56-T009"
);

const html = fs.readFileSync(pageFile, "utf8");

const server = http.createServer((req, res) => {
  if (req.url === "/multicol/styling/column-gap.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

async function checkWidth(browser, width, label) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });

  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  try {
    const response = await page.goto(
      `http://127.0.0.1:${server.address().port}/multicol/styling/column-gap.html`,
      { waitUntil: "load" }
    );

    assert.equal(response.status(), 200, "Page should load successfully");

    assert.equal(
      await page.evaluate(() =>
        matchMedia("(prefers-reduced-motion: reduce)").matches
      ),
      true,
      "Reduced-motion preference should be active"
    );

    const motion = await page.evaluate(() => {
      const elements = [...document.querySelectorAll("*")];

      return {
        animations: document.getAnimations().length,
        animatedElements: elements.filter((element) => {
          return getComputedStyle(element).animationName !== "none";
        }).length,
        transitioningElements: elements.filter((element) => {
          return getComputedStyle(element).transitionDuration
            .split(",")
            .some((duration) => parseFloat(duration) > 0);
        }).length,
      };
    });

    assert.equal(motion.animations, 0, "No active animations expected");
    assert.equal(motion.animatedElements, 0, "No CSS animations expected");
    assert.equal(
      motion.transitioningElements,
      0,
      "No CSS transitions expected"
    );

    const initialLayout = await page.locator(".container").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        columnCount: style.columnCount,
        columnGap: style.columnGap,
      };
    });

    assert.equal(initialLayout.columnCount, "3");
    assert.equal(initialLayout.columnGap, "40px");

    const expectedControls = [
      { selector: ".playable-css", description: "CSS editor" },
      { selector: "#code", description: "HTML editor" },
      { selector: "#reset", description: "Reset button" },
    ];

    for (const control of expectedControls) {
      await page.keyboard.press("Tab");

      const focus = await page.evaluate(() => {
        const element = document.activeElement;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return {
          className: element.className,
          id: element.id,
          focusVisible: element.matches(":focus-visible"),
          outlineStyle: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth),
          insideViewport:
            rect.right > 0 &&
            rect.left < window.innerWidth &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight,
        };
      });

      const selectorMatches =
        control.selector === ".playable-css"
          ? focus.className.includes("playable-css")
          : focus.id === control.selector.slice(1);

      assert.equal(
        selectorMatches,
        true,
        `${control.description} should receive keyboard focus`
      );

      assert.equal(
        focus.focusVisible,
        true,
        `${control.description} should match :focus-visible`
      );

      assert.notEqual(
        focus.outlineStyle,
        "none",
        `${control.description} should have a visible focus outline`
      );

      assert.ok(
        focus.outlineWidth > 0,
        `${control.description} should have a non-zero focus outline`
      );

      assert.equal(
        focus.insideViewport,
        true,
        `${control.description} should remain inside the viewport`
      );
    }

    await page.locator(".playable-css").fill(
      ".container { column-count: 2; column-gap: 24px; }"
    );

    const editedLayout = await page.locator(".container").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        columnCount: style.columnCount,
        columnGap: style.columnGap,
      };
    });

    assert.equal(editedLayout.columnCount, "2");
    assert.equal(editedLayout.columnGap, "24px");

    await page.locator("#code").fill(
      '<div class="container"><p>R56-T009 preview update</p></div>'
    );

    await page.locator("section").getByText("R56-T009 preview update").waitFor();

    await page.locator("#reset").click();

    const resetLayout = await page.locator(".container").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        columnCount: style.columnCount,
        columnGap: style.columnGap,
      };
    });

    assert.equal(resetLayout.columnCount, "3");
    assert.equal(resetLayout.columnGap, "40px");

    assert.equal(
      await page.locator(".playable-css").inputValue(),
      ".container {\n  column-count: 3;\n  column-gap: 40px;\n}"
    );

    assert.deepEqual(
      pageErrors,
      [],
      "The page should not produce unexpected JavaScript errors"
    );

    await page.screenshot({
      path: path.join(evidenceDir, `r56-t009-${label}.png`),
      fullPage: true,
    });

    console.log(`PASS: ${label} viewport (${width}px)`);
    console.log("  Reduced motion: active");
    console.log("  Animations/transitions: none");
    console.log("  Keyboard focus: visible on all three controls");
    console.log("  Layout: 3 columns / 40px gap");
    console.log("  CSS edit and HTML edit: passed");
    console.log("  Reset: restored original layout");
    console.log("  Page errors: none");
  } finally {
    await context.close();
  }
}

async function main() {
  let browser;

  try {
    fs.mkdirSync(evidenceDir, { recursive: true });

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const url = `http://127.0.0.1:${server.address().port}/multicol/styling/column-gap.html`;

    let ready = false;

    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const response = await fetch(url);

        if (response.status === 200) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    assert.equal(ready, true, "Local server should become ready");

    browser = await chromium.launch();

    await checkWidth(browser, 1280, "desktop");
    await checkWidth(browser, 375, "mobile");

    console.log("\nAll R56-T009 checks passed.");
  } finally {
    if (browser) {
      await browser.close();
    }

    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

main().catch((error) => {
  console.error("\nR56-T009 test failed:");
  console.error(error);
  process.exitCode = 1;
});
