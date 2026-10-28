import { computeCandidates, houseCells, peersOf, TECHNIQUES } from "./core.js";
import { findConflicts } from "./board.js";

const houses = ["row", "col", "box"].flatMap((type) =>
  Array.from({ length: 9 }, (_, index) => ({ type, index })),
);
const units = houses.map(houseCells);
const bits = Array.from({ length: 9 }, (_, i) => 1 << i);
const digits = (mask) => bits.flatMap((bit, i) => (mask & bit ? [i + 1] : []));
const size = (mask) => {
  let n = 0;
  for (; mask; mask &= mask - 1) n++;
  return n;
};
const sees = (a, b) => peersOf(a).includes(b);
const row = (i) => Math.floor(i / 9);
const col = (i) => i % 9;
const box = (i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);

function* combinations(values, n, start = 0, chosen = []) {
  if (!n) {
    yield chosen;
    return;
  }
  for (let i = start; i <= values.length - n; i++)
    yield* combinations(values, n - 1, i + 1, [...chosen, values[i]]);
}
function pattern(
  technique,
  cells,
  usedHouses,
  masks,
  eliminations = [],
  placement = null,
) {
  cells = [...new Set(cells)].sort((a, b) => a - b);
  const candidates = cells.flatMap((index) =>
    digits(masks[index]).map((digit) => ({ index, digit })),
  );
  const unique = new Map(eliminations.map((e) => [`${e.index}:${e.digit}`, e]));
  return {
    technique,
    placement,
    eliminations: [...unique.values()].sort(
      (a, b) => a.index - b.index || a.digit - b.digit,
    ),
    cells,
    houses: usedHouses,
    candidates,
  };
}
function single(technique, index, digit, usedHouses) {
  return {
    technique,
    placement: { index, digit },
    eliminations: [],
    cells: [index],
    houses: usedHouses,
    candidates: [{ index, digit }],
  };
}
function removals(cells, mask, candidates) {
  return cells.flatMap((index) =>
    digits(candidates[index] & mask).map((digit) => ({ index, digit })),
  );
}
function* singles(board, c, technique) {
  if (technique === "full-house") {
    for (let h = 0; h < 27; h++) {
      const cells = units[h].filter((i) => !board[i]);
      if (cells.length === 1 && size(c[cells[0]]) === 1)
        yield single(technique, cells[0], digits(c[cells[0]])[0], [houses[h]]);
    }
  } else if (technique === "naked-single") {
    for (let i = 0; i < 81; i++)
      if (!board[i] && size(c[i]) === 1)
        yield single(technique, i, digits(c[i])[0], []);
  } else {
    for (let h = 0; h < 27; h++)
      for (let d = 1; d <= 9; d++) {
        const cells = units[h].filter((i) => c[i] & (1 << (d - 1)));
        if (cells.length === 1)
          yield single(technique, cells[0], d, [houses[h]]);
      }
  }
}
function* subsets(c, technique, n, hidden) {
  for (let h = 0; h < 27; h++) {
    const empty = units[h].filter((i) => c[i]);
    if (hidden) {
      const available = bits.filter((b) => empty.some((i) => c[i] & b));
      for (const selected of combinations(available, n)) {
        const mask = selected.reduce((a, b) => a | b, 0),
          cells = empty.filter((i) => c[i] & mask);
        if (cells.length !== n) continue;
        const eliminations = removals(cells, 511 ^ mask, c);
        if (eliminations.length)
          yield pattern(
            technique,
            cells,
            [houses[h]],
            c.map((m) => m & mask),
            eliminations,
          );
      }
    } else {
      for (const cells of combinations(
        empty.filter((i) => size(c[i]) >= 2 && size(c[i]) <= n),
        n,
      )) {
        const mask = cells.reduce((m, i) => m | c[i], 0);
        if (size(mask) !== n) continue;
        const eliminations = removals(
          empty.filter((i) => !cells.includes(i)),
          mask,
          c,
        );
        if (eliminations.length)
          yield pattern(technique, cells, [houses[h]], c, eliminations);
      }
    }
  }
}
function* locked(c, technique) {
  const pointing = technique === "pointing";
  for (let h = pointing ? 18 : 0; h < (pointing ? 27 : 18); h++)
    for (const bit of bits) {
      const cells = units[h].filter((i) => c[i] & bit);
      if (cells.length < 2) continue;
      for (const type of pointing ? ["row", "col"] : ["box"]) {
        const coord = type === "row" ? row : type === "col" ? col : box,
          index = coord(cells[0]);
        if (!cells.every((i) => coord(i) === index)) continue;
        const target = { type, index },
          eliminations = removals(
            houseCells(target).filter((i) => !units[h].includes(i)),
            bit,
            c,
          );
        if (eliminations.length)
          yield pattern(
            technique,
            cells,
            [houses[h], target],
            c.map((m) => m & bit),
            eliminations,
          );
      }
    }
}
function* fish(c, technique, n) {
  for (const type of ["row", "col"])
    for (const bit of bits) {
      const cross = type === "row" ? col : row;
      const lines = Array.from({ length: 9 }, (_, index) => ({
        index,
        cells: houseCells({ type, index }).filter((i) => c[i] & bit),
      })).filter((l) => l.cells.length >= 2 && l.cells.length <= n);
      for (const selected of combinations(lines, n)) {
        const covers = [
          ...new Set(selected.flatMap((l) => l.cells.map(cross))),
        ].sort((a, b) => a - b);
        if (covers.length !== n) continue;
        const cells = selected.flatMap((l) => l.cells),
          coverType = type === "row" ? "col" : "row";
        const targets = covers
          .flatMap((index) => houseCells({ type: coverType, index }))
          .filter(
            (i) =>
              !selected.some(
                (l) => (type === "row" ? row(i) : col(i)) === l.index,
              ),
          );
        const eliminations = removals(targets, bit, c);
        if (eliminations.length)
          yield pattern(
            technique,
            cells,
            [
              ...selected.map((l) => ({ type, index: l.index })),
              ...covers.map((index) => ({ type: coverType, index })),
            ],
            c.map((m) => m & bit),
            eliminations,
          );
      }
    }
}
function* wings(c, technique) {
  const xyz = technique === "xyz-wing",
    bivalue = Array.from({ length: 81 }, (_, i) => i).filter(
      (i) => size(c[i]) === 2,
    );
  for (let pivot = 0; pivot < 81; pivot++) {
    if (size(c[pivot]) !== (xyz ? 3 : 2)) continue;
    const wings = bivalue.filter(
      (i) =>
        sees(pivot, i) &&
        (xyz ? (c[i] & c[pivot]) === c[i] : size(c[i] & c[pivot]) === 1),
    );
    for (const [a, b] of combinations(wings, 2)) {
      const common = c[a] & c[b];
      if (size(common) !== 1 || size(c[a] | c[b] | c[pivot]) !== 3) continue;
      if (xyz ? (c[a] | c[b]) !== c[pivot] : !!(common & c[pivot])) continue;
      const targets = peersOf(a).filter(
        (i) => i !== pivot && i !== b && sees(i, b) && (!xyz || sees(i, pivot)),
      );
      const eliminations = removals(targets, common, c);
      if (eliminations.length)
        yield pattern(technique, [pivot, a, b], [], c, eliminations);
    }
  }
}
function* skyscrapers(c) {
  for (const type of ["row", "col"])
    for (const bit of bits) {
      const cross = type === "row" ? col : row;
      const lines = Array.from({ length: 9 }, (_, index) => ({
        index,
        cells: houseCells({ type, index }).filter((i) => c[i] & bit),
      })).filter((l) => l.cells.length === 2);
      for (const [a, b] of combinations(lines, 2))
        for (const baseA of a.cells)
          for (const baseB of b.cells) {
            if (cross(baseA) !== cross(baseB)) continue;
            const roofA = a.cells.find((i) => i !== baseA),
              roofB = b.cells.find((i) => i !== baseB);
            if (cross(roofA) === cross(roofB)) continue;
            const cells = [...a.cells, ...b.cells];
            const eliminations = removals(
              peersOf(roofA).filter(
                (i) => !cells.includes(i) && sees(i, roofB),
              ),
              bit,
              c,
            );
            if (eliminations.length)
              yield pattern(
                "skyscraper",
                cells,
                [
                  { type, index: a.index },
                  { type, index: b.index },
                ],
                c.map((m) => m & bit),
                eliminations,
              );
          }
    }
}
/** Enumerate deductions for one technique; internal API for hint selection and fixtures. */
export function* techniqueSteps(board, c, technique) {
  if (["full-house", "naked-single", "hidden-single"].includes(technique))
    yield* singles(board, c, technique);
  else if (technique.includes("pair") || technique.includes("triple"))
    yield* subsets(
      c,
      technique,
      technique.includes("pair") ? 2 : 3,
      technique.startsWith("hidden"),
    );
  else if (technique === "pointing" || technique === "claiming")
    yield* locked(c, technique);
  else if (technique === "x-wing" || technique === "swordfish")
    yield* fish(c, technique, technique === "x-wing" ? 2 : 3);
  else if (technique === "xy-wing" || technique === "xyz-wing")
    yield* wings(c, technique);
  else if (technique === "skyscraper") yield* skyscrapers(c);
}
/** Return the first deduction in the documented simplest-first strategy. */
export function findNextStep(board, candidates = computeCandidates(board)) {
  candidates ??= computeCandidates(board);
  for (const technique of Object.keys(TECHNIQUES)) {
    const step = techniqueSteps(board, candidates, technique).next().value;
    if (step) return step;
  }
  return null;
}
/** Apply a logical step to private working board/candidate arrays. */
export function applyStep(board, candidates, step) {
  for (const { index, digit } of step.eliminations)
    candidates[index] &= ~(1 << (digit - 1));
  if (step.placement) {
    const { index, digit } = step.placement;
    board[index] = digit;
    candidates[index] = 0;
    for (const i of peersOf(index)) candidates[i] &= ~(1 << (digit - 1));
  }
}
/** Grade the hardest deduction needed by a deterministic simplest-first solve. */
export function grade(puzzle) {
  const counts = {};
  let hardest = null,
    steps = 0,
    score = 0;
  const invalid = {
    difficulty: null,
    hardest,
    score,
    steps,
    counts,
    solved: false,
  };
  if (
    !Array.isArray(puzzle) ||
    puzzle.length !== 81 ||
    puzzle.some((v) => !Number.isInteger(v) || v < 0 || v > 9) ||
    findConflicts(puzzle).size
  )
    return invalid;
  const board = puzzle.slice(),
    candidates = computeCandidates(board);
  while (board.includes(0)) {
    if (board.some((v, i) => !v && !candidates[i])) break;
    const step = findNextStep(board, candidates);
    if (!step) break;
    applyStep(board, candidates, step);
    steps++;
    counts[step.technique] = (counts[step.technique] ?? 0) + 1;
    score += TECHNIQUES[step.technique].rank + 1;
    if (
      hardest === null ||
      TECHNIQUES[step.technique].rank > TECHNIQUES[hardest].rank
    )
      hardest = step.technique;
  }
  const solved = !board.includes(0) && !findConflicts(board).size;
  return {
    difficulty: solved
      ? hardest
        ? TECHNIQUES[hardest].difficulty
        : "easy"
      : null,
    hardest,
    score,
    steps,
    counts,
    solved,
  };
}
