import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packages = ['@hagicode/hagilight', '@hagicode/hagilight-starlight'];
const packageVersion = JSON.parse(readFileSync('packages/astro/package.json', 'utf8')).version;
const starlight = JSON.parse(readFileSync('packages/starlight/package.json', 'utf8'));

export function stableVersion(tag) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag);
  if (!match) throw new Error(`Expected a stable release tag vX.Y.Z, received: ${tag}`);
  return match.slice(1).join('.');
}

export function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function nextBaseVersion(releases, currentVersion) {
  const versions = releases.flatMap((release) => {
    try {
      return [{ version: stableVersion(release.tag_name), draft: release.draft, prerelease: release.prerelease }];
    } catch {
      return [];
    }
  });
  const published = versions.filter((item) => !item.draft && !item.prerelease)
    .map((item) => item.version).sort(compareVersions).at(-1);
  const draft = versions.filter((item) => item.draft && (!published || compareVersions(item.version, published) > 0))
    .map((item) => item.version).sort(compareVersions).at(-1);
  if (draft) return draft;
  if (!published) return currentVersion;
  const [major, minor, patch] = published.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

async function fetchReleases() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required for dev publishing');
  const releases = [];
  for (let page = 1; page <= 5; page++) {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`GitHub releases API returned HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('GitHub releases API returned an invalid response');
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return releases;
}

function assertPackages() {
  if (packageVersion !== starlight.version || starlight.dependencies['@hagicode/hagilight'] !== packageVersion) {
    throw new Error('Both packages and the Starlight dependency must have the same version');
  }
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  assertPackages();
  if (command === 'dev') {
    const base = nextBaseVersion(await fetchReleases(), packageVersion);
    const run = process.env.GITHUB_RUN_NUMBER;
    const attempt = process.env.GITHUB_RUN_ATTEMPT;
    const sha = process.env.GITHUB_SHA?.slice(0, 7).toLowerCase();
    if (!/^[1-9]\d*$/.test(run ?? '') || !/^[1-9]\d*$/.test(attempt ?? '') || !/^[0-9a-f]{7}$/.test(sha ?? '')) {
      throw new Error('GITHUB_RUN_NUMBER, GITHUB_RUN_ATTEMPT, and GITHUB_SHA are required');
    }
    process.stdout.write(`${base}-dev.${run}.${attempt}.${sha}`);
  } else if (command === 'verify') {
    const version = stableVersion(argument ?? '');
    if (compareVersions(version, packageVersion) < 0) throw new Error(`Release ${version} predates package ${packageVersion}`);
    process.stdout.write(version);
  } else if (command === 'stamp') {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-dev\.[1-9]\d*\.[1-9]\d*\.[0-9a-f]{7})?$/.test(argument ?? '')) {
      throw new Error(`Invalid publish version: ${argument}`);
    }
    for (const name of packages) {
      execFileSync('npm', ['pkg', 'set', `version=${argument}`, '-w', name], { stdio: 'inherit' });
    }
    execFileSync('npm', ['pkg', 'set', `dependencies.@hagicode/hagilight=${argument}`, '-w', packages[1]], { stdio: 'inherit' });
    execFileSync('npm', ['pkg', 'set', `dependencies.@hagicode/hagilight=${argument}`, `dependencies.@hagicode/hagilight-starlight=${argument}`, '-w', 'hagilight-example'], { stdio: 'inherit' });
    execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--offline'], { stdio: 'inherit' });
  } else {
    throw new Error('Usage: node scripts/release.mjs dev|verify <tag>|stamp <version>');
  }
}

if (process.argv[1]?.endsWith('/scripts/release.mjs')) await main();
