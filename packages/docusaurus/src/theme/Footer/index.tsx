import FooterDefaults from '@theme-init/Footer';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { usePluginData } from '@docusaurus/useGlobalData';
import type { ReactElement } from 'react';
import { resolveFooterLinks } from '../../footer.js';
import { PLUGIN_NAME, type HagilightGlobalData } from '../../global-data.js';
import { FooterView } from './FooterView.js';

export default function Footer(): ReactElement {
  const { i18n, siteConfig } = useDocusaurusContext();
  const { version, options } = usePluginData(PLUGIN_NAME) as HagilightGlobalData;
  if (!options.footer) return <FooterDefaults />;
  const links = resolveFooterLinks({
    locale: i18n.currentLocale,
    baseUrl: siteConfig.baseUrl,
    links: options.links,
    rssEnabled: options.rss.enabled,
  });
  return <FooterView links={links} version={version} year={new Date().getFullYear()} />;
}
