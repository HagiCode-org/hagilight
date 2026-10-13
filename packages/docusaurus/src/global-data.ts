import type { LoadContext } from '@docusaurus/types';
import type { BuildInfo } from '@hagicode/hagilight-core/build-info';
import type { ResolvedHagilightOptions } from './options.js';

export const PLUGIN_NAME = '@hagicode/hagilight-docusaurus';

export interface HagilightGlobalData {
  version: string;
  options: ResolvedHagilightOptions;
  i18n: LoadContext['i18n'];
  buildInfo: BuildInfo;
}
