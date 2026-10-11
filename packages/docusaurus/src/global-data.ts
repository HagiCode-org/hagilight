import type { LoadContext } from '@docusaurus/types';
import type { ResolvedHagilightOptions } from './options.js';

export const PLUGIN_NAME = '@hagicode/hagilight-docusaurus';

export interface HagilightGlobalData {
  version: string;
  options: ResolvedHagilightOptions;
  i18n: LoadContext['i18n'];
}
