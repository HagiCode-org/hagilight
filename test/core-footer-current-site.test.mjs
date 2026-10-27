import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const variants = join(root, 'node_modules/.hagilight-variants/core-footer-current-site');
const astroCli = join(root, 'node_modules/astro/bin/astro.mjs');

const FRONTMATTER = `---
import Footer from '@hagicode/hagilight-core/Footer';
---
`;

const PAGE_LOCALE_ONLY = `${FRONTMATTER}<html lang="en-US">
  <head><meta charset="utf-8" /><title>Current site</title></head>
  <body><Footer locale="en-US" /></body>
</html>
`;

const PAGE_EXPLICIT_SITE_URL = `${FRONTMATTER}<html lang="en-US">
  <head><meta charset="utf-8" /><title>Current site</title></head>
  <body><Footer locale="en-US" links={{ siteUrl: 'https://consumer.example.test/' }} /></body>
</html>
`;

const VARIANTS = {
  otherSite: {
    config: "export default defineConfig({ site: 'https://consumer.example.test' });",
    page: PAGE_LOCALE_ONLY,
  },
  fullstackSite: {
    config: "export default defineConfig({ site: 'https://fullstack.hagicode.com' });",
    page: PAGE_LOCALE_ONLY,
  },
  explicitSiteUrlOverridesAstroSite: {
    config: "export default defineConfig({ site: 'https://fullstack.hagicode.com' });",
    page: PAGE_EXPLICIT_SITE_URL,
  },
  noAstroSite: {
    config: 'export default defineConfig({});',
    page: PAGE_LOCALE_ONLY,
  },
};

const FULLSTACK_LINK = 'href="https://fullstack.hagicode.com/"';

function buildFixture(name) {
  const { config, page } = VARIANTS[name];
  const dir = join(variants, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'src/pages'), { recursive: true });
  writeFileSync(join(dir, 'astro.config.mjs'), `import { defineConfig } from 'astro/config';\n\n${config}\n`);
  writeFileSync(join(dir, 'src/pages/index.astro'), page);
  execFileSync(process.execPath, [astroCli, 'build', '--root', dir], {
    cwd: root,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    stdio: 'pipe',
  });
  return readFileSync(join(dir, 'dist/index.html'), 'utf8');
}

// The columns regroup the ecosystem sites by purpose, so the whole column grid is the unit to inspect.
function ecosystemSitesOf(html) {
  return html.match(/<div class="hagilight-cols[^>]*>[\s\S]*?<\/div>/u)?.[0];
}

test('the core footer lists the Fullstack entry on a site that is not Fullstack', () => {
  const html = buildFixture('otherSite');
  const sites = ecosystemSitesOf(html);
  assert.ok(sites, 'the footer renders the link columns');
  assert.ok(sites.includes(FULLSTACK_LINK), 'the Fullstack entry is listed');
  assert.match(sites, /href="https:\/\/tasks\.hagicode\.com\/"/u);
});

test('the core footer omits the Fullstack entry when the Astro site is Fullstack', () => {
  const html = buildFixture('fullstackSite');
  const sites = ecosystemSitesOf(html);
  assert.ok(sites, 'the footer renders the link columns');
  assert.ok(!sites.includes(FULLSTACK_LINK), 'the Fullstack entry is excluded');
  assert.match(sites, /href="https:\/\/tasks\.hagicode\.com\/"/u, 'other entries still render');
  assert.ok(!html.includes('utm_source='), 'no campaign parameters are added without a siteId');
});

test('an explicit siteUrl wins over the Astro site', () => {
  const sites = ecosystemSitesOf(buildFixture('explicitSiteUrlOverridesAstroSite'));
  assert.ok(sites, 'the footer renders the link columns');
  assert.ok(sites.includes(FULLSTACK_LINK), 'the Fullstack entry is listed when siteUrl names another origin');
});

test('without any Astro site the core footer lists the Fullstack entry as before', () => {
  const sites = ecosystemSitesOf(buildFixture('noAstroSite'));
  assert.ok(sites, 'the footer renders the link columns');
  assert.ok(sites.includes(FULLSTACK_LINK));
});
