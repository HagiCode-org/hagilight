import { execFileSync } from 'node:child_process';
import { PACKAGES, assertPackageGraph, readManifest, root } from './packages.mjs';

if (process.env.GITHUB_REPOSITORY !== 'HagiCode-org/hagilight') {
  throw new Error('Publishing is only allowed from HagiCode-org/hagilight');
}
if (!process.env.GITHUB_WORKFLOW_REF?.startsWith('HagiCode-org/hagilight/.github/workflows/npm-publish.yml@')) {
  throw new Error('Publishing requires the npm-publish.yml trusted publisher workflow');
}
const tag = process.argv[2];
if (!['dev', 'latest'].includes(tag)) throw new Error('Usage: node scripts/publish.mjs dev|latest');

assertPackageGraph();

// Core publishes first; a failure stops the loop so no dependent package is
// published against an unavailable core version.
for (const { directory } of PACKAGES) {
  const { name, version, repository } = readManifest(directory);
  if (repository?.url !== 'git+https://github.com/HagiCode-org/hagilight.git' || repository?.directory !== directory) {
    throw new Error(`${name} has an unexpected repository URL or directory`);
  }
  let versions;
  try {
    versions = JSON.parse(execFileSync('npm', ['view', name, 'versions', '--json', '--registry', 'https://registry.npmjs.org'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch (error) {
    if (!error.stderr?.toString().includes('E404')) throw error;
    versions = [];
  }
  if ((Array.isArray(versions) ? versions : [versions]).includes(version)) {
    console.log(`${name}@${version} already exists; skipping`);
    continue;
  }
  execFileSync('npm', ['publish', '--workspace', name, '--tag', tag, '--access', 'public', '--provenance'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NPM_CONFIG_PROVENANCE: 'true' },
  });
}
