import rssConfig from 'virtual:hagilight/rss-config';

export const onRequest = (context, next) => {
  context.locals.hagilightRss = rssConfig.footer;
  return next();
};
