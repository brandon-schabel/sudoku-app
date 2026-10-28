#!/usr/bin/env node
/**
 * Copies the static web app into www/ (Capacitor webDir; gitignored).
 * Also stamps www/sw.js with a content-hash VERSION and an up-to-date PRECACHE.
 * Tolerates files that don't exist yet (privacy.html, etc.).
 * Usage: node scripts/build-www.mjs [--out <dir>]
 */
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk } from './lib/shell-files.mjs';
import { computePrecache, rewriteSw } from './update-precache.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Paths copied verbatim (files or directories). Missing ones are skipped. */
export const INCLUDE = ['index.html', 'styles.css', 'manifest.webmanifest', 'privacy.html', 'sw.js', 'src', 'assets/icons'];

/**
 * @param {string} [out] output directory (default <root>/www)
 * @returns {{out:string, files:string[], version:string}}
 */
export function buildWww(out = join(root, 'www')) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const p of INCLUDE) {
    const from = join(root, p);
    if (!existsSync(from)) continue;
    mkdirSync(dirname(join(out, p)), { recursive: true });
    cpSync(from, join(out, p), { recursive: true, filter: (s) => !/\.test\.m?js$|\.DS_Store$/.test(s) });
  }
  if (!existsSync(join(out, 'index.html'))) throw new Error('build-www: index.html missing');
  const files = walk(out, '.').map((f) => f.replace(/^\.\//, '')).filter((f) => f !== 'sw.js').sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update(readFileSync(join(out, f)));
  const version = hash.digest('hex').slice(0, 12);
  if (existsSync(join(out, 'sw.js'))) {
    const sw = readFileSync(join(out, 'sw.js'), 'utf8');
    writeFileSync(join(out, 'sw.js'), rewriteSw(sw, computePrecache(out), version));
  }
  return { out, files, version };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const r = buildWww(i > 0 ? process.argv[i + 1] : undefined);
  process.stdout.write(`www: ${r.files.length} files, version ${r.version} -> ${r.out}\n`);
}
