import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { usePluginData } from '@docusaurus/useGlobalData';
import ClassicSiteMetadata from '@docusaurus/theme-classic/lib/theme/SiteMetadata/index.js';
import type { ReactElement } from 'react';
import { PLUGIN_NAME, type HagilightGlobalData } from '../../global-data.js';
import { sharingMetadataFor } from '../../seo.js';
import { SharingMetadata } from './SharingMetadata.js';

export default function SiteMetadata(): ReactElement {
  const { siteConfig } = useDocusaurusContext();
  const { options } = usePluginData(PLUGIN_NAME) as HagilightGlobalData;
  const themeImage = siteConfig.themeConfig?.image;
  const sharing = sharingMetadataFor(options.seo, siteConfig, typeof themeImage === 'string' ? themeImage : undefined);
  return (
    <>
      {sharing !== undefined && <SharingMetadata Head={Head} {...sharing} />}
      <ClassicSiteMetadata />
    </>
  );
}
