import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
  buildOrganizationStructuredData,
  composeCanonicalSeoHead,
  isValidSeoImageReference,
  resolveCanonicalUrl,
  resolveSeoImageUrl,
  resolveSeoMetadata,
  serializeJsonLd,
} from '@hagicode/hagilight-core/seo';
import { seoSchema } from '@hagicode/hagilight-core/seo-schema';

test('core SEO utilities and schema import without Starlight dependencies', async () => {
  const [core, astro] = await Promise.all(['core', 'astro'].map(async (directory) =>
    JSON.parse(await readFile(new URL(`../packages/${directory}/package.json`, import.meta.url), 'utf8'))));
  assert.equal(astro.exports['./SEOHead'], './SEOHead.astro');
  assert.deepEqual(core.exports['./seo'], { types: './dist/seo.d.ts', default: './dist/seo.js' });
  assert.equal(core.dependencies?.['@astrojs/starlight'], undefined);
  assert.equal(core.peerDependencies?.['@astrojs/starlight'], undefined);
  assert.deepEqual(seoSchema.parse({ seo: { title: '  Share title  ', image: '/social.svg' } }), {
    seo: { title: 'Share title', image: '/social.svg' },
  });
});

test('resolves absolute canonical URLs without query or fragment and handles base-aware images', () => {
  assert.equal(
    resolveCanonicalUrl('https://docs.example.test/manual/guide/?q=private#details', {
      site: 'https://docs.example.test',
    }),
    'https://docs.example.test/manual/guide/',
  );
  assert.equal(
    resolveSeoImageUrl('/social.svg', {
      site: 'https://docs.example.test',
      basePath: '/manual/',
    }),
    'https://docs.example.test/manual/social.svg',
  );
  assert.equal(
    resolveSeoImageUrl('https://cdn.example.test/card.png', {
      site: 'https://docs.example.test',
      basePath: '/manual/',
    }),
    'https://cdn.example.test/card.png',
  );
  assert.equal(isValidSeoImageReference('//other.example/card.png'), false);
  assert.equal(isValidSeoImageReference('javascript:alert(1)'), false);
  assert.throws(() => resolveCanonicalUrl('/guide/', { site: 'https://docs.example.test' }), /page URL must be an absolute/);
  assert.throws(() => resolveCanonicalUrl('https://docs.example.test/', { site: '/relative' }), /site must be an absolute/);
  assert.throws(() => resolveSeoImageUrl('relative.png', { site: 'https://docs.example.test' }), /image must be/);
  assert.throws(() => seoSchema.parse({ seo: { image: 'javascript:alert(1)' } }));
});

test('uses page metadata over site defaults and preserves consumer-owned head entries', () => {
  const consumerTitle = {
    tag: 'meta',
    attrs: { property: 'og:title', content: 'Consumer title' },
  };
  const customCanonical = {
    tag: 'link',
    attrs: { rel: 'canonical', href: 'https://docs.example.test/manual/page/?tracking=1#section' },
  };
  const unrelated = { tag: 'link', attrs: { rel: 'stylesheet', href: '/site.css' } };
  const metadata = resolveSeoMetadata({
    pageSeo: { title: 'Page title', description: 'Page description' },
    siteSeo: { title: 'Site title', description: 'Site description', image: '/default.svg' },
    site: 'https://docs.example.test',
    basePath: '/manual/',
  });
  assert.deepEqual(metadata, {
    title: 'Page title',
    description: 'Page description',
    image: 'https://docs.example.test/manual/default.svg',
  });

  const head = composeCanonicalSeoHead([consumerTitle, customCanonical, unrelated], {
    ...metadata,
    site: 'https://docs.example.test',
  }, {
    canonicalUrl: 'https://docs.example.test/manual/page/?query=1',
    explicitHead: [[consumerTitle, customCanonical, unrelated]],
  });
  assert.equal(head.filter(({ tag, attrs }) => tag === 'link' && attrs.rel === 'canonical').length, 1);
  assert.equal(head.find(({ tag, attrs }) => tag === 'link' && attrs.rel === 'canonical').attrs.href,
    'https://docs.example.test/manual/page/');
  assert.equal(head.find(({ attrs }) => attrs?.property === 'og:title'), consumerTitle);
  assert.equal(head.filter(({ attrs }) => attrs?.property === 'og:title').length, 1);
  assert.equal(head.find(({ attrs }) => attrs?.property === 'og:description').attrs.content, 'Page description');
  assert.equal(head.find(({ attrs }) => attrs?.name === 'twitter:title').attrs.content, 'Page title');
  assert.equal(head.find(({ attrs }) => attrs?.name === 'twitter:image').attrs.content,
    'https://docs.example.test/manual/default.svg');
  assert.equal(head.includes(unrelated), true);
});

test('structured-data builders include only supplied facts and safely serialize JSON-LD', () => {
  const sparseArticle = buildArticleStructuredData({
    url: 'https://docs.example.test/article/',
    title: 'Example article',
  });
  assert.equal(sparseArticle['@type'], 'Article');
  assert.equal('author' in sparseArticle, false);
  assert.equal('datePublished' in sparseArticle, false);
  assert.equal('dateModified' in sparseArticle, false);

  const article = buildArticleStructuredData({
    url: 'https://docs.example.test/article/',
    title: ' Example article ',
    description: ' A useful summary ',
    author: ' Example author ',
    publishedDate: new Date('2026-09-25T00:00:00.000Z'),
  });
  assert.equal(article.headline, 'Example article');
  assert.equal(article.description, 'A useful summary');
  assert.equal(article.author.name, 'Example author');
  assert.equal(article.datePublished, '2026-09-25T00:00:00.000Z');
  assert.equal('dateModified' in article, false);

  assert.deepEqual(buildBreadcrumbStructuredData([
    { name: 'Home', url: 'https://docs.example.test/' },
    { name: 'Article', url: 'https://docs.example.test/article/' },
  ]).itemListElement.map(({ name, position }) => [position, name]), [[1, 'Home'], [2, 'Article']]);
  assert.equal(buildOrganizationStructuredData({
    name: 'Example',
    url: 'https://docs.example.test/',
  }).logo, undefined);

  const serialized = serializeJsonLd({ text: '</script><script>alert(1)</script>' });
  assert.equal(JSON.parse(serialized).text, '</script><script>alert(1)</script>');
  assert.doesNotMatch(serialized, /<\/script/iu);
});
