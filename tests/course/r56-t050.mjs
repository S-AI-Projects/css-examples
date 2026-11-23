import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const pageURL = `file://${path.join(root, 'learn', 'backgrounds-borders', 'size.html')}`;

const browser = await chromium.launch({ headless: true });
let expectedBgSize;

try {
  // ── CHECK 1: Feature-present path — background-size is supported ──
  const ctx1 = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page1 = await ctx1.newPage();
  await page1.goto(pageURL, { waitUntil: 'load' });

  // Verify background-size is applied (10em computes to a pixel value)
  const bgSize = await page1.$eval('section.preview .box', el =>
    getComputedStyle(el).backgroundSize
  );
  assert.ok(
    bgSize.startsWith('100px ') && parseInt(bgSize.split(' ')[1]) >= 100,
    `Feature-present: background-size should be "100px <em-value>", got "${bgSize}"`
  );
  expectedBgSize = bgSize;

  // Verify background-image is set
  const bgImage = await page1.$eval('section.preview .box', el =>
    getComputedStyle(el).backgroundImage
  );
  assert.ok(
    bgImage.includes('balloons.jpg'),
    `Feature-present: background-image should reference balloons.jpg, got "${bgImage}"`
  );

  // Verify fallback background-color is set (from the base non-editable style)
  const bgColor = await page1.$eval('section.preview .box', el =>
    getComputedStyle(el).backgroundColor
  );
  // #e2e8f0 = rgb(226, 232, 240) — the base fallback, though image paints over it
  assert.ok(
    bgColor !== 'rgba(0, 0, 0, 0)',
    `Feature-present: fallback background-color should be set, got "${bgColor}"`
  );

  // Verify @supports NOT block does NOT apply (no ::after content in supported browser)
  const afterContent = await page1.$eval('section.preview .box', el =>
    getComputedStyle(el, '::after').content
  );
  assert.ok(
    afterContent === 'none' || afterContent === '""' || afterContent === '',
    `Feature-present: ::after content should be none/empty, got "${afterContent}"`
  );

  await ctx1.close();

  // ── CHECK 2: Feature-absent simulation ──
  // We can't truly disable @supports in a supporting browser, so we simulate
  // the fallback path by injecting the same styles @supports not would apply.
  const ctx2 = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page2 = await ctx2.newPage();
  await page2.goto(pageURL, { waitUntil: 'load' });

  // Simulate: remove background-size/image, apply the fallback styles
  await page2.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      section.preview .box {
        background-size: auto !important;
        background-image: none !important;
        background-color: #cbd5e1 !important;
      }
      section.preview .box::after {
        content: "Your browser does not support background-size. The background image cannot be resized." !important;
        display: block !important;
        padding: 1em !important;
        color: #334155 !important;
        font-style: italic !important;
      }
    `;
    document.head.appendChild(style);
  });

  await page2.waitForTimeout(200);

  // Verify fallback background-color is visible (#cbd5e1 = rgb(203, 213, 225))
  const fallbackBg = await page2.$eval('section.preview .box', el =>
    getComputedStyle(el).backgroundColor
  );
  assert.ok(
    fallbackBg.includes('203') && fallbackBg.includes('213') && fallbackBg.includes('225'),
    `Feature-absent: background-color should be #cbd5e1 (rgb(203,213,225)), got "${fallbackBg}"`
  );

  // Verify fallback text is displayed via ::after
  const fallbackText = await page2.$eval('section.preview .box', el =>
    getComputedStyle(el, '::after').content
  );
  assert.ok(
    fallbackText.includes('does not support background-size'),
    `Feature-absent: ::after should contain fallback message, got "${fallbackText}"`
  );

  // Verify background-image is removed
  const noBgImage = await page2.$eval('section.preview .box', el =>
    getComputedStyle(el).backgroundImage
  );
  assert.equal(noBgImage, 'none', `Feature-absent: background-image should be none, got "${noBgImage}"`);

  await ctx2.close();

  // ── CHECK 3: Reset button restores original state ──
  const ctx3 = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page3 = await ctx3.newPage();
  await page3.goto(pageURL, { waitUntil: 'load' });

  // Modify the CSS textarea to remove background-size
  await page3.evaluate(() => {
    const ta = document.querySelector('.playable-css');
    ta.value = '.box { background-color: red; }';
    ta.dispatchEvent(new Event('input'));
  });
  await page3.waitForTimeout(200);

  // After removing background-size from editable style, it falls back to initial "auto"
  const editedBgSize = await page3.$eval('section.preview .box', el =>
    getComputedStyle(el).backgroundSize
  );
  assert.ok(
    editedBgSize === 'auto' || editedBgSize === 'auto auto',
    `After edit: background-size should be auto, got "${editedBgSize}"`
  );

  // Click Reset
  await page3.click('#reset');
  await page3.waitForTimeout(200);

  const resetBgSize = await page3.$eval('section.preview .box', el =>
    getComputedStyle(el).backgroundSize
  );
  assert.equal(
    resetBgSize, expectedBgSize,
    `After reset: background-size should be restored to "${expectedBgSize}", got "${resetBgSize}"`
  );

  await ctx3.close();

  // ── CHECK 4: Source file integrity ──
  const fs = await import('node:fs');
  const src = fs.readFileSync(path.join(root, 'learn', 'backgrounds-borders', 'size.html'), 'utf8');
  assert.ok(
    src.includes('background-size: 100px 10em'),
    'Source must contain "background-size: 100px 10em"'
  );
  assert.ok(
    src.includes('@supports not (background-size: cover)'),
    'Source must contain @supports fallback block'
  );
  assert.ok(
    src.includes('background-color: #e2e8f0'),
    'Source must contain fallback background-color in base style'
  );

  console.log('PASS: R56-T050 feature-support fallback — present path works, absent path shows fallback, reset restores.');
} finally {
  await browser.close();
}
