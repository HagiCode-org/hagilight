import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PACKAGES, assertPackageGraph, readManifest } from '../scripts/packages.mjs';
import { compareVersions, dependencyStamps, devVersion, isPublishVersion, nextBaseVersion, stableVersion } from '../scripts/release.mjs';

test('accepts only stable release tags', () => {
  assert.equal(stableVersion('v1.2.3'), '1.2.3');
  for (const tag of ['1.2.3', 'v1.2.3-dev.1', 'v01.2.3', 'v1.2']) {
    assert.throws(() => stableVersion(tag));
  }
});

test('selects the newest unreleased draft after the latest stable release', () => {
  const releases = [
    { tag_name: 'v1.2.0', draft: false },
    { tag_name: 'v1.3.0', draft: true },
    { tag_name: 'v1.2.1', draft: true },
    { tag_name: 'v2.0.0-dev.1', draft: true },
  ];
  assert.equal(nextBaseVersion(releases, '0.1.0'), '1.3.0');
  assert.equal(nextBaseVersion(releases.filter((release) => !release.draft), '0.1.0'), '1.2.1');
  assert.equal(nextBaseVersion([], '0.1.0'), '0.1.0');
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
});

test('publishes shared core first and stamps it into every dependent package and examples', () => {
  assert.deepEqual(PACKAGES.map(({ name }) => name), [
    '@hagicode/hagilight-core',
    '@hagicode/hagilight-docusaurus',
    '@hagicode/hagilight-mermaid',
    '@hagicode/hagilight',
    '@hagicode/hagilight-starlight',
  ]);
  const stamps = Object.fromEntries(dependencyStamps('1.2.3').map(({ workspace, values }) => [workspace, values]));
  assert.deepEqual(stamps['@hagicode/hagilight-core'], ['version=1.2.3']);
  for (const name of ['@hagicode/hagilight-docusaurus', '@hagicode/hagilight', '@hagicode/hagilight-starlight']) {
    assert.deepEqual(stamps[name], ['version=1.2.3', 'dependencies.@hagicode/hagilight-core=1.2.3']);
  }
  assert.deepEqual(stamps['@hagicode/hagilight-mermaid'], ['version=1.2.3']);
  assert.deepEqual(stamps['hagilight-core-footer-example'], [
    'dependencies.@hagicode/hagilight=1.2.3',
    'dependencies.@hagicode/hagilight-core=1.2.3',
    'dependencies.@hagicode/hagilight-mermaid=1.2.3',
  ]);
  assert.ok(stamps['hagilight-example'].includes('dependencies.@hagicode/hagilight-starlight=1.2.3'));
  assert.ok(stamps['hagilight-example'].includes('dependencies.@hagicode/hagilight-core=1.2.3'));
});

test('rejects a Docusaurus dependency on either Astro-based feature package', () => {
  for (const name of ['@hagicode/hagilight', '@hagicode/hagilight-starlight']) {
    const manifests = PACKAGES.map(({ directory }) => readManifest(directory));
    const docusaurus = manifests.find((manifest) => manifest.name === '@hagicode/hagilight-docusaurus');
    docusaurus.dependencies = { ...docusaurus.dependencies, [name]: docusaurus.version };
    assert.throws(() => assertPackageGraph(manifests), {
      message: `@hagicode/hagilight-docusaurus must not depend on ${name} (dependencies)`,
    });
  }
});

test('lets the standalone mermaid package carry no core dependency', () => {
  const manifests = PACKAGES.map(({ directory }) => readManifest(directory));
  const mermaid = manifests.find((manifest) => manifest.name === '@hagicode/hagilight-mermaid');
  assert.equal(mermaid.dependencies?.['@hagicode/hagilight-core'], undefined);
  assert.equal(assertPackageGraph(manifests), manifests[0].version);
});

test('rejects a standalone package whose version drifts from core', () => {
  const manifests = PACKAGES.map(({ directory }) => readManifest(directory));
  const mermaid = manifests.find((manifest) => manifest.name === '@hagicode/hagilight-mermaid');
  mermaid.version = '9.9.9';
  assert.throws(() => assertPackageGraph(manifests), {
    message: `@hagicode/hagilight-mermaid@9.9.9 does not match @hagicode/hagilight-core@${manifests[0].version}`,
  });
});

test('rejects a standalone package that depends on another feature package', () => {
  const manifests = PACKAGES.map(({ directory }) => readManifest(directory));
  const mermaid = manifests.find((manifest) => manifest.name === '@hagicode/hagilight-mermaid');
  mermaid.peerDependencies = { ...mermaid.peerDependencies, '@hagicode/hagilight-docusaurus': mermaid.version };
  assert.throws(() => assertPackageGraph(manifests), {
    message: '@hagicode/hagilight-mermaid must not depend on @hagicode/hagilight-docusaurus (peerDependencies)',
  });
});

test('keeps a sha with a letter as is and prefixes a sha made only of digits so SemVer keeps it a string', () => {
  assert.equal(devVersion('0.19.1', '189', '1', '6e24429ffff'), '0.19.1-dev.189.1.6e24429');
  assert.equal(devVersion('0.19.1', '189', '1', '0a9f22fffff'), '0.19.1-dev.189.1.0a9f22f');
  assert.equal(devVersion('0.19.1', '189', '1', '1008756ffff'), '0.19.1-dev.189.1.g1008756');
  assert.equal(devVersion('0.19.1', '189', '1', '0123456ffff'), '0.19.1-dev.189.1.g0123456');
  assert.throws(() => devVersion('0.19.1', '0', '1', '6e24429ffff'), /required/);
  for (const ok of ['0.19.1', '0.19.1-dev.189.1.6e24429', '0.19.1-dev.189.1.g1008756']) assert.equal(isPublishVersion(ok), true, ok);
  for (const bad of ['v0.19.1', '0.19.1-dev.189.1.1008756', '0.19.1-dev.189.1.g6e24429', '0.19.1-dev.0.1.6e24429']) {
    assert.equal(isPublishVersion(bad), false, bad);
  }
});
