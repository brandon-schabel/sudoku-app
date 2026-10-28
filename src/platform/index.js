/**
 * Platform adapters (web + Capacitor). Every export is a safe no-op when the
 * capability is missing, and importing this module never touches
 * window/navigator, so it is safe to load under Node.
 *
 * Capacitor plugins are reached lazily through the global
 * `window.Capacitor.registerPlugin(name)` proxy (no bundler, no runtime
 * dependency). Names match the native `jsName`/`@CapacitorPlugin(name)`:
 * Haptics, App, InAppReview.
 * @module platform
 */

/** @typedef {'tap'|'place'|'error'|'success'} FeedbackKind */

const KINDS = ['tap', 'place', 'error', 'success'];

/** @returns {any} the Capacitor global, or null */
function cap() {
  return (typeof window !== 'undefined' && window.Capacitor) || null;
}

/** @param {string} name @returns {any} native plugin proxy or null */
function plugin(name) {
  const c = cap();
  if (!c || !isNative()) return null;
  try {
    if (typeof c.registerPlugin === 'function') return c.registerPlugin(name) || null;
  } catch {
    /* fall through to the pre-registered map */
  }
  return (c.Plugins && c.Plugins[name]) || null;
}

/** @returns {boolean} true when running inside a Capacitor native shell. */
export function isNative() {
  const c = cap();
  if (!c) return false;
  try {
    if (typeof c.isNativePlatform === 'function') return !!c.isNativePlatform();
    const p = typeof c.getPlatform === 'function' ? c.getPlatform() : 'web';
    return p === 'ios' || p === 'android';
  } catch {
    return false;
  }
}

// ---- haptics -------------------------------------------------------------

const VIBRATE = { tap: 8, place: 12, error: [30, 40, 30], success: [15, 30, 15, 30, 40] };

/**
 * Fire a short tactile cue. Capacitor Haptics when native, else navigator.vibrate.
 * @param {FeedbackKind} kind
 */
export function haptic(kind) {
  if (!KINDS.includes(kind)) return;
  try {
    const h = plugin('Haptics');
    if (h) {
      if (kind === 'error') h.notification({ type: 'ERROR' });
      else if (kind === 'success') h.notification({ type: 'SUCCESS' });
      else h.impact({ style: kind === 'tap' ? 'LIGHT' : 'MEDIUM' });
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(VIBRATE[kind]);
    }
  } catch {
    /* feedback is best-effort */
  }
}

// ---- sounds --------------------------------------------------------------

/** Per-kind note sequences: [frequency Hz, start s, duration s, peak gain, wave]. */
const TONES = {
  tap: [[520, 0, 0.05, 0.05, 'sine']],
  place: [[660, 0, 0.08, 0.08, 'triangle']],
  error: [[180, 0, 0.16, 0.09, 'square'], [140, 0.1, 0.18, 0.07, 'square']],
  success: [[523.25, 0, 0.12, 0.08, 'sine'], [659.25, 0.1, 0.12, 0.08, 'sine'], [783.99, 0.2, 0.22, 0.08, 'sine']],
};

let audioCtx = null;

/** @returns {AudioContext|null} lazily created on first use */
function context() {
  if (audioCtx) return audioCtx;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/**
 * Play a tiny synthesized cue (no audio files).
 * @param {FeedbackKind} kind
 */
export function playSound(kind) {
  const notes = TONES[kind];
  if (!notes) return;
  try {
    const ctx = context();
    if (!ctx) return;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume();
    const t0 = ctx.currentTime;
    for (const [freq, start, dur, peak, wave] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch {
    /* sound is best-effort */
  }
}

// ---- review --------------------------------------------------------------

/**
 * Ask the OS for its native in-app review sheet (the OS decides whether to show it).
 * @returns {Promise<boolean>} true if the request was issued; false on web/failure
 */
export async function requestReview() {
  try {
    const r = plugin('InAppReview');
    if (!r || typeof r.requestReview !== 'function') return false;
    await r.requestReview();
    return true;
  } catch {
    return false;
  }
}

// ---- app state -----------------------------------------------------------

/**
 * Subscribe to foreground/background changes.
 * Capacitor App plugin when native, else document visibilitychange.
 * @param {(active:boolean) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onAppStateChange(cb) {
  if (typeof cb !== 'function') return () => {};
  const app = plugin('App');
  if (app && typeof app.addListener === 'function') {
    let removed = false;
    let handle = null;
    try {
      const p = app.addListener('appStateChange', (s) => cb(!!(s && s.isActive)));
      Promise.resolve(p).then((h) => {
        handle = h;
        if (removed && h && h.remove) h.remove();
      }, () => {});
    } catch {
      return () => {};
    }
    return () => {
      removed = true;
      if (handle && handle.remove) handle.remove();
    };
  }
  if (typeof document === 'undefined' || !document.addEventListener) return () => {};
  const onVis = () => cb(document.visibilityState !== 'hidden');
  document.addEventListener('visibilitychange', onVis);
  return () => document.removeEventListener('visibilitychange', onVis);
}

// ---- service worker ------------------------------------------------------

/**
 * Register `sw.js` (resolved relative to the page, so it works under any subpath).
 * No-op under Capacitor, on file://, and where service workers are unsupported.
 * @returns {Promise<void>}
 */
export async function registerServiceWorker() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
    if (isNative()) return;
    await navigator.serviceWorker.register('./sw.js');
  } catch {
    /* offline support is an enhancement only */
  }
}

// ---- share ---------------------------------------------------------------

/**
 * Share text via the Web Share API (native webviews implement it), falling back
 * to the clipboard.
 * @param {{title?:string, text?:string}} data
 * @returns {Promise<boolean>} true if shared/copied
 */
export async function share({ title, text } = {}) {
  try {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text });
      return true;
    }
    if (navigator.clipboard && navigator.clipboard.writeText && text) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* user cancelled or unsupported */
  }
  return false;
}
