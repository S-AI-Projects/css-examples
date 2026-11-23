import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const pageURL = `file://${path.join(root, 'learn', 'writing-modes', 'float.html')}`;

const browser = await chromium.launch({ headless: true });

try {
  // ── CHECK 1: Baseline — correct layout ──
  const ctx1 = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page1 = await ctx1.newPage();
  await page1.goto(pageURL, { waitUntil: 'load' });

  // The image should be floated (inline-start or left) in the preview section
  const baselineFloat = await page1.$eval('section.preview img', el =>
    getComputedStyle(el).float
  );
  assert.ok(
    baselineFloat === 'inline-start' || baselineFloat === 'left',
    `Baseline: img float should be inline-start|left, got "${baselineFloat}"`
  );

  // Measure baseline: the paragraph text should wrap beside the image.
  // The image's right edge should be less than the paragraph's left edge
  // or the paragraph text should start at an x > image x (text wraps around).
  const baselineLayout = await page1.$eval('section.preview .box', box => {
    const img = box.querySelector('img');
    const p = box.querySelector('p');
    const imgRect = img.getBoundingClientRect();
    const pRect = p.getBoundingClientRect();
    return {
      imgRight: imgRect.right,
      pLeft: pRect.left,
      imgTop: imgRect.top,
      pTop: pRect.top,
      boxWidth: box.getBoundingClientRect().width,
    };
  });

  // With float, the paragraph starts at the same top as the image (text wraps around it)
  // The key signal: image top and paragraph top are close (both start near top of .box)
  assert.ok(
    Math.abs(baselineLayout.imgTop - baselineLayout.pTop) < 50,
    `Baseline: img and p should start at similar vertical position (float wrapping)`
  );

  await ctx1.close();

  // ── CHECK 2: Regression fixture — deliberately break float ──
  const ctx2 = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page2 = await ctx2.newPage();
  await page2.goto(pageURL, { waitUntil: 'load' });

  // Inject a mutation: remove the float from the image via CSS override
  await page2.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = 'section.preview img { float: none !important; margin: 0 !important; }';
    document.head.appendChild(style);
  });

  // Wait for reflow
  await page2.waitForTimeout(200);

  const brokenFloat = await page2.$eval('section.preview img', el =>
    getComputedStyle(el).float
  );
  assert.equal(brokenFloat, 'none', 'Broken fixture: img float should be none');

  const brokenLayout = await page2.$eval('section.preview .box', box => {
    const img = box.querySelector('img');
    const p = box.querySelector('p');
    const imgRect = img.getBoundingClientRect();
    const pRect = p.getBoundingClientRect();
    return {
      imgBottom: imgRect.bottom,
      pTop: pRect.top,
    };
  });

  // Without float, the paragraph is pushed below the image (block flow)
  assert.ok(
    brokenLayout.pTop >= brokenLayout.imgBottom - 2,
    `Broken fixture: paragraph top (${brokenLayout.pTop}) should be at or below image bottom (${brokenLayout.imgBottom}) when float is removed`
  );

  await ctx2.close();

  // ── CHECK 3: Confirm the mutation distinguishes broken from correct ──
  // Baseline: p.top ≈ img.top (wrapping). Broken: p.top >= img.bottom (stacked).
  // This is already asserted above. The test passes if baseline wraps and broken stacks.

  // ── CHECK 4: Reset button restores original state ──
  const ctx3 = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page3 = await ctx3.newPage();
  await page3.goto(pageURL, { waitUntil: 'load' });

  // Modify the CSS textarea to break float
  await page3.evaluate(() => {
    const ta = document.querySelector('.playable-css');
    ta.value = '.box { inline-size: 200px; writing-mode: horizontal-tb; }\nimg { float: none; }';
    ta.dispatchEvent(new Event('input'));
  });
  await page3.waitForTimeout(200);

  const afterEdit = await page3.$eval('section.preview img', el =>
    getComputedStyle(el).float
  );
  assert.equal(afterEdit, 'none', 'After textarea edit: float should be none');

  // Click Reset
  await page3.click('#reset');
  await page3.waitForTimeout(200);

  const afterReset = await page3.$eval('section.preview img', el =>
    getComputedStyle(el).float
  );
  assert.ok(
    afterReset === 'inline-start' || afterReset === 'left',
    `After reset: float should be restored to inline-start|left, got "${afterReset}"`
  );

  await ctx3.close();

  // ── CHECK 5: Source file has no mutations ──
  const fs = await import('node:fs');
  const src = fs.readFileSync(path.join(root, 'learn', 'writing-modes', 'float.html'), 'utf8');
  assert.ok(
    src.includes('float: inline-start;'),
    'Source file must still contain "float: inline-start;" — no mutations persisted'
  );
  assert.ok(
    !src.includes('float: none'),
    'Source file must NOT contain "float: none" — deliberate break must not persist'
  );

  console.log('PASS: R56-T049 regression test — baseline wraps, broken stacks, reset restores, source clean.');
} finally {
  await browser.close();
}
