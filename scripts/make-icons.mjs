#!/usr/bin/env node
/**
 * Renders the SVG sources in assets/ to the PNG set used by the PWA manifest,
 * the stores and @capacitor/assets. Uses @resvg/resvg-js (devDependency).
 * Usage: node scripts/make-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => join(root, ...p);

/** @type {Array<{src:string,out:string,size:number}>} */
export const OUTPUTS = [
  ...[48, 72, 96, 128, 144, 152, 192, 256, 384, 512, 1024].map((s) => ({
    src: 'assets/icons/icon.svg', out: `assets/icons/icon-${s}.png`, size: s,
  })),
  { src: 'assets/icons/icon-full.svg', out: 'assets/icons/apple-touch-icon.png', size: 180 },
  { src: 'assets/icons/icon-full.svg', out: 'assets/icons/store-icon-1024.png', size: 1024 },
  { src: 'assets/icons/icon-maskable.svg', out: 'assets/icons/maskable-192.png', size: 192 },
  { src: 'assets/icons/icon-maskable.svg', out: 'assets/icons/maskable-512.png', size: 512 },
  // inputs for @capacitor/assets
  { src: 'assets/icons/icon-full.svg', out: 'assets/icon-only.png', size: 1024 },
  { src: 'assets/splash/splash.svg', out: 'assets/splash/splash-2732.png', size: 2732 },
  { src: 'assets/splash/splash-dark.svg', out: 'assets/splash/splash-dark-2732.png', size: 2732 },
  { src: 'assets/splash/splash.svg', out: 'assets/splash.png', size: 2732 },
  { src: 'assets/splash/splash-dark.svg', out: 'assets/splash-dark.png', size: 2732 },
];

for (const { src, out, size } of OUTPUTS) {
  const png = new Resvg(readFileSync(at(src)), { fitTo: { mode: 'width', value: size } }).render().asPng();
  mkdirSync(dirname(at(out)), { recursive: true });
  writeFileSync(at(out), png);
}
process.stdout.write(`wrote ${OUTPUTS.length} PNGs\n`);
