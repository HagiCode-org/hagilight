import { execFileSync } from 'node:child_process';
import { normalizeBranch, normalizeCommit, UNKNOWN, type BuildInfo } from './build-info.js';

export interface ResolveBuildInfoOptions {
  /** Site project root. Git runs here, so a site inside a larger repository still finds it. */
  root: string;
  env?: Readonly<Record<string, string | undefined>>;
  now?: Date;
}

const GIT_TIMEOUT_MS = 5000;

function readGit(root: string, args: readonly string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
  } catch {
    return undefined;
  }
}

function formatBuiltAt(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/u, 'Z');
}

export function resolveBuildInfo({ root, env = process.env, now = new Date() }: ResolveBuildInfoOptions): BuildInfo {
  const branch = normalizeBranch(env.HAGILIGHT_BUILD_BRANCH)
    ?? normalizeBranch(readGit(root, ['symbolic-ref', '--short', '-q', 'HEAD']))
    ?? UNKNOWN;
  const commit = normalizeCommit(env.HAGILIGHT_BUILD_COMMIT)
    ?? normalizeCommit(readGit(root, ['rev-parse', 'HEAD']))
    ?? UNKNOWN;
  return Object.freeze({ branch, commit, builtAt: formatBuiltAt(now) });
}
