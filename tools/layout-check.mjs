#!/usr/bin/env node
// Optional developer layout check. Not part of `node --test`.
//
// Usage:
//   (cd .. && python3 -m http.server 8799)
//   node --experimental-websocket tools/layout-check.mjs
//
// Set APP_URL or CHROME_BIN to override the defaults.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_URL = process.env.APP_URL || "http://localhost:8799/sudoku-app/";
const CHROME_BIN = process.env.CHROME_BIN || "google-chrome";
const VIEWPORTS = [
  { width: 375, height: 667, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 393, height: 852, mobile: true },
  { width: 430, height: 932, mobile: true },
  { width: 844, height: 390, mobile: true },
  { width: 667, height: 375, mobile: true },
  { width: 1280, height: 800, mobile: false },
  { width: 1440, height: 900, mobile: false }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (typeof WebSocket === "undefined") {
  console.error(
    "This check needs Node's built-in WebSocket. Run it with:\n" +
      "  node --experimental-websocket tools/layout-check.mjs"
  );
  process.exit(1);
}

const metricsExpression = `(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const se = document.scrollingElement || document.documentElement;
  const toRect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const fullyInside = (r) =>
    r.x >= -0.5 &&
    r.y >= -0.5 &&
    r.x + r.width <= vw + 0.5 &&
    r.y + r.height <= vh + 0.5;
  const boardEl = document.getElementById("board");
  const read = (el) => {
    const r = toRect(el);
    return { ...r, inside: fullyInside(r), label: (el.textContent || "").trim() };
  };
  const board = read(boardEl);
  const pad = Array.from(document.querySelectorAll("#number-pad button")).map(read);
  const tools = Array.from(document.querySelectorAll(".tool-btn")).map(read);
  const topbar = document.querySelector(".topbar");
  return {
    innerWidth: vw,
    innerHeight: vh,
    scrollWidth: se.scrollWidth,
    scrollHeight: se.scrollHeight,
    headerHeight: topbar ? topbar.getBoundingClientRect().height : 0,
    paused: boardEl.classList.contains("is-paused"),
    board,
    pad,
    tools,
    padCount: pad.length,
    toolCount: tools.length
  };
})()`;

async function waitForFile(file, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8").trim();
      if (content) return content;
    }
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${file}`);
}

async function getPageTarget(port) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < 15000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(
    `Could not find a Chrome page target${lastError ? `: ${lastError.message}` : ""}`
  );
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.eventWaiters = new Set();
    this.errors = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result);
        return;
      }
      this._trackError(message);
      for (const waiter of Array.from(this.eventWaiters)) {
        if (waiter.method !== message.method) continue;
        this.eventWaiters.delete(waiter);
        clearTimeout(waiter.timer);
        waiter.resolve(message.params);
      }
    });
  }

  _trackError(message) {
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      this.errors.push(
        details.exception?.description || details.text || "Uncaught exception"
      );
    } else if (
      message.method === "Runtime.consoleAPICalled" &&
      message.params.type === "error"
    ) {
      this.errors.push(
        message.params.args
          .map((arg) => arg.value ?? arg.description ?? "")
          .join(" ")
      );
    } else if (
      message.method === "Log.entryAdded" &&
      message.params.entry.level === "error"
    ) {
      this.errors.push(message.params.entry.text);
    }
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const waiter = {
        method,
        resolve,
        timer: setTimeout(() => {
          this.eventWaiters.delete(waiter);
          reject(new Error(`Timed out waiting for ${method}`));
        }, timeoutMs)
      };
      this.eventWaiters.add(waiter);
    });
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "Evaluation failed"
    );
  }
  return result.result.value;
}

function checkViewport(metrics, viewport) {
  const failures = [];
  const label = `${viewport.width}x${viewport.height}`;

  if (!Number.isFinite(metrics.board.width)) {
    failures.push(`${label}: board was not found`);
    return failures;
  }
  if (metrics.scrollHeight > metrics.innerHeight + 0.5) {
    failures.push(
      `${label}: vertical scroll (${metrics.scrollHeight} > ${metrics.innerHeight})`
    );
  }
  if (metrics.scrollWidth > metrics.innerWidth + 0.5) {
    failures.push(
      `${label}: horizontal scroll (${metrics.scrollWidth} > ${metrics.innerWidth})`
    );
  }
  if (metrics.headerHeight > 48) {
    failures.push(
      `${label}: header is ${metrics.headerHeight.toFixed(1)}px tall (max 48px)`
    );
  }
  if (metrics.paused) {
    failures.push(`${label}: restored game loaded paused instead of running`);
  }
  if (!metrics.board.inside) {
    failures.push(`${label}: board is outside the viewport`);
  }
  if (Math.abs(metrics.board.width - metrics.board.height) > 2) {
    failures.push(
      `${label}: board is not square (${metrics.board.width.toFixed(1)} x ${metrics.board.height.toFixed(1)})`
    );
  }
  if (metrics.padCount !== 9) {
    failures.push(`${label}: expected 9 number keys, found ${metrics.padCount}`);
  }
  for (const key of metrics.pad) {
    if (!key.inside) failures.push(`${label}: number key ${key.label} is outside the viewport`);
    if (key.height < 44) {
      failures.push(`${label}: number key ${key.label} is only ${key.height.toFixed(1)}px tall`);
    }
  }
  if (metrics.toolCount !== 5) {
    failures.push(`${label}: expected 5 tools, found ${metrics.toolCount}`);
  }
  for (const tool of metrics.tools) {
    if (!tool.inside) failures.push(`${label}: tool ${tool.label} is outside the viewport`);
  }

  return failures;
}

async function main() {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "sudoku-layout-"));
  const chrome = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--metrics-recording-only",
      "--mute-audio",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  let cdp = null;
  try {
    const portFile = path.join(profileDir, "DevToolsActivePort");
    const [port] = (await waitForFile(portFile)).split(/\r?\n/);
    if (!port) throw new Error("Chrome did not expose a DevTools port");

    const target = await getPageTarget(port);
    cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    const rows = [];
    const failures = [];

    for (const viewport of VIEWPORTS) {
      cdp.errors.length = 0;
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.mobile,
        screenWidth: viewport.width,
        screenHeight: viewport.height
      });

      const loaded = cdp.waitForEvent("Page.loadEventFired");
      await cdp.send("Page.navigate", {
        url: `${APP_URL}${APP_URL.includes("?") ? "&" : "?"}layout=${viewport.width}x${viewport.height}&t=${Date.now()}`
      });
      await loaded;
      await sleep(400);

      const metrics = await evaluate(cdp, metricsExpression);
      const currentFailures = checkViewport(metrics, viewport);
      failures.push(...currentFailures);
      if (cdp.errors.length > 0) {
        failures.push(
          `${viewport.width}x${viewport.height}: console errors: ${cdp.errors.join(" | ")}`
        );
      }

      rows.push({
        viewport: `${viewport.width}x${viewport.height}`,
        board: `${metrics.board.width.toFixed(1)}px`,
        scroll: `${metrics.scrollWidth}x${metrics.scrollHeight}`,
        status: currentFailures.length === 0 ? "PASS" : "FAIL"
      });
    }

    cdp.errors.length = 0;
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 393,
      height: 852,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: 393,
      screenHeight: 852
    });
    const pauseLoaded = cdp.waitForEvent("Page.loadEventFired");
    await cdp.send("Page.navigate", {
      url: `${APP_URL}${APP_URL.includes("?") ? "&" : "?"}pause=${Date.now()}`
    });
    await pauseLoaded;
    await sleep(400);

    await evaluate(cdp, `document.getElementById("pause").click()`);
    await sleep(200);
    const opened = await evaluate(
      cdp,
      `(() => {
        const menu = document.getElementById("pause-menu");
        const pause = document.getElementById("pause");
        return {
          open: !menu.hidden,
          expanded: pause.getAttribute("aria-expanded"),
          focused: document.activeElement && document.activeElement.id
        };
      })()`
    );
    if (!opened.open) failures.push("Pause menu did not open");
    if (opened.expanded !== "true") {
      failures.push("Pause button aria-expanded was not set to true");
    }
    if (opened.focused !== "resume") {
      failures.push(`Pause menu focus was ${opened.focused}, expected resume`);
    }

    await evaluate(cdp, `document.getElementById("resume").click()`);
    await sleep(200);
    const closed = await evaluate(
      cdp,
      `(() => {
        const menu = document.getElementById("pause-menu");
        const pause = document.getElementById("pause");
        return {
          open: !menu.hidden,
          expanded: pause.getAttribute("aria-expanded"),
          running: !document.getElementById("board").classList.contains("is-paused")
        };
      })()`
    );
    if (closed.open) failures.push("Pause menu did not close");
    if (closed.expanded !== "false") {
      failures.push("Pause button aria-expanded was not reset to false");
    }
    if (!closed.running) failures.push("Game did not resume after closing the pause menu");
    if (cdp.errors.length > 0) {
      failures.push(`Pause menu console errors: ${cdp.errors.join(" | ")}`);
    }

    console.log("| Viewport | Board side | Scroll size | Result |");
    console.log("| --- | ---: | --- | --- |");
    for (const row of rows) {
      console.log(
        `| ${row.viewport} | ${row.board} | ${row.scroll} | ${row.status} |`
      );
    }

    if (failures.length > 0) {
      console.error("\nFailures:");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
    } else {
      console.log("\nAll viewport and pause menu checks passed.");
    }
  } finally {
    if (cdp) cdp.close();
    chrome.kill("SIGKILL");
    await new Promise((resolve) => {
      if (chrome.exitCode !== null) resolve();
      else {
        chrome.once("exit", resolve);
        setTimeout(() => {
          chrome.kill("SIGKILL");
          resolve();
        }, 1000);
      }
    });
    try {
      fs.rmSync(profileDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100
      });
    } catch {
      // Chrome can briefly hold files open after exiting; cleanup is best-effort.
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
