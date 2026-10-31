#!/usr/bin/env node
/**
 * Writes docs/images/social-preview.png, the 1280x640 card GitHub shows for the repository.
 *
 * It is composed from the committed brand wordmark and the dashboard picture in
 * docs/images/readme/, so run `pnpm readme:screenshots` first when the console changed.
 * Deliberately outside every verification gate, like the README screenshots.
 *
 * Usage:
 *   node scripts/social-preview.mjs
 * Env overrides:
 *   SHELLPAMC_BROWSER (explicit Chromium/Chrome/Edge executable)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs', 'images', 'social-preview.png');
const WIDTH = 1280;
const HEIGHT = 640;

function dataUrl(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`;
}

/** The dashboard window inside hero-split.en.webp, in that picture's own pixels. */
const WINDOW = { x: 88, y: 71 };
const IMAGE = { width: 2576, scale: 0.458 };
const PANEL = { left: 596, top: 94 };

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #0b0d12; }
  body {
    position: relative; color: #f3f4f6;
    font-family: Consolas, 'Cascadia Mono', 'Courier New', monospace;
    background-image:
      linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px),
      radial-gradient(900px 500px at 78% 40%, rgba(236,72,153,.16), transparent 70%);
    background-size: 40px 40px, 40px 40px, auto;
  }
  .brand { position: absolute; left: 72px; top: 150px; width: 470px; }
  h1 { position: absolute; left: 72px; top: 262px; font-size: 38px; line-height: 1.22; font-weight: 700; letter-spacing: .5px; }
  p { position: absolute; left: 72px; top: 368px; font-size: 21px; color: #9ca3af; }
  .chips { position: absolute; left: 72px; top: 441px; display: flex; gap: 10px; }
  .chip { padding: 9px 14px; border: 1px solid rgba(255,255,255,.16); border-radius: 6px;
          background: rgba(255,255,255,.04); font-size: 17px; font-weight: 700; }
  .chip::before { content: '\\25B8'; color: #ec4899; margin-right: 8px; }
  .panel { position: absolute; left: ${PANEL.left}px; top: ${PANEL.top}px; width: ${WIDTH - PANEL.left}px;
           height: ${HEIGHT - PANEL.top}px; overflow: hidden; border-top-left-radius: 14px;
           box-shadow: 0 0 60px rgba(236,72,153,.22); }
  .panel img { position: absolute; width: ${Math.round(IMAGE.width * IMAGE.scale)}px;
               left: ${-Math.round(WINDOW.x * IMAGE.scale)}px; top: ${-Math.round(WINDOW.y * IMAGE.scale)}px; }
</style></head><body>
  <img class="brand" src="${dataUrl('web/src/assets/brand/omc-wordmark-dark.svg', 'image/svg+xml')}" alt="Shell-PAMC">
  <h1>Manage APIs and OAuth<br>in one place.</h1>
  <p>Visualize requests, cost and usage.</p>
  <div class="chips"><span class="chip">MCP</span><span class="chip">Visualization</span><span class="chip">Management</span></div>
  <div class="panel"><img src="${dataUrl('docs/images/readme/hero-split.en.webp', 'image/webp')}" alt=""></div>
</body></html>`;

const executablePath = (process.env.SHELLPAMC_BROWSER || '').trim();
const browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })).newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: output, type: 'png' });
  console.log(`${path.relative(root, output)}  ${(fs.statSync(output).size / 1024).toFixed(0)} KiB`);
} finally {
  await browser.close();
}
