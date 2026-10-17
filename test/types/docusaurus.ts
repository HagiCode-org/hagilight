// Type fixture for @hagicode/hagilight-docusaurus. Each `@ts-expect-error` line must stay an error.
import type { Config, I18nConfig, PluginModule } from '@docusaurus/types';
import { hagilightDocusaurus, type HagilightDocusaurusOptions, type PostHogOptions } from '@hagicode/hagilight-docusaurus';
import { i18n } from '@hagicode/hagilight-docusaurus/locales';

const options: HagilightDocusaurusOptions = {
  footer: { enabled: true },
  promoto: { enabled: false },
  languageSelector: { enabled: true },
  seo: {
    image: '/img/social-card.png',
    organization: { name: 'HagiCode', url: 'https://hagicode.com', logo: 'https://hagicode.com/logo.svg' },
  },
  sitemap: { enabled: true },
  robots: { enabled: false },
  rss: { enabled: true, includeDocs: false, includeBlog: true },
  noIndex: false,
  analytics: {
    googleAnalytics: { measurementId: 'G-EN03FMT2Q4' },
    fiftyOneLa: { enabled: false },
  },
};
const plugins: PluginModule[] = [hagilightDocusaurus(), hagilightDocusaurus(options)];
const siteConfig: Pick<Config, 'plugins'> = { plugins: [hagilightDocusaurus(options)] };
const localeCatalog: I18nConfig = i18n;

hagilightDocusaurus({ metadata: false });
hagilightDocusaurus({ metadata: { name: 'HagiCode Docs', description: 'Documentation for HagiCode.' } });
// @ts-expect-error The metadata option is a boolean or an options object.
hagilightDocusaurus({ metadata: 'yes' });
// @ts-expect-error Misspelled metadata fields are rejected.
hagilightDocusaurus({ metadata: { title: 'HagiCode Docs' } });
// @ts-expect-error Feature toggles are objects, so a bare boolean is rejected.
hagilightDocusaurus({ sitemap: true });
// @ts-expect-error Misspelled top-level option names are rejected.
hagilightDocusaurus({ seoo: {} });
// @ts-expect-error The SEO enabled switch is a boolean.
hagilightDocusaurus({ seo: { enabled: 'yes' } });
// @ts-expect-error The SEO image is a string path or URL.
hagilightDocusaurus({ seo: { image: 42 } });
// @ts-expect-error Misspelled SEO fields are rejected.
hagilightDocusaurus({ seo: { organisation: {} } });
// @ts-expect-error The sitemap toggle is an object, not a string.
hagilightDocusaurus({ sitemap: 'yes' });
// @ts-expect-error The robots toggle is an object, not a boolean.
hagilightDocusaurus({ robots: false });
// @ts-expect-error RSS include flags are booleans.
hagilightDocusaurus({ rss: { includeDocs: 'yes' } });
// @ts-expect-error Misspelled RSS fields are rejected.
hagilightDocusaurus({ rss: { includeBlogs: true } });
// @ts-expect-error The noIndex switch is a boolean.
hagilightDocusaurus({ noIndex: 'true' });
// @ts-expect-error Analytics measurement IDs must be strings.
hagilightDocusaurus({ analytics: { googleAnalytics: { measurementId: 1 } } });
// @ts-expect-error The 51LA site ID key is siteId.
hagilightDocusaurus({ analytics: { fiftyOneLa: { id: 'L6b88a5yK4h2Xnci' } } });

export { localeCatalog, plugins, siteConfig };

const posthog: PostHogOptions = { apiKey: 'phc_Custom123' };
hagilightDocusaurus({ analytics: { posthog } });
hagilightDocusaurus({ analytics: {} });
hagilightDocusaurus({ analytics: { posthog: {} } });
hagilightDocusaurus({ analytics: { posthog: { enabled: false } } });
// @ts-expect-error PostHog options are an object.
hagilightDocusaurus({ analytics: { posthog: true } });
// @ts-expect-error PostHog enabled is boolean.
hagilightDocusaurus({ analytics: { posthog: { enabled: 'yes' } } });
// @ts-expect-error PostHog project keys are strings.
hagilightDocusaurus({ analytics: { posthog: { apiKey: 42 } } });
// @ts-expect-error The PostHog key field is apiKey.
hagilightDocusaurus({ analytics: { posthog: { key: 'phc_Test' } } });
