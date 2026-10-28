/** Offline, reproducible builder: node src/engine/tools/build-bank.mjs
 * Keep at least 320 independently generated solved grids per tier, then change
 * givens in rare-technique donors to meet the floors, and fill to 384 per tier.
 * Mutations change clue patterns, rather than relabeling or moving rows/columns.
 * Every accepted source is regraded, uniqueness checked, and certified distinct
 * from all other sources in its tier by an isomorphism-invariant fingerprint.
 */
import { writeFileSync } from "node:fs";
import { createRng } from "../core.js";
import { generateSolvedBoard, countSolutions, solve } from "../board.js";
import { grade } from "../techniques.js";
import { PUBLISHED_FIXTURES } from "./published-fixtures.js";
import { HINT_FIXTURES } from "./hint-fixtures.js";
import { diversityFingerprint, DIVERSITY_FLOORS } from "./bank-diversity.js";

const bank = { easy: [], medium: [], hard: [], expert: [] };
const seen = Object.fromEntries(Object.keys(bank).map((d) => [d, new Set()]));
const target = 384,
  randomMinimum = 320;
const donors = new Map();
function shuffle(values, rng) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
function accept(puzzle, seed, limit, required) {
  const result = grade(puzzle),
    d = result.difficulty;
  if (!d || (required && result.hardest !== required)) return false;
  if (!donors.has(result.hardest)) donors.set(result.hardest, puzzle.slice());
  if (bank[d].length >= limit) return false;
  const key = diversityFingerprint(puzzle);
  if (seen[d].has(key) || countSolutions(puzzle) !== 1) return false;
  seen[d].add(key);
  bank[d].push({ seed, puzzle: puzzle.join(""), hardest: result.hardest });
  return true;
}
function harvest(seed, limit) {
  const rng = createRng(`bank-v2:${seed}`),
    puzzle = generateSolvedBoard(rng);
  const order = shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    rng,
  );
  const collected = new Set();
  let clues = 81;
  for (const index of order) {
    const value = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle) !== 1) {
      puzzle[index] = value;
      continue;
    }
    clues--;
    if (clues > 40) continue;
    const d = grade(puzzle).difficulty;
    // At most one source per independently generated solved grid per tier.
    if (d && !collected.has(d) && accept(puzzle, seed, limit)) collected.add(d);
  }
}
function progress(label) {
  process.stderr.write(
    `${label}: ${JSON.stringify(
      Object.fromEntries(
        Object.entries(bank).map(([d, puzzles]) => [
          d,
          {
            n: puzzles.length,
            hardest: puzzles.reduce((counts, p) => {
              counts[p.hardest] = (counts[p.hardest] ?? 0) + 1;
              return counts;
            }, {}),
          },
        ]),
      ),
    )}\n`,
  );
}
let seed = 0;
while (Object.values(bank).some((puzzles) => puzzles.length < randomMinimum)) {
  if (seed > 20000) throw Error("Independent-grid target not reached");
  harvest(seed++, randomMinimum);
  if (seed % 250 === 0) progress(seed);
}
// Published technique examples provide donors only if random harvesting missed
// a rare technique. Source attribution stays in the fixture files.
for (const f of Object.values(PUBLISHED_FIXTURES))
  accept([...f.original].map(Number), `published:${f.source}`, 0);
for (const f of HINT_FIXTURES)
  accept([...f.puzzle].map(Number), `hint:${f.id}`, 0);
for (const [d, floors] of Object.entries(DIVERSITY_FLOORS))
  for (const [technique, floor] of Object.entries(floors)) {
    const donor = donors.get(technique);
    if (!donor) throw Error(`No donor for ${technique}`);
    const solution = solve(donor),
      rng = createRng(`bank-v2:diversity:${technique}`);
    let attempt = 0;
    while (bank[d].filter((p) => p.hardest === technique).length < floor) {
      if (attempt++ > 20000)
        throw Error(`Diversity target not reached: ${technique}`);
      const puzzle = donor.slice();
      const filled = shuffle(
        puzzle.flatMap((v, i) => (v ? [i] : [])),
        rng,
      );
      const empty = shuffle(
        puzzle.flatMap((v, i) => (v ? [] : [i])),
        rng,
      );
      const remove = 1 + Math.floor(rng() * 4),
        add = Math.floor(rng() * 4);
      for (const i of filled.slice(0, remove)) puzzle[i] = 0;
      for (const i of empty.slice(0, add)) puzzle[i] = solution[i];
      accept(puzzle, `diversity:${technique}:${attempt}`, target, technique);
    }
    progress(technique);
  }
while (Object.values(bank).some((puzzles) => puzzles.length < target)) {
  if (seed > 30000) throw Error("Bank target not reached");
  harvest(seed++, target);
}
// Compact rows retain provenance for inspection without shipping repeated keys.
const rows = Object.fromEntries(
  Object.entries(bank).map(([d, puzzles]) => [
    d,
    puzzles.map((p) => [p.seed, p.puzzle, p.hardest]),
  ]),
);
writeFileSync(
  new URL("../bank.js", import.meta.url),
  `/** Offline bank v2: 384 non-isomorphic sources per tier. Regenerate with tools/build-bank.mjs. */\n` +
    `const rows = ${JSON.stringify(rows)};\n` +
    `/** Unique, pregraded fallback sources; runtime variants are always regraded. */\n` +
    `export const PUZZLE_BANK = Object.fromEntries(Object.entries(rows).map(([d, entries]) =>\n` +
    `  [d, entries.map(([seed, puzzle, hardest]) => ({seed, puzzle, hardest}))]));\n`,
);
progress("complete");
