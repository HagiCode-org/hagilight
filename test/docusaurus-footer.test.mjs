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

function render({ locale = 'en-US', baseUrl = '/', links = {}, rssEnabled = true, buildInfo } = {}) {
  const resolved = resolveFooterLinks({ locale, baseUrl, links, rssEnabled });
  return renderToStaticMarkup(createElement(FooterView, { links: resolved, version: VERSION, year: 2026, buildInfo }));
}

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const BUILD_INFO = { branch: 'release/1.2', commit: COMMIT, builtAt: '2026-10-13T08:12:34Z' };

function buildSpan(html, field) {
  return html.match(new RegExp(`<span class="hagilight-footer__build"[^>]*data-build-field="${field}"[^>]*>[\\s\\S]*?</span>`, 'u'))?.[0];
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

test('the build line shows the branch, short commit, and UTC build time from the given values', () => {
  const html = render({ buildInfo: BUILD_INFO });
  assert.equal(
    buildSpan(html, 'branch'),
    '<span class="hagilight-footer__build" data-build-field="branch">Branch: release/1.2</span>',
  );
  assert.equal(
    buildSpan(html, 'commit'),
    `<span class="hagilight-footer__build" data-build-field="commit" title="${COMMIT}" data-build-commit="${COMMIT}">Commit: 0123456</span>`,
  );
  assert.equal(
    buildSpan(html, 'builtAt'),
    '<span class="hagilight-footer__build" data-build-field="builtAt">Built: <time dateTime="2026-10-13T08:12:34Z">2026-10-13T08:12:34Z</time></span>',
  );
});

test('unknown values render as unknown without a title or a time element', () => {
  const html = render({ buildInfo: { branch: 'unknown', commit: 'unknown', builtAt: 'unknown' } });
  assert.equal(
    buildSpan(html, 'branch'),
    '<span class="hagilight-footer__build" data-build-field="branch">Branch: unknown</span>',
  );
  assert.equal(
    buildSpan(html, 'commit'),
    '<span class="hagilight-footer__build" data-build-field="commit">Commit: unknown</span>',
  );
  assert.equal(
    buildSpan(html, 'builtAt'),
    '<span class="hagilight-footer__build" data-build-field="builtAt">Built: unknown</span>',
  );
  assert.doesNotMatch(html, /<time\b/u);
  assert.doesNotMatch(html, /title=/u);
});

test('no build text appears when no build info is given', () => {
  const html = render();
  assert.doesNotMatch(html, /hagilight-footer__build/u);
  assert.doesNotMatch(html, /Branch:|Commit:|Built:/u);
});

test('the attribution appears exactly once and precedes the build line inside the copyright paragraph', () => {
  const html = render({ buildInfo: BUILD_INFO });
  assert.equal(html.split(`Powered By hagilight-docusaurus@${VERSION}`).length - 1, 1);
  const copyright = html.match(/<p class="hagilight-footer__copyright">[\s\S]*?<\/p>/u)[0];
  assert.ok(copyright.indexOf('hagilight-footer__attribution') < copyright.indexOf('hagilight-footer__build'));
  assert.equal(copyright.split('hagilight-footer__build').length - 1, 3);
});

test('tracked quick and community links carry GA attributes; other links do not', () => {
  const resolved = resolveFooterLinks({ locale: 'en-US', baseUrl: '/', links: {}, rssEnabled: true });
  const html = render();
  // The link list is the last anchor for a destination; the product statement's calls to action come first.
  const tagsOf = (href) => [...html.matchAll(new RegExp(`<a [^>]*href="${escapeRegExp(href)}"[^>]*>`, 'gu'))].map(([tag]) => tag);
  const tagOf = (href) => tagsOf(href).at(-1);
  const byId = (links, id) => links.find((link) => link.id === id);

  const download = byId(resolved.quick, 'downloadClient');
  assert.match(tagOf(download.href), /data-ga-category="download"/u);
  assert.match(tagOf(download.href), /data-ga-label="downloadClient"/u);
  assert.match(tagOf(download.href), /data-ga-location="footer"/u);
  assert.match(tagsOf(download.href)[0], /data-ga-location="footer_brand"/u);

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

test('a disabled footer with SEO and PostHog off exposes no theme directory and no footer stylesheet', () => {
  const plugin = hagilightDocusaurus({ footer: { enabled: false }, seo: { enabled: false }, analytics: { posthog: { enabled: false } } })({
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

test('the Cookie settings entry renders only when a consent label is supplied, and calls the preferences hook', () => {
  const resolved = resolveFooterLinks({ locale: 'de-DE', baseUrl: '/', links: {}, rssEnabled: false });
  const on = renderToStaticMarkup(createElement(FooterView, { links: resolved, version: VERSION, year: 2026, consentLabel: 'Cookie-Einstellungen' }));
  assert.match(on, /<button type="button" class="hagilight-footer__consent" data-consent-preferences="true">Cookie-Einstellungen<\/button>/u);
  const off = renderToStaticMarkup(createElement(FooterView, { links: resolved, version: VERSION, year: 2026 }));
  assert.doesNotMatch(off, /data-consent-preferences/u);
  assert.doesNotMatch(off, /hagilight-footer__consent/u);
});
