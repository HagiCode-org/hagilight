import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  MERMAID_LAYOUT_DEFAULTS,
  clearMermaidThemeConfigCache,
  getContrastRatio,
  getMermaidSemanticTheme,
  getMermaidThemeConfig,
  resolvePreset,
} from '@hagicode/hagilight-mermaid/theme';

/** Fakes the browser pieces the theme reads: computed custom properties and the canvas color conversion. */
function stubBrowser(values, { canvas = true } = {}) {
  globalThis.document = {
    documentElement: {},
    createElement: () => ({
      getContext: () => {
        if (!canvas) return null;
        let fill = '';
        return {
          // Converts oklch() to rgb the way a browser canvas does; other colors pass through.
          set fillStyle(value) {
            fill = value.startsWith('oklch(') ? 'rgb(1, 2, 3)' : value;
          },
          get fillStyle() {
            return fill;
          },
        };
      },
    }),
  };
  globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => values[name] ?? '' });
}

function clearBrowser() {
  delete globalThis.document;
  delete globalThis.getComputedStyle;
}

afterEach(() => {
  clearBrowser();
  clearMermaidThemeConfigCache();
});

test('light and dark semantic themes use the built-in palettes without a DOM', () => {
  clearBrowser();
  assert.equal(getMermaidSemanticTheme('light').background, '#ffffff');
  assert.equal(getMermaidSemanticTheme('dark').background, '#111827');
  assert.equal(getMermaidSemanticTheme('dark').mode, 'dark');
});

test('archify uses its own fixed palettes and adds the archify text variables', () => {
  clearBrowser();
  assert.equal(getMermaidSemanticTheme('light', 'archify').background, '#f8fafc');
  assert.equal(getMermaidSemanticTheme('dark', 'archify').background, '#020617');
  const archify = getMermaidThemeConfig('light', 'archify').themeVariables;
  const standard = getMermaidThemeConfig('light', 'default').themeVariables;
  assert.equal(archify.nodeTextColor, '#0f172a');
  assert.equal(standard.nodeTextColor, undefined);
});

test('an unknown preset name falls back to the default preset', () => {
  assert.equal(resolvePreset('archify'), 'archify');
  assert.equal(resolvePreset('lunar'), 'default');
  assert.equal(resolvePreset(undefined), 'default');
  assert.equal(getMermaidSemanticTheme('light', 'lunar').background, '#ffffff');
});

test('hex token values pass through unchanged', () => {
  stubBrowser({ '--hagilight-mermaid-background': '#abcdef' });
  assert.equal(getMermaidSemanticTheme('light').background, '#abcdef');
});

test('mapped token names replace the default custom properties', () => {
  stubBrowser({ '--site-bg': '#123456', '--hagilight-mermaid-background': '#abcdef' });
  assert.equal(getMermaidSemanticTheme('light', 'default', { tokens: { background: '--site-bg' } }).background, '#123456');
  assert.equal(getMermaidSemanticTheme('light').background, '#abcdef');
});

test('oklch token values are converted to rgb through the canvas before Mermaid sees them', () => {
  stubBrowser({ '--hagilight-mermaid-background': 'oklch(0.2 0 0)' });
  assert.equal(getMermaidSemanticTheme('dark').background, 'rgb(1, 2, 3)');
});

test('an unconvertible color uses the mode fallback, with or without a canvas', () => {
  stubBrowser({ '--hagilight-mermaid-background': 'oklch(0.2 0 0)' }, { canvas: false });
  assert.equal(getMermaidSemanticTheme('light').background, '#ffffff');
  stubBrowser({ '--hagilight-mermaid-background': 'oklch(0.2 0 0)' });
  // A canvas that echoes the unconverted oklch() value is treated as unconvertible too.
  globalThis.document.createElement = () => ({
    getContext: () => ({ fillStyle: 'oklch(0.2 0 0)' }),
  });
  assert.equal(getMermaidSemanticTheme('light').background, '#ffffff');
});

test('no DOM at all uses the built-in values and does not throw', () => {
  clearBrowser();
  assert.doesNotThrow(() => getMermaidThemeConfig('dark'));
  assert.equal(getMermaidSemanticTheme('dark').foreground, '#f8fafc');
});

test('low contrast text falls back to the built-in foreground for the mode', () => {
  stubBrowser({ '--hagilight-mermaid-foreground': '#777777', '--hagilight-mermaid-background': '#ffffff' });
  assert.ok(getContrastRatio('#777777', '#ffffff') < 4.5);
  assert.equal(getMermaidSemanticTheme('light').foreground, '#17212b');
  stubBrowser({ '--hagilight-mermaid-foreground': '#000000', '--hagilight-mermaid-background': '#ffffff' });
  assert.equal(getMermaidSemanticTheme('light').foreground, '#000000');
});

test('contrast ratio matches the WCAG definition at its extremes', () => {
  assert.ok(Math.abs(getContrastRatio('#000000', '#ffffff') - 21) < 0.01);
  assert.equal(getContrastRatio('#ffffff', '#ffffff'), 1);
});

test('configuration is reused while the colors are unchanged and rebuilt after a cache reset', () => {
  clearBrowser();
  const first = getMermaidThemeConfig('light');
  assert.equal(getMermaidThemeConfig('light'), first);
  clearMermaidThemeConfigCache();
  const rebuilt = getMermaidThemeConfig('light');
  assert.notEqual(rebuilt, first);
  assert.deepEqual(rebuilt, first);
});

test('a token change produces a new configuration instead of a stale cached one', () => {
  stubBrowser({ '--hagilight-mermaid-background': '#111111' });
  const dim = getMermaidThemeConfig('light');
  stubBrowser({ '--hagilight-mermaid-background': '#222222' });
  const brighter = getMermaidThemeConfig('light');
  assert.notEqual(brighter, dim);
  assert.equal(brighter.themeVariables.background, '#222222');
});

test('the Mermaid configuration keeps the strict security and no auto-start settings', () => {
  clearBrowser();
  const config = getMermaidThemeConfig('light');
  assert.equal(config.theme, 'base');
  assert.equal(config.securityLevel, 'strict');
  assert.equal(config.startOnLoad, false);
  assert.equal(config.suppressErrorRendering, true);
  assert.deepEqual(config.flowchart, MERMAID_LAYOUT_DEFAULTS);
  assert.equal(MERMAID_LAYOUT_DEFAULTS.maxNodeWidth, 280);
});

for (const preset of ['default', 'archify']) {
  for (const mode of ['light', 'dark']) {
    test(`${preset} ${mode} series colors keep readable text and visible marks`, () => {
      clearBrowser();
      const theme = getMermaidSemanticTheme(mode, preset);
      assert.equal(theme.series.length, 12);
      assert.equal(new Set(theme.series.map((tone) => tone.mark)).size, 12, 'every mark is distinct');
      for (const [index, tone] of theme.series.entries()) {
        assert.ok(getContrastRatio(theme.onSeries, tone.mark) >= 4.5, `text on mark ${index}`);
        assert.ok(getContrastRatio(tone.mark, theme.background) >= 3, `mark ${index} against the canvas`);
        assert.ok(getContrastRatio(theme.foreground, tone.fill) >= 4.5, `text on fill ${index}`);
        assert.ok(getContrastRatio(tone.border, tone.fill) >= 4.5, `border on fill ${index}`);
      }
    });
  }
}

test('categorical diagrams read the series palette instead of the node color', () => {
  clearBrowser();
  const light = getMermaidThemeConfig('light').themeVariables;
  const dark = getMermaidThemeConfig('dark').themeVariables;
  const theme = getMermaidSemanticTheme('light');
  assert.equal(light.darkMode, false);
  assert.equal(dark.darkMode, true);
  assert.equal(light.pie1, theme.series[0].mark);
  assert.equal(light.pie2, theme.series[1].mark);
  assert.equal(light.cScale3, theme.series[3].mark);
  assert.equal(light.pieSectionTextColor, theme.onSeries);
  assert.equal(light.pieStrokeColor, theme.background);
  assert.equal(light.xyChart.plotColorPalette.split(',').length, 12);
  assert.notEqual(light.noteBkgColor, '#fff5ad', 'notes no longer use the cream default');
  assert.notEqual(light.pie1, dark.pie1, 'each mode has its own tones');
});
