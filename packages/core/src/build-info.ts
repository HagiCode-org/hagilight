export const UNKNOWN = 'unknown';

export interface BuildInfo {
  readonly branch: string;
  readonly commit: string;
  readonly builtAt: string;
}

export interface BuildInfoItem {
  readonly field: 'branch' | 'commit' | 'builtAt';
  readonly label: string;
  readonly text: string;
  readonly title?: string;
  readonly datetime?: string;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/iu;
const BUILT_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeBranch(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const branch = value.trim();
  return branch && !CONTROL_CHARACTERS.test(branch) ? branch : undefined;
}

export function normalizeCommit(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const commit = value.trim();
  return COMMIT_PATTERN.test(commit) ? commit.toLowerCase() : undefined;
}

function normalizeBuiltAt(value: unknown): string | undefined {
  if (typeof value !== 'string' || !BUILT_AT_PATTERN.test(value)) return undefined;
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}

export function normalizeBuildInfo(input: unknown): BuildInfo {
  const record = isRecord(input) ? input : {};
  return Object.freeze({
    branch: normalizeBranch(record.branch) ?? UNKNOWN,
    commit: normalizeCommit(record.commit) ?? UNKNOWN,
    builtAt: normalizeBuiltAt(record.builtAt) ?? UNKNOWN,
  });
}

export function shortCommit(commit: string): string {
  return normalizeCommit(commit)?.slice(0, 7) ?? UNKNOWN;
}

export function buildInfoFromLocals(locals: unknown): BuildInfo | undefined {
  if (!isRecord(locals) || locals.hagilightBuild === undefined) return undefined;
  return normalizeBuildInfo(locals.hagilightBuild);
}

export function buildInfoItems(info: BuildInfo | null | undefined): readonly BuildInfoItem[] {
  if (info === undefined || info === null) return [];
  const { branch, commit, builtAt } = normalizeBuildInfo(info);
  return [
    { field: 'branch', label: 'Branch', text: branch },
    {
      field: 'commit',
      label: 'Commit',
      text: shortCommit(commit),
      ...(commit === UNKNOWN ? {} : { title: commit }),
    },
    {
      field: 'builtAt',
      label: 'Built',
      text: builtAt,
      ...(builtAt === UNKNOWN ? {} : { datetime: builtAt }),
    },
  ];
}
