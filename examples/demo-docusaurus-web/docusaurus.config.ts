import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { hagilightDocusaurus } from '@hagicode/hagilight-docusaurus';
import { i18n } from '@hagicode/hagilight-docusaurus/locales';

const analyticsDisabled = process.env.HAGILIGHT_DEMO_ANALYTICS === 'off';

const config: Config = {
  title: 'Hagilight for Docusaurus',
  tagline: 'One plugin. Every HagiCode site feature.',
  favicon: 'img/logo.svg',
  url: 'https://docusaurus.hagicode.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  i18n,
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: {
          blogTitle: 'Blog',
          showReadingTime: false,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        // The plugin provides the sitemap fallback, so the demo exercises it.
        sitemap: false,
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    hagilightDocusaurus({
      seo: {
        image: '/img/social-card.png',
        organization: {
          name: 'HagiCode',
          url: 'https://hagicode.com',
          logo: 'https://docusaurus.hagicode.com/img/logo.svg',
        },
      },
      analytics: {
        googleAnalytics: { enabled: !analyticsDisabled, measurementId: 'G-EN03FMT2Q4' },
        fiftyOneLa: { enabled: !analyticsDisabled, siteId: 'L6b88a5yK4h2Xnci' },
      },
    }),
  ],
  themeConfig: {
    navbar: {
      title: 'Hagilight',
      logo: { alt: 'Hagilight logo', src: 'img/logo.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' },
        { to: '/blog', label: 'Blog', position: 'left' },
        { type: 'localeDropdown', position: 'right' },
        { href: 'https://github.com/HagiCode-org/hagilight', label: 'GitHub', position: 'right' },
      ],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
