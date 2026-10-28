import test from "node:test";
import assert from "node:assert/strict";
import { Worker as Thread } from "node:worker_threads";
import { generatePuzzle, generatePuzzleAsync } from "../src/engine/index.js";

test("real worker module handles messages concurrently and returns errors; every worker terminates", async () => {
  let terminations = 0;
  const previous = globalThis.Worker;
  class ModuleWorker {
    constructor(url, options) {
      assert.equal(options.type, "module");
      assert.ok(url.href.endsWith("/src/engine/worker.js"));
      this.thread = new Thread(
        new URL(
          `data:text/javascript,${encodeURIComponent(`
        import {parentPort} from 'node:worker_threads';
        globalThis.self={postMessage: data=>parentPort.postMessage(data)};
        await import(${JSON.stringify(url.href)});
        parentPort.on('message',data=>self.onmessage({data}));
      `)}`,
        ),
      );
      this.thread.on("message", (data) => this.onmessage?.({ data }));
      this.thread.on("error", (error) => this.onerror?.(error));
    }
    postMessage(data) {
      this.thread.postMessage(data);
    }
    terminate() {
      terminations++;
      return this.thread.terminate();
    }
  }
  try {
    globalThis.Worker = ModuleWorker;
    const difficulties = ["easy", "medium", "hard", "expert"];
    const results = await Promise.all(
      difficulties.map((d) => generatePuzzleAsync(d, { seed: "worker" })),
    );
    for (let i = 0; i < 4; i++)
      assert.deepEqual(
        results[i],
        generatePuzzle(difficulties[i], { seed: "worker" }),
      );
    await assert.rejects(generatePuzzleAsync("invalid"), /Unknown difficulty/);
    assert.equal(terminations, 5);
  } finally {
    if (previous === undefined) delete globalThis.Worker;
    else globalThis.Worker = previous;
  }
});
test("worker construction, load and serialization failures use the synchronous fallback", async () => {
  const previous = globalThis.Worker,
    expected = generatePuzzle("medium", { seed: "fallback" });
  try {
    globalThis.Worker = class {
      constructor() {
        throw Error("worker blocked");
      }
    };
    assert.deepEqual(
      await generatePuzzleAsync("medium", { seed: "fallback" }),
      expected,
    );
    for (const failure of ["onerror", "onmessageerror", "postMessage"]) {
      let terminated = false;
      globalThis.Worker = class {
        postMessage() {
          if (failure === "postMessage") throw Error("clone failed");
          queueMicrotask(() => this[failure](new Error("load failed")));
        }
        terminate() {
          terminated = true;
        }
      };
      assert.deepEqual(
        await generatePuzzleAsync("medium", { seed: "fallback" }),
        expected,
      );
      assert.ok(terminated);
    }
  } finally {
    if (previous === undefined) delete globalThis.Worker;
    else globalThis.Worker = previous;
  }
});
