import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { fakeNode, installMermaidStub, restoreMermaidStub, settle } from './support/mermaid-dom-stub.mjs';

// Pele theme mapping: tokens and presets become --pele-* custom properties, series colors hold 4.5:1
// against the background, and a mode or preset change restyles the diagram without calling Pele again.
const { PELE_MIN_CONTRAST, PELE_SERIES_COUNT, PELE_VARIABLE_NAMES, applyPeleVariables, ensureContrast, peleVariables } = await import(
  '../packages/mermaid/dist/pele-theme.js'
);
const { getContrastRatio, getMermaidSemanticTheme, ARCHIFY_DARK_SERIES, ARCHIFY_LIGHT_SERIES, DEFAULT_DARK_SERIES, DEFAULT_LIGHT_SERIES } = await import(
  '../packages/mermaid/dist/theme.js'
);
const { renderMermaid } = await import('../packages/mermaid/dist/render.js');

const hadStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => installMermaidStub({ storageKey: 'hagilight-mermaid:engine' }));
afterEach(() => {
  restoreMermaidStub(hadStorage);
  delete globalThis.getComputedStyle;
});

/** A page root whose computed custom properties come from `values`, with an oklch-to-rgb canvas like a browser. */
function stubPage(values) {
  globalThis.getComputedStyle = () => ({
    fontFamily: '"Test Sans", sans-serif',
    getPropertyValue: (name) => values[name] ?? '',
  });
  globalThis.document.createElement = (tag) => {
    const node = fakeNode(tag);
    if (tag === 'canvas') {
      node.getContext = () => {
        let fill = '';
        return {
          set fillStyle(value) {
            fill = String(value).startsWith('oklch(') ? 'rgb(12, 34, 56)' : String(value);
          },
          get fillStyle() {
            return fill;
          },
        };
      };
    }
    return node;
  };
}

const PIE = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85';

test('every Pele variable is written for each mode and preset', () => {
  for (const preset of ['default', 'archify']) {
    for (const mode of ['light', 'dark']) {
      const variables = peleVariables(mode, preset);
      for (const name of PELE_VARIABLE_NAMES) assert.ok(name in variables, `${name} for ${preset} ${mode}`);
      assert.equal(Object.keys(variables).length, PELE_VARIABLE_NAMES.length);
    }
  }
  assert.equal(PELE_SERIES_COUNT, 8);
});

test('token roles map to the Pele background, text, lines, surfaces, borders and accent', () => {
  stubPage({
    '--hagilight-mermaid-background': '#fdfcf8',
    '--hagilight-mermaid-foreground': '#1c1b18',
    '--hagilight-mermaid-primary': '#2f5bd6',
    '--hagilight-mermaid-accent': '#7a3fd1',
  });
  const variables = peleVariables('light', 'default');
  assert.equal(variables['--pele-bg'], '#fdfcf8');
  assert.equal(variables['--pele-fg'], '#1c1b18');
  assert.equal(variables['--pele-accent'], '#7a3fd1');
  assert.equal(variables['--pele-border'], '#2f5bd6');
  assert.equal(variables['--pele-line'], '#1c1b18');
});

test('a foreground below 4.5:1 falls back to the built-in foreground for the mode', () => {
  stubPage({
    '--hagilight-mermaid-background': '#ffffff',
    '--hagilight-mermaid-foreground': '#eeeeee',
  });
  const variables = peleVariables('light', 'default');
  assert.equal(variables['--pele-fg'], getMermaidSemanticTheme('light', 'default').foreground);
  assert.ok(getContrastRatio(variables['--pele-fg'], variables['--pele-bg']) >= PELE_MIN_CONTRAST);
});

test('oklch token values are converted to rgb before they reach Pele', () => {
  stubPage({ '--hagilight-mermaid-background': 'oklch(0.98 0 0)' });
  assert.equal(peleVariables('light', 'default')['--pele-bg'], 'rgb(12, 34, 56)');
});

test('without a DOM the mapping uses the built-in colors and the default font', () => {
  restoreMermaidStub(hadStorage);
  delete globalThis.getComputedStyle;
  assert.equal(globalThis.document, undefined);
  const variables = peleVariables('dark', 'default');
  assert.equal(variables['--pele-bg'], getMermaidSemanticTheme('dark', 'default').background);
  assert.equal(variables['--pele-font'], 'sans-serif');
  assert.equal(variables['--pele-radius'], '4px');
});

test('applyPeleVariables writes each variable onto the element as a custom property', () => {
  const node = fakeNode('div');
  applyPeleVariables(node, peleVariables('light', 'archify'));
  assert.equal(node.style.values['--pele-series-1'], peleVariables('light', 'archify')['--pele-series-1']);
  assert.equal(Object.keys(node.style.values).length, PELE_VARIABLE_NAMES.length);
});

test('ensureContrast moves a color only as far as the contrast needs', () => {
  assert.equal(ensureContrast('#000000', '#ffffff'), '#000000');
  const lightened = ensureContrast('#f0f0f0', '#111111');
  assert.ok(getContrastRatio(lightened, '#111111') >= PELE_MIN_CONTRAST);
  const darkened = ensureContrast('#88aaff', '#ffffff');
  assert.ok(getContrastRatio('#ffffff', darkened) >= PELE_MIN_CONTRAST);
});

test('the eight series colors hold 4.5:1 against the background in both presets and modes', () => {
  for (const preset of ['default', 'archify']) {
    for (const mode of ['light', 'dark']) {
      const variables = peleVariables(mode, preset);
      const background = variables['--pele-bg'];
      for (let index = 1; index <= PELE_SERIES_COUNT; index += 1) {
        const series = variables[`--pele-series-${index}`];
        const ratio = getContrastRatio(background, series);
        assert.ok(ratio >= PELE_MIN_CONTRAST, `${preset} ${mode} series ${index} ${series} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test('the Mermaid palettes are read unchanged, so Mermaid output does not move', () => {
  const palettes = [DEFAULT_LIGHT_SERIES, DEFAULT_DARK_SERIES, ARCHIFY_LIGHT_SERIES, ARCHIFY_DARK_SERIES];
  for (const palette of palettes) assert.ok(palette.length >= PELE_SERIES_COUNT);
  assert.equal(getMermaidSemanticTheme('light', 'default').series[0].mark, DEFAULT_LIGHT_SERIES[0].mark);
});

test('a mode change restyles a shown Pele diagram without calling Pele again', async () => {
  let renders = 0;
  const peleLoader = async () => ({
    render: () => {
      renders += 1;
      return { svg: '<svg data-probe="PIE" class="pele pele-pie"></svg>', width: 1, height: 1, type: 'pie', mermaidType: 'pie' };
    },
  });
  const host = fakeNode();
  const handle = renderMermaid(host, PIE, { engine: 'pele', mode: 'light', peleLoader });
  await settle();
  const container = host.children[0];
  assert.equal(container.dataset.mermaidMode, 'light');
  const lightBackground = container.style.values['--pele-bg'];

  handle.update({ mode: 'dark' });
  await settle();
  assert.equal(renders, 1, 'Pele renders once');
  assert.equal(container.dataset.mermaidMode, 'dark');
  assert.notEqual(container.style.values['--pele-bg'], lightBackground);
  assert.equal(container.style.values['--pele-bg'], peleVariables('dark', 'default')['--pele-bg']);
});

test('a preset change restyles in place and updates the preset class and attribute', async () => {
  let renders = 0;
  const peleLoader = async () => ({
    render: () => {
      renders += 1;
      return { svg: '<svg class="pele pele-pie"></svg>', width: 1, height: 1, type: 'pie', mermaidType: 'pie' };
    },
  });
  const host = fakeNode();
  const handle = renderMermaid(host, PIE, { engine: 'pele', mode: 'light', peleLoader });
  await settle();
  handle.update({ preset: 'archify' });
  await settle();
  assert.equal(renders, 1);
  assert.equal(host.children[0].dataset.mermaidPreset, 'archify');
  assert.equal(host.children[0].style.values['--pele-series-1'], peleVariables('light', 'archify')['--pele-series-1']);
});

test('a source change on a Pele diagram still renders again', async () => {
  let renders = 0;
  const peleLoader = async () => ({
    render: () => {
      renders += 1;
      return { svg: '<svg class="pele pele-pie"></svg>', width: 1, height: 1, type: 'pie', mermaidType: 'pie' };
    },
  });
  const host = fakeNode();
  const handle = renderMermaid(host, PIE, { engine: 'pele', peleLoader });
  await settle();
  handle.update({ source: 'pie title Other\n  "A" : 1' });
  await settle();
  assert.equal(renders, 2);
});
