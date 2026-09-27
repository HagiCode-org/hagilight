import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { articlePromotionSchema } from '../packages/starlight/article-promotion-schema.mjs';
import {
  COPY,
  getArticlePromotionCopy,
  resolveArticlePromotion,
} from '../packages/starlight/article-promotion.mjs';

test('article promotion inherits the site default and preserves explicit article overrides', () => {
  assert.equal(resolveArticlePromotion(undefined), true);
  assert.equal(resolveArticlePromotion(undefined, false), false);
  assert.equal(resolveArticlePromotion(true, false), true);
  assert.equal(resolveArticlePromotion(false, true), false);
});

test('article promotion rejects invalid site defaults and frontmatter values', () => {
  assert.throws(() => resolveArticlePromotion(undefined, 'false'), /enabled default must be a boolean/);
  assert.throws(() => resolveArticlePromotion('false', true), /frontmatter hagicodePromotion must be a boolean/);
  assert.throws(() => resolveArticlePromotion(null, true), /frontmatter hagicodePromotion must be a boolean/);
});

test('article promotion schema accepts an optional boolean and rejects other values', () => {
  assert.deepEqual(articlePromotionSchema.parse({}), {});
  assert.deepEqual(articlePromotionSchema.parse({ hagicodePromotion: false }), { hagicodePromotion: false });
  assert.throws(() => articlePromotionSchema.parse({ hagicodePromotion: 'false' }));
});

test('article promotion carries complete copy for all ten locales and falls back to English', () => {
  assert.deepEqual(Object.keys(COPY), [
    'zh-CN',
    'en-US',
    'zh-Hant',
    'ja-JP',
    'ko-KR',
    'de-DE',
    'fr-FR',
    'es-ES',
    'pt-BR',
    'ru-RU',
  ]);
  for (const copy of Object.values(COPY)) {
    assert.ok(copy.title);
    assert.ok(copy.lead);
    assert.ok(copy.subheadline);
    assert.ok(copy.imageAlt);
    assert.equal(copy.features.length, 3);
    assert.ok(copy.visitLabel);
    for (const feature of copy.features) {
      assert.ok(feature.label);
      assert.ok(feature.description);
    }
  }
  assert.equal(getArticlePromotionCopy('zh-CN').lead, COPY['zh-CN'].lead);
  assert.equal(getArticlePromotionCopy('fr-FR').features[1].label, 'Efficient');
  assert.equal(getArticlePromotionCopy('it-IT').title, 'HagiCode');
});

test('article promotion includes original artwork, theme styling, focus, and article-end positioning', async () => {
  const [component, markdownContent, image] = await Promise.all([
    readFile(new URL('../packages/starlight/ArticlePromotion.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/MarkdownContent.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/assets/light-main.png', import.meta.url)),
  ]);
  const bodyPosition = markdownContent.indexOf('<DefaultMarkdownContent>');
  const translationPosition = markdownContent.indexOf('{showTranslation &&');
  const promotionPosition = markdownContent.indexOf('{showHagicodePromotion &&');

  assert.match(component, /href="https:\/\/www\.hagicode\.com\/"/);
  assert.match(component, /heroImage\.src/);
  assert.match(component, /copy\.lead/);
  assert.match(component, /copy\.subheadline/);
  assert.match(component, /copy\.features\.map/);
  assert.match(component, /copy\.imageAlt/);
  assert.match(component, /:focus-visible/);
  assert.match(component, /var\(--sl-color-/);
  assert.doesNotMatch(component, /<script/u);
  assert.ok(image.length > 100_000);
  assert.ok(bodyPosition >= 0 && translationPosition > bodyPosition);
  assert.ok(promotionPosition > translationPosition);
  assert.match(markdownContent, /const showHagicodePromotion = isDocsEntry\s+&& resolveArticlePromotion/u);
});
