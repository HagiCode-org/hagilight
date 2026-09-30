import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packages = ['core', 'astro', 'starlight'].map((directory) => ({
  directory,
  manifest: JSON.parse(readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8')),
}));

const expectedExports = {
  '@hagicode/hagilight-core/links': ['resolveSiteLinks'],
  '@hagicode/hagilight-core/favicon': ['getHagilightFaviconDataUri', 'resolveFaviconHeadEntry'],
  '@hagicode/hagilight-core/seo': ['composeCanonicalSeoHead', 'composeSeoHead', 'resolveSeoMetadata', 'serializeJsonLd'],
  '@hagicode/hagilight-core/seo-schema': ['seoSchema'],
  '@hagicode/hagilight-core/rss': ['generateRssFeed', 'resolveRssLocales'],
  '@hagicode/hagilight-core/rss-ownership': ['RSS_OWNER', 'registerStarlightRssOwner', 'resolvePlainAstroRssOwner'],
  '@hagicode/hagilight-core/promotions': ['loadActivePromotions'],
  '@hagicode/hagilight/integration': ['hagilight', 'hagilightFavicon', 'hagilightRss'],
  '@hagicode/hagilight-starlight': ['default'],
  '@hagicode/hagilight-starlight/locales': ['locales'],
  '@hagicode/hagilight-starlight/schema': ['aiDisclosureSchema', 'articlePromotionSchema', 'hagilightSchema', 'rssSchema'],
};

test('every JavaScript export resolves to built ESM with a sibling declaration file', async () => {
  const seen = new Set();
  for (const { directory, manifest } of packages) {
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      if (typeof target === 'string') {
        assert.doesNotMatch(target, /\.(?:m?js|ts)$/u, `${manifest.name} ${subpath} must use a types/default condition`);
        assert.ok(existsSync(join(root, 'packages', directory, target)), `${manifest.name} ${subpath} exists`);
        continue;
      }
      assert.match(target.default, /^\.\/dist\/.+\.js$/u);
      assert.equal(target.types, target.default.replace(/\.js$/u, '.d.ts'));
      assert.ok(existsSync(join(root, 'packages', directory, target.types)), `${manifest.name} ${subpath} types exist`);
      const specifier = subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`;
      const module = await import(specifier);
      for (const name of expectedExports[specifier] ?? assert.fail(`${specifier} is not covered`)) {
        assert.ok(name in module, `${specifier} exports ${name}`);
      }
      seen.add(specifier);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(expectedExports).sort());
});

test('feature packages depend on the matching shared core and not on each other', () => {
  const [core, astro, starlight] = packages.map(({ manifest }) => manifest);
  for (const manifest of [astro, starlight]) {
    assert.equal(manifest.version, core.version);
    assert.equal(manifest.dependencies['@hagicode/hagilight-core'], core.version);
  }
  assert.equal(astro.dependencies['@hagicode/hagilight-starlight'], undefined);
  assert.equal(starlight.dependencies['@hagicode/hagilight'], undefined);
  assert.equal(core.dependencies['@hagicode/hagilight'], undefined);
  assert.equal(core.dependencies['@hagicode/hagilight-starlight'], undefined);
  assert.equal(core.peerDependencies['@astrojs/starlight'], undefined);
});

test('typed consumer fixtures accept the documented APIs and reject invalid options', () => {
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  for (const project of ['test/types/tsconfig.json', 'tsconfig.routes.json']) {
    execFileSync(process.execPath, [tsc, '-p', project], { cwd: root, stdio: 'pipe' });
  }
});
