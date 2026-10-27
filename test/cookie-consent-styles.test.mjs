import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../packages/core/CookieConsent.astro', import.meta.url), 'utf8');
const css = source.match(/<style is:global>([\s\S]*?)<\/style>/u)?.[1] ?? '';
const banner = readFileSync(new URL('../packages/core/PromotoBanner.astro', import.meta.url), 'utf8');

test('the popup sits above the banner (40) and below the top-layer dialog, with a 24rem width', () => {
  const zIndex = Number(css.match(/z-index:\s*(\d+)/u)?.[1]);
  assert.equal(zIndex, 45);
  assert.match(banner, /z-index:\s*40;/u, 'the banner keeps z-index 40');
  assert.ok(zIndex > 40);
  assert.match(css, /width:\s*min\(24rem,/u);
});

test('the popup attaches to the bottom edge below about 36rem', () => {
  assert.match(css, /@media \(max-width: 36rem\)\s*\{[\s\S]*?inset-block-end:\s*0;/u);
});

test('a hidden popup stays hidden even though the panel sets display rules of its own', () => {
  assert.match(css, /\.hagilight-consent\[hidden\][\s\S]*?display:\s*none;/u);
  assert.match(css, /\.hagilight-consent:not\(\[hidden\]\)\s*\{\s*animation:/u);
  assert.match(css, /\.hagilight-consent\[data-state='undecided'\] \.hagilight-consent__choice\s*\{\s*display:\s*none;/u, 'the choice chip waits for a choice');
});

test('the panel declares its elevation once, as a shadow, with no border outside forced colors', () => {
  const panel = css.match(/\n  \.hagilight-consent \{([^}]*)\}/u)?.[1] ?? '';
  assert.match(panel, /box-shadow:\s*0 1px 2px[^;]*,\s*0 18px 44px/u);
  assert.match(panel, /border:\s*0;/u);
  assert.match(css, /@media \(forced-colors: active\)\s*\{\s*\.hagilight-consent\s*\{\s*border:\s*1px solid CanvasText;/u);
});

test('the entrance is keyframes with a spring where linear() exists, never @starting-style', () => {
  assert.match(css, /@supports \(animation-timing-function: linear\(0, 1\)\)[\s\S]*?--hc-spring:\s*linear\(/u);
  assert.match(css, /--hc-spring:\s*cubic-bezier\(/u, 'a cubic-bezier fallback is declared first');
  assert.match(css, /@keyframes hagilight-consent-rise/u);
  assert.doesNotMatch(css, /@starting-style/u, 'Docusaurus minifier rejects it');
});

test('the Docusaurus stylesheet carries the same rules as the Astro component, with its own tokens', () => {
  const docusaurus = readFileSync(new URL('../packages/docusaurus/consent.css', import.meta.url), 'utf8');
  const body = (text) => text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('/*') && !line.startsWith('--hc-') && !line.includes('--sl-color-') && !line.includes('--ifm-'))
    .join('\n');
  const rules = body(css);
  const docusaurusRules = body(docusaurus.slice(0, docusaurus.indexOf('.hagilight-footer__consent')));
  assert.equal(docusaurusRules, rules);
  assert.doesNotMatch(docusaurus.slice(0, docusaurus.indexOf('.hagilight-footer__consent')), /--sl-color-/u);
});

test('Accept and Reject share one class and one set of properties', () => {
  const rule = css.match(/\.hagilight-consent__button\s*\{([^}]*)\}/u)?.[1] ?? '';
  assert.ok(rule.length > 0);
  assert.doesNotMatch(css, /\.hagilight-consent__button--primary/u);
  assert.equal(source.match(/class="hagilight-consent__button"/gu) ?? null, null, 'markup comes from consent-markup.ts');
});

test('focus rings, reduced motion and the Starlight token fallbacks are all present', () => {
  assert.match(css, /:focus-visible/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none !important;/u);
  for (const token of ['--sl-color-accent', '--sl-color-bg', '--sl-color-text', '--sl-color-gray-5']) {
    assert.match(css, new RegExp(`var\\(${token}, `, 'u'), `${token} has a fallback`);
  }
});
