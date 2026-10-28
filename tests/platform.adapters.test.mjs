import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as platform from '../src/platform/index.js';

const g = globalThis;
function withGlobals(vals, fn) {
  const saved = {};
  for (const k of Object.keys(vals)) saved[k] = Object.getOwnPropertyDescriptor(g, k);
  for (const [k, v] of Object.entries(vals)) Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
  const restore = () => {
    for (const k of Object.keys(vals)) {
      if (saved[k]) Object.defineProperty(g, k, saved[k]);
      else delete g[k];
    }
  };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.finally(restore);
    restore();
    return r;
  } catch (e) {
    restore();
    throw e;
  }
}

test('exports the contract', () => {
  for (const n of ['haptic', 'playSound', 'requestReview', 'onAppStateChange', 'registerServiceWorker', 'isNative', 'share']) {
    assert.equal(typeof platform[n], 'function', n);
  }
});

test('Node-safe no-ops without window/navigator', async () => {
  assert.equal(platform.isNative(), false);
  platform.haptic('tap');
  platform.playSound('success');
  assert.equal(await platform.requestReview(), false);
  assert.equal(await platform.share({ title: 't', text: 'x' }), false);
  await platform.registerServiceWorker();
  const off = platform.onAppStateChange(() => {});
  assert.equal(typeof off, 'function');
  off();
});

test('haptic uses navigator.vibrate on web and ignores unknown kinds', () => {
  const calls = [];
  withGlobals({ navigator: { vibrate: (p) => calls.push(p) } }, () => {
    platform.haptic('tap');
    platform.haptic('error');
    platform.haptic('bogus');
  });
  assert.equal(calls.length, 2);
});

test('haptic prefers the Capacitor plugin when native', () => {
  const calls = [];
  const win = {
    Capacitor: {
      isNativePlatform: () => true,
      Plugins: { Haptics: { impact: (a) => calls.push(['impact', a.style]), notification: (a) => calls.push(['n', a.type]) } },
    },
  };
  withGlobals({ window: win, navigator: { vibrate: () => assert.fail('should not vibrate') } }, () => {
    assert.equal(platform.isNative(), true);
    platform.haptic('tap');
    platform.haptic('place');
    platform.haptic('error');
    platform.haptic('success');
  });
  assert.deepEqual(calls, [['impact', 'LIGHT'], ['impact', 'MEDIUM'], ['n', 'ERROR'], ['n', 'SUCCESS']]);
});

test('playSound lazily creates one AudioContext and schedules oscillators', () => {
  let created = 0;
  let oscs = 0;
  class Ctx {
    constructor() { created++; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() { oscs++; return { frequency: {}, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  withGlobals({ window: { AudioContext: Ctx } }, () => {
    assert.equal(created, 0);
    platform.playSound('success');
    platform.playSound('tap');
    platform.playSound('nope');
  });
  assert.equal(created, 1);
  assert.equal(oscs, 4);
});

test('requestReview calls the native plugin only when native', async () => {
  let n = 0;
  const plugins = { InAppReview: { requestReview: async () => { n++; } } };
  await withGlobals({ window: { Capacitor: { isNativePlatform: () => false, Plugins: plugins } } }, async () => {
    assert.equal(await platform.requestReview(), false);
  });
  await withGlobals({ window: { Capacitor: { isNativePlatform: () => true, Plugins: plugins } } }, async () => {
    assert.equal(await platform.requestReview(), true);
  });
  assert.equal(n, 1);
});

test('onAppStateChange: visibilitychange on web, App plugin when native', async () => {
  const listeners = new Map();
  const doc = {
    visibilityState: 'visible',
    addEventListener: (t, f) => listeners.set(t, f),
    removeEventListener: (t) => listeners.delete(t),
  };
  const seen = [];
  withGlobals({ document: doc }, () => {
    const off = platform.onAppStateChange((a) => seen.push(a));
    doc.visibilityState = 'hidden';
    listeners.get('visibilitychange')();
    doc.visibilityState = 'visible';
    listeners.get('visibilitychange')();
    off();
    assert.equal(listeners.size, 0);
  });
  assert.deepEqual(seen, [false, true]);

  let handler;
  let removed = false;
  const App = { addListener: async (_, f) => { handler = f; return { remove: () => { removed = true; } }; } };
  await withGlobals({ window: { Capacitor: { isNativePlatform: () => true, Plugins: { App } } } }, async () => {
    const got = [];
    const off = platform.onAppStateChange((a) => got.push(a));
    handler({ isActive: false });
    assert.deepEqual(got, [false]);
    await new Promise((r) => setTimeout(r, 0));
    off();
    assert.equal(removed, true);
  });
});

test('registerServiceWorker registers ./sw.js on http(s) only, not on file:// or native', async () => {
  const regs = [];
  const nav = { serviceWorker: { register: async (u) => regs.push(u) } };
  await withGlobals({ navigator: nav, location: { protocol: 'https:' } }, () => platform.registerServiceWorker());
  await withGlobals({ navigator: nav, location: { protocol: 'file:' } }, () => platform.registerServiceWorker());
  await withGlobals({ navigator: nav, location: { protocol: 'https:' }, window: { Capacitor: { isNativePlatform: () => true } } }, () => platform.registerServiceWorker());
  assert.deepEqual(regs, ['./sw.js']);
});

test('share uses navigator.share, falls back to clipboard, swallows cancel', async () => {
  let shared;
  await withGlobals({ navigator: { share: async (d) => { shared = d; } } }, async () => {
    assert.equal(await platform.share({ title: 'a', text: 'b' }), true);
  });
  assert.deepEqual(shared, { title: 'a', text: 'b' });
  let copied;
  await withGlobals({ navigator: { clipboard: { writeText: async (t) => { copied = t; } } } }, async () => {
    assert.equal(await platform.share({ text: 'hi' }), true);
  });
  assert.equal(copied, 'hi');
  await withGlobals({ navigator: { share: async () => { throw new Error('AbortError'); } } }, async () => {
    assert.equal(await platform.share({ text: 'x' }), false);
  });
});

test('native path registers plugins lazily via Capacitor.registerPlugin', async () => {
  const calls = [];
  const listeners = [];
  const plugins = {
    Haptics: { impact: (a) => calls.push(['impact', a]), notification: (a) => calls.push(['notification', a]) },
    App: { addListener: (ev, fn) => { listeners.push([ev, fn]); return Promise.resolve({ remove: () => calls.push(['removed']) }); } },
    InAppReview: { requestReview: async () => { calls.push(['review']); } },
  };
  const registered = [];
  globalThis.window = {
    Capacitor: {
      isNativePlatform: () => true,
      registerPlugin: (n) => { registered.push(n); return plugins[n]; },
    },
  };
  try {
    const m = await import('../src/platform/index.js');
    assert.equal(registered.length, 0, 'nothing registered at import');
    m.haptic('tap');
    m.haptic('error');
    assert.deepEqual(calls.slice(0, 2), [['impact', { style: 'LIGHT' }], ['notification', { type: 'ERROR' }]]);
    assert.equal(await m.requestReview(), true);
    assert.ok(calls.some((c) => c[0] === 'review'));
    const seen = [];
    const off = m.onAppStateChange((a) => seen.push(a));
    assert.equal(listeners[0][0], 'appStateChange');
    listeners[0][1]({ isActive: false });
    assert.deepEqual(seen, [false]);
    await new Promise((r) => setImmediate(r));
    off();
    assert.ok(calls.some((c) => c[0] === 'removed'));
    for (const n of registered) assert.ok(['Haptics', 'App', 'InAppReview'].includes(n));
  } finally {
    delete globalThis.window;
  }
});

test('web path stays a no-op when Capacitor is not native', async () => {
  let registered = 0;
  globalThis.window = { Capacitor: { isNativePlatform: () => false, registerPlugin: () => { registered++; return {}; } } };
  try {
    const m = await import('../src/platform/index.js');
    m.haptic('tap');
    assert.equal(await m.requestReview(), false);
    assert.equal(registered, 0);
  } finally {
    delete globalThis.window;
  }
});
