import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/mermaid/', import.meta.url));
const stylesheets = ['styles.css', 'styles/archify.css'];
const SCOPE = '.mermaid-container';
const PREFIX = '--hagilight-mermaid-';

function stylesOf(file) {
  return readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Top-level commas only, so `:is(a, b)` stays one selector. */
function splitSelectors(list) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

/** Selectors of every style rule. At-rules and keyframe steps are not style rules. */
function styleRuleSelectors(css) {
  const selectors = [];
  for (const match of css.matchAll(/([^{}]+)\{/g)) {
    const text = match[1].trim();
    if (text.startsWith('@') || /^(?:from|to|\d+(?:\.\d+)?%)$/.test(text)) continue;
    selectors.push(...splitSelectors(text));
  }
  return selectors;
}

test('every style rule is scoped under the diagram container', () => {
  for (const file of stylesheets) {
    const outside = styleRuleSelectors(stylesOf(file)).filter((selector) => !selector.startsWith(SCOPE));
    assert.deepEqual(outside, [], `${file} has selectors outside ${SCOPE}`);
  }
});

test('every custom property read is package-prefixed and has a fallback', () => {
  for (const file of stylesheets) {
    const references = [...stylesOf(file).matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)];
    assert.ok(references.length > 0, `${file} reads custom properties`);
    const unprefixed = references.filter(([, name]) => !name.startsWith(PREFIX)).map(([, name]) => name);
    assert.deepEqual(unprefixed, [], `${file} reads non-prefixed properties`);
    const withoutFallback = references.filter(([, , comma]) => !comma).map(([, name]) => name);
    assert.deepEqual(withoutFallback, [], `${file} reads properties without a fallback`);
  }
});

test('the archify preset and base styles are both loadable and share the token names', () => {
  const base = stylesOf('styles.css');
  const archify = stylesOf('styles/archify.css');
  for (const token of ['--hagilight-mermaid-mm-down', '--hagilight-mermaid-mm-up', '--hagilight-mermaid-card']) {
    assert.ok(base.includes(token) || archify.includes(token), `${token} is read by the styles`);
  }
  assert.match(archify, /\.mermaid-container\.mermaid-preset-archify/u);
});
