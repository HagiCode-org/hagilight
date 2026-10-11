import type { HtmlTagObject } from '@docusaurus/types';

export const DEFAULT_GOOGLE_ANALYTICS_ID = 'G-EN03FMT2Q4';
export const DEFAULT_FIFTY_ONE_LA_ID = 'L6b88a5yK4h2Xnci';
export const GOOGLE_ANALYTICS_ID_PATTERN = /^G-[A-Z0-9]+$/u;
export const FIFTY_ONE_LA_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;

export function googleAnalyticsHeadTags(measurementId: string): HtmlTagObject[] {
  return [
    {
      tagName: 'script',
      attributes: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}` },
    },
    {
      tagName: 'script',
      innerHTML: [
        'window.dataLayer = window.dataLayer || [];',
        'function gtag(){dataLayer.push(arguments);}',
        "gtag('js', new Date());",
        `gtag('config', ${JSON.stringify(measurementId)});`,
      ].join('\n'),
    },
  ];
}

export function fiftyOneLaHeadTags(siteId: string): HtmlTagObject[] {
  return [
    {
      tagName: 'script',
      attributes: { charset: 'UTF-8', id: 'LA_COLLECT', src: 'https://sdk.51.la/js-sdk-pro.min.js' },
    },
    {
      tagName: 'script',
      innerHTML: `LA.init(${JSON.stringify({ id: siteId, ck: siteId, autoTrack: true, hashMode: true, screenRecord: true })});`,
    },
  ];
}
