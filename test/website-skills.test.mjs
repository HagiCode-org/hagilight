import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Guards the agent skills that ship in @hagicode/hagilight-core under packages/core/skills.
// It fails when a skill is malformed, names a references file that is missing, names a
// package subpath that the owning package no longer exports, or states a peer range that
// differs from its package manifest.

const root = fileURLToPath(new URL('../', import.meta.url));
const skillsRoot = join(root, 'packages', 'core', 'skills');
const relativeToRoot = (file) => file.slice(root.length);

const EXPECTED_SKILLS = [
  'hagilight',
  'hagilight-site-from-scratch',
  'hagilight-docs-site',
  'hagilight-official-website',
];

const PACKAGE_DIRECTORIES = {
  '@hagicode/hagilight': 'astro',
  '@hagicode/hagilight-core': 'core',
  '@hagicode/hagilight-starlight': 'starlight',
  '@hagicode/hagilight-docusaurus': 'docusaurus',
  '@hagicode/hagilight-mermaid': 'mermaid',
};

const manifests = Object.fromEntries(
  Object.entries(PACKAGE_DIRECTORIES).map(([name, directory]) => [
    name,
    JSON.parse(readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8')),
  ]),
);

function skillDirectories() {
  return readdirSync(skillsRoot).filter((entry) => statSync(join(skillsRoot, entry)).isDirectory()).sort();
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

function allSkillMarkdown() {
  return skillDirectories().flatMap((skill) => markdownFiles(join(skillsRoot, skill)));
}

function frontmatterOf(file) {
  const text = readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(text);
  if (!match) return undefined;
  const fields = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/u.exec(line);
    if (field) fields[field[1]] = field[2].trim().replace(/^"(.*)"$/u, '$1');
  }
  return fields;
}

// A package subpath is the specifier minus its package name: `''` is the root export.
function exportKeyFor(specifier) {
  const name = Object.keys(PACKAGE_DIRECTORIES).find(
    (candidate) => specifier === candidate || specifier.startsWith(`${candidate}/`),
  );
  if (!name) return undefined;
  const rest = specifier.slice(name.length);
  return { name, key: rest === '' ? '.' : `.${rest}` };
}

function exportIsDeclared(exportsMap, key) {
  if (Object.hasOwn(exportsMap, key)) return true;
  // Pattern exports such as `./comparison-articles-data/*.json` cover any matching subpath.
  return Object.keys(exportsMap).some((pattern) => {
    if (!pattern.includes('*')) return false;
    const [prefix, suffix] = pattern.split('*');
    return key.startsWith(prefix) && key.endsWith(suffix);
  });
}

test('every expected skill exists under packages/core/skills', () => {
  assert.deepEqual(skillDirectories(), [...EXPECTED_SKILLS].sort());
});

for (const skill of EXPECTED_SKILLS) {
  test(`${skill} has frontmatter whose name matches its folder and a non-empty description`, () => {
    const file = join(skillsRoot, skill, 'SKILL.md');
    assert.ok(existsSync(file), `${relativeToRoot(file)} is missing`);
    const fields = frontmatterOf(file);
    assert.ok(fields, `${relativeToRoot(file)} has no frontmatter block`);
    assert.equal(fields.name, skill, `${relativeToRoot(file)} name must equal its folder name ${skill}`);
    assert.ok(fields.description && fields.description.length > 0, `${relativeToRoot(file)} description must not be empty`);
  });
}

// A `references/` path or a relative `.md` link in a SKILL.md must exist, resolved from the skill's
// own folder. A cross-skill path such as `../other-skill/references/x.md` resolves through `..`.
test('every references/ path and relative .md link named by a SKILL.md exists', () => {
  const missing = [];
  for (const skill of skillDirectories()) {
    const skillDirectory = join(skillsRoot, skill);
    const file = join(skillDirectory, 'SKILL.md');
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const targets = [
      ...[...text.matchAll(/(?:\.\.\/[\w.-]+\/|[\w.-]+\/)?references\/[\w./-]+\.md/gu)].map((match) => match[0]),
      ...[...text.matchAll(/\]\((\.{1,2}\/[^)\s#]+\.md)\)/gu)].map((match) => match[1]),
    ];
    for (const target of targets) {
      if (!existsSync(join(skillDirectory, target))) missing.push(`${relativeToRoot(file)} names ${target}, which does not exist`);
    }
  }
  assert.deepEqual(missing, []);
});

// The peer ranges the skills state live in one table, so a range change has one place to update.
const VERSIONS_FILE = join(skillsRoot, 'hagilight-site-from-scratch', 'references', 'versions.md');
const REQUIRED_PEER_RANGES = [
  ['@hagicode/hagilight', 'astro'],
  ['@hagicode/hagilight-core', 'astro'],
  ['@hagicode/hagilight-starlight', 'astro'],
  ['@hagicode/hagilight-starlight', '@astrojs/starlight'],
  ['@hagicode/hagilight-docusaurus', '@docusaurus/core'],
  ['@hagicode/hagilight-docusaurus', '@docusaurus/theme-classic'],
];

function peerRangeRows() {
  const text = readFileSync(VERSIONS_FILE, 'utf8');
  return [...text.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*$/gmu)].map(
    ([, packageName, peer, range]) => ({ packageName, peer, range }),
  );
}

test('the peer ranges in versions.md equal the package manifests', () => {
  assert.ok(existsSync(VERSIONS_FILE), `${relativeToRoot(VERSIONS_FILE)} is missing`);
  const rows = peerRangeRows();
  const mismatches = [];
  for (const { packageName, peer, range } of rows) {
    const manifest = manifests[packageName];
    if (!manifest) {
      mismatches.push(`${relativeToRoot(VERSIONS_FILE)} names unknown package ${packageName}`);
      continue;
    }
    const declared = manifest.peerDependencies?.[peer];
    if (declared !== range) {
      mismatches.push(
        `${relativeToRoot(VERSIONS_FILE)} states ${peer} ${range} for ${packageName}, but its manifest declares ${declared ?? 'no peer'}`,
      );
    }
  }
  for (const [packageName, peer] of REQUIRED_PEER_RANGES) {
    if (!rows.some((row) => row.packageName === packageName && row.peer === peer)) {
      mismatches.push(`${relativeToRoot(VERSIONS_FILE)} has no row for ${peer} on ${packageName}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

// Every mention of a package subpath must be exported. A bare package name is checked only where
// it is imported (`from '…'`, `import '…'`, `import('…')`): install commands and tables name packages
// without importing them, and the Astro and core packages export no root entry to import.
test('every @hagicode/hagilight* subpath in a skill is exported by its owning package', () => {
  const stale = [];
  for (const file of allSkillMarkdown()) {
    const text = readFileSync(file, 'utf8');
    const importedBare = new Set(
      [...text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"](@hagicode\/hagilight(?:-[a-z]+)?)['"]/gu)].map((match) => match[1]),
    );
    for (const match of text.matchAll(/@hagicode\/hagilight(?:-[a-z]+)?(?:\/[\w.\-/[\]]*[\w\]])?/gu)) {
      const specifier = match[0];
      const hasSubpath = specifier !== exportKeyFor(specifier)?.name;
      if (!hasSubpath && !importedBare.has(specifier)) continue;
      const owner = exportKeyFor(specifier);
      if (!owner) continue;
      const exportsMap = manifests[owner.name].exports ?? {};
      if (!exportIsDeclared(exportsMap, owner.key)) {
        stale.push(`${relativeToRoot(file)} names ${specifier}, but ${owner.name} has no export ${owner.key}`);
      }
    }
  }
  assert.deepEqual(stale, []);
});
