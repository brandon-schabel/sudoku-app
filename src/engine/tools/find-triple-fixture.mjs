/** Reproduce the naked-triple hint regression fixture search. */
import { createRng } from "../core.js";
import { generateSolvedBoard, countSolutions, solve } from "../board.js";
import { grade } from "../techniques.js";
import { getHint } from "../hints.js";
for (let seed = 0; seed < 20000; seed++) {
  const rng = createRng(`triple:${seed}`),
    puzzle = generateSolvedBoard(rng),
    order = Array.from({ length: 81 }, (_, i) => i);
  for (let i = 80; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const i of order) {
    const value = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle) !== 1) puzzle[i] = value;
  }
  const g = grade(puzzle);
  if (!g.counts["naked-triple"]) continue;
  const board = puzzle.slice(),
    solution = solve(board);
  while (board.includes(0)) {
    const hint = getHint(board, [], solution);
    if (!hint) break;
    if (hint.technique === "naked-triple") {
      process.stdout.write(
        JSON.stringify(
          { seed, original: puzzle.join(""), puzzle: board.join(""), hint },
          null,
          2,
        ) + "\n",
      );
      process.exit(0);
    }
    board[hint.placement.index] = hint.placement.digit;
  }
}
throw new Error("No naked-triple fixture found");
