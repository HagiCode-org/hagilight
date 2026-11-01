import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'packages', 'mermaid', 'package.json'), 'utf8'));
const core = JSON.parse(readFileSync(join(root, 'packages', 'core', 'package.json'), 'utf8'));
const FRAMEWORK_PACKAGES = [
  'react',
  'react-dom',
  'redux',
  '@reduxjs/toolkit',
  'react-i18next',
  'i18next',
  'astro',
  '@astrojs/starlight',
  '@docusaurus/core',
  '@docusaurus/theme-classic',
  '@hagicode/hagilight-core',
  '@hagicode/hagilight',
  '@hagicode/hagilight-starlight',
  '@hagicode/hagilight-docusaurus',
];

test('the manifest keeps mermaid as the required peer and pele as an optional, bounded peer', () => {
  assert.deepEqual(Object.keys(manifest.peerDependencies).sort(), ['mermaid', 'pele']);
  assert.equal(manifest.peerDependencies.mermaid, '^11');
  // Upper-bounded: ^1.13.0 stops before 2.0.0, and pele is never a hard dependency.
  assert.equal(manifest.peerDependencies.pele, '^1.13.0');
  assert.deepEqual(manifest.peerDependenciesMeta, { pele: { optional: true } });
  assert.equal(manifest.dependencies?.pele, undefined);
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of FRAMEWORK_PACKAGES) {
      assert.equal(manifest[field]?.[name], undefined, `${name} must not appear in ${field}`);
    }
  }
  assert.equal(manifest.version, core.version);
  assert.equal(manifest.repository.directory, 'packages/mermaid');
  assert.deepEqual(manifest.publishConfig, { access: 'public', provenance: true });
});

test('every subpath imports under Node with no DOM global', async () => {
  assert.equal(globalThis.document, undefined);
  assert.equal(globalThis.window, undefined);
  for (const subpath of Object.keys(manifest.exports)) {
    if (subpath.endsWith('.css')) continue;
    const specifier = subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`;
    const module = await import(specifier);
    assert.ok(Object.keys(module).length > 0, `${specifier} exports at least one value`);
  }
});

test('the pure helpers run under Node without a DOM', async () => {
  const { getMermaidThemeConfig } = await import('@hagicode/hagilight-mermaid/theme');
  const { postProcessMermaidSvg } = await import('@hagicode/hagilight-mermaid/svg');
  const { resolveLabels } = await import('@hagicode/hagilight-mermaid/labels');
  assert.equal(getMermaidThemeConfig('dark').securityLevel, 'strict');
  // Without DOMParser the post-processor returns its input unchanged, so server builds keep working.
  assert.equal(postProcessMermaidSvg('<svg></svg>'), '<svg></svg>');
  assert.equal(resolveLabels().errorTitle, 'Diagram Rendering Error');
});
