#!/usr/bin/env node
/**
 * Rewrites the PRECACHE list (and optionally VERSION) in a sw.js so it covers
 * exactly the app shell discovered from index.html + the ES-module import graph.
 * Usage: node scripts/update-precache.mjs [--root <dir>] [--sw <file>] [--version <v>]
 * With no --version the VERSION line is left untouched; build-www passes a content hash.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellFiles } from './lib/shell-files.mjs';

/**
 * @param {string} root directory holding index.html etc.
 * @returns {string[]} precache list entries ('./' first)
 */
export function computePrecache(root) {
  const files = new Set(shellFiles(root));
  files.add('assets/icons/favicon.svg');
  files.add('assets/icons/apple-touch-icon.png');
  return ['./', ...[...files].sort()];
}

/**
 * @param {string} source sw.js source
 * @param {string[]} list @param {string} [version]
 * @returns {string} updated source
 */
export function rewriteSw(source, list, version) {
  let out = source.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(list, null, 2)};`);
  if (version) out = out.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
  const root = opt('--root', join(dirname(fileURLToPath(import.meta.url)), '..'));
  const sw = opt('--sw', join(root, 'sw.js'));
  const list = computePrecache(root);
  writeFileSync(sw, rewriteSw(readFileSync(sw, 'utf8'), list, opt('--version', '')));
  process.stdout.write(`precache: ${list.length} entries -> ${sw}\n`);
}
