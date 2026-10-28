/**
 * Tiny DOM helper for C1 views.
 * @module ui/el
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {Record<string, any>} [attrs] `class`, `text`, `html`, `on<Event>` handlers, `dataset`, or attributes
 * @param {Array<Node|string|null|false>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    node.append(child);
  }
  return node;
}

/**
 * Set or remove an attribute depending on `value`.
 * @param {Element} node @param {string} name @param {string|boolean|null|undefined} value
 */
export function attr(node, name, value) {
  if (value === null || value === undefined || value === false) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
  } else {
    const v = value === true ? "true" : String(value);
    if (node.getAttribute(name) !== v) node.setAttribute(name, v);
  }
}

/** Update text only when it changed. @param {Node} node @param {string} text */
export function text(node, value) {
  if (node.textContent !== value) node.textContent = value;
}
