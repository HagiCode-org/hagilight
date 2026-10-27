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
