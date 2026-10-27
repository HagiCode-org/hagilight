import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Source-level wiring checks for the Starlight components that own their events. Behaviour is covered by the
 * shared observer tests, and the built output is checked by the browser step; these pin the call order.
 */
const component = (path) => readFileSync(new URL(`../packages/starlight/${path}`, import.meta.url), 'utf8');
const index = (source, needle) => {
  const at = source.indexOf(needle);
  assert.notEqual(at, -1, `missing ${needle}`);
  return at;
};

test('the 404 hero marks the not-found branch and reports once from its script', () => {
  const source = component('NotFoundHero.astro');
  assert.ok(index(source, 'data-hagilight-not-found') < index(source, '<script>'), 'marker is in the not-found branch');
  assert.match(source, /capturePostHogEvent\('not_found_viewed'/u);
  assert.match(source, /referrer_domain: referrerDomain\(document\.referrer\)/u);
});

test('the language chooser reports after the same-language return and before navigation', () => {
  const source = component('LanguageChooser.astro');
  const sameLanguage = index(source, "if (option.getAttribute('aria-selected') === 'true') return;");
  const capture = index(source, "capturePostHogEvent('locale_changed'");
  const navigate = index(source, 'window.location.assign(target.toString());');
  assert.ok(sameLanguage < capture && capture < navigate);
  assert.ok(index(source, 'persistStarlightLocaleSelection(locale);') > sameLanguage);
});

test('the theme picker and the content width toggle report their chosen value', () => {
  const theme = component('ThemeSelect.astro');
  assert.ok(index(theme, 'applyThemeChoice(choice);') < index(theme, "capturePostHogEvent('theme_changed', { theme: choice });"));
  const width = component('ContentLayoutToggle.astro');
  assert.ok(index(width, 'setContentWidth(button.dataset.hagilightContentWidthChoice, root);') < index(width, "capturePostHogEvent('content_width_changed'"));
});

test('the article promotion card observes impressions from the PostHog script, in production only', () => {
  // ArticlePromotion keeps its single script (the Microsoft badge loader); the observer is installed centrally.
  assert.equal([...component('ArticlePromotion.astro').matchAll(/<script\b/gu)].length, 1);
  const source = readFileSync(new URL('../packages/core/PostHog.astro', import.meta.url), 'utf8');
  assert.match(source, /const installPostHogListeners = \(\) => \{[\s\S]*installPromotionImpression\(\);[\s\S]*\};/u);
  assert.match(source, /if \(import\.meta\.env\.PROD\) \{/u);
  assert.match(source, /installPostHogListeners\);/u);
});
