import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { posthogInitScript } from '@hagicode/hagilight-core/posthog';
import {
  ANALYTICS_LOADER_MARKERS,
  SITE_METADATA_PATH,
  buildSiteMetadata,
  detectAnalyticsLoaders,
  resolveSiteMetadataOption,
  serializeSiteMetadata,
  validateSiteMetadata,
} from '@hagicode/hagilight-core/site-metadata';
import {
  findDiscoveryOutputs,
  writeSiteMetadata,
} from '@hagicode/hagilight-core/site-metadata-writer';
import {
  completeSiteMetadataOwnerBuild,
  expectSiteMetadataReport,
  registerStarlightSiteMetadataOwner,
  reportSiteMetadataBuilt,
  resolveSiteMetadataOwner,
} from '@hagicode/hagilight-core/site-metadata-ownership';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'hagilight-site-metadata-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const BUILD = { branch: 'main', commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', builtAt: '2026-10-17T08:12:34Z' };
const DEFAULT_GA_ID = 'G-EN03FMT2Q4';
const DEFAULT_51LA_ID = 'L6b88a5yK4h2Xnci';
const DEFAULT_POSTHOG_KEY = 'phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5';

function sampleInput(overrides = {}) {
  return {
    generator: { name: '@hagicode/hagilight-starlight', version: '0.1.0' },
    site: { name: 'HagiCode Docs', url: 'https://docs.hagicode.com/', base: '/', description: 'Docs for HagiCode' },
    locales: [
      { code: 'en', lang: 'en-US', path: '/' },
      { code: 'zh-CN', lang: 'zh-CN', path: '/zh-CN/' },
    ],
    defaultLocale: 'en',
    build: BUILD,
    discovery: { sitemap: '/sitemap-index.xml', robots: '/robots.txt', rss: '/rss.xml', llms: '/llms.txt' },
    analytics: { googleAnalytics: true, fiftyOneLa: true, posthog: true },
    features: { seo: true, promoto: true },
    ...overrides,
  };
}

test('the output path constant is the single definition of the file location', () => {
  assert.equal(SITE_METADATA_PATH, '.well-known/hagilight.metadata.json');
});

test('the path literal appears only in the contract module across package sources', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  // Quoted code literals only, so doc comments that name the file do not count.
  const literals = ["'.well-known/hagilight.metadata.json'", '".well-known/hagilight.metadata.json"'];
  const offenders = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        if (name !== 'dist' && name !== 'node_modules') walk(path);
      } else if (/\.(?:ts|astro|mjs)$/u.test(name) && !path.endsWith('site-metadata.ts')) {
        const source = readFileSync(path, 'utf8');
        if (literals.some((literal) => source.includes(literal))) offenders.push(path);
      }
    }
  };
  for (const pkg of ['core', 'astro', 'starlight', 'docusaurus']) walk(join(root, 'packages', pkg, 'src'));
  assert.deepEqual(offenders, []);
});

test('buildSiteMetadata emits every required field in schema version 1', () => {
  const metadata = buildSiteMetadata(sampleInput());
  assert.equal(metadata.schemaVersion, 1);
  assert.deepEqual(validateSiteMetadata(metadata), []);
  assert.equal(metadata.site.url, 'https://docs.hagicode.com/');
  assert.equal(metadata.site.base, '/');
  assert.equal(metadata.site.description, 'Docs for HagiCode');
  assert.deepEqual(metadata.languages, {
    default: 'en',
    locales: [
      { code: 'en', lang: 'en-US', path: '/' },
      { code: 'zh-CN', lang: 'zh-CN', path: '/zh-CN/' },
    ],
  });
  assert.deepEqual(metadata.build, BUILD);
});

test('unknown build values stay the literal unknown and the output still validates', () => {
  const metadata = buildSiteMetadata(sampleInput({ build: { branch: '', commit: 'not-a-hash', builtAt: 'yesterday' } }));
  assert.deepEqual(metadata.build, { branch: 'unknown', commit: 'unknown', builtAt: 'unknown' });
  assert.deepEqual(validateSiteMetadata(metadata), []);
});

test('a site without locales reports exactly one locale that is the default', () => {
  const metadata = buildSiteMetadata(sampleInput({ locales: [], defaultLocale: undefined, fallbackLang: 'en-GB' }));
  assert.deepEqual(metadata.languages, {
    default: 'en-GB',
    locales: [{ code: 'en-GB', lang: 'en-GB', path: '/' }],
  });
});

test('optional description and discovery keys are omitted when absent', () => {
  const metadata = buildSiteMetadata(sampleInput({
    site: { name: 'Example', url: 'https://example.test', base: '/' },
    discovery: { robots: '/robots.txt' },
  }));
  assert.equal('description' in metadata.site, false);
  assert.deepEqual(metadata.discovery, { robots: '/robots.txt' });
  assert.equal('description' in JSON.parse(serializeSiteMetadata(metadata)).site, false);
});

test('the site name falls back to the URL hostname when no source has one', () => {
  const metadata = buildSiteMetadata(sampleInput({ site: { url: 'https://docs.example.test/', base: '/docs' } }));
  assert.equal(metadata.site.name, 'docs.example.test');
  assert.equal(metadata.site.base, '/docs/');
});

test('serialization is byte-identical for identical input and ends with a newline', () => {
  const first = serializeSiteMetadata(buildSiteMetadata(sampleInput()));
  const second = serializeSiteMetadata(buildSiteMetadata(sampleInput()));
  assert.equal(first, second);
  assert.ok(first.endsWith('\n'));
  assert.deepEqual(Object.keys(JSON.parse(first)), ['schemaVersion', 'generator', 'site', 'languages', 'build', 'discovery', 'analytics', 'features']);
});

test('extra input fields never reach the output', () => {
  const input = sampleInput({
    build: { ...BUILD, token: 'ghp_secret', remote: 'https://user:pass@example.test/repo.git' },
    env: { GITHUB_TOKEN: 'ghp_secret' },
  });
  const serialized = serializeSiteMetadata(buildSiteMetadata(input));
  assert.doesNotMatch(serialized, /ghp_secret|user:pass|GITHUB_TOKEN|remote/u);
  assert.equal(validateSiteMetadata({ ...JSON.parse(serialized), leak: 'x' })[0], 'unexpected top-level field "leak"');
});

test('analytics is always three booleans and features only carries supplied keys', () => {
  const bare = buildSiteMetadata(sampleInput({ analytics: undefined, features: undefined }));
  assert.deepEqual(bare.analytics, { googleAnalytics: false, fiftyOneLa: false, posthog: false });
  assert.deepEqual(bare.features, {});
  const partial = buildSiteMetadata(sampleInput({ features: { seo: false } }));
  assert.deepEqual(partial.features, { seo: false });
});

test('the loader markers match the shipped GA, 51LA and PostHog loaders', () => {
  const gaSource = readFileSync(join(root, 'packages/core/GoogleAnalytics.astro'), 'utf8');
  assert.ok(gaSource.includes(ANALYTICS_LOADER_MARKERS.googleAnalytics[0]));
  const laSource = readFileSync(join(root, 'packages/core/Analytics51LA.astro'), 'utf8');
  for (const marker of ANALYTICS_LOADER_MARKERS.fiftyOneLa) assert.ok(laSource.includes(marker), marker);
  const posthog = posthogInitScript(DEFAULT_POSTHOG_KEY);
  for (const marker of ANALYTICS_LOADER_MARKERS.posthog) assert.ok(posthog.includes(marker), marker);
});

test('detectAnalyticsLoaders reports a provider only when every marker is present on a page', () => {
  const gaPage = `<script src="${ANALYTICS_LOADER_MARKERS.googleAnalytics[0]}?id=G-X"></script>`;
  const half51La = `<script id="LA_COLLECT"></script>`;
  const full51La = `<script is:inline id="LA_COLLECT" src="https://sdk.51.la/js-sdk-pro.min.js"></script>`;
  const posthogPage = `<script>${ANALYTICS_LOADER_MARKERS.posthog[0]}</script>`;
  assert.deepEqual(detectAnalyticsLoaders([]), { googleAnalytics: false, fiftyOneLa: false, posthog: false });
  assert.deepEqual(detectAnalyticsLoaders(['<p>plain</p>', gaPage]), { googleAnalytics: true, fiftyOneLa: false, posthog: false });
  assert.deepEqual(detectAnalyticsLoaders([half51La]), { googleAnalytics: false, fiftyOneLa: false, posthog: false });
  assert.deepEqual(detectAnalyticsLoaders([full51La, posthogPage]), { googleAnalytics: false, fiftyOneLa: true, posthog: true });
});

test('default analytics IDs and keys never appear in the serialized output', () => {
  const serialized = serializeSiteMetadata(buildSiteMetadata(sampleInput()));
  for (const secret of [DEFAULT_GA_ID, DEFAULT_51LA_ID, DEFAULT_POSTHOG_KEY]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test('resolveSiteMetadataOption accepts booleans, omission and an options object', () => {
  assert.deepEqual(resolveSiteMetadataOption(undefined), { enabled: true });
  assert.deepEqual(resolveSiteMetadataOption(true), { enabled: true });
  assert.deepEqual(resolveSiteMetadataOption(false), { enabled: false });
  assert.deepEqual(resolveSiteMetadataOption({ name: ' HagiCode ', description: 'Docs' }), {
    enabled: true,
    name: 'HagiCode',
    description: 'Docs',
  });
  assert.deepEqual(resolveSiteMetadataOption({ enabled: false }), { enabled: false });
});

test('resolveSiteMetadataOption rejects invalid values with errors that name the option', () => {
  assert.throws(() => resolveSiteMetadataOption('yes'), /metadata option must be a boolean or an options object/u);
  assert.throws(() => resolveSiteMetadataOption({ name: '' }), /metadata name must be a non-empty string/u);
  assert.throws(() => resolveSiteMetadataOption({ description: 5 }), /metadata description must be a non-empty string/u);
  assert.throws(() => resolveSiteMetadataOption({ enabled: 'no' }), /metadata enabled option must be a boolean/u);
});

test('writeSiteMetadata creates .well-known when missing and writes the file', () => {
  const outDir = join(scratch, 'missing-well-known');
  mkdirSync(outDir, { recursive: true });
  const logs = [];
  const logger = { info: (message) => logs.push(message), warn: () => {} };
  const metadata = buildSiteMetadata(sampleInput());
  assert.equal(writeSiteMetadata({ outDir, metadata, logger }), 'written');
  const target = join(outDir, SITE_METADATA_PATH);
  assert.equal(readFileSync(target, 'utf8'), serializeSiteMetadata(metadata));
  assert.equal(existsSync(join(outDir, '.well-known', 'hagilight.metadata.json.tmp')), false);
});

test('writeSiteMetadata leaves other files in an existing .well-known directory alone', () => {
  const outDir = join(scratch, 'existing-well-known');
  mkdirSync(join(outDir, '.well-known'), { recursive: true });
  writeFileSync(join(outDir, '.well-known', 'security.txt'), 'Contact: mailto:x@example.test\n');
  writeSiteMetadata({ outDir, metadata: buildSiteMetadata(sampleInput()), logger: { info() {}, warn() {} } });
  assert.equal(readFileSync(join(outDir, '.well-known', 'security.txt'), 'utf8'), 'Contact: mailto:x@example.test\n');
  assert.ok(existsSync(join(outDir, SITE_METADATA_PATH)));
});

test('writeSiteMetadata keeps an existing or site-owned file untouched and logs it', () => {
  const outDir = join(scratch, 'site-owned');
  mkdirSync(join(outDir, '.well-known'), { recursive: true });
  const siteOwned = join(outDir, '.well-known', 'hagilight.metadata.json');
  writeFileSync(siteOwned, '{"site":"owned"}\n');
  const logs = [];
  const result = writeSiteMetadata({
    outDir,
    metadata: buildSiteMetadata(sampleInput()),
    logger: { info: (message) => logs.push(message), warn() {} },
  });
  assert.equal(result, 'kept');
  assert.equal(readFileSync(siteOwned, 'utf8'), '{"site":"owned"}\n');
  assert.match(logs[0], /already exists.*leaving it untouched/u);

  const fresh = join(scratch, 'public-owned');
  mkdirSync(fresh, { recursive: true });
  const publicCopy = join(scratch, 'public', '.well-known', 'hagilight.metadata.json');
  mkdirSync(join(scratch, 'public', '.well-known'), { recursive: true });
  writeFileSync(publicCopy, '{}\n');
  assert.equal(writeSiteMetadata({
    outDir: fresh,
    metadata: buildSiteMetadata(sampleInput()),
    siteOwnedFiles: [publicCopy],
    logger: { info() {}, warn() {} },
  }), 'kept');
  assert.equal(existsSync(join(fresh, SITE_METADATA_PATH)), false);
});

test('findDiscoveryOutputs reports only the artifacts that exist', () => {
  const outDir = join(scratch, 'discovery');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'sitemap.xml'), '<urlset/>');
  writeFileSync(join(outDir, 'robots.txt'), 'User-agent: *\n');
  assert.deepEqual(findDiscoveryOutputs(outDir), { sitemap: '/sitemap.xml', robots: '/robots.txt' });
  writeFileSync(join(outDir, 'sitemap-index.xml'), '<sitemapindex/>');
  assert.equal(findDiscoveryOutputs(outDir).sitemap, '/sitemap-index.xml');
});

test('owner resolution picks Starlight only when its claim is enabled', () => {
  assert.equal(resolveSiteMetadataOwner(), 'astro');
  const withdrawDisabled = registerStarlightSiteMetadataOwner(false);
  assert.equal(resolveSiteMetadataOwner(), 'astro');
  withdrawDisabled();
  const withdraw = registerStarlightSiteMetadataOwner(true);
  assert.equal(resolveSiteMetadataOwner(), 'starlight');
  withdraw();
  assert.equal(resolveSiteMetadataOwner(), 'astro');
});

test('the owner writes at once when no peer deferred', () => {
  const writes = [];
  completeSiteMetadataOwnerBuild(() => writes.push('owner'));
  assert.deepEqual(writes, ['owner']);
});

test('the owner write runs once for both registration orders, after the deferring peer reports', () => {
  // Owner's hook runs first, peer reports afterwards.
  const ownerFirst = [];
  const peerToken = expectSiteMetadataReport();
  completeSiteMetadataOwnerBuild(() => ownerFirst.push('owner'));
  assert.deepEqual(ownerFirst, [], 'owner waits while a peer is pending');
  reportSiteMetadataBuilt(peerToken);
  assert.deepEqual(ownerFirst, ['owner']);

  // Peer reports first, owner's hook runs afterwards.
  const peerFirst = [];
  const secondPeer = expectSiteMetadataReport();
  reportSiteMetadataBuilt(secondPeer);
  completeSiteMetadataOwnerBuild(() => peerFirst.push('owner'));
  assert.deepEqual(peerFirst, ['owner']);
  reportSiteMetadataBuilt(secondPeer);
  assert.deepEqual(peerFirst, ['owner'], 'a repeated report does not write again');
});
