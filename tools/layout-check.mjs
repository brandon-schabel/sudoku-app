#!/usr/bin/env node
// Developer layout check (not part of `node --test`): loads the app at phone,
// tablet and desktop viewports, fails if the page scrolls, anything in the
// game shell leaves the viewport, the board is not square, or a control is
// smaller than 44px tall. Optionally saves screenshots.
//
// Usage:
//   python3 -m http.server 8771 --bind 127.0.0.1      # from the repo root
//   node tools/layout-check.mjs [--shots <dir>] [--text default|large|xlarge] [--dark]
//
// Env: APP_URL (default http://127.0.0.1:8771/), PLAYWRIGHT_MODULE (path to a
// playwright index.mjs when the package is not installed locally).

import { mkdirSync } from "node:fs";

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8771/";
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const shots = opt("--shots");
const textSize = opt("--text") || "default";
const dark = args.includes("--dark");

const VIEWPORTS = [
  [375, 667, true], [390, 844, true], [393, 852, true], [430, 932, true],
  [844, 390, true], [667, 375, true],
  [768, 1024, true], [1024, 768, true], [1280, 800, false], [1440, 900, false]
];

let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright"));
} catch {
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    console.error("Playwright not found. Install it or set PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs");
    process.exit(2);
  }
}

if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
let failures = 0;

for (const [width, height, mobile] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(([text, isDark]) => {
    localStorage.setItem("sudoku:v2:settings", JSON.stringify({ textSize: text, colorMode: isDark ? "dark" : "light", onboardingDone: true }));
  }, [textSize, dark]);
  await page.goto(`${APP_URL}?seed=layout&difficulty=medium`);
  await page.waitForSelector('#app[data-ready="true"]');
  const m = await page.evaluate(() => {
    const visible = (e) => e.getClientRects().length > 0;
    const outside = [...document.querySelectorAll(".game *")].filter(visible).filter((e) => {
      const b = e.getBoundingClientRect();
      return b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1;
    });
    const small = [...document.querySelectorAll(".game button")].filter(visible).filter((e) => e.getBoundingClientRect().height < 44);
    const board = document.getElementById("board").getBoundingClientRect();
    const se = document.scrollingElement;
    return {
      scroll: se.scrollHeight > innerHeight || se.scrollWidth > innerWidth,
      outside: outside.map((e) => e.dataset.testid || e.className).slice(0, 5),
      small: small.map((e) => e.dataset.testid || e.className).slice(0, 5),
      board: Math.round(board.width),
      square: Math.abs(board.width - board.height) < 1.5
    };
  });
  const problems = [];
  if (m.scroll) problems.push("page scrolls");
  if (m.outside.length) problems.push(`outside viewport: ${m.outside.join(", ")}`);
  if (m.small.length) problems.push(`targets < 44px: ${m.small.join(", ")}`);
  if (!m.square) problems.push("board not square");
  if (errors.length) problems.push(`errors: ${errors.join("; ")}`);
  failures += problems.length ? 1 : 0;
  console.log(`${problems.length ? "FAIL" : "ok  "} ${width}x${height} board ${m.board}px${problems.length ? " — " + problems.join(" | ") : ""}`);
  if (shots) await page.screenshot({ path: `${shots}/${width}x${height}-${textSize}${dark ? "-dark" : ""}.png` });
  await ctx.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
