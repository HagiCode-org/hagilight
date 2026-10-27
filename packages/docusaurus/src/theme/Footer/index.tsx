import FooterDefaults from '@theme-init/Footer';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { usePluginData } from '@docusaurus/useGlobalData';
import type { ReactElement } from 'react';
import { resolveFooterLinks } from '../../footer.js';
import { resolveConsentCopy } from '@hagicode/hagilight-core/consent-copy';
import { PLUGIN_NAME, type HagilightGlobalData } from '../../global-data.js';
import { FooterView, type FooterAvatar } from './FooterView.js';
import avatarAvif from '@hagicode/hagilight-core/assets/footer/avatar.avif';
import avatarWebp from '@hagicode/hagilight-core/assets/footer/avatar.webp';

export default function Footer(): ReactElement {
  const { i18n, siteConfig } = useDocusaurusContext();
  const { version, options, buildInfo, footerAvatarPool } = usePluginData(PLUGIN_NAME) as HagilightGlobalData;
  if (!options.footer) return <FooterDefaults />;
  const avatar: FooterAvatar | undefined = options.footerAvatar.avatar
    ? { avif: avatarAvif, webp: avatarWebp, randomPool: footerAvatarPool }
    : undefined;
  const links = resolveFooterLinks({
    locale: i18n.currentLocale,
    baseUrl: siteConfig.baseUrl,
    links: options.links,
    rssEnabled: options.rss.enabled,
  });
  return (
    <FooterView
      links={links}
      version={version}
      year={new Date().getFullYear()}
      buildInfo={buildInfo}
      avatar={avatar}
      siteId={options.links.siteId}
      siteUrl={options.links.siteUrl ?? siteConfig.url}
      consentLabel={options.consent.enabled ? resolveConsentCopy(i18n.currentLocale).footerEntry : undefined}
    />
  );
}
