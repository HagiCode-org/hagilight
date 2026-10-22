import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
  buildDefaultStructuredData,
  buildOrganizationStructuredData,
  buildWebSiteStructuredData,
  collectStructuredDataTypes,
  composeCanonicalSeoHead,
  composeSocialCardHead,
  isValidSeoImageReference,
  resolveCanonicalUrl,
  resolveSeoImageUrl,
  resolveSeoMetadata,
  serializeJsonLd,
  toOpenGraphLocale,
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

test('canonical SEO URLs never carry campaign parameters from tagged footer links', () => {
  const taggedPage = 'https://docs.example.test/manual/page/?utm_source=docs&utm_medium=footer#section';
  assert.equal(resolveCanonicalUrl(taggedPage, { site: 'https://docs.example.test' }),
    'https://docs.example.test/manual/page/');

  const metadata = resolveSeoMetadata({
    pageSeo: { title: 'Page title', description: 'Page description' },
    site: 'https://docs.example.test',
  });
  const head = composeCanonicalSeoHead([], { ...metadata, site: 'https://docs.example.test' }, {
    canonicalUrl: taggedPage,
  });
  const canonical = head.find(({ tag, attrs }) => tag === 'link' && attrs.rel === 'canonical');
  assert.equal(canonical.attrs.href, 'https://docs.example.test/manual/page/');
  assert.equal(JSON.stringify(head).includes('utm_'), false);
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

test('converts locales to Open Graph form only through unambiguous mappings', () => {
  assert.equal(toOpenGraphLocale('zh-CN'), 'zh_CN');
  assert.equal(toOpenGraphLocale('en_gb'), 'en_GB');
  assert.equal(toOpenGraphLocale('zh-Hant'), 'zh_TW');
  assert.equal(toOpenGraphLocale('zh-Hans'), 'zh_CN');
  assert.equal(toOpenGraphLocale('zh-Hant-HK'), 'zh_HK');
  assert.equal(toOpenGraphLocale('en'), 'en_US');
  assert.equal(toOpenGraphLocale('ja'), 'ja_JP');
  assert.equal(toOpenGraphLocale('fil'), undefined);
  assert.equal(toOpenGraphLocale('sr-Latn'), undefined);
  assert.equal(toOpenGraphLocale('en-029'), undefined);
  assert.equal(toOpenGraphLocale(''), undefined);
  assert.equal(toOpenGraphLocale(undefined), undefined);
});

test('generated card tags carry the canonical URL, type, site name, locale and card kind', () => {
  const existing = { tag: 'meta', attrs: { name: 'description', content: 'Summary' } };
  const card = composeSocialCardHead([existing], {
    url: 'https://docs.example.test/manual/page/',
    siteName: ' Docs Example ',
    locale: 'zh-CN',
    image: 'https://docs.example.test/manual/card.png',
  });
  assert.equal(card[0], existing);
  assert.deepEqual(card.slice(1), [
    { tag: 'meta', attrs: { property: 'og:url', content: 'https://docs.example.test/manual/page/' } },
    { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: 'Docs Example' } },
    { tag: 'meta', attrs: { property: 'og:locale', content: 'zh_CN' } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
  ]);

  const bare = composeSocialCardHead([], { url: 'https://docs.example.test/', type: 'article' });
  assert.deepEqual(bare.map(({ attrs }) => attrs.property ?? attrs.name), ['og:url', 'og:type', 'twitter:card']);
  assert.equal(bare[1].attrs.content, 'article');
  assert.equal(bare[2].attrs.content, 'summary');
});

test('consumer card tags win over generated ones under either attribute', () => {
  const consumer = [
    { tag: 'meta', attrs: { property: 'og:type', content: 'article' } },
    { tag: 'meta', attrs: { name: 'og:url', content: 'https://docs.example.test/custom/' } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: 'Consumer name' } },
    { tag: 'meta', attrs: { property: 'og:locale', content: 'fr_FR' } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary' } },
  ];
  const card = {
    url: 'https://docs.example.test/manual/page/',
    siteName: 'Site',
    locale: 'en-US',
    image: 'https://docs.example.test/manual/card.png',
  };
  assert.deepEqual(composeSocialCardHead(consumer, card), consumer);
  assert.deepEqual(composeSocialCardHead([], card, [consumer]), []);

  const partial = composeSocialCardHead([{ tag: 'meta', attrs: { name: 'og:type', content: 'article' } }], {
    url: 'https://docs.example.test/manual/page/',
    type: 'website',
  });
  assert.deepEqual(partial.filter(({ attrs }) => attrs.property === 'og:type' || attrs.name === 'og:type')
    .map(({ attrs }) => attrs.content), ['article']);
  assert.equal(partial.filter(({ attrs }) => attrs.property === 'og:url').length, 1);
});

test('default WebSite and Organization blocks are built from the site and skip declared types', () => {
  assert.deepEqual(buildWebSiteStructuredData({
    name: ' Docs Example ',
    url: 'https://docs.example.test',
    basePath: '/manual/',
  }), {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://docs.example.test/manual/#website',
    name: 'Docs Example',
    url: 'https://docs.example.test/manual/',
  });

  const both = buildDefaultStructuredData({ siteName: 'Example Docs', site: 'https://docs.example.test/' });
  assert.deepEqual(both.map(({ '@type': type }) => type), ['WebSite', 'Organization']);
  assert.deepEqual(both[1], {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Example Docs',
    url: 'https://docs.example.test/',
  });

  const consumerWebsite = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Consumer' };
  assert.deepEqual(
    buildDefaultStructuredData({ siteName: 'Example Docs', site: 'https://docs.example.test/', structuredData: consumerWebsite })
      .map(({ '@type': type }) => type),
    ['Organization'],
  );

  const headScripts = [
    { tag: 'script', attrs: { type: 'application/ld+json' }, content: '{"@type":"WebSite"}' },
    { tag: 'script', attrs: { type: 'application/ld+json' }, content: '{"@graph":[{"@type":"Organization"}]}' },
  ];
  assert.deepEqual(buildDefaultStructuredData({
    siteName: 'Example Docs',
    site: 'https://docs.example.test/',
    head: headScripts,
  }), []);

  const unreadable = [{ tag: 'script', attrs: { type: 'application/ld+json' }, content: '{not json' }];
  assert.deepEqual(
    buildDefaultStructuredData({ siteName: 'Example Docs', site: 'https://docs.example.test/', head: unreadable })
      .map(({ '@type': type }) => type),
    ['WebSite', 'Organization'],
  );

  assert.deepEqual([...collectStructuredDataTypes({ '@graph': [{ '@type': 'Organization' }] })], ['Organization']);
  assert.equal(collectStructuredDataTypes({
    '@type': 'WebApplication',
    publisher: { '@type': 'Organization' },
  }).has('Organization'), false);
});

test('default structured data honors the organization override and survives hostile titles', () => {
  const overridden = buildDefaultStructuredData({
    siteName: 'Example Docs',
    site: 'https://docs.example.test/',
    organization: {
      name: 'Example Labs',
      logo: 'https://docs.example.test/logo.png',
      alternateName: 'EL',
    },
  });
  assert.equal(overridden[1].name, 'Example Labs');
  assert.equal(overridden[1].logo, 'https://docs.example.test/logo.png');
  assert.equal(overridden[1].alternateName, 'EL');

  assert.deepEqual(buildDefaultStructuredData({ site: 'https://docs.example.test/' }), []);
  assert.deepEqual(buildDefaultStructuredData({ siteName: 'Example Docs' }), []);
  assert.deepEqual(buildDefaultStructuredData({
    siteName: 'Example Docs',
    site: 'https://docs.example.test/',
    enabled: false,
  }), []);

  const hostile = buildDefaultStructuredData({
    siteName: 'Docs </script><script>alert(1)</script>',
    site: 'https://docs.example.test/',
  });
  const serialized = serializeJsonLd(hostile[0]);
  assert.doesNotMatch(serialized, /<\/script/iu);
  assert.equal(JSON.parse(serialized).name, 'Docs </script><script>alert(1)</script>');
});
