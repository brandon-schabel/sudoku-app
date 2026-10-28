import { computeCandidates, TECHNIQUES } from "./core.js";
import { findConflicts } from "./board.js";
import { techniqueSteps, applyStep } from "./techniques.js";

const location = (index) =>
  `row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}`;
const houseName = (house) =>
  `${house.type === "col" ? "column" : house.type} ${house.index + 1}`;
const list = (values) =>
  values.length < 2
    ? String(values[0] ?? "")
    : values.slice(0, -1).join(", ") + ` and ${values.at(-1)}`;
function explanation(step, chainIndex) {
  const { technique, placement, candidates, houses } = step;
  const digits = list(
    [...new Set(candidates.map((c) => c.digit))].sort((a, b) => a - b),
  );
  const area = houses[0] ? houseName(houses[0]) : "highlighted cells";
  switch (technique) {
    case "incorrect-entry":
      return `This entry does not match the solution. The correct digit is ${placement.digit}.`;
    case "full-house":
      return `${area[0].toUpperCase() + area.slice(1)} has one empty cell. Its missing digit is ${placement.digit}.`;
    case "naked-single":
      return chainIndex
        ? `After these eliminations, ${placement.digit} is this cell's only remaining candidate.`
        : `This cell's row, column and box leave only ${placement.digit} as a candidate.`;
    case "hidden-single":
      return `${placement.digit} can only go in one cell of ${area}.`;
    case "naked-pair":
    case "naked-triple":
      return `These ${step.cells.length} cells can contain only ${digits}. Those digits must occupy these cells, so remove them from other cells in ${area}.`;
    case "hidden-pair":
    case "hidden-triple":
      return `In ${area}, ${digits} can appear only in these ${step.cells.length} cells. Reserve these cells for those digits and remove their other candidates.`;
    case "pointing":
      return `In ${area}, ${digits} is confined to ${houseName(houses[1])}. Remove it from the rest of that ${houses[1].type === "col" ? "column" : "row"}.`;
    case "claiming":
      return `In ${area}, ${digits} is confined to ${houseName(houses[1])}. Remove it from other cells in that box.`;
    case "x-wing":
    case "swordfish": {
      const n = technique === "x-wing" ? 2 : 3;
      return `In ${list(houses.slice(0, n).map(houseName))}, ${digits} can occur only in ${list(houses.slice(n).map(houseName))}. These ${n} placements use all ${n} crossing houses, so remove ${digits} from their other cells.`;
    }
    case "xy-wing":
    case "xyz-wing": {
      const shared = step.eliminations[0].digit;
      const cellDigits = (index) =>
        candidates.filter((c) => c.index === index).map((c) => c.digit);
      const pivot = step.cells.find((i) =>
        technique === "xy-wing"
          ? !cellDigits(i).includes(shared)
          : cellDigits(i).length === 3,
      );
      const wings = step.cells.filter((i) => i !== pivot);
      const intro = `The pivot at ${location(pivot)} has candidates ${list(cellDigits(pivot))}. The wings at ${list(wings.map(location))} share ${shared}.`;
      return technique === "xy-wing"
        ? `${intro} Either choice in the pivot forces ${shared} into one wing. Remove ${shared} from cells that see both wings.`
        : `${intro} ${shared} must occur in the pivot or a wing. Remove ${shared} only from cells that see all three.`;
    }
    case "skyscraper":
      return `Each highlighted line has two positions for ${digits}. The aligned ends cannot both hold ${digits}, so at least one outer end must. Remove ${digits} from cells that see both outer ends.`;
    default:
      throw new Error(`Unknown hint technique: ${technique}`);
  }
}
function easiestSteps(board, candidates) {
  for (const technique of Object.keys(TECHNIQUES)) {
    const steps = [...techniqueSteps(board, candidates, technique)];
    if (steps.length) return steps;
  }
  return [];
}
function choose(steps, focusIndex) {
  return (
    steps.find((s) => s.placement?.index === focusIndex) ??
    steps.find((s) => s.eliminations.some((e) => e.index === focusIndex)) ??
    steps[0]
  );
}
// Drop unrelated deductions only when every remaining pattern can be independently
// re-established from board candidates. This keeps teaching chains short and sound.
function simplifyChain(board, chain) {
  for (let omit = chain.length - 2; omit >= 0; omit--) {
    const trial = chain.filter((_, i) => i !== omit),
      values = board.slice(),
      c = computeCandidates(board);
    let valid = true;
    const validated = [];
    for (const step of trial) {
      const match = [...techniqueSteps(values, c, step.technique)].find(
        (candidate) =>
          step.placement
            ? candidate.placement?.index === step.placement.index &&
              candidate.placement.digit === step.placement.digit
            : JSON.stringify(candidate.cells) === JSON.stringify(step.cells) &&
              JSON.stringify(candidate.candidates) ===
                JSON.stringify(step.candidates) &&
              step.eliminations.every((e) =>
                candidate.eliminations.some(
                  (x) => x.index === e.index && x.digit === e.digit,
                ),
              ),
      );
      if (!match) {
        valid = false;
        break;
      }
      validated.push(match);
      applyStep(values, c, match);
    }
    if (valid) chain = validated;
  }
  return chain;
}
function allSingles(board, candidates) {
  return ["full-house", "naked-single", "hidden-single"].flatMap((t) => [
    ...techniqueSteps(board, candidates, t),
  ]);
}
function makeHint(chain) {
  const hardest = chain.reduce((a, b) =>
    TECHNIQUES[a.technique].rank >= TECHNIQUES[b.technique].rank ? a : b,
  );
  const placement = chain.at(-1).placement,
    cells = [...new Set(chain.flatMap((s) => s.cells))].sort((a, b) => a - b);
  const houses = [
    ...new Map(
      chain.flatMap((s) => s.houses).map((h) => [`${h.type}:${h.index}`, h]),
    ).values(),
  ];
  const candidates = [
    ...new Map(
      chain
        .flatMap((s) => s.candidates)
        .map((c) => [`${c.index}:${c.digit}`, c]),
    ).values(),
  ];
  const eliminations = chain.flatMap((s) => s.eliminations);
  const highlight = hardest.houses.length
    ? `Look at ${list(hardest.houses.map(houseName))}.`
    : `Look at ${list(hardest.cells.map(location))}.`;
  return {
    technique: hardest.technique,
    techniqueName: TECHNIQUES[hardest.technique].name,
    placement,
    cells,
    houses,
    candidates,
    eliminations,
    chain,
    steps: [
      { kind: "highlight", text: highlight, cells, houses },
      {
        kind: "explain",
        text: chain.map(explanation).join(" "),
        candidates,
        eliminations,
      },
      {
        kind: "fill",
        text: `Place ${placement.digit} in ${location(placement.index)}.`,
        placement,
      },
    ],
  };
}
/** Return three teaching stages ending in a justified placement. Notes are deliberately
 * ignored. Wrong entries take priority; otherwise exhaust simpler techniques first,
 * preferring a direct placement chain and the focused cell among equal-rank choices.
 */
function baseHint(board, solution, focusIndex) {
  if (
    !Array.isArray(board) ||
    board.length !== 81 ||
    !Array.isArray(solution) ||
    solution.length !== 81
  )
    return null;
  const incorrect = board.flatMap((v, i) =>
    v && v !== solution[i] ? [i] : [],
  );
  if (incorrect.length) {
    const index = incorrect.includes(focusIndex) ? focusIndex : incorrect[0];
    return makeHint([
      {
        technique: "incorrect-entry",
        placement: { index, digit: solution[index] },
        eliminations: [],
        cells: [index],
        houses: [],
        candidates: [],
      },
    ]);
  }
  if (findConflicts(board).size) return null;
  const values = board.slice(),
    candidates = computeCandidates(board),
    chain = [];
  while (values.includes(0)) {
    if (values.some((v, i) => !v && !candidates[i])) return null;
    const options = easiestSteps(values, candidates);
    if (!options.length) return null;
    if (options[0].placement)
      return makeHint(
        simplifyChain(board, [
          ...chain,
          choose(
            chain.length ? allSingles(values, candidates) : options,
            focusIndex,
          ),
        ]),
      );
    // Prefer a single elimination pattern that immediately yields a placement.
    const direct = [];
    for (const step of options) {
      const nextValues = values.slice(),
        nextCandidates = candidates.slice();
      applyStep(nextValues, nextCandidates, step);
      const placements = allSingles(nextValues, nextCandidates);
      if (placements.length)
        direct.push([step, choose(placements, focusIndex)]);
    }
    if (direct.length) {
      const selected =
        direct.find(([, s]) => s.placement.index === focusIndex) ?? direct[0];
      return makeHint(simplifyChain(board, [...chain, ...selected]));
    }
    const step = choose(options, focusIndex);
    chain.push(step);
    applyStep(values, candidates, step);
  }
  return null;
}

/** Return a teaching hint using board candidates, with incorrect entries first and
 * focus preference among chains no harder than the simplest available hint.
 * Returns null for completed boards or positions with no supported deduction
 * (including an empty board), and when a deduction disagrees with solution.
 * @param {number[]} board
 * @param {number[]} notes Ignored: handwritten notes cannot justify a deduction.
 * @param {number[]} solution
 * @param {{focusIndex?:number}} [options]
 * @returns {import('./index.js').Hint|null}
 */
export function getHint(board, notes, solution, { focusIndex } = {}) {
  const hint = focusedHint(board, solution, focusIndex);
  return hint && hint.placement.digit === solution[hint.placement.index]
    ? hint
    : null;
}

function focusedHint(board, solution, focusIndex) {
  const hint = baseHint(board, solution, focusIndex);
  if (
    !hint ||
    hint.technique === "incorrect-entry" ||
    !Number.isInteger(focusIndex) ||
    board[focusIndex] !== 0 ||
    hint.placement.index === focusIndex
  )
    return hint;
  const rank = TECHNIQUES[hint.technique].rank,
    candidates = computeCandidates(board),
    chain = [];
  // Saturate only eliminations at or below the established rank. Other singles
  // are not filled: a hint must contain just one placement, at the end.
  while (true) {
    const focused = allSingles(board, candidates).find(
      (s) =>
        s.placement.index === focusIndex &&
        TECHNIQUES[s.technique].rank <= rank,
    );
    if (focused) return makeHint(simplifyChain(board, [...chain, focused]));
    let next = null;
    for (const technique of Object.keys(TECHNIQUES)) {
      if (TECHNIQUES[technique].rank > rank) break;
      const step = techniqueSteps(board, candidates, technique).next().value;
      if (step && !step.placement) {
        next = step;
        break;
      }
    }
    if (!next) return hint;
    chain.push(next);
    applyStep(board.slice(), candidates, next);
  }
}
