declare module 'virtual:hagilight/rss-config' {
  const config: import('./rss-config.js').RssRuntimeConfig;
  export default config;
}

declare module 'virtual:hagilight/build-info' {
  const buildInfo: import('@hagicode/hagilight-core/build-info').BuildInfo;
  export default buildInfo;
}

declare module 'virtual:hagilight/consent-footer' {
  const consentFooter: import('./integration.js').ConsentFooterState;
  export default consentFooter;
}
