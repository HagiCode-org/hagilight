import { execFileSync } from 'node:child_process';
import {
  CORE_PACKAGE,
  EXAMPLES,
  PACKAGES,
  STANDALONE,
  assertPackageGraph,
  pnpm,
  readManifest,
  root,
} from './packages.mjs';

const packageVersion = readManifest(PACKAGES[0].directory).version;

export function stableVersion(tag) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag);
  if (!match) throw new Error(`Expected a stable release tag vX.Y.Z, received: ${tag}`);
  return match.slice(1).join('.');
}

const PUBLISH_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-dev\.[1-9]\d*\.[1-9]\d*\.(?:(?=[0-9]*[a-f])[0-9a-f]{7}|g[0-9]{7}))?$/;

/**
 * Development version `<base>-dev.<run>.<attempt>.<sha7>`. SemVer reads an all-digit identifier as a number (and refuses
 * one with a leading zero), so a sha made only of digits gets a `g` prefix, as in `git describe`. A sha with a letter in
 * it is already a valid identifier and is left alone.
 */
export function devVersion(base, run, attempt, sha) {
  const short = sha?.slice(0, 7).toLowerCase();
  if (!/^[1-9]\d*$/.test(run ?? '') || !/^[1-9]\d*$/.test(attempt ?? '') || !/^[0-9a-f]{7}$/.test(short ?? '')) {
    throw new Error('GITHUB_RUN_NUMBER, GITHUB_RUN_ATTEMPT, and GITHUB_SHA are required');
  }
  return `${base}-dev.${run}.${attempt}.${/^\d+$/.test(short) ? `g${short}` : short}`;
}

export function isPublishVersion(version) {
  return PUBLISH_VERSION.test(version ?? '');
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

/** Hagilight dependency fields to stamp in each workspace, in core-first package order. */
export function dependencyStamps(version) {
  const names = new Set(PACKAGES.map(({ name }) => name));
  return [
    ...PACKAGES.map(({ name }) => ({
      workspace: name,
      values: [
        `version=${version}`,
        ...(name === CORE_PACKAGE || STANDALONE.includes(name) ? [] : [`dependencies.${CORE_PACKAGE}=${version}`]),
      ],
    })),
    ...EXAMPLES.map(({ name, directory }) => {
      const manifest = readManifest(directory);
      return {
        workspace: name,
        values: ['dependencies', 'devDependencies'].flatMap((field) => Object.keys(manifest[field] ?? {})
          .filter((dependency) => names.has(dependency))
          .map((dependency) => `${field}.${dependency}=${version}`)),
      };
    }),
  ].filter(({ values }) => values.length > 0);
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  assertPackageGraph();
  if (command === 'dev') {
    const base = nextBaseVersion(await fetchReleases(), packageVersion);
    process.stdout.write(devVersion(base, process.env.GITHUB_RUN_NUMBER, process.env.GITHUB_RUN_ATTEMPT, process.env.GITHUB_SHA));
  } else if (command === 'verify') {
    const version = stableVersion(argument ?? '');
    if (compareVersions(version, packageVersion) < 0) throw new Error(`Release ${version} predates package ${packageVersion}`);
    process.stdout.write(version);
  } else if (command === 'stamp') {
    if (!isPublishVersion(argument)) {
      throw new Error(`Invalid publish version: ${argument}`);
    }
    for (const { workspace, values } of dependencyStamps(argument)) {
      execFileSync('npm', ['pkg', 'set', ...values, '-w', workspace], { cwd: root, stdio: 'inherit' });
    }
    execFileSync(pnpm, ['install', '--lockfile-only', '--ignore-scripts', '--prefer-offline'], { cwd: root, stdio: 'inherit' });
    assertPackageGraph();
  } else {
    throw new Error('Usage: node scripts/release.mjs dev|verify <tag>|stamp <version>');
  }
}

if (process.argv[1]?.endsWith('/scripts/release.mjs')) await main();
