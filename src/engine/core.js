import { getPeers } from "./board.js";
/** Ordered difficulty identifiers. */
export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard", "expert"]);
/** Labels and dot counts for the UI. */
export const DIFFICULTY_META = Object.freeze(
  Object.fromEntries(
    DIFFICULTIES.map((id, i) => [
      id,
      Object.freeze({ label: id[0].toUpperCase() + id.slice(1), dots: i + 1 }),
    ]),
  ),
);
const tiers = [
  ["full-house", "naked-single"],
  ["hidden-single"],
  [
    "naked-pair",
    "hidden-pair",
    "pointing",
    "claiming",
    "naked-triple",
    "hidden-triple",
  ],
  ["x-wing", "swordfish", "xy-wing", "xyz-wing", "skyscraper"],
];
/** Human techniques in simplest-first order. */
export const TECHNIQUES = Object.freeze(
  Object.fromEntries([
    ...tiers.flat().map((id, rank) => [
      id,
      Object.freeze({
        id,
        name:
          { "x-wing": "X-Wing", "xy-wing": "XY-Wing", "xyz-wing": "XYZ-Wing" }[
            id
          ] ??
          id
            .split("-")
            .map((s) => s[0].toUpperCase() + s.slice(1))
            .join(" "),
        difficulty: DIFFICULTIES[tiers.findIndex((t) => t.includes(id))],
        rank,
      }),
    ]),
    [
      "incorrect-entry",
      Object.freeze({
        id: "incorrect-entry",
        name: "Incorrect entry",
        difficulty: "easy",
        rank: -1,
      }),
    ],
  ]),
);
/** xmur3 string hashing followed by mulberry32; independent of global randomness. */
export function createRng(seed) {
  let a;
  if (typeof seed === "number") a = seed >>> 0;
  else {
    const s = String(seed);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    a = (h ^ (h >>> 16)) >>> 0;
  }
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const peers = Array.from({ length: 81 }, (_, i) =>
  Object.freeze(getPeers(i).sort((a, b) => a - b)),
);
/** Readonly row, column and box neighbours. */
export function peersOf(index) {
  return peers[index] ?? Object.freeze([]);
}
/** Return the nine cells of a zero-based house. */
export function houseCells({ type, index }) {
  if (!Number.isInteger(index) || index < 0 || index > 8) return [];
  return Array.from({ length: 9 }, (_, k) =>
    type === "row"
      ? index * 9 + k
      : type === "col"
        ? k * 9 + index
        : type === "box"
          ? Math.floor(index / 3) * 27 +
            (index % 3) * 3 +
            Math.floor(k / 3) * 9 +
            (k % 3)
          : NaN,
  ).filter(Number.isFinite);
}
/** Compute legal candidate bitmasks (bits zero through eight). */
export function computeCandidates(board) {
  return board.map((v, i) =>
    v
      ? 0
      : peersOf(i).reduce(
          (m, j) => (board[j] ? m & ~(1 << (board[j] - 1)) : m),
          511,
        ),
  );
}
/** Replace notes, or intersect existing notes and populate missing/empty/stale notes. Pure. */
export function autoNotes(board, notes, { mode = "replace" } = {}) {
  return computeCandidates(board).map((m, i) =>
    mode === "merge" ? m & notes?.[i] || m : m,
  );
}
/** Describe peer note removals after a placement, without changing either input. */
export function notesCleanup(board, notes, index, digit) {
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return [];
  return peersOf(index)
    .filter((i) => !board[i] && notes[i] & (1 << (digit - 1)))
    .map((i) => ({
      index: i,
      before: notes[i],
      after: notes[i] & ~(1 << (digit - 1)),
    }));
}
