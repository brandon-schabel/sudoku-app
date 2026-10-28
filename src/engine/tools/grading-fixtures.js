/** Fixed external grading evidence, independent of the generated bank.
 * HoDoKu regression library: Bernhard Hobiger, reglib-1.3, line numbers are 1-based.
 * Codes 0003/0002 identify published naked/hidden singles. '+' marks placements
 * already made in the published position; flatten it without replaying grade().
 * Our Easy/Medium boundary is naked vs hidden singles (ROADMAP section 2.1).
 * The other entries use original givens from HoDoKu's named technique examples;
 * the separately published solving positions witness the named required patterns.
 * No labels or expectations here are computed with this engine's grader.
 * See https://hodoku.sourceforge.net/en/libs.php for the source format.
 */
import { PUBLISHED_FIXTURES } from "./published-fixtures.js";
const singles = [
  {
    id: "reglib-186",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 186,
    raw: ":0003:7:.5..4+6.8.3.12.+8.+5.7..3+9+5.16.78.......9.681.4.......19.62...7..4.....98.1.1..2..7.:::725:",
    difficulty: "easy",
    hardest: "naked-single",
    publishedPlacement: {
      digit: 7,
      index: 13,
    },
  },
  {
    id: "reglib-187",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 187,
    raw: ":0003:8:6...+53+4.7....4+2+56.+254867+3+9+1.+4..+9+6.1.162+38+5749.3..+1+4.+5....42193..1.+57...+44+2.6+3.+1+75:::829:",
    difficulty: "easy",
    hardest: "naked-single",
    publishedPlacement: {
      digit: 8,
      index: 17,
    },
  },
  {
    id: "reglib-201",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 201,
    raw: ":0003:3:+9+8.6..3+15.6.+1..+72817....9+6+48.92+1..+5.+4+2+69+85+1+7+3..+1..68.2..8....4121.....3.6.7..1..+9:::342:",
    difficulty: "easy",
    hardest: "naked-single",
    publishedPlacement: {
      digit: 3,
      index: 28,
    },
  },
  {
    id: "reglib-204",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 204,
    raw: ":0003:4:9.+2......+3+5718+9+246....52...53....7.+2+28971356+4..6....38...29....42..618...+9.....+21:::445:",
    difficulty: "easy",
    hardest: "naked-single",
    publishedPlacement: {
      digit: 4,
      index: 31,
    },
  },
  {
    id: "reglib-205",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 205,
    raw: ":0003:5:..578.........6...26.5.....15...83....41326....74...89.....4.52...8.........178..:::566:",
    difficulty: "easy",
    hardest: "naked-single",
    publishedPlacement: {
      digit: 5,
      index: 50,
    },
  },
  {
    id: "reglib-138",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 138,
    raw: ":0002:1:2+8.+64...74+6....+2.+8317+9+285+46.5+3..9.2+4.+42.3.7.+9.9.4...8+35+382+9+6471.+7......21+2..8...5:::163:",
    difficulty: "medium",
    hardest: "hidden-single",
    publishedPlacement: {
      digit: 1,
      index: 47,
    },
  },
  {
    id: "reglib-139",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 139,
    raw: ":0002:2:5.2.+6....+819+23...5+7.6..5..8+6.+74..5..+3+517264+8+9+4.8..3...9..6..2..2...7.81.+1....+29.3:::238:",
    difficulty: "medium",
    hardest: "hidden-single",
    publishedPlacement: {
      digit: 2,
      index: 25,
    },
  },
  {
    id: "reglib-140",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 140,
    raw: ":0002:3:.3...4+2.1+4.21......5+19+2.4..14+82.....+275...39+8..+3..8+142..7..2.6..+2...98+1+73..7...2.:::379:",
    difficulty: "medium",
    hardest: "hidden-single",
    publishedPlacement: {
      digit: 3,
      index: 62,
    },
  },
  {
    id: "reglib-141",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 141,
    raw: ":0002:4:728+9.6..31....5.9.....3.1........8....14839....4........5.6.....4.8....62..1..385:::431:",
    difficulty: "medium",
    hardest: "hidden-single",
    publishedPlacement: {
      digit: 4,
      index: 18,
    },
  },
  {
    id: "reglib-142",
    source: "https://hodoku.sourceforge.net/libraries/reglib-1.3.txt",
    line: 142,
    raw: ":0002:5:.+4.3+1....+3+184..92.65...9.1..+2.9...4.4+3+6125+8+97.9...3....7.5...81.83..12...+6...4...:::525:",
    difficulty: "medium",
    hardest: "hidden-single",
    publishedPlacement: {
      digit: 5,
      index: 13,
    },
  },
];
const examples = [
  ["hard", "n201", "naked-pair"],
  ["hard", "h201", "hidden-pair"],
  ["hard", "lc101", "pointing"],
  ["hard", "lc201", "claiming"],
  ["hard", "h301", "hidden-triple"],
  ["hard", "h302", "hidden-triple"],
  ["expert", "bf201", "x-wing"],
  ["expert", "bf301", "swordfish"],
  ["expert", "xy01", "xy-wing"],
  ["expert", "xyz01", "xyz-wing"],
  ["expert", "sk01", "skyscraper"],
];
/** Published puzzles/positions and literal tier and technique expectations. */
export const GRADING_FIXTURES = [
  {
    id: "exemplars-116",
    source: "https://hodoku.sourceforge.net/libraries/exemplars-1.0.txt",
    line: 116,
    publishedSequence: "s n3(8) s",
    difficulty: "hard",
    hardest: "naked-triple",
    puzzle:
      "000080057060379000020000000000700000000004596032900040006450320000000000000000008",
  },
  ...singles.map((f) => ({
    ...f,
    puzzle: f.raw.split(":")[3].replaceAll("+", "").replaceAll(".", "0"),
  })),
  ...examples.map(([difficulty, id, hardest]) => ({
    id,
    difficulty,
    hardest,
    source: PUBLISHED_FIXTURES[id].source,
    puzzle: PUBLISHED_FIXTURES[id].original,
    publishedPosition: PUBLISHED_FIXTURES[id].puzzle,
  })),
];
