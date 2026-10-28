/** Browser worker smoke test without npm dependencies.
 * Run: node src/engine/tools/check-worker.mjs [path-to-chrome]
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { generatePuzzle, dailyPuzzle } from "../index.js";
const root = new URL("../../../", import.meta.url);
const profile = await mkdtemp(join(tmpdir(), "sudoku-worker-"));
let resolveReport, rejectReport;
const report = new Promise((resolve, reject) => {
  resolveReport = resolve;
  rejectReport = reject;
});
const html = `<!doctype html><html><body>Engine worker smoke test<script type="module">
import {generatePuzzleAsync,dailyPuzzle} from './src/engine/index.js';
const NativeWorker=window.Worker;let started=0,messages=0,errors=0;
window.Worker=class extends NativeWorker {constructor(...args){super(...args);started++;this.addEventListener('message',()=>messages++);this.addEventListener('error',()=>errors++);}};
try {
  const results=await Promise.all(['easy','medium','hard','expert'].map(d=>generatePuzzleAsync(d,{seed:'browser-worker'})));
  await fetch('./result',{method:'POST',body:JSON.stringify({results,started,messages,errors,daily:dailyPuzzle('2026-10-27')})});
} catch(error) {await fetch('./result',{method:'POST',body:JSON.stringify({error:error.stack})});}
</script></body></html>`;
const server = createServer(async (req, res) => {
  if (req.url === "/result" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.end("ok");
    try {
      resolveReport(JSON.parse(body));
    } catch (error) {
      rejectReport(error);
    }
    return;
  }
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
    return;
  }
  if (!req.url.startsWith("/src/engine/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    res.setHeader("Content-Type", "text/javascript");
    res.end(await readFile(new URL(`.${req.url}`, root)));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const chrome = spawn(
  process.argv[2] ?? "/usr/bin/google-chrome",
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--user-data-dir=${profile}`,
    `http://127.0.0.1:${server.address().port}/`,
  ],
  { stdio: "ignore" },
);
chrome.on("error", rejectReport);
const timeout = setTimeout(
  () => rejectReport(new Error("Browser worker test timed out")),
  20000,
);
try {
  const data = await report;
  assert.equal(data.error, undefined);
  assert.equal(data.started, 4);
  assert.equal(data.messages, 4);
  assert.equal(data.errors, 0);
  for (const [i, d] of ["easy", "medium", "hard", "expert"].entries())
    assert.deepEqual(
      data.results[i],
      generatePuzzle(d, { seed: "browser-worker" }),
    );
  assert.deepEqual(data.daily, dailyPuzzle("2026-10-27"));
  process.stdout.write(
    "PASS: four browser module workers; exact browser/Node results and daily snapshot; zero worker errors.\n",
  );
} finally {
  clearTimeout(timeout);
  chrome.kill();
  server.closeAllConnections();
  server.close();
  await new Promise((resolve) => {
    if (chrome.exitCode !== null) resolve();
    else chrome.once("exit", resolve);
  });
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}
