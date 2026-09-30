import type { MiddlewareHandler } from 'astro';
import rssConfig from 'virtual:hagilight/rss-config';
import type { RssFooterContext } from './rss-config.js';

export const onRequest: MiddlewareHandler = (context, next) => {
  (context.locals as { hagilightRss?: RssFooterContext }).hagilightRss = rssConfig.footer;
  return next();
};
