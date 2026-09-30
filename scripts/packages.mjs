import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
export const CORE_PACKAGE = '@hagicode/hagilight-core';

/** Publishable workspaces in dependency (and therefore publication) order: shared core first. */
export const PACKAGES = [
  { name: CORE_PACKAGE, directory: 'packages/core' },
  { name: '@hagicode/hagilight', directory: 'packages/astro' },
  { name: '@hagicode/hagilight-starlight', directory: 'packages/starlight' },
];

/** Private example workspaces and the Hagilight packages each one depends on. */
export const EXAMPLES = [
  { name: 'hagilight-core-footer-example', directory: 'examples/demo-web' },
  { name: 'hagilight-example', directory: 'examples/demo-starlight-web' },
];

export function readManifest(directory) {
  return JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8'));
}

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
}

/** Compile every package to ESM and declarations in core-first order. */
export function buildPackages() {
  run(npm, ['run', 'build']);
}

/**
 * Assert that versions are aligned: every package shares one version, both
 * feature packages depend on exactly that core version, and neither depends on
 * the other feature package.
 */
export function assertPackageGraph(manifests = PACKAGES.map(({ directory }) => readManifest(directory))) {
  const [core, ...dependents] = manifests;
  for (const manifest of manifests) {
    if (manifest.version !== core.version) {
      throw new Error(`${manifest.name}@${manifest.version} does not match ${core.name}@${core.version}`);
    }
  }
  const featureNames = new Set(dependents.map(({ name }) => name));
  for (const manifest of dependents) {
    if (manifest.dependencies?.[CORE_PACKAGE] !== core.version) {
      throw new Error(`${manifest.name} must depend on ${CORE_PACKAGE}@${core.version}`);
    }
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
      for (const name of Object.keys(manifest[field] ?? {})) {
        if (featureNames.has(name)) throw new Error(`${manifest.name} must not depend on ${name} (${field})`);
      }
    }
  }
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(core[field] ?? {})) {
      if (featureNames.has(name) || name === '@astrojs/starlight') {
        throw new Error(`${CORE_PACKAGE} must not depend on ${name} (${field})`);
      }
    }
  }
  return core.version;
}
