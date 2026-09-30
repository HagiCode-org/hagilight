import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  composeSeoHead,
  extractSeoDescription,
  isValidSeoImageReference,
  resolveSeoImageUrl,
  resolveSeoMetadata,
  serializeJsonLd,
} from '@hagicode/hagilight-core/seo';
import { seoSchema } from '@hagicode/hagilight-core/seo-schema';
import {
  buildDocsPageUrl,
  buildStructuredData,
  createPublishedDocsLookup,
  filterPublishedLocaleAlternates,
  resolveSeoLocales,
  resolveSeoPage,
} from '../packages/starlight/dist/seo-utils.js';

const locales = resolveSeoLocales({
  root: { lang: 'zh-CN' },
  'en-us': { lang: 'en-US' },
  'zh-Hant': { lang: 'zh-Hant' },
  'fr-FR': { lang: 'fr-FR' },
});

function doc(id, data = {}) {
  return { id, data: { title: id, ...data } };
}

function alternate(lang, route, slug = 'guide/start') {
  const suffix = slug ? `${route === 'root' ? '' : `${route}/`}${slug}/` : '';
  return {
    tag: 'link',
    attrs: {
      rel: 'alternate',
      hreflang: lang,
      href: `https://docs.example.test/manual/${suffix}`,
    },
  };
}

test('validates unique locale language tags and maps non-English root routes', () => {
  assert.equal(resolveSeoPage('guide/index', locales).slug, 'guide');
  assert.deepEqual(resolveSeoPage('zh-Hant/guide/start', locales), {
    route: 'zh-Hant',
    slug: 'guide/start',
  });
  assert.throws(
    () => resolveSeoLocales({ root: { lang: 'en-us' }, 'en-US': { lang: 'en-US' } }),
    /same language tag/,
  );
  assert.throws(
    () => resolveSeoLocales({ root: { lang: 'not a language tag' } }),
    /invalid language tag/,
  );
});

test('looks up only published localized docs and ignores drafts', () => {
  const lookup = createPublishedDocsLookup([
    doc('guide/start'),
    doc('en-us/guide/start'),
    doc('fr-FR/guide/start', { draft: true }),
  ], locales);

  assert.equal(lookup.has('root', 'guide/start'), true);
  assert.equal(lookup.has('en-us', 'guide/start'), true);
  assert.equal(lookup.has('fr-FR', 'guide/start'), false);
  assert.equal(lookup.get('root', 'guide/start').data.title, 'guide/start');
});

test('filters only missing locale alternates, retaining canonical, RSS and unrelated links', () => {
  const lookup = createPublishedDocsLookup([
    doc('guide/start'),
    doc('en-us/guide/start'),
    doc('en-us/guide/draft', { draft: true }),
  ], locales);
  const head = [
    { tag: 'link', attrs: { rel: 'canonical', href: 'https://docs.example.test/manual/guide/start/' } },
    alternate('zh-CN', 'root'),
    alternate('en-US', 'en-us'),
    alternate('zh-Hant', 'zh-Hant'),
    alternate('fr-FR', 'fr-FR'),
    alternate('x-default', 'en-us'),
    { tag: 'link', attrs: { rel: 'alternate', type: 'application/rss+xml', href: '/rss.xml' } },
    { tag: 'meta', attrs: { name: 'description', content: 'Guide' } },
  ];
  const filtered = filterPublishedLocaleAlternates(head, {
    entryId: 'guide/start',
    locales,
    lookup,
    basePath: '/manual/',
  });

  assert.deepEqual(filtered, [
    head[0],
    head[1],
    head[2],
    head[5],
    head[6],
    head[7],
  ]);
});

test('keeps alternate sets reciprocal, including x-default only when the default page exists', () => {
  const lookup = createPublishedDocsLookup([
    doc('guide/start'),
    doc('en-us/guide/start'),
  ], locales);
  const rootHead = [alternate('zh-CN', 'root'), alternate('en-US', 'en-us'), alternate('x-default', 'en-us')];
  const englishHead = [alternate('zh-CN', 'root'), alternate('en-US', 'en-us'), alternate('x-default', 'en-us')];
  const rootLinks = filterPublishedLocaleAlternates(rootHead, {
    entryId: 'guide/start', locales, lookup, basePath: '/manual/',
  }).map(({ attrs }) => [attrs.hreflang, attrs.href]);
  const englishLinks = filterPublishedLocaleAlternates(englishHead, {
    entryId: 'en-us/guide/start', locales, lookup, basePath: '/manual/',
  }).map(({ attrs }) => [attrs.hreflang, attrs.href]);

  assert.deepEqual(rootLinks, englishLinks);
  const onlyChinese = createPublishedDocsLookup([doc('guide/start')], locales);
  const noDefault = filterPublishedLocaleAlternates([
    alternate('zh-CN', 'root'),
    alternate('en-US', 'en-us'),
    alternate('x-default', 'en-us'),
  ], {
    entryId: 'guide/start',
    locales,
    lookup: onlyChinese,
    basePath: '/manual/',
  });
  assert.deepEqual(noDefault.map(({ attrs }) => attrs.hreflang), ['zh-CN']);
});

test('preserves consumer-owned alternate links even when their locale lacks a local page', () => {
  const consumer = {
    tag: 'link',
    attrs: { rel: 'alternate', hreflang: 'fr-FR', href: 'https://archive.example.test/start/' },
  };
  const lookup = createPublishedDocsLookup([doc('guide/start')], locales);
  const filtered = filterPublishedLocaleAlternates([
    consumer,
    alternate('fr-FR', 'fr-FR'),
  ], {
    entryId: 'guide/start',
    locales,
    lookup,
    basePath: '/manual/',
    explicitHead: [[consumer]],
  });

  assert.deepEqual(filtered, [consumer]);
});

test('resolves canonical base-aware URLs for localized routes and build formats', () => {
  assert.equal(
    buildDocsPageUrl('root', 'guide/start', {
      site: 'https://docs.example.test',
      basePath: '/manual/',
      trailingSlash: 'never',
    }),
    'https://docs.example.test/manual/guide/start',
  );
  assert.equal(
    buildDocsPageUrl('zh-Hant', '', {
      site: 'https://docs.example.test',
      basePath: '/manual/',
      format: 'file',
    }),
    'https://docs.example.test/manual/zh-Hant.html',
  );
  assert.equal(
    buildDocsPageUrl('root', '', {
      site: 'https://docs.example.test',
      format: 'file',
    }),
    'https://docs.example.test/index.html',
  );
});

test('validates optional page sharing fields and resolves page values ahead of site defaults', () => {
  assert.deepEqual(seoSchema.parse({ seo: { title: '  Sharing title  ', image: '/social.svg' } }), {
    seo: { title: 'Sharing title', image: '/social.svg' },
  });
  assert.throws(() => seoSchema.parse({ seo: { title: '' } }));
  assert.throws(() => seoSchema.parse({ seo: { image: 'javascript:alert(1)' } }));
  assert.throws(() => seoSchema.parse({ seo: { description: 42 } }));
  assert.equal(isValidSeoImageReference('/social.svg'), true);
  assert.equal(isValidSeoImageReference('//other.test/social.svg'), false);
  assert.equal(isValidSeoImageReference('data:image/png;base64,abc'), false);
  assert.equal(
    resolveSeoImageUrl('/social.svg', { site: 'https://docs.example.test', basePath: '/manual/' }),
    'https://docs.example.test/manual/social.svg',
  );
  assert.equal(
    resolveSeoImageUrl('https://cdn.example.test/card.png', {
      site: 'https://docs.example.test',
      basePath: '/manual/',
    }),
    'https://cdn.example.test/card.png',
  );

  const metadata = resolveSeoMetadata({
    entry: doc('guide/start', { title: 'Visible title', description: 'Page summary' }),
    head: [],
    pageSeo: { title: 'Share title', description: 'Share summary', image: '/social.svg' },
    siteSeo: { title: 'Site title', description: 'Site summary', image: '/default.svg' },
    site: 'https://docs.example.test',
    basePath: '/manual/',
  });
  assert.deepEqual(metadata, {
    title: 'Share title',
    description: 'Share summary',
    image: 'https://docs.example.test/manual/social.svg',
  });
});

test('uses the page description, then a clean truncated body excerpt, before shared defaults', () => {
  const body = `# Install

This guide explains **desktop installation** with [official packages](https://example.test). Use \`astro build\` after setup.

\`\`\`sh
npm install
\`\`\`
`;
  assert.equal(
    extractSeoDescription(body),
    'Install This guide explains desktop installation with official packages. Use astro build after setup.',
  );
  assert.equal(extractSeoDescription(''), undefined);
  const truncated = extractSeoDescription('x '.repeat(100));
  assert.ok(truncated.length <= 160);
  assert.ok(truncated.endsWith('…'));

  const extracted = resolveSeoMetadata({
    entry: doc('guide/install', { title: 'Install guide' }),
    head: [{ tag: 'meta', attrs: { name: 'description', content: 'Generic Starlight description' } }],
    siteSeo: { description: 'Generic site SEO description' },
    body,
  });
  assert.equal(
    extracted.description,
    'Install This guide explains desktop installation with official packages. Use astro build after setup.',
  );

  const frontmatter = resolveSeoMetadata({
    entry: doc('guide/install', { title: 'Install guide', description: 'Frontmatter summary' }),
    head: [],
    body,
  });
  assert.equal(frontmatter.description, 'Frontmatter summary');
});

test('composes unique share metadata while preserving explicit head and RSS entries', () => {
  const explicit = { tag: 'meta', attrs: { property: 'og:title', content: 'Consumer title' } };
  const rss = { tag: 'link', attrs: { rel: 'alternate', type: 'application/rss+xml', href: '/rss.xml' } };
  const head = [
    explicit,
    { tag: 'meta', attrs: { property: 'og:description', content: 'Starlight description' } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
    rss,
  ];
  const output = composeSeoHead(head, {
    title: 'SEO title',
    description: 'SEO description',
    image: 'https://docs.example.test/manual/social.svg',
  }, [[explicit]]);

  assert.equal(output.filter(({ tag, attrs }) => tag === 'meta' && attrs.property === 'og:title').length, 1);
  assert.equal(output.find(({ attrs }) => attrs.property === 'og:title'), explicit);
  assert.equal(output.find(({ attrs }) => attrs.property === 'og:description').attrs.content, 'SEO description');
  assert.equal(output.filter(({ attrs }) => attrs.name === 'twitter:title').length, 1);
  assert.equal(output.find(({ attrs }) => attrs.name === 'twitter:image').attrs.content, 'https://docs.example.test/manual/social.svg');
  assert.equal(output.find(({ attrs }) => attrs.name === 'twitter:card').attrs.content, 'summary_large_image');
  assert.equal(output.find(({ tag }) => tag === 'link'), rss);

  const withoutImage = composeSeoHead([], { title: 'Title', description: 'Description' });
  assert.equal(withoutImage.some(({ attrs }) => attrs?.property === 'og:image'), false);
  assert.equal(withoutImage.some(({ attrs }) => attrs?.name === 'twitter:image'), false);
});

test('creates article, breadcrumbs, and home-only organization data from available facts', () => {
  const entries = [
    doc('', { title: 'Home' }),
    doc('guide', { title: 'Guides' }),
    doc('blog/post', {
      title: 'Published post',
      lastUpdated: new Date('2026-09-25T00:00:00.000Z'),
    }),
    doc('blog/index', { title: 'Blog listing' }),
    doc('zh-CN/blog/post', { title: '本地化文章' }),
  ];
  const lookup = createPublishedDocsLookup(entries, locales);
  const article = buildStructuredData({
    entry: entries[2],
    entryId: 'blog/post',
    canonicalUrl: 'https://docs.example.test/manual/blog/post/',
    site: 'https://docs.example.test',
    siteTitle: 'Example docs',
    pageSeo: { description: 'Article summary', author: 'A. Author', publishedDate: new Date('2026-09-20') },
    organization: { name: 'Example', url: 'https://docs.example.test/' },
    locales,
    defaultLocale: 'root',
    lookup,
    basePath: '/manual/',
  });

  assert.deepEqual(article.map(({ '@type': type }) => type), ['Article', 'BreadcrumbList']);
  assert.equal(article[0].datePublished, '2026-09-20T00:00:00.000Z');
  assert.equal(article[0].dateModified, '2026-09-25T00:00:00.000Z');
  assert.deepEqual(article[0].author, { '@type': 'Person', name: 'A. Author' });
  assert.deepEqual(article[1].itemListElement.map(({ name, item }) => [name, item]), [
    ['Home', 'https://docs.example.test/manual/'],
    ['Blog listing', 'https://docs.example.test/manual/blog/'],
    ['Published post', 'https://docs.example.test/manual/blog/post/'],
  ]);

  const listing = buildStructuredData({
    entry: entries[3],
    entryId: 'blog/index',
    canonicalUrl: 'https://docs.example.test/manual/blog/',
    site: 'https://docs.example.test',
    locales,
    lookup,
  });
  assert.deepEqual(listing.map(({ '@type': type }) => type), ['BreadcrumbList']);
  const organization = buildStructuredData({
    entry: entries[0],
    entryId: '',
    canonicalUrl: 'https://docs.example.test/manual/',
    site: 'https://docs.example.test',
    locales,
    defaultLocale: 'root',
    organization: { name: 'Example', url: 'https://docs.example.test/' },
    lookup,
  });
  assert.equal(organization.at(-1)['@type'], 'Organization');
  const localized = buildStructuredData({
    entry: entries[4],
    entryId: 'zh-CN/blog/post',
    canonicalUrl: 'https://docs.example.test/manual/zh-CN/blog/post/',
    site: 'https://docs.example.test',
    locales,
    defaultLocale: 'root',
    organization: { name: 'Example', url: 'https://docs.example.test/' },
    lookup,
  });
  assert.equal(localized.some(({ '@type': type }) => type === 'Organization'), false);
});

test('omits unavailable breadcrumb ancestors and unprovided article facts', () => {
  const post = doc('blog/nested/post', { title: 'A post' });
  const lookup = createPublishedDocsLookup([post], locales);
  const [article, breadcrumbs] = buildStructuredData({
    entry: post,
    entryId: 'blog/nested/post',
    canonicalUrl: 'https://docs.example.test/blog/nested/post/',
    site: 'https://docs.example.test',
    locales,
    lookup,
  });

  assert.equal(article['@type'], 'Article');
  assert.equal('description' in article, false);
  assert.equal('author' in article, false);
  assert.equal('datePublished' in article, false);
  assert.equal('dateModified' in article, false);
  assert.deepEqual(breadcrumbs.itemListElement, [{
    '@type': 'ListItem',
    position: 1,
    name: 'A post',
    item: 'https://docs.example.test/blog/nested/post/',
  }]);
});

test('escapes script terminators in inert JSON-LD serialization', () => {
  const serialized = serializeJsonLd({ text: '</script><script>alert(1)</script>' });
  assert.equal(JSON.parse(serialized).text, '</script><script>alert(1)</script>');
  assert.doesNotMatch(serialized, /<\/script/iu);
});
