import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { hagilight } from '@hagicode/hagilight/integration';
import { buildLlmsTxt, parsePageMeta } from '../packages/astro/dist/llms.js';

const page = (path, title, description, lang = 'en-US', siteName) => ({
  path, url: `https://example.test${path}`, lang, title, description, siteName,
});

const html = ({ title = 'Title', lang = 'en-US', description, head = '' } = {}) =>
  `<!doctype html><html lang="${lang}"><head><title>${title}</title>${description ? `<meta name="description" content="${description}"/>` : ''}${head}</head><body></body></html>`;

test('parsePageMeta reads title, description, language and site name with entities decoded', () => {
  const meta = parsePageMeta(
    html({ title: 'Install &amp; Run | Docs', description: 'Fast &quot;start&quot;', head: '<meta property="og:site_name" content="Docs"/>' }),
    'https://example.test/install/',
  );
  assert.deepEqual(meta, { lang: 'en-US', title: 'Install & Run | Docs', description: 'Fast "start"', siteName: 'Docs' });
});

test('parsePageMeta skips noindex, redirects, 404s and pages canonical elsewhere', () => {
  const url = 'https://example.test/a/';
  assert.equal(parsePageMeta(html({ head: '<meta name="robots" content="noindex,follow"/>' }), url), undefined);
  assert.equal(parsePageMeta(html({ head: '<meta http-equiv="refresh" content="0; url=/"/>' }), url), undefined);
  assert.equal(parsePageMeta(html({ title: '404 | Docs' }), url), undefined);
  assert.equal(parsePageMeta(html({ head: '<link rel="canonical" href="https://example.test/other/"/>' }), url), undefined);
  assert.ok(parsePageMeta(html({ head: '<link rel="canonical" href="https://example.test/a/"/>' }), url));
  assert.ok(parsePageMeta(html({ head: '<link rel="canonical" href="https://example.test/a"/>' }), url), 'a trailing-slash difference alone is not a different page');
});

test('buildLlmsTxt lists the default language by section and the other languages as optional', () => {
  const text = buildLlmsTxt({
    lang: 'en-US',
    pages: [
      page('/en-US/', 'Example Docs', 'Docs for the example product.'),
      page('/en-US/about/', 'About | Example Docs', 'Who we are.'),
      page('/en-US/guides/install/', 'Install | Example Docs', 'Install it.'),
      page('/en-US/guides/run/', 'Run | Example Docs', 'Run it.'),
      page('/zh-CN/', '示例文档', '示例', 'zh-CN'),
      page('/zh-CN/guides/install/', '安装', '安装它', 'zh-CN'),
    ],
  });
  assert.equal(text, [
    '# Example Docs',
    '',
    '> Docs for the example product.',
    '',
    '## Overview',
    '',
    '- [Example Docs](https://example.test/en-US/): Docs for the example product.',
    '- [About](https://example.test/en-US/about/): Who we are.',
    '',
    '## Guides',
    '',
    '- [Install](https://example.test/en-US/guides/install/): Install it.',
    '- [Run](https://example.test/en-US/guides/run/): Run it.',
    '',
    '## Optional',
    '',
    '- [zh-CN](https://example.test/zh-CN/)',
    '',
  ].join('\n'));
});

test('buildLlmsTxt names the site from og:site_name and strips it from page titles', () => {
  const text = buildLlmsTxt({
    pages: [
      page('/', 'Welcome to Example | Example Docs', 'Hello.', 'en-US', 'Example Docs'),
      page('/guides/a/', 'Alpha | Example Docs', 'Alpha.', 'en-US', 'Example Docs'),
    ],
  });
  assert.match(text, /^# Example Docs\n/u);
  assert.match(text, /- \[Welcome to Example\]\(https:\/\/example\.test\/\): Hello\./u);
  assert.match(text, /- \[Alpha\]\(https:\/\/example\.test\/guides\/a\/\): Alpha\./u);
});

test('parsePageMeta omits a script-redirect page that declares the llms exclude marker', () => {
  const url = 'https://example.test/about/';
  const redirect = '<!doctype html><html lang="en-US"><head><title>The localized about page has moved</title>'
    + '<meta name="robots" content="index,follow"/><meta name="hagilight:llms" content="exclude"/></head>'
    + '<body><script>window.location.replace("/en-US/about/");</script></body></html>';
  assert.equal(parsePageMeta(redirect, url), undefined);
  // The same script redirect without the marker is still listed: only the marker opts it out.
  const unmarked = redirect.replace('<meta name="hagilight:llms" content="exclude"/>', '');
  assert.ok(parsePageMeta(unmarked, url));
  // Another meta name never opts a page out.
  assert.ok(parsePageMeta(html({ head: '<meta name="hagilight:other" content="exclude"/>' }), 'https://example.test/a/'));
});

test('the marker is left out next to a normal page and meta-refresh pages stay omitted', () => {
  const pages = [
    { path: '/', url: 'https://example.test/', lang: 'en-US', title: 'HagiCode', description: 'Home.', siteName: undefined },
  ];
  const marked = parsePageMeta(
    html({ title: 'The localized about page has moved', head: '<meta name="hagilight:llms" content="exclude"/>' }),
    'https://example.test/about/',
  );
  assert.equal(marked, undefined);
  assert.equal(parsePageMeta(html({ title: 'Moved', head: '<meta http-equiv="refresh" content="0; url=/"/>' }), 'https://example.test/desktop/'), undefined);
  const normal = parsePageMeta(html({ title: 'Guide', description: 'A guide.' }), 'https://example.test/guide/');
  const txt = buildLlmsTxt({ pages: [...pages, { ...normal, path: '/guide/', url: 'https://example.test/guide/' }], title: 'HagiCode' });
  assert.match(txt, /- \[Guide\]\(https:\/\/example\.test\/guide\/\): A guide\./u);
  assert.doesNotMatch(txt, /has moved/u);
});

test('configured title and summary win over the page values even when the home page has its own', () => {
  const home = { path: '/', url: 'https://example.test/', lang: 'en-US', title: 'HagiCode - Long Marketing Title', description: 'Page description.', siteName: 'Long Site' };
  const page = { path: '/guide/', url: 'https://example.test/guide/', lang: 'en-US', title: 'Guide', description: 'A guide.', siteName: 'Long Site' };
  const txt = buildLlmsTxt({ pages: [home, page], title: 'HagiCode', summary: 'The configured definition.' });
  assert.match(txt, /^# HagiCode\n\n> The configured definition\.\n/u);
  assert.doesNotMatch(txt, /Long Marketing Title/u);
});

test('buildLlmsTxt caps links per section and in total, and honors title and summary overrides', () => {
  const pages = [page('/', 'Home', 'Welcome.')];
  for (let i = 0; i < 30; i += 1) pages.push(page(`/guides/g${String(i).padStart(2, '0')}/`, `Guide ${i}`, `About ${i}.`));
  for (let i = 0; i < 30; i += 1) pages.push(page(`/blog/b${String(i).padStart(2, '0')}/`, `Post ${i}`, `Post ${i}.`));
  const capped = buildLlmsTxt({ pages, maxLinksPerSection: 5 });
  assert.equal(capped.split('\n').filter((line) => line.startsWith('- [')).length, 11);
  const total = buildLlmsTxt({ pages, maxLinksPerSection: 20, maxLinks: 25 });
  assert.equal(total.split('\n').filter((line) => line.startsWith('- [')).length, 25);
  const named = buildLlmsTxt({ pages, title: 'Custom', summary: 'Custom summary.' });
  assert.match(named, /^# Custom\n\n> Custom summary\.\n/u);
});

test('buildLlmsTxt omits a description repeated across pages and gives Overview a larger share', () => {
  const pages = [page('/', 'Home', 'Same everywhere.')];
  for (let i = 0; i < 30; i += 1) pages.push(page(`/p${String(i).padStart(2, '0')}/`, `Page ${i}`, i === 0 ? 'Unique page.' : 'Same everywhere.'));
  const text = buildLlmsTxt({ pages, maxLinksPerSection: 5 });
  assert.equal(text.split('\n').filter((line) => line.startsWith('- [')).length, 15);
  assert.match(text, /- \[Page 0\]\(https:\/\/example\.test\/p00\/\): Unique page\./u);
  assert.match(text, /- \[Page 1\]\(https:\/\/example\.test\/p01\/\)\n/u);
  assert.match(text, /^> Same everywhere\.$/mu, 'the summary keeps the site description');
});

test('buildLlmsTxt falls back to the most common language and returns undefined without pages', () => {
  const text = buildLlmsTxt({
    lang: 'fr-FR',
    pages: [page('/a/', 'A', 'a'), page('/b/', 'B', 'b')],
  });
  assert.match(text, /\[A\]\(https:\/\/example\.test\/a\/\)/u);
  assert.equal(buildLlmsTxt({ pages: [] }), undefined);
});

function build({ options, files, config = {}, preexisting }) {
  const dir = mkdtempSync(join(tmpdir(), 'hagilight-llms-'));
  const messages = [];
  try {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(dir, name), { recursive: true });
      writeFileSync(join(dir, name, 'index.html'), content);
    }
    if (preexisting) writeFileSync(join(dir, 'llms.txt'), preexisting);
    const integration = hagilight(options);
    integration.hooks['astro:config:done']({
      config: { site: 'https://example.test', base: '/', srcDir: pathToFileURL(`${dir}/src/`), publicDir: pathToFileURL(`${dir}/public/`), root: pathToFileURL(`${dir}/`), integrations: [], ...config },
      logger: { warn() {}, info() {} },
    });
    integration.hooks['astro:build:done']({
      dir: pathToFileURL(`${dir}/`),
      pages: Object.keys(files).map((name) => ({ pathname: name === '' ? '' : `${name}/` })),
      logger: { info: (m) => messages.push(m), warn: (m) => messages.push(m) },
    });
    return { text: existsSync(join(dir, 'llms.txt')) ? readFileSync(join(dir, 'llms.txt'), 'utf8') : undefined, messages };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SITE_FILES = {
  '': html({ title: 'Example', description: 'An example site.', head: '<meta property="og:site_name" content="Example"/>' }),
  guides: html({ title: 'Guides | Example', description: 'All guides.' }),
  'guides/install': html({ title: 'Install | Example', description: 'Install it.' }),
  old: html({ title: 'Old', head: '<meta http-equiv="refresh" content="0; url=/guides/"/>' }),
};

test('the integration writes llms.txt after the build and skips redirects', () => {
  const { text, messages } = build({ files: SITE_FILES });
  assert.match(text, /^# Example\n\n> An example site\.\n/u);
  assert.match(text, /\[Install\]\(https:\/\/example\.test\/guides\/install\/\): Install it\./u);
  assert.doesNotMatch(text, /\/old\//u);
  assert.ok(messages.some((m) => /Generated llms\.txt from 3 page/u.test(m)));
});

test('the integration respects opt-outs, enabled:false and an existing llms.txt', () => {
  assert.equal(build({ options: { llms: false }, files: SITE_FILES }).text, undefined);
  assert.equal(build({ options: { llms: { enabled: false } }, files: SITE_FILES }).text, undefined);
  assert.equal(build({ options: { enabled: false }, files: SITE_FILES }).text, undefined);
  assert.equal(build({ files: SITE_FILES, preexisting: 'hand written' }).text, 'hand written');
});

test('the integration validates the llms option', () => {
  assert.throws(() => hagilight({ llms: 'yes' }), /llms option must be a boolean or an options object/u);
  assert.throws(() => hagilight({ llms: { maxLinks: 0 } }), /maxLinks must be a positive integer/u);
  assert.throws(() => hagilight({ llms: { title: ' ' } }), /title must be a non-empty string/u);
});
