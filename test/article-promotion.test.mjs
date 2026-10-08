import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { articlePromotionSchema } from '@hagicode/hagilight-starlight/schema';
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';
import { getShowcaseCopy, showcaseLocales } from '@hagicode/hagilight-starlight/showcase';
import {
  COPY,
  getArticlePromotionCopy,
  resolveArticlePromotion,
} from '../packages/starlight/dist/article-promotion.js';
import { GLOSSARY } from '../packages/starlight/dist/article-promotion-copy/index.js';

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

const LOCALES = ['zh-CN', 'en-US', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];
const SHARE_URL = 'https://www.hagicode.com/';

function collectStrings(value, path = []) {
  if (typeof value === 'string') return [[path.join('.'), value]];
  if (Array.isArray(value)) return value.flatMap((entry, index) => collectStrings(entry, [...path, index]));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => collectStrings(entry, [...path, key]));
  }
  return [];
}

/** Reader-visible strings: everything except the identifier fields. */
function visibleStrings(copy) {
  return collectStrings(copy).filter(([field]) => !field.endsWith('.id'));
}

function isDeepFrozen(value) {
  return !value || typeof value !== 'object'
    || (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));
}

test('showcase copy covers all ten locales with identical structure and no empty field', () => {
  assert.deepEqual(Object.keys(COPY), LOCALES);
  const english = COPY['en-US'];
  for (const [locale, copy] of Object.entries(COPY)) {
    const fields = collectStrings(copy);
    for (const [field, text] of fields) assert.ok(text.trim(), `${locale} ${field} is empty`);
    assert.deepEqual(
      Object.keys(copy).sort(),
      Object.keys(english).sort(),
      `${locale} has the same fields as the English copy`,
    );
    assert.deepEqual(copy.features.map(({ id }) => id), ['smart', 'efficient', 'fun'], `${locale} feature ids`);
    assert.deepEqual(
      copy.gallery.map(({ id }) => id),
      english.gallery.map(({ id }) => id),
      `${locale} gallery ids`,
    );
    assert.equal(copy.imageAlt, copy.gallery[0].alt, `${locale} lead image alt`);
    assert.equal(copy.title, 'HagiCode');
  }
});

test('showcase copy keeps brand and product terms untranslated in every locale', () => {
  for (const [locale, copy] of Object.entries(COPY)) {
    for (const term of ['HagiCode', 'OpenSpec', 'Hero Dungeon']) {
      assert.ok(copy.lead.includes(term), `${locale} lead names ${term}`);
    }
    assert.ok(copy.features[0].description.includes('OpenSpec'), `${locale} smart card names OpenSpec`);
    assert.ok(copy.features[2].description.includes('Hero Dungeon'), `${locale} fun card names Hero Dungeon`);
    assert.ok(copy.windowsLabel.includes('Windows'), `${locale} Windows label`);
    assert.ok(copy.windowsStoreLabel.includes('Microsoft Store'), `${locale} Store fallback label`);
    assert.ok(copy.windowsStoreAriaLabel.includes('Microsoft Store'), `${locale} Store accessible name`);
    assert.ok(copy.windowsStoreAriaLabel.includes('HagiCode'), `${locale} Store accessible name names the product`);
    for (const [field, text] of visibleStrings(copy)) {
      assert.doesNotMatch(text, /PCode|Steam/iu, `${locale} ${field} mentions a superseded term`);
    }
  }
});

test('showcase copy follows the per-locale glossary', () => {
  assert.deepEqual(Object.keys(GLOSSARY), LOCALES);
  const englishLabels = COPY['en-US'].features.map(({ label }) => label);
  for (const [locale, copy] of Object.entries(COPY)) {
    const glossary = GLOSSARY[locale];
    const includes = (text, term) => text.toLowerCase().includes(term.toLowerCase());
    assert.deepEqual(
      copy.features.map(({ label }) => label),
      [glossary.pillars.smart, glossary.pillars.efficient, glossary.pillars.fun],
      `${locale} pillar labels`,
    );
    assert.ok(includes(copy.lead, glossary.multiAgent), `${locale} lead uses the multi-agent term`);
    assert.ok(includes(copy.features[1].description, glossary.multiAgent), `${locale} efficient card uses the multi-agent term`);
    assert.ok(includes(copy.lead, glossary.workflow), `${locale} lead uses the workflow term`);
    assert.ok(includes(copy.features[0].description, glossary.workflow), `${locale} smart card uses the workflow term`);
    assert.ok(includes(copy.docsLabel, glossary.documentation), `${locale} docs label uses the documentation term`);
    assert.ok(includes(copy.shareText, glossary.multiAgent), `${locale} share text uses the multi-agent term`);
    for (const [field, text] of visibleStrings(copy)) {
      for (const variant of glossary.avoid) {
        assert.ok(!includes(text, variant), `${locale} ${field} uses the avoided variant ${variant}`);
      }
    }
    if (locale !== 'en-US') {
      copy.features.forEach(({ label }, index) => {
        if (label === englishLabels[index]) {
          assert.equal(glossary.pillars[copy.features[index].id], label, `${locale} English pillar word is glossary-approved`);
        }
      });
    }
  }
  for (const locale of LOCALES.filter((entry) => entry !== 'en-US')) {
    assert.notDeepEqual(
      COPY[locale].features.map(({ label }) => label),
      COPY['en-US'].features.map(({ label }) => label),
      `${locale} localizes the pillar labels`,
    );
  }
});

test('share text is one plain-text line that ends with the website address', () => {
  for (const [locale, copy] of Object.entries(COPY)) {
    assert.ok(copy.shareText.endsWith(SHARE_URL), `${locale} share text ends with the site URL`);
    assert.ok(copy.shareText.includes('HagiCode'), `${locale} share text names the product`);
    assert.doesNotMatch(copy.shareText, /[<>`*\[\]\p{Cc}\p{Cf}]/u, `${locale} share text has no markup or control characters`);
    assert.equal(copy.shareText, copy.shareText.trim());
  }
});

test('showcase copy falls back to English and cannot be mutated', () => {
  assert.equal(getArticlePromotionCopy('zh-CN').lead, COPY['zh-CN'].lead);
  assert.equal(getArticlePromotionCopy('fr-FR').features[1].label, 'Efficace');
  assert.equal(getArticlePromotionCopy('it-IT'), COPY['en-US']);
  assert.equal(getArticlePromotionCopy(undefined), COPY['en-US']);
  assert.equal(getArticlePromotionCopy(''), COPY['en-US']);

  assert.ok(isDeepFrozen(COPY), 'the catalog is deeply frozen');
  const japanese = getArticlePromotionCopy('ja-JP');
  const original = japanese.lead;
  assert.throws(() => { japanese.lead = 'changed'; }, TypeError);
  assert.throws(() => { japanese.features[0].label = 'changed'; }, TypeError);
  assert.throws(() => { japanese.gallery.push({ id: 'x', caption: 'x', alt: 'x' }); }, TypeError);
  assert.throws(() => { COPY['ja-JP'] = COPY['en-US']; }, TypeError);
  assert.equal(getArticlePromotionCopy('ja-JP').lead, original);
});

test('the public showcase entry returns the same read-only copy', () => {
  assert.deepEqual([...showcaseLocales], LOCALES);
  assert.ok(Object.isFrozen(showcaseLocales));
  const japanese = getShowcaseCopy('ja-JP');
  assert.equal(japanese, COPY['ja-JP']);
  assert.ok(japanese.shareText.endsWith(SHARE_URL));
  assert.equal(getShowcaseCopy('it-IT'), COPY['en-US']);
  assert.equal(getShowcaseCopy(undefined), COPY['en-US']);
});

test('every showcase locale resolves the links the component needs from core', () => {
  for (const locale of LOCALES) {
    const links = resolveSiteLinks(locale);
    const byId = new Map([...links.header, ...links.quick].map((link) => [link.id, link.href]));
    for (const id of ['home', 'productDocs', 'microsoftStore', 'downloadClient']) {
      assert.match(byId.get(id) ?? '', /^https:\/\//u, `${locale} resolves ${id}`);
    }
    assert.match(byId.get('microsoftStore'), /\/detail\/9N3PM0N3SVDW$/u);
  }
});

test('article promotion renders a themed, accessible showcase after the article body', async () => {
  const [component, markdownContent, floatingBanner] = await Promise.all([
    readFile(new URL('../packages/starlight/ArticlePromotion.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/MarkdownContent.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/core/PromotoBanner.astro', import.meta.url), 'utf8'),
  ]);
  const bodyPosition = markdownContent.indexOf('<DefaultMarkdownContent>');
  const translationPosition = markdownContent.indexOf('{showTranslation &&');
  const promotionPosition = markdownContent.indexOf('{showHagicodePromotion &&');

  // Calls to action resolve through core's locale-aware links, with fixed fallbacks.
  assert.doesNotMatch(component, /href="https:\/\/www\.hagicode\.com\/"/);
  assert.match(component, /resolveSiteLinks\(lang\)/);
  for (const [id, fallback] of [
    ['home', 'https://www.hagicode.com/'],
    ['productDocs', 'https://docs.hagicode.com/'],
    ['microsoftStore', 'https://apps.microsoft.com/detail/9N3PM0N3SVDW'],
    ['downloadClient', 'https://www.hagicode.com/'],
  ]) {
    assert.ok(component.includes(`linkHref('${id}', '${fallback}')`), `${id} link with fallback`);
  }
  assert.match(component, /href=\{homeHref\}/);
  assert.match(component, /href=\{docsHref\}/);

  // Copy, gallery images, and localized text alternatives.
  for (const field of [
    'copy.lead', 'copy.subheadline', 'copy.features.map', 'copy.visitLabel', 'copy.docsLabel',
    'copy.galleryHeading', 'copy.windowsLabel', 'copy.windowsStoreLabel', 'copy.windowsStoreAriaLabel',
    'copy.allDownloadsLabel', 'copy.shareLabel', 'copy.shareText', 'copy.gallery.flatMap',
  ]) {
    assert.ok(component.includes(field), `component renders ${field}`);
  }
  assert.match(component, /alt=\{item\.alt\}/);
  assert.match(component, /<figcaption[^>]*>\{item\.caption\}<\/figcaption>/);
  assert.match(component, /import \{ Image \} from 'astro:assets'/);
  assert.match(component, /width=\{item\.image\.width\}/);
  assert.match(component, /height=\{item\.image\.height\}/);
  assert.match(component, /widths=\{\[480, 800, item\.image\.width\]\}/);
  assert.match(component, /sizes=/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /decoding="async"/);
  assert.match(component, /fetchpriority="low"/);
  assert.doesNotMatch(component, /light-main/);

  // Accessibility, theming, and responsive layout.
  assert.match(component, /aria-labelledby="hagilight-article-promotion-title"/);
  assert.match(component, /<h2 id="hagilight-article-promotion-title"/);
  assert.match(component, /:focus-visible/);
  assert.match(component, /var\(--sl-color-/);
  assert.doesNotMatch(component.match(/<style>[\s\S]*<\/style>/u)[0], /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu, 'no hard-coded colors');
  assert.match(component, /min-height: 2\.75rem/);
  assert.match(component, /@media \(max-width: 30rem\)/);
  assert.match(component, /user-select: all/);

  // Placement and script policy.
  assert.ok(bodyPosition >= 0 && translationPosition > bodyPosition);
  assert.ok(promotionPosition > translationPosition);
  assert.match(markdownContent, /const showHagicodePromotion = isDocsEntry\s+&& resolveArticlePromotion/u);
  const scripts = [...component.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gu)].map(([script]) => script);
  assert.equal(scripts.length, 1, 'the only script is the Microsoft badge loader');
  assert.match(scripts[0], /^<script type="module" src="https:\/\/get\.microsoft\.com\/badge\/ms-store-badge\.bundled\.js" is:inline><\/script>$/u);
  assert.doesNotMatch(component, /set:html/u);
  assert.match(floatingBanner, /class="hagilight-promoto__shell"[^>]*hidden/);
  assert.match(floatingBanner, /\.hagilight-promoto__shell\s*\{[\s\S]*?position:\s*fixed/u);
  assert.match(floatingBanner, /\.hagilight-promoto__shell\[hidden\][\s\S]*?display:\s*none/u);
});
