import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  DEFAULT_WINDOWS_STORE_PRODUCT_ID,
  resolveMicrosoftStoreBadgeLanguage,
  resolveMicrosoftStoreProductId,
} from '../packages/starlight/dist/windows-download.js';

test('Microsoft Store product id comes from the listing URL', () => {
  assert.equal(DEFAULT_WINDOWS_STORE_PRODUCT_ID, '9N3PM0N3SVDW');
  assert.equal(resolveMicrosoftStoreProductId('https://apps.microsoft.com/detail/9N3PM0N3SVDW'), '9N3PM0N3SVDW');
  assert.equal(resolveMicrosoftStoreProductId('https://apps.microsoft.com/store/detail/9n3pm0n3svdw?hl=en-us'), '9N3PM0N3SVDW');
  assert.equal(resolveMicrosoftStoreProductId('https://apps.microsoft.com/detail/abc123/'), 'ABC123');
  assert.equal(resolveMicrosoftStoreProductId(''), '9N3PM0N3SVDW');
  assert.equal(resolveMicrosoftStoreProductId(undefined), '9N3PM0N3SVDW');
  assert.equal(resolveMicrosoftStoreProductId('https://example.com/not-a-store-url'), '9N3PM0N3SVDW');
});

test('badge language follows the page locale and defaults to English', () => {
  const expected = {
    'en-US': 'en-us',
    'zh-CN': 'zh-cn',
    'zh-Hant': 'zh-tw',
    'ja-JP': 'ja',
    'ko-KR': 'ko',
    'de-DE': 'de',
    'fr-FR': 'fr',
    'es-ES': 'es',
    'pt-BR': 'pt-br',
    'ru-RU': 'ru',
  };
  for (const [locale, language] of Object.entries(expected)) {
    assert.equal(resolveMicrosoftStoreBadgeLanguage(locale), language, locale);
  }
  for (const locale of ['it-IT', 'zh', 'EN-us', '', undefined]) {
    assert.equal(resolveMicrosoftStoreBadgeLanguage(locale), 'en-us', String(locale));
  }
});

test('the showcase renders the official badge element with a static fallback link inside it', async () => {
  const component = await readFile(new URL('../packages/starlight/ArticlePromotion.astro', import.meta.url), 'utf8');
  const badge = component.match(/<ms-store-badge\b[\s\S]*?<\/ms-store-badge>/u)?.[0] ?? assert.fail('badge element');
  for (const attribute of [
    'productid={storeProductId}',
    'productname="HagiCode"',
    'window-mode="direct"',
    'theme="auto"',
    'size="large"',
    'animation="on"',
    'language={badgeLanguage}',
    'aria-label={copy.windowsStoreAriaLabel}',
    'title={copy.windowsStoreAriaLabel}',
  ]) {
    assert.ok(badge.includes(attribute), `badge has ${attribute}`);
  }
  assert.match(badge, /<a\b[\s\S]*?href=\{storeHref\}[\s\S]*?>\{copy\.windowsStoreLabel\}<\/a>/u, 'fallback anchor inside the badge');
  assert.match(component, /resolveMicrosoftStoreProductId\(storeHref\)/u);
  assert.match(component, /resolveMicrosoftStoreBadgeLanguage\(lang\)/u);
  assert.match(component, /<a class="hagilight-article-promotion__downloads" href=\{downloadsHref\}>/u);
});
