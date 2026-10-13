// Type fixture for the build-info core exports. Each `@ts-expect-error` line must stay an error.
import {
  buildInfoFromLocals,
  buildInfoItems,
  normalizeBuildInfo,
  shortCommit,
  UNKNOWN,
  type BuildInfo,
  type BuildInfoItem,
} from '@hagicode/hagilight-core/build-info';
import { resolveBuildInfo, type ResolveBuildInfoOptions } from '@hagicode/hagilight-core/build-info-resolver';

const info: BuildInfo = { branch: 'main', commit: 'a1b2c3d', builtAt: '2026-10-13T08:12:34Z' };
const items: readonly BuildInfoItem[] = buildInfoItems(info);
const label: string = items[0].label;
const short: string = shortCommit(info.commit);
const unknown: string = UNKNOWN;
const fromLocals: BuildInfo | undefined = buildInfoFromLocals({});
const normalized: BuildInfo = normalizeBuildInfo(null);
const options: ResolveBuildInfoOptions = { root: '.', env: {}, now: new Date() };
const resolved: BuildInfo = resolveBuildInfo(options);

// @ts-expect-error BuildInfo fields are strings.
const badBuildInfo: BuildInfo = { branch: 'main', commit: 1, builtAt: '2026-10-13T08:12:34Z' };

// @ts-expect-error resolveBuildInfo requires a root directory.
resolveBuildInfo({ env: {} });

export { badBuildInfo, label, normalized, short, unknown, fromLocals, resolved };
