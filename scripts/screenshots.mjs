#!/usr/bin/env node
/**
 * Store screenshot generator. Drives any served build of the app with Playwright.
 *
 * Usage:
 *   node scripts/screenshots.mjs [--url http://localhost:8080/] [--only iphone-6.7,ipad] [--out store/screenshots] [--theme graphite] [--dark]
 * Without --url it serves the repo root itself on a random local port.
 *
 * Playwright is imported dynamically (devDependency @playwright/test is owned by the
 * e2e stream; `npm i -D @playwright/test && npx playwright install chromium` if missing).
 * Scenes use ROADMAP 2.5 hooks: ?seed=&difficulty= (deterministic puzzle) and ?test=1
 * (window.__sudoku). Hooks that don't exist yet degrade gracefully (plain shot of the page).
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Store screenshot sizes in physical pixels = viewport (CSS px) x deviceScaleFactor. */
export const DEVICES = [
  { id: 'iphone-6.7', platform: 'ios', w: 1290, h: 2796, dpr: 3 },
  { id: 'iphone-6.5', platform: 'ios', w: 1284, h: 2778, dpr: 3 },
  { id: 'iphone-5.5', platform: 'ios', w: 1242, h: 2208, dpr: 3 },
  { id: 'ipad-12.9', platform: 'ios', w: 2048, h: 2732, dpr: 2 },
  { id: 'android-phone', platform: 'android', w: 1080, h: 1920, dpr: 3 },
  { id: 'android-tablet-7', platform: 'android', w: 1200, h: 1920, dpr: 2 },
  { id: 'android-tablet-10', platform: 'android', w: 1600, h: 2560, dpr: 2 },
];

/** Scenes: name, query string, optional async action(page). */
export const SCENES = [
  { name: '01-easy', query: 'seed=store-1&difficulty=easy' },
  { name: '02-medium', query: 'seed=store-2&difficulty=medium', action: pickCell(40) },
  { name: '03-hard-notes', query: 'seed=store-3&difficulty=hard', action: notesScene },
  { name: '04-hint', query: 'seed=store-4&difficulty=medium', action: clickTestId('tool-hint') },
  { name: '05-menu', query: 'seed=store-5&difficulty=easy', action: clickTestId('pause') },
  { name: '06-dark', query: 'seed=store-6&difficulty=expert', dark: true },
];

function pickCell(i) {
  return async (page) => { await page.locator(`[data-testid="cell"][data-index="${i}"]`).first().click({ timeout: 2000 }).catch(() => {}); };
}
function clickTestId(id) {
  return async (page) => { await page.getByTestId(id).first().click({ timeout: 2000 }).catch(() => {}); };
}
async function notesScene(page) {
  await clickTestId('tool-notes')(page);
  await pickCell(10)(page);
  for (const d of [1, 3, 7]) await page.getByTestId(`numpad-${d}`).first().click({ timeout: 1500 }).catch(() => {});
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

/** Minimal static server for the repo root. @returns {Promise<{url:string, close:()=>void}>} */
function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      const file = join(dir, path.endsWith('/') ? path + 'index.html' : path);
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    }).listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }));
  });
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
}

async function main() {
  let playwright;
  try {
    playwright = await import('@playwright/test');
  } catch {
    try { playwright = await import('playwright'); } catch {
      process.stderr.write('Playwright not found. Run: npm i -D @playwright/test && npx playwright install chromium\n');
      process.exit(2);
    }
  }
  const chromium = playwright.chromium || playwright.default?.chromium;
  const only = arg('--only', '') ? arg('--only').split(',') : null;
  const outRoot = resolve(root, arg('--out', 'store/screenshots'));
  const server = arg('--url') ? null : await serve(root);
  const base = arg('--url', server?.url);
  const browser = await chromium.launch();
  let count = 0;
  try {
    for (const d of DEVICES.filter((x) => !only || only.includes(x.id))) {
      for (const scene of SCENES) {
        const dark = scene.dark || process.argv.includes('--dark');
        const ctx = await browser.newContext({
          viewport: { width: Math.round(d.w / d.dpr), height: Math.round(d.h / d.dpr) },
          deviceScaleFactor: d.dpr,
          isMobile: true,
          hasTouch: true,
          colorScheme: dark ? 'dark' : 'light',
          serviceWorkers: 'block',
        });
        const page = await ctx.newPage();
        const u = new URL(base);
        for (const [k, v] of new URLSearchParams(scene.query + '&test=1')) u.searchParams.set(k, v);
        await page.goto(u.href, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        if (scene.action) await scene.action(page);
        await page.waitForTimeout(300);
        const dir = join(outRoot, d.platform, d.id);
        await mkdir(dir, { recursive: true });
        await page.screenshot({ path: join(dir, `${scene.name}.png`) });
        count++;
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server?.close();
  }
  process.stdout.write(`wrote ${count} screenshots to ${outRoot}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { process.stderr.write(String(e.stack || e) + '\n'); process.exit(1); });
