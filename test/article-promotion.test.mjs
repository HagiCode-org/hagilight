import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { articlePromotionSchema } from '../packages/starlight/article-promotion-schema.mjs';
import {
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

test('article promotion copy is localized when available and falls back to English', () => {
  assert.equal(getArticlePromotionCopy('zh-CN').title, '关于 HagiCode');
  assert.equal(getArticlePromotionCopy('fr-FR').link, 'Découvrir HagiCode');
  assert.equal(getArticlePromotionCopy('it-IT').title, 'About HagiCode');
});

test('article promotion is static, themed, keyboard accessible, and positioned after article notices', async () => {
  const [component, markdownContent] = await Promise.all([
    readFile(new URL('../packages/starlight/ArticlePromotion.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/MarkdownContent.astro', import.meta.url), 'utf8'),
  ]);
  const bodyPosition = markdownContent.indexOf('<DefaultMarkdownContent>');
  const translationPosition = markdownContent.indexOf('{showTranslation &&');
  const promotionPosition = markdownContent.indexOf('{showHagicodePromotion &&');

  assert.match(component, /href="https:\/\/www\.hagicode\.com\/"/);
  assert.match(component, /:focus-visible/);
  assert.match(component, /var\(--sl-color-/);
  assert.doesNotMatch(component, /<script/u);
  assert.ok(bodyPosition >= 0 && translationPosition > bodyPosition);
  assert.ok(promotionPosition > translationPosition);
  assert.match(markdownContent, /const showHagicodePromotion = isDocsEntry\s+&& resolveArticlePromotion/u);
});
