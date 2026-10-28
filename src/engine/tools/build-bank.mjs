/** Offline, reproducible puzzle bank builder. Run: node src/engine/tools/build-bank.mjs */
import { writeFileSync } from "node:fs";
import { createRng } from "../core.js";
import { generateSolvedBoard, countSolutions } from "../board.js";
import { grade } from "../techniques.js";
const bank = { easy: [], medium: [], hard: [], expert: [] };
const targets = { easy: 8, medium: 8, hard: 64, expert: 64 };
for (
  let seed = 0;
  Object.keys(bank).some((d) => bank[d].length < targets[d]);
  seed++
) {
  const rng = createRng(`bank-v1:${seed}`),
    solution = generateSolvedBoard(rng),
    puzzle = solution.slice();
  const order = Array.from({ length: 81 }, (_, i) => i);
  for (let i = 80; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
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
    const result = grade(puzzle),
      difficulty = result.difficulty;
    if (
      difficulty &&
      bank[difficulty].length < targets[difficulty] &&
      !bank[difficulty].some((p) => p.seed === seed)
    )
      bank[difficulty].push({
        seed,
        puzzle: puzzle.join(""),
        hardest: result.hardest,
      });
  }
  if (seed % 100 === 0)
    process.stderr.write(
      `${seed}: ${JSON.stringify(Object.fromEntries(Object.entries(bank).map(([d, p]) => [d, p.length])))}\n`,
    );
  if (seed > 50000) throw Error("Bank target not reached");
}
writeFileSync(
  new URL("../bank.js", import.meta.url),
  `/** Offline bank; regenerate with tools/build-bank.mjs. Each source has one solution and its stated tier. */\n// prettier-ignore\nexport const PUZZLE_BANK = ${JSON.stringify(bank, null, 2)};\n`,
);
