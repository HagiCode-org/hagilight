import type { MiddlewareHandler } from 'astro';
import type { BuildInfo } from '@hagicode/hagilight-core/build-info';
import buildInfo from 'virtual:hagilight/build-info';

export const onRequest: MiddlewareHandler = (context, next) => {
  (context.locals as { hagilightBuild?: BuildInfo }).hagilightBuild = buildInfo;
  return next();
};
