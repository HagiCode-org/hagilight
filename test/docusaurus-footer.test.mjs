import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';

const { resolveFooterLinks } = await import(new URL('../packages/docusaurus/dist/footer.js', import.meta.url).href);
const { FooterView } = await import(new URL('../packages/docusaurus/dist/theme/Footer/FooterView.js', import.meta.url).href);
const { hagilightDocusaurus } = await import(new URL('../packages/docusaurus/dist/index.js', import.meta.url).href);

const VERSION = JSON.parse(readFileSync(new URL('../packages/docusaurus/package.json', import.meta.url), 'utf8')).version;
const i18n = {
  defaultLocale: 'en-US',
  locales: ['en-US'],
  currentLocale: 'en-US',
  path: 'i18n',
  localeConfigs: { 'en-US': { label: 'English', htmlLang: 'en-US', direction: 'ltr' } },
};

function render({ locale = 'en-US', baseUrl = '/', links = {}, rssEnabled = true } = {}) {
  const resolved = resolveFooterLinks({ locale, baseUrl, links, rssEnabled });
  return renderToStaticMarkup(createElement(FooterView, { links: resolved, version: VERSION, year: 2026 }));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');
}

test('English footer renders the English headings, filings label, and copyright', () => {
  const html = render();
  assert.match(html, />Ecosystem Sites</u);
  assert.match(html, />Quick Links</u);
  assert.match(html, />Community</u);
  assert.match(html, /aria-label="View filing information"/u);
  assert.match(html, /© 2026 HagiCode/u);
});

test('Simplified Chinese footer renders the zh-CN headings and links', () => {
  const html = render({ locale: 'zh-CN' });
  assert.match(html, />生态站点</u);
  assert.match(html, />快速链接</u);
  assert.match(html, />社区</u);
  assert.match(html, /aria-label="查看备案信息"/u);
  assert.match(html, /href="https:\/\/docs\.hagicode\.com\/installation\/docker-compose\/"/u);
});

test('an unknown locale falls back to the English labels', () => {
  const html = render({ locale: 'xx-YY' });
  assert.match(html, />Quick Links</u);
  assert.doesNotMatch(html, />快速链接</u);
});

test('sitemap and RSS links follow the base URL', () => {
  const html = render({ locale: 'zh-CN', baseUrl: '/zh-CN/' });
  assert.match(html, /href="\/zh-CN\/sitemap\.xml"/u);
  assert.match(html, /href="\/zh-CN\/rss\.xml"/u);
  assert.doesNotMatch(html, /sitemap-index\.xml/u);
});

test('the RSS link is omitted when RSS output is disabled', () => {
  const html = render({ rssEnabled: false });
  assert.doesNotMatch(html, /rss\.xml/u);
  assert.match(html, /href="\/sitemap\.xml"/u);
});

test('an explicit rssFeedUrl overrides the default RSS link', () => {
  const html = render({ links: { rssFeedUrl: 'https://feeds.example.com/hagicode.xml' } });
  assert.match(html, /href="https:\/\/feeds\.example\.com\/hagicode\.xml"/u);
  assert.doesNotMatch(html, /href="\/rss\.xml"/u);
});

test('attribution names the package version', () => {
  const html = render();
  assert.ok(html.includes(`Powered By hagilight-docusaurus@${VERSION}`));
});

test('tracked quick and community links carry GA attributes; other links do not', () => {
  const resolved = resolveFooterLinks({ locale: 'en-US', baseUrl: '/', links: {}, rssEnabled: true });
  const html = render();
  const tagOf = (href) => html.match(new RegExp(`<a [^>]*href="${escapeRegExp(href)}"[^>]*>`, 'u'))?.[0];
  const byId = (links, id) => links.find((link) => link.id === id);

  const download = byId(resolved.quick, 'downloadClient');
  assert.match(tagOf(download.href), /data-ga-category="download"/u);
  assert.match(tagOf(download.href), /data-ga-label="downloadClient"/u);
  assert.match(tagOf(download.href), /data-ga-location="footer"/u);

  const github = byId(resolved.community, 'github');
  assert.match(tagOf(github.href), /data-ga-category="community"/u);

  for (const link of [byId(resolved.quick, 'sitemap'), byId(resolved.quick, 'about'), byId(resolved.community, 'contactEmail')]) {
    assert.doesNotMatch(tagOf(link.href), /data-ga-/u, `${link.id} is untagged`);
  }
  for (const link of [...resolved.relatedSites, ...resolved.filings]) {
    assert.doesNotMatch(tagOf(link.href), /data-ga-/u, `${link.id} is untagged`);
  }
});

test('custom extra links render untagged and removed links disappear', () => {
  const html = render({
    links: {
      extraLinks: { quick: [{ id: 'handbook', href: 'https://example.com/handbook', label: 'Handbook' }] },
      removeLinks: { quick: ['about'] },
    },
  });
  assert.match(html, /<a href="https:\/\/example\.com\/handbook"[^>]*>Handbook<\/a>/u);
  assert.doesNotMatch(html, /data-ga-label="handbook"/u);
  assert.doesNotMatch(html, /href="https:\/\/www\.hagicode\.com\/en-US\/about\/"/u);
});

test('a disabled footer with SEO off exposes no theme directory and no footer stylesheet', () => {
  const plugin = hagilightDocusaurus({ footer: { enabled: false }, seo: { enabled: false } })({
    siteDir: fileURLToPath(new URL('.', import.meta.url)),
    siteConfig: { title: 'HagiCode', url: 'https://example.com', themeConfig: {} },
    i18n,
    baseUrl: '/',
  });
  assert.equal(plugin.getThemePath, undefined);
  assert.deepEqual(plugin.getClientModules().filter((path) => path.endsWith('styles.css')), []);
});

test('a disabled footer keeps the theme directory for the SEO wrapper without the footer stylesheet', () => {
  const plugin = hagilightDocusaurus({ footer: { enabled: false } })({
    siteDir: fileURLToPath(new URL('.', import.meta.url)),
    siteConfig: { title: 'HagiCode', url: 'https://example.com', themeConfig: {} },
    i18n,
    baseUrl: '/',
  });
  assert.match(plugin.getThemePath(), /dist[\\/]theme$/u);
  assert.deepEqual(plugin.getClientModules().filter((path) => path.endsWith('styles.css')), []);
});

test('an enabled footer exposes the theme directory and footer stylesheet', () => {
  const plugin = hagilightDocusaurus()({
    siteDir: fileURLToPath(new URL('.', import.meta.url)),
    siteConfig: { title: 'HagiCode', url: 'https://example.com', themeConfig: {} },
    i18n,
    baseUrl: '/',
  });
  assert.match(plugin.getThemePath(), /dist[\\/]theme$/u);
  assert.ok(plugin.getClientModules().some((path) => path.endsWith('styles.css')));
});
