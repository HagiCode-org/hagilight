import { mock } from 'node:test';

/**
 * A minimal DOM stand-in for the Mermaid render controller in Node. It has no layout and draws nothing: the
 * tests inject the Mermaid and Pele loaders, so they observe which module a render asked for and what the
 * host holds afterwards. Anything the controller calls that is not listed here is a test that needs a browser.
 */
export function fakeNode(tag = 'div') {
  const node = {
    tagName: tag.toUpperCase(),
    children: [],
    attributes: {},
    dataset: {},
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = String(value);
      },
    },
    textContent: '',
    innerHTML: '',
    classList: { add() {}, remove() {}, contains: () => false },
    setAttribute(name, value) {
      node.attributes[name] = String(value);
    },
    getAttribute: (name) => node.attributes[name] ?? null,
    removeAttribute(name) {
      delete node.attributes[name];
    },
    appendChild(child) {
      node.children.push(child);
      return child;
    },
    append(...children) {
      node.children.push(...children);
    },
    insertBefore(child) {
      node.children.unshift(child);
      return child;
    },
    replaceChildren(...children) {
      node.children = children.flat();
    },
    replaceWith(...replacements) {
      node.replacedBy = replacements;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    matches: () => false,
    addEventListener() {},
    removeEventListener() {},
  };
  return node;
}

/** A `pre.mermaid`-style block that `mountMermaidDiagrams` can replace. */
export function fakeBlock(text) {
  return {
    textContent: text,
    matches: (selector) => selector === 'pre.mermaid',
    closest: () => null,
    replaceWith() {},
  };
}

/**
 * Installs a document stub and a localStorage stub that returns `storedEngine` for `storageKey`.
 * Console errors are muted, because a probe render that fails is expected.
 */
export function installMermaidStub({ storageKey, storedEngine = null } = {}) {
  mock.method(console, 'error', () => {});
  globalThis.document = {
    documentElement: fakeNode('html'),
    createElement: (tag) => fakeNode(tag),
    createElementNS: (_ns, tag) => fakeNode(tag),
  };
  globalThis.localStorage = {
    getItem: (key) => (key === storageKey ? storedEngine : null),
    setItem() {},
  };
}

/** Undoes `installMermaidStub`, including the stored localStorage descriptor the test file saved. */
export function restoreMermaidStub(originalStorage) {
  mock.restoreAll();
  delete globalThis.document;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
}

/** Resolves after pending microtasks and the render queue have had a turn. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
