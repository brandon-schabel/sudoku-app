/**
 * Platform adapters (web + Capacitor). Every export is a safe no-op when the
 * capability is missing, and importing this module never touches window/navigator.
 * @module platform
 */

/** @typedef {'tap'|'place'|'error'|'success'} FeedbackKind */

/** @returns {boolean} true when running inside a Capacitor native shell. */
export function isNative() {
  return false;
}

/** @param {FeedbackKind} kind */
export function haptic(kind) {
  void kind;
}

/** @param {FeedbackKind} kind */
export function playSound(kind) {
  void kind;
}

/** @returns {Promise<boolean>} true if the native review flow was requested. */
export async function requestReview() {
  return false;
}

/**
 * @param {(active:boolean) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onAppStateChange(cb) {
  void cb;
  return () => {};
}

/** @returns {Promise<void>} */
export async function registerServiceWorker() {}

/**
 * @param {{title?:string, text?:string}} data
 * @returns {Promise<boolean>}
 */
export async function share(data) {
  void data;
  return false;
}
