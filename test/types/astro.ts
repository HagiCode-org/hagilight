// Type fixture for @hagicode/hagilight. Each `@ts-expect-error` line must stay an error.
import type { AstroIntegration } from 'astro';
import {
  hagilight,
  hagilightFavicon,
  type HagilightRssOptions,
  type RssFeedCallback,
} from '@hagicode/hagilight/integration';

const rssOptions: HagilightRssOptions = {
  getFeed: './src/rss-feed.ts',
};
const integrations: AstroIntegration[] = [
  hagilight(),
  hagilight({ enabled: false }),
  hagilight({ rss: false }),
  hagilight({ rss: rssOptions }),
  hagilight({ contentImages: false }),
  hagilight({ contentImages: { enabled: false } }),
  hagilightFavicon(),
  hagilightFavicon({ href: '/favicon.svg' }),
];
const getFeed: RssFeedCallback = async ({ route, lang }) => ({
  title: `${route} ${lang}`,
  description: 'Updates',
  items: [{ title: 'Post', link: '/post/', pubDate: '2026-01-01' }],
});

// @ts-expect-error The discovery switch is a boolean.
hagilight({ enabled: 'yes' });
// @ts-expect-error getFeed is a project-relative module path, not the callback itself.
hagilight({ rss: { getFeed } });
// @ts-expect-error RSS content locales, when provided, must be a locale map.
hagilight({ rss: { locales: 'en' } });
// @ts-expect-error Feed callbacks must return a description.
const missingDescription: RssFeedCallback = () => ({ title: 'Feed', items: [] });
// @ts-expect-error Content-image toggles are a boolean or an options object.
hagilight({ contentImages: 'yes' });
// @ts-expect-error The content-image enabled switch is a boolean.
hagilight({ contentImages: { enabled: 'yes' } });
hagilight({ metadata: false });
hagilight({ metadata: true });
hagilight({ metadata: { name: 'HagiCode Docs', description: 'Documentation for HagiCode.' } });
hagilight({ metadata: { enabled: false } });
// @ts-expect-error The metadata option is a boolean or an options object.
hagilight({ metadata: 'yes' });
// @ts-expect-error The metadata name is a string.
hagilight({ metadata: { name: 42 } });
// @ts-expect-error The metadata enabled switch is a boolean.
hagilight({ metadata: { enabled: 'yes' } });
// @ts-expect-error Misspelled metadata fields are rejected.
hagilight({ metadata: { title: 'HagiCode Docs' } });

export { integrations, missingDescription };
