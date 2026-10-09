import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  getNextPromotionIndex,
  getPromotionSetSignature,
  getPromotionVisibility,
  selectPromotionCards,
  shouldAutoRotate,
} from '../packages/core/dist/promoto-banner.js';

const fallback = {
  id: 'site-fallback',
  title: 'Local campaign',
  description: 'Localized for this site',
  ctaLabel: 'Read more',
  link: '/campaign',
};

test('uses a site fallback only when no eligible remote campaign exists', () => {
  assert.deepEqual(selectPromotionCards([], fallback), [fallback]);
  assert.deepEqual(selectPromotionCards([{ ...fallback, id: 'remote' }], fallback), [{ ...fallback, id: 'remote' }]);
  assert.deepEqual(selectPromotionCards([], { ...fallback, link: 'javascript:alert(1)' }), []);
});

test('dismissal signatures change with campaign content and drive banner visibility', () => {
  const signature = getPromotionSetSignature([fallback]);
  assert.ok(signature);
  assert.equal(getPromotionSetSignature([{ ...fallback, title: 'Changed campaign' }]) === signature, false);
  assert.equal(getPromotionVisibility([fallback], signature, signature, false), 'dismissed');
  assert.equal(getPromotionVisibility([fallback], signature, null, true), 'footer-hidden');
  assert.equal(getPromotionVisibility([fallback], signature, null, false), 'ready');
  assert.equal(getPromotionVisibility([], null, null, false), 'hidden');
});

test('supports manual wraparound controls and respects reduced-motion rotation', () => {
  assert.equal(getNextPromotionIndex(0, 3, -1), 2);
  assert.equal(getNextPromotionIndex(2, 3, 1), 0);
  assert.equal(getNextPromotionIndex(0, 0, 1), 0);
  assert.equal(shouldAutoRotate(2, false, false, true, 'ready'), true);
  assert.equal(shouldAutoRotate(2, false, true, true, 'ready'), false);
  assert.equal(shouldAutoRotate(2, false, false, true, 'footer-hidden'), false);
  assert.equal(shouldAutoRotate(1, false, false, true, 'ready'), false);
});


test('every rendered promotion CTA, including rotated slides, is tagged with its campaign id', async () => {
  const source = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');
  const render = source.slice(source.indexOf('private renderCards'), source.indexOf('private updateSlides'));

  // renderCards() builds one anchor per card, and is re-run on reload and rotation.
  assert.match(render, /this\.cards\.forEach\(\(card, index\) => \{/);
  assert.match(render, /category: 'promotion',\s*label: card\.id,\s*location: 'promoto_banner',/);
  assert.match(render, /gaEventAttributes\(/);
  assert.match(render, /link\.setAttribute\(name, value\)/);
});

test('pager and dismiss stay a compact icon toolbar that follows the content in DOM order', async () => {
  const component = await readFile(new URL('../packages/core/PromotoBanner.astro', import.meta.url), 'utf8');
  const script = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');

  // Content first, then pager, then dismiss, so focus order matches the visual order.
  const order = ['hagilight-promoto__viewport', 'data-promoto-controls', 'data-promoto-dismiss']
    .map((marker) => component.indexOf(marker));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);

  // Controls are icon buttons that keep an accessible name; the script must not overwrite
  // their children with text, or the pause/play icons would disappear.
  assert.match(component, /data-promoto-pause[\s\S]*?aria-label="Pause automatic promotion rotation"/u);
  assert.match(component, /hagilight-promoto__icon--pause/u);
  assert.match(component, /hagilight-promoto__icon--play/u);
  assert.doesNotMatch(script, /pause\.textContent\s*=/u);
  assert.match(script, /toggleAttribute\('data-multiple'/u);

  // Visible marks stay small; touch devices get a larger, still compact, target.
  assert.match(component, /--promoto-control-size:\s*1\.75rem/u);
  assert.match(component, /@media \(pointer: coarse\)[\s\S]*?--promoto-control-size:\s*2rem/u);
});

test('narrow and short viewports keep the card compact without a separate controls row', async () => {
  const component = await readFile(new URL('../packages/core/PromotoBanner.astro', import.meta.url), 'utf8');

  // Portrait phones: dismiss in the corner, pager sharing the call-to-action row.
  assert.match(component, /@media \(max-width: 45rem\) and \(min-height: 30rem\)/u);
  assert.match(component, /\.hagilight-promoto__controls\s*\{[^}]*position:\s*absolute/u);
  assert.match(component, /\[data-multiple\] \.hagilight-promoto__cta\s*\{[^}]*max-width:/u);
  // Short landscape viewports collapse to a thin strip instead of overflowing.
  assert.match(component, /@media \(max-height: 30rem\)[\s\S]*?\.hagilight-promoto__media\s*\{[^}]*display:\s*none/u);
});
