/**
 * Regenerates public/og.png — the picture link previews show (WhatsApp, Slack,
 * iMessage, LinkedIn…).
 *
 * It screenshots the real app rather than a hand-drawn mockup, so the preview
 * can never drift from what the device actually renders. Run it after changing
 * the models, the lighting or the wording:
 *
 *   npm run dev            # in one terminal
 *   node scripts/make-og-image.mjs
 *
 * Pass a different origin as the first argument if the dev server isn't on the
 * default port.
 *
 * Playwright is deliberately not a project dependency — it is only needed to
 * regenerate this one asset. Install it on demand:
 *
 *   npm i --no-save playwright && npx playwright install chrome
 */
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://localhost:5173';
const out = 'public/og.png';

// 1200×630 is the size link scrapers expect; ×2 keeps the text crisp on the
// retina screens most previews are read on. Keep og:image:width/height in the
// HTML in sync with the result.
const WIDTH = 1200;
const HEIGHT = 630;

const browser = await chromium.launch({
  channel: 'chrome',
  // The GPU isn't available in most shells this runs in, so rasterize WebGL on
  // the CPU instead of failing to get a context.
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
});
await page.goto(origin, { waitUntil: 'networkidle' });

// networkidle fires before the GLB is parsed and the placeholder is on screen.
await page.waitForTimeout(3000);

await page.evaluate(() => {
  const set = (id, value) => {
    const element = document.getElementById(id);
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set('rot-x', -10);
  set('rot-y', 26);
  set('rot-z', -5);
});
await page.waitForTimeout(1500);

// Drop the control panel and slide the device into the right third, leaving the
// left half for the headline.
await page.evaluate(() => {
  document.querySelector('.panel').remove();

  const canvas = document.getElementById('scene');
  canvas.style.transform = 'translateX(35%) scale(1.02)';
  // The checkerboard reads as noise at thumbnail size.
  canvas.style.backgroundImage = 'none';
  canvas.style.backgroundColor = '#14161a';

  const style = document.createElement('style');
  style.textContent = `
    .og {
      position: fixed; left: 64px; top: 0; height: 100%; width: 600px;
      display: flex; flex-direction: column; justify-content: center; gap: 20px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .og__brand { display: flex; align-items: center; gap: 14px;
      font-size: 30px; font-weight: 700; letter-spacing: -0.01em; color: #e7e9ee; }
    .og h1 { margin: 0; font-size: 54px; line-height: 1.08;
      letter-spacing: -0.03em; font-weight: 700; color: #fff; }
    .og p { margin: 0; font-size: 22px; line-height: 1.5; color: #949aa6; max-width: 460px; }
  `;
  document.head.append(style);

  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <div class="og">
      <div class="og__brand">
        <img src="/favicon.svg" width="52" height="52" alt="">
        <span>easyDevicePic</span>
      </div>
      <h1>Your screenshot,<br>on a 3D device.</h1>
      <p>Drop an image, rotate to any angle, download a
         transparent PNG. Runs entirely in your browser.</p>
    </div>`;
  document.body.append(overlay);
});
await page.waitForTimeout(500);

await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out} (${WIDTH * 2}×${HEIGHT * 2})`);
