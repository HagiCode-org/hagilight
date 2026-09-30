import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PACKAGES } from '../scripts/packages.mjs';
import { compareVersions, dependencyStamps, nextBaseVersion, stableVersion } from '../scripts/release.mjs';

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

test('publishes shared core first and stamps it into both dependent packages and examples', () => {
  assert.deepEqual(PACKAGES.map(({ name }) => name), [
    '@hagicode/hagilight-core',
    '@hagicode/hagilight',
    '@hagicode/hagilight-starlight',
  ]);
  const stamps = Object.fromEntries(dependencyStamps('1.2.3').map(({ workspace, values }) => [workspace, values]));
  assert.deepEqual(stamps['@hagicode/hagilight-core'], ['version=1.2.3']);
  for (const name of ['@hagicode/hagilight', '@hagicode/hagilight-starlight']) {
    assert.deepEqual(stamps[name], ['version=1.2.3', 'dependencies.@hagicode/hagilight-core=1.2.3']);
  }
  assert.deepEqual(stamps['hagilight-core-footer-example'], [
    'dependencies.@hagicode/hagilight=1.2.3',
    'dependencies.@hagicode/hagilight-core=1.2.3',
  ]);
  assert.ok(stamps['hagilight-example'].includes('dependencies.@hagicode/hagilight-starlight=1.2.3'));
  assert.ok(stamps['hagilight-example'].includes('dependencies.@hagicode/hagilight-core=1.2.3'));
});
