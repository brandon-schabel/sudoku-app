/**
 * Discovers the files that make up the offline app shell: index.html, the
 * local files it references, and the transitive ES-module import closure.
 * Pure Node, no dependencies. Shared by update-precache, build-www and tests.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, posix } from 'node:path';

const MODULE_REFS = [
  /\bimport\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"()]*?\s+from\s+['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
  /serviceWorker\.register\(\s*['"]([^'"]+)['"]/g,
];

const isLocal = (s) => !/^([a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(s);

/** @param {string} root @param {string} file repo-relative @returns {string[]} repo-relative local refs found in a JS file */
function jsRefs(root, file) {
  const src = readFileSync(join(root, file), 'utf8');
  const out = new Set();
  for (const re of MODULE_REFS) {
    for (const m of src.matchAll(re)) {
      const spec = m[1];
      if (!isLocal(spec) || !(spec.startsWith('.') || spec.startsWith('/'))) continue;
      const p = posix.normalize(posix.join(posix.dirname(file), spec.split(/[?#]/)[0]));
      if (existsSync(join(root, p))) out.add(p);
    }
  }
  return [...out];
}

/** @param {string} root @returns {string[]} repo-relative refs from index.html (src/href attributes) */
function htmlRefs(root) {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const out = new Set(['index.html']);
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!isLocal(spec)) continue;
    const p = posix.normalize(spec.split(/[?#]/)[0]);
    if (p && !p.startsWith('..') && existsSync(join(root, p)) && statSync(join(root, p)).isFile()) out.add(p);
  }
  return [...out];
}

/**
 * Every file the app needs to boot offline (sorted, repo-relative, posix separators).
 * @param {string} root repo root
 * @returns {string[]}
 */
export function shellFiles(root) {
  const seen = new Set();
  const queue = [...htmlRefs(root), ...EXTRA_SHELL.filter((f) => existsSync(join(root, f)))];
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    if (f.endsWith('.js') || f.endsWith('.mjs')) queue.push(...jsRefs(root, f));
    if (f.endsWith('.webmanifest')) {
      const mf = JSON.parse(readFileSync(join(root, f), 'utf8'));
      for (const i of mf.icons || []) {
        const p = posix.normalize(posix.join(posix.dirname(f), i.src));
        if (existsSync(join(root, p))) queue.push(p);
      }
    }
  }
  return [...seen].sort();
}

/** Files that are not imported by anything but must be cached for the PWA to be complete. */
const EXTRA_SHELL = ['manifest.webmanifest', 'privacy.html'];

/** Recursively list files under a directory (posix, repo-relative). */
export function walk(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const rel = posix.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(root, rel));
    else out.push(rel);
  }
  return out;
}

/**
 * Parse the PRECACHE array out of a sw.js source string.
 * @param {string} swSource @returns {string[]}
 */
export function parsePrecache(swSource) {
  const m = swSource.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('sw.js: PRECACHE array not found');
  return JSON.parse(m[1]);
}

export { dirname, join, relative, resolve };
