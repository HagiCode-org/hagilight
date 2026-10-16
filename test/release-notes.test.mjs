import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { bumpVersion, groupCommits, parseCommit, renderNotes } from '../.github/scripts/release-notes.mjs';

const sha = (n) => String(n).repeat(40);
const commit = (subject, body = '', n = 1) => parseCommit({ sha: sha(n), subject, body });

test('parses Conventional Commit headers, scopes, and breaking markers', () => {
  assert.deepEqual(commit('feat(core): add links'), {
    sha: sha(1), type: 'feat', scope: 'core', description: 'add links', breaking: false,
  });
  assert.equal(commit('fix!: drop option').breaking, true);
  assert.equal(commit('refactor(core): tidy', 'BREAKING CHANGE: renamed export').breaking, true);
  assert.equal(commit('Update readme').type, null);
  assert.equal(commit('feat:missing space').type, null);
});

test('groups commits by section in display order and omits empty sections', () => {
  const commits = [
    commit('ci: run on node 24', '', 1),
    commit('feat(core): a', '', 2),
    commit('Tweak things', '', 3),
    commit('fix(core)!: b', '', 4),
    commit('docs: c', '', 5),
  ];
  assert.deepEqual(groupCommits(commits).map(({ title }) => title), [
    'Breaking Changes', 'Features', 'Documentation', 'Maintenance', 'Other Changes',
  ]);
});

test('bumps patch, minor for features, and minor or major for breaking changes', () => {
  assert.equal(bumpVersion('0.9.8', [commit('fix: x'), commit('docs: y')]), '0.9.9');
  assert.equal(bumpVersion('0.9.8', [commit('fix: x'), commit('feat: y')]), '0.10.0');
  assert.equal(bumpVersion('0.9.8', [commit('feat!: y')]), '0.10.0');
  assert.equal(bumpVersion('1.2.3', [commit('feat: y'), commit('fix!: z')]), '2.0.0');
});

test('handles a range without commits', () => {
  assert.equal(bumpVersion('0.9.8', []), '0.9.9');
  assert.equal(renderNotes([]), '## Changes\n\n_No changes yet._\n');
});

test('renders scoped entries with commit links', () => {
  const body = renderNotes([commit('feat(core): add links', '', 1), commit('Tweak things', '', 2)], 'HagiCode-org/hagilight');
  assert.equal(body, [
    '## Changes',
    '',
    '### Features',
    '',
    `- **core:** add links ([\`1111111\`](https://github.com/HagiCode-org/hagilight/commit/${sha(1)}))`,
    '',
    '### Other Changes',
    '',
    `- Tweak things ([\`2222222\`](https://github.com/HagiCode-org/hagilight/commit/${sha(2)}))`,
    '',
  ].join('\n'));
});

test('release drafter workflow builds notes from full git history and keeps drafts unpublished', () => {
  const workflow = readFileSync(new URL('../.github/workflows/release-drafter.yml', import.meta.url), 'utf8');
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /\.github\/scripts\/release-notes\.mjs version/);
  assert.match(workflow, /\.github\/scripts\/release-notes\.mjs notes/);
  assert.match(workflow, /--draft/);
  assert.doesNotMatch(workflow, /release-drafter\/release-drafter/);
});
