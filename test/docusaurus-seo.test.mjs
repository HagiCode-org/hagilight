import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement, Fragment } from 'react';
import { renderToString } from 'react-dom/server';
import { test } from 'node:test';

const docusaurusCore = createRequire(new URL('../node_modules/@docusaurus/core/package.json', import.meta.url));
const { Helmet, HelmetProvider } = docusaurusCore('react-helmet-async');
const { hagilightDocusaurus } = await import(new URL('../packages/docusaurus/dist/index.js', import.meta.url).href);
const { SharingMetadata } = await import(
  new URL('../packages/docusaurus/dist/theme/SiteMetadata/SharingMetadata.js', import.meta.url).href
);
const { resolveSharingImage, sharingMetadataFor } = await import(
  new URL('../packages/docusaurus/dist/seo.js', import.meta.url).href
);

const i18n = {
  defaultLocale: 'en-US',
  locales: ['en-US'],
  currentLocale: 'en-US',
  path: 'i18n',
  localeConfigs: { 'en-US': { label: 'English', htmlLang: 'en-US', direction: 'ltr' } },
};

function createPlugin(options, siteConfig = {}) {
  return hagilightDocusaurus(options)({
    siteDir: fileURLToPath(new URL('.', import.meta.url)),
    siteConfig: {
      title: 'HagiCode',
      url: 'https://example.com',
      baseUrl: '/',
      themeConfig: { image: 'img/social.png' },
      ...siteConfig,
    },
    i18n,
    baseUrl: '/',
  });
}

function jsonLdOf(plugin) {
  return plugin
    .injectHtmlTags({ content: undefined })
    .headTags.filter((tag) => tag.attributes?.type === 'application/ld+json')
    .map((tag) => ({ raw: tag.innerHTML, data: JSON.parse(tag.innerHTML) }));
}

function renderHead(element) {
  const helmetContext = {};
  renderToString(createElement(HelmetProvider, { context: helmetContext }, element));
  return helmetContext.helmet;
}

const count = (markup, pattern) => (markup.match(pattern) ?? []).length;

test('Organization and WebSite JSON-LD are emitted on every page', () => {
  const entries = jsonLdOf(createPlugin());
  assert.deepEqual(entries.map(({ data }) => data['@type']), ['Organization', 'WebSite']);
});

test('defaults come from the site title and url', () => {
  const [organization, website] = jsonLdOf(createPlugin()).map(({ data }) => data);
  assert.equal(organization.name, 'HagiCode');
  assert.equal(organization.url, 'https://example.com/');
  assert.equal(organization.logo, undefined);
  assert.equal(website.name, 'HagiCode');
  assert.equal(website.url, 'https://example.com/');
});

test('explicit organization options replace the defaults', () => {
  const plugin = createPlugin({
    seo: { organization: { name: 'HagiCode Labs', url: 'https://hagicode.com', logo: 'https://example.com/logo.png' } },
  });
  const [organization, website] = jsonLdOf(plugin).map(({ data }) => data);
  assert.equal(organization.name, 'HagiCode Labs');
  assert.equal(organization.url, 'https://hagicode.com/');
  assert.equal(organization.logo, 'https://example.com/logo.png');
  assert.equal(website.name, 'HagiCode');
});

test('a locale base URL is used for the WebSite URL', () => {
  const plugin = hagilightDocusaurus()({
    siteDir: fileURLToPath(new URL('.', import.meta.url)),
    siteConfig: { title: 'HagiCode', url: 'https://example.com', themeConfig: { image: 'img/social.png' }, baseUrl: '/zh-CN/' },
    i18n,
    baseUrl: '/zh-CN/',
  });
  const [, website] = jsonLdOf(plugin).map(({ data }) => data);
  assert.equal(website.url, 'https://example.com/zh-CN/');
});

test('JSON-LD escapes "<" so an organization name cannot close the script tag', () => {
  const name = '</script><script>alert(1)</script>';
  const [{ raw, data }] = jsonLdOf(createPlugin({ seo: { organization: { name } } }));
  assert.doesNotMatch(raw, /</u);
  assert.equal(data.name, name);
});

test('disabling SEO removes the JSON-LD', () => {
  assert.deepEqual(jsonLdOf(createPlugin({ seo: { enabled: false } })), []);
});

test('the sharing image is resolved against the site and locale base path', () => {
  assert.equal(resolveSharingImage(undefined, { url: 'https://example.com', baseUrl: '/' }), undefined);
  assert.equal(
    resolveSharingImage('https://cdn.example.com/og.png', { url: 'https://example.com', baseUrl: '/' }),
    'https://cdn.example.com/og.png',
  );
  assert.equal(
    resolveSharingImage('/img/og.png', { url: 'https://example.com', baseUrl: '/' }),
    'https://example.com/img/og.png',
  );
});

test('sharing metadata is absent when SEO is off and the theme image replaces the fallback', () => {
  const site = { title: 'HagiCode', url: 'https://example.com', baseUrl: '/' };
  assert.equal(sharingMetadataFor({ enabled: false, image: '/img/og.png' }, site, undefined), undefined);
  assert.deepEqual(sharingMetadataFor({ enabled: true, image: '/img/og.png' }, site, undefined), {
    siteName: 'HagiCode',
    image: 'https://example.com/img/og.png',
  });
  assert.deepEqual(sharingMetadataFor({ enabled: true, image: '/img/og.png' }, site, 'img/theme.png'), {
    siteName: 'HagiCode',
    image: undefined,
  });
});

test('the fallback sharing image appears once as og:image and twitter:image', () => {
  const image = 'https://example.com/og.png';
  const markup = renderHead(createElement(SharingMetadata, { Head: Helmet, siteName: 'HagiCode', image }))
    .meta.toString();
  assert.equal(count(markup, /property="og:image"/gu), 1);
  assert.equal(count(markup, /name="twitter:image"/gu), 1);
  assert.match(markup, /property="og:site_name" content="HagiCode"/u);
});

test('without a sharing image only the site name is emitted', () => {
  const markup = renderHead(createElement(SharingMetadata, { Head: Helmet, siteName: 'HagiCode', image: undefined }))
    .meta.toString();
  assert.equal(count(markup, /og:image/gu), 0);
  assert.equal(count(markup, /twitter:image/gu), 0);
  assert.match(markup, /property="og:site_name" content="HagiCode"/u);
});

test('a page with its own image keeps exactly one og:image and one twitter:image', () => {
  const page = createElement(
    Helmet,
    null,
    createElement('meta', { property: 'og:image', content: 'https://example.com/page.png' }),
    createElement('meta', { name: 'twitter:image', content: 'https://example.com/page.png' }),
  );
  const markup = renderHead(
    createElement(
      Fragment,
      null,
      createElement(SharingMetadata, { Head: Helmet, siteName: 'HagiCode', image: 'https://example.com/og.png' }),
      page,
    ),
  ).meta.toString();
  assert.equal(count(markup, /property="og:image"/gu), 1);
  assert.equal(count(markup, /name="twitter:image"/gu), 1);
  assert.match(markup, /property="og:image" content="https:\/\/example\.com\/page\.png"/u);
});
