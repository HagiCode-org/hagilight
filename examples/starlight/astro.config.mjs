import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';
import { locales as packageLocales } from '@hagicode/hagilight-starlight/locales';

// Astro lowercases slug segments, so Starlight locale keys must be lowercase to
// match their content folders (e.g. a `de-DE` key would route content to the
// lowercased `/de-de/` but fail to detect the locale). We keep the package's
// labels and BCP-47 `lang` values and only normalize the routing keys.
const locales = Object.fromEntries(
  Object.entries(packageLocales).map(([code, value]) => [code.toLowerCase(), value]),
);

const base = process.env.HAGILIGHT_EXAMPLE_BASE ?? '/';
const rssOption = (name) => {
  const key = name.replace(/[A-Z]/gu, (letter) => `_${letter}`).toUpperCase();
  return process.env[`HAGILIGHT_RSS_${key}`] !== 'false';
};

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base,
  integrations: [
    starlight({
      title: 'Hagilight example',
      editLink: { baseUrl: 'https://github.com/HagiCode-org/hagilight/edit/main/' },
      locales,
      plugins: [hagilight({
        rss: {
          includeDocs: rssOption('includeDocs'),
          includeBlog: rssOption('includeBlog'),
        },
        hagicodePromotion: { enabled: true },
        promoto: { enabled: true },
        aiDisclosures: {
          isAITranslation: true,
          isAIAuthor: true,
          sourceLocale: 'root',
        },
        links: {
          siteId: 'hagilight-example',
          siteUrl: 'https://hagilight.hagicode.com/',
        },
      })],
    }),
  ],
});