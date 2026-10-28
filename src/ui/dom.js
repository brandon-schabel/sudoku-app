/**
 * STUB owned by C2 (docs/UI-CONTRACT.md): tiny h() helper. C2 replaces this file.
 * @module ui/dom
 */

/**
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {...(Node|string|null|false)} children
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== false && c !== undefined) node.append(c);
  return node;
}
