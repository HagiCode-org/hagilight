import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  buildInfoFromLocals,
  buildInfoItems,
  normalizeBuildInfo,
  shortCommit,
  UNKNOWN,
} from '@hagicode/hagilight-core/build-info';
import { resolveBuildInfo } from '@hagicode/hagilight-core/build-info-resolver';

const scratch = mkdtempSync(join(tmpdir(), 'hagilight-build-info-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const NOW = new Date('2026-10-13T08:12:34.789Z');
const BUILT_AT = '2026-10-13T08:12:34Z';
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Hagilight Test',
      GIT_AUTHOR_EMAIL: 'test@example.invalid',
      GIT_COMMITTER_NAME: 'Hagilight Test',
      GIT_COMMITTER_EMAIL: 'test@example.invalid',
    },
  }).trim();
}

function createRepository(name, { commit = true } = {}) {
  const dir = join(scratch, name);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  if (commit) {
    writeFileSync(join(dir, 'README.md'), '# fixture\n');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-q', '-m', 'init');
  }
  return dir;
}

function createOutsideDirectory(name) {
  const dir = join(scratch, 'outside', name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test('branch and commit come from the checkout at the project root', () => {
  const repo = createRepository('branch-and-commit');
  const head = git(repo, 'rev-parse', 'HEAD');
  const info = resolveBuildInfo({ root: repo, env: {}, now: NOW });
  assert.equal(info.branch, 'main');
  assert.equal(info.commit, head);
  assert.equal(info.builtAt, BUILT_AT);
});

test('a detached HEAD yields an unknown branch and keeps the checked-out commit', () => {
  const repo = createRepository('detached');
  const head = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '-q', '--detach');
  const info = resolveBuildInfo({ root: repo, env: {}, now: NOW });
  assert.equal(info.branch, UNKNOWN);
  assert.equal(info.commit, head);
});

test('a project root inside a repository subdirectory finds the repository', () => {
  const repo = createRepository('monorepo');
  const head = git(repo, 'rev-parse', 'HEAD');
  const site = join(repo, 'packages', 'site');
  mkdirSync(site, { recursive: true });
  const info = resolveBuildInfo({ root: site, env: {}, now: NOW });
  assert.equal(info.branch, 'main');
  assert.equal(info.commit, head);
});

test('a directory outside any repository yields unknown Git fields and a build time', () => {
  const outside = createOutsideDirectory('plain');
  const info = resolveBuildInfo({ root: outside, env: {}, now: NOW });
  assert.deepEqual({ ...info }, { branch: UNKNOWN, commit: UNKNOWN, builtAt: BUILT_AT });
});

test('an unborn branch reports the branch with an unknown commit', () => {
  const repo = createRepository('unborn', { commit: false });
  const info = resolveBuildInfo({ root: repo, env: {}, now: NOW });
  assert.equal(info.branch, 'main');
  assert.equal(info.commit, UNKNOWN);
});

test('a missing git program yields unknown Git fields without throwing', () => {
  const repo = createRepository('missing-git');
  const previousPath = process.env.PATH;
  process.env.PATH = '';
  try {
    const info = resolveBuildInfo({ root: repo, env: {}, now: NOW });
    assert.deepEqual({ ...info }, { branch: UNKNOWN, commit: UNKNOWN, builtAt: BUILT_AT });
  } finally {
    process.env.PATH = previousPath;
  }
});

test('explicit overrides win over Git and are trimmed and lowercased', () => {
  const repo = createRepository('overrides');
  git(repo, 'rev-parse', 'HEAD');
  const info = resolveBuildInfo({
    root: repo,
    env: { HAGILIGHT_BUILD_BRANCH: '  release/2026-10  ', HAGILIGHT_BUILD_COMMIT: 'ABCDEF0' },
    now: NOW,
  });
  assert.equal(info.branch, 'release/2026-10');
  assert.equal(info.commit, 'abcdef0');
});

test('explicit values produce a complete result without any repository', () => {
  const outside = createOutsideDirectory('explicit-only');
  const info = resolveBuildInfo({
    root: outside,
    env: { HAGILIGHT_BUILD_BRANCH: 'main', HAGILIGHT_BUILD_COMMIT: 'a1b2c3d4e5f6' },
    now: NOW,
  });
  assert.deepEqual({ ...info }, { branch: 'main', commit: 'a1b2c3d4e5f6', builtAt: BUILT_AT });
});

test('blank and invalid overrides fall through to Git', () => {
  const repo = createRepository('fall-through');
  const head = git(repo, 'rev-parse', 'HEAD');
  const invalid = [
    { HAGILIGHT_BUILD_BRANCH: '   ', HAGILIGHT_BUILD_COMMIT: 'xyz' },
    { HAGILIGHT_BUILD_BRANCH: 'bad\nbranch', HAGILIGHT_BUILD_COMMIT: 'abc' },
    { HAGILIGHT_BUILD_BRANCH: '', HAGILIGHT_BUILD_COMMIT: 'g'.repeat(7) },
    { HAGILIGHT_BUILD_COMMIT: 'a'.repeat(65) },
  ];
  for (const env of invalid) {
    const info = resolveBuildInfo({ root: repo, env, now: NOW });
    assert.equal(info.branch, 'main', JSON.stringify(env));
    assert.equal(info.commit, head, JSON.stringify(env));
  }
});

test('an explicit branch and Git commit resolve independently', () => {
  const repo = createRepository('independent');
  const head = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '-q', '--detach');
  const info = resolveBuildInfo({ root: repo, env: { HAGILIGHT_BUILD_BRANCH: 'main' }, now: NOW });
  assert.equal(info.branch, 'main');
  assert.equal(info.commit, head);
});

test('the build time is the UTC start moment truncated to whole seconds', () => {
  const info = resolveBuildInfo({ root: createOutsideDirectory('time'), env: {}, now: NOW });
  assert.match(info.builtAt, TIME_PATTERN);
  assert.equal(info.builtAt, BUILT_AT);
});

test('the resolved result is frozen', () => {
  const info = resolveBuildInfo({ root: createOutsideDirectory('frozen'), env: {}, now: NOW });
  assert.equal(Object.isFrozen(info), true);
});

test('normalizeBuildInfo maps missing and invalid fields to unknown', () => {
  assert.deepEqual({ ...normalizeBuildInfo(null) }, { branch: UNKNOWN, commit: UNKNOWN, builtAt: UNKNOWN });
  assert.deepEqual(
    { ...normalizeBuildInfo({ branch: '', commit: 'a1b2c3', builtAt: '2026-10-13T08:12:34.000Z' }) },
    { branch: UNKNOWN, commit: UNKNOWN, builtAt: UNKNOWN },
  );
  assert.deepEqual(
    { ...normalizeBuildInfo({ branch: 'main', commit: 'a'.repeat(65), builtAt: BUILT_AT }) },
    { branch: 'main', commit: UNKNOWN, builtAt: BUILT_AT },
  );
});

test('normalizeBuildInfo lowercases a valid hash', () => {
  const info = normalizeBuildInfo({ branch: 'main', commit: 'A1B2C3D4E5F6', builtAt: BUILT_AT });
  assert.equal(info.commit, 'a1b2c3d4e5f6');
});

test('shortCommit keeps the first seven characters and leaves unknown alone', () => {
  assert.equal(shortCommit('A1B2C3D4E5F60718293A4B5C6D7E8F9012345678'), 'a1b2c3d');
  assert.equal(shortCommit(UNKNOWN), UNKNOWN);
});

test('buildInfoItems renders the three display items with the full hash retained', () => {
  const items = buildInfoItems({
    branch: 'main',
    commit: 'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678',
    builtAt: BUILT_AT,
  });
  assert.deepEqual(items.map(({ field, label, text }) => [field, label, text]), [
    ['branch', 'Branch', 'main'],
    ['commit', 'Commit', 'a1b2c3d'],
    ['builtAt', 'Built', BUILT_AT],
  ]);
  assert.equal(items[1].title, 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678');
  assert.equal(items[2].datetime, BUILT_AT);
  assert.equal(items[0].title, undefined);
  assert.equal(items[0].datetime, undefined);
});

test('buildInfoItems shows unknown without a full-hash attribute', () => {
  const items = buildInfoItems({ branch: UNKNOWN, commit: UNKNOWN, builtAt: BUILT_AT });
  assert.equal(items[1].text, UNKNOWN);
  assert.equal(items[1].title, undefined);
});

test('buildInfoItems returns no items when no value is supplied', () => {
  assert.deepEqual(buildInfoItems(undefined), []);
  assert.deepEqual(buildInfoItems(null), []);
});

test('buildInfoFromLocals reads the middleware value and never throws', () => {
  assert.equal(buildInfoFromLocals({}), undefined);
  assert.equal(buildInfoFromLocals(null), undefined);
  assert.equal(buildInfoFromLocals('locals'), undefined);
  assert.deepEqual(
    { ...buildInfoFromLocals({ hagilightBuild: { branch: 'main', commit: 'a1b2c3d', builtAt: BUILT_AT } }) },
    { branch: 'main', commit: 'a1b2c3d', builtAt: BUILT_AT },
  );
  assert.deepEqual(
    { ...buildInfoFromLocals({ hagilightBuild: 42 }) },
    { branch: UNKNOWN, commit: UNKNOWN, builtAt: UNKNOWN },
  );
});
