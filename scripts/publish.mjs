import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

if (process.env.GITHUB_REPOSITORY !== 'HagiCode-org/hagilight') {
  throw new Error('Publishing is only allowed from HagiCode-org/hagilight');
}
if (!process.env.GITHUB_WORKFLOW_REF?.startsWith('HagiCode-org/hagilight/.github/workflows/npm-publish.yml@')) {
  throw new Error('Publishing requires the npm-publish.yml trusted publisher workflow');
}
const tag = process.argv[2];
if (!['dev', 'latest'].includes(tag)) throw new Error('Usage: node scripts/publish.mjs dev|latest');

for (const directory of ['astro', 'starlight']) {
  const { name, version, repository } = JSON.parse(readFileSync(`packages/${directory}/package.json`, 'utf8'));
  if (repository?.url !== 'git+https://github.com/HagiCode-org/hagilight.git') {
    throw new Error(`${name} has an unexpected repository URL`);
  }
  let versions;
  try {
    versions = JSON.parse(execFileSync('npm', ['view', name, 'versions', '--json', '--registry', 'https://registry.npmjs.org'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
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
    stdio: 'inherit',
    env: { ...process.env, NPM_CONFIG_PROVENANCE: 'true' },
  });
}
