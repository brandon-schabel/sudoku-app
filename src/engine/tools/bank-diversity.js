import { houseCells, peersOf } from "../core.js";

/** Clue-pattern invariants under digit renaming, band/stack and within-band/stack
 * permutations, and transposition. Different fingerprints certify non-isomorphism;
 * equal fingerprints are inconclusive and are conservatively rejected by the builder.
 * This is intentionally not a canonical form or a general equivalence checker.
 */
export function diversityFingerprint(board) {
  const sorted = (values) => values.sort((a, b) => a - b).join(",");
  const houses = (type) =>
    sorted(
      Array.from(
        { length: 9 },
        (_, index) =>
          houseCells({ type, index }).filter((i) => board[i]).length,
      ),
    );
  const digits = Array(9).fill(0);
  const filled = [],
    empty = [];
  for (let i = 0; i < 81; i++) {
    if (board[i]) digits[board[i] - 1]++;
    (board[i] ? filled : empty).push(peersOf(i).filter((j) => board[j]).length);
  }
  return [
    filled.length,
    [houses("row"), houses("col")].sort().join("/"),
    houses("box"),
    sorted(digits),
    sorted(filled),
    sorted(empty),
  ].join("|");
}

/** Minimum number of distinct sources whose hardest required step is each technique. */
export const DIVERSITY_FLOORS = Object.freeze({
  hard: Object.freeze(
    Object.fromEntries(
      [
        "naked-pair",
        "hidden-pair",
        "pointing",
        "claiming",
        "naked-triple",
        "hidden-triple",
      ].map((id) => [id, 12]),
    ),
  ),
  expert: Object.freeze(
    Object.fromEntries(
      ["x-wing", "swordfish", "xy-wing", "xyz-wing", "skyscraper"].map((id) => [
        id,
        12,
      ]),
    ),
  ),
});
