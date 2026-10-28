import { generatePuzzle } from "./generator.js";
// One request per worker; the caller terminates it after receiving the result.
self.onmessage = ({ data: { difficulty, opts } }) => {
  try {
    self.postMessage({ result: generatePuzzle(difficulty, opts) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
