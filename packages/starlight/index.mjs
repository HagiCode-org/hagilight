import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveFaviconHeadEntry } from '@hagicode/hagilight/favicon';
import { resolveRssLocales, resolveRssOptions } from './rss-utils.mjs';
import {
  isValidSeoImageReference,
  resolveSeoImageUrl,
  resolveSeoLocales,
} from './seo-utils.mjs';

const GOOGLE_ID_PATTERN = /^G-[A-Z0-9]+$/u;
const FIFTY_ONE_LA_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const DEFAULT_GOOGLE_ANALYTICS_ID = 'G-EN03FMT2Q4';
const DEFAULT_51LA_ID = 'L6b88a5yK4h2Xnci';
const defaultLogo = fileURLToPath(import.meta.resolve('@hagicode/hagilight/logo.png'));
const contentWidthCssPath = fileURLToPath(new URL('./content-width.css', import.meta.url));
const contentWidthHeadScript = `(() => {
  let mode = 'wide';
  try {
    const stored = localStorage.getItem('hagilight-content-width');
    if (stored === 'wide' || stored === 'narrow') mode = stored;
  } catch {
    mode = 'wide';
  }
  document.documentElement.dataset.hagilightContentWidth = mode;
})();`;

function resolveProvider(config, { name, idKey, pattern, defaultId }) {
  if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config))) {
    throw new TypeError(`Hagilight ${name} analytics options must be an object.`);
  }

  const enabled = config === undefined ? true : config.enabled ?? Boolean(config[idKey]);
  if (!enabled) return undefined;

  const id = config === undefined ? defaultId : config[idKey];
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error(`Hagilight ${name} analytics is enabled but its ${idKey} is missing.`);
  }
  if (!pattern.test(id)) {
    throw new Error(`Hagilight ${name} analytics ${idKey} has an invalid format.`);
  }
  return id;
}

function resolveAIDisclosures(config) {
  if (config === undefined) {
    return {
      isAITranslation: false,
      isAIAuthor: false,
      sourceLocale: 'root',
    };
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Hagilight aiDisclosures options must be an object.');
  }
  for (const key of ['isAITranslation', 'isAIAuthor']) {
    if (config[key] !== undefined && typeof config[key] !== 'boolean') {
      throw new TypeError(`Hagilight aiDisclosures ${key} option must be a boolean.`);
    }
  }
  const sourceLocale = config.sourceLocale === undefined ? 'root' : config.sourceLocale;
  if (typeof sourceLocale !== 'string' || !sourceLocale.trim() || /[/\\]/u.test(sourceLocale)) {
    throw new TypeError('Hagilight aiDisclosures sourceLocale option must be a non-empty string.');
  }
  return {
    isAITranslation: config.isAITranslation ?? false,
    isAIAuthor: config.isAIAuthor ?? false,
    sourceLocale: sourceLocale.trim(),
  };
}

function resolveHagicodePromotion(config) {
  if (config === undefined) return true;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Hagilight hagicodePromotion options must be an object.');
  }
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw new TypeError('Hagilight hagicodePromotion enabled option must be a boolean.');
  }
  return config.enabled ?? true;
}

function getRssFeedUrl(config) {
  if (!Array.isArray(config.head)) return undefined;
  const rssLink = config.head.find((entry) => {
    const attrs = entry?.attrs;
    return entry?.tag === 'link'
      && attrs?.rel === 'alternate'
      && typeof attrs.type === 'string'
      && attrs.type.toLowerCase() === 'application/rss+xml'
      && typeof attrs.href === 'string';
  });
  return rssLink?.attrs.href;
}

function optionalSeoText(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Hagilight SEO ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function resolveSeoOptions(config) {
  if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config))) {
    throw new TypeError('Hagilight seo options must be an object.');
  }
  if (config?.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw new TypeError('Hagilight seo enabled option must be a boolean.');
  }

  const image = config?.image;
  if (image !== undefined && !isValidSeoImageReference(image)) {
    throw new TypeError('Hagilight SEO image must be an absolute HTTP(S) URL or a site-root path.');
  }

  let organization;
  if (config?.organization !== undefined) {
    const identity = config.organization;
    if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
      throw new TypeError('Hagilight SEO organization option must be an object.');
    }
    const name = optionalSeoText(identity.name, 'organization name');
    const url = optionalSeoText(identity.url, 'organization URL');
    if (!name) throw new TypeError('Hagilight SEO organization name is required.');
    if (!url) throw new TypeError('Hagilight SEO organization URL is required.');
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new TypeError('Hagilight SEO organization URL must be an absolute HTTP(S) URL.');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      throw new TypeError('Hagilight SEO organization URL must be an absolute HTTP(S) URL.');
    }
    if (identity.logo !== undefined && !isValidSeoImageReference(identity.logo)) {
      throw new TypeError('Hagilight SEO organization logo must be an absolute HTTP(S) URL or a site-root path.');
    }
    organization = {
      name,
      url: parsedUrl.href,
      ...(identity.logo === undefined ? {} : { logo: identity.logo }),
    };
  }

  return {
    enabled: config?.enabled ?? true,
    title: optionalSeoText(config?.title, 'title'),
    description: optionalSeoText(config?.description, 'description'),
    ...(image === undefined ? {} : { image }),
    ...(organization === undefined ? {} : { organization }),
  };
}

function resolveAstroSite(site) {
  if (site === undefined || site === null || site === '') {
    throw new Error('Hagilight SEO requires an absolute Astro site URL. Set site or disable generated SEO with seo: { enabled: false }.');
  }
  let parsed;
  try {
    parsed = new URL(site);
  } catch {
    throw new Error('Hagilight SEO requires Astro site to be an absolute HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Hagilight SEO requires Astro site to be an absolute HTTP(S) URL.');
  }
  return parsed.href;
}

function resolveDefaultSeoLocale(defaultLocale, locales) {
  const configured = typeof defaultLocale === 'object' && defaultLocale !== null
    ? defaultLocale.locale ?? defaultLocale.lang
    : defaultLocale;
  if (configured === undefined) {
    return locales.find(({ route }) => route === 'root')?.route ?? locales[0].route;
  }
  const found = locales.find(({ route, lang }) =>
    route === configured || lang.toLowerCase() === String(configured).toLowerCase(),
  );
  if (!found) {
    throw new Error(`Hagilight SEO default locale "${configured}" is not present in Starlight locales.`);
  }
  return found.route;
}

function createConfiguredIntegration(
  instanceId,
  serializedOptions,
  rssConfig,
  rssLocaleFeedUrls,
  componentIds,
  getConfiguredRssFeed,
  generateRss,
) {
  const optionsId = `virtual:hagilight-starlight/${instanceId}/options`;
  const rssConfigId = 'virtual:hagilight-starlight/rss-config';
  const headerPath = componentIds.header
    ? fileURLToPath(new URL('./Header.astro', import.meta.url))
    : undefined;
  const footerPath = fileURLToPath(new URL('./Footer.astro', import.meta.url));
  const pageTitlePath = fileURLToPath(new URL('./PageTitle.astro', import.meta.url));
  const markdownContentPath = fileURLToPath(new URL('./MarkdownContent.astro', import.meta.url));
  const seoHeadPath = fileURLToPath(new URL('./SEOHead.astro', import.meta.url));
  const headerSource = headerPath
    ? `---
import Header from ${JSON.stringify(headerPath)};
import options from '${optionsId}';
---

<Header links={options.links} />
`
    : undefined;
  const promotionImport = serializedOptions.promotoEnabled
    ? "import PromotoBanner from '@hagicode/hagilight/PromotoBanner';"
    : '';
  const promotionRender = serializedOptions.promotoEnabled ? '<PromotoBanner />' : '';
  const analyticsImport = serializedOptions.fiftyOneLaId
    ? "import Analytics51LA from '@hagicode/hagilight/Analytics51LA';"
    : '';
  const analyticsRender = serializedOptions.fiftyOneLaId
    ? '<Analytics51LA siteId={options.fiftyOneLaId} />'
    : '';
  const footerSource = `---
import Footer from ${JSON.stringify(footerPath)};
${promotionImport}
${analyticsImport}
import options from '${optionsId}';
---

<Footer
  locale={Astro.locals?.starlightRoute?.locale}
  links={options.links}
  rssFeedUrl={options.rssFeedUrl}
  rssLocaleFeedUrls={options.rssLocaleFeedUrls}
/>
${promotionRender}
${analyticsRender}
`;
  const pageTitleSource = `---
import PageTitle from ${JSON.stringify(pageTitlePath)};
---

<PageTitle />
`;
  const markdownContentSource = `---
import MarkdownContent from ${JSON.stringify(markdownContentPath)};
import options from '${optionsId}';
---

<MarkdownContent
  aiDisclosures={options.aiDisclosures}
  hagicodePromotionEnabled={options.hagicodePromotionEnabled}
><slot /></MarkdownContent>
`;
  const headSource = `---
import DefaultHead from '@astrojs/starlight/components/Head.astro';
import SEOHead from ${JSON.stringify(seoHeadPath)};
import GoogleAnalytics from '@hagicode/hagilight/GoogleAnalytics';
import options from '${optionsId}';
const isNotFound = /(?:^|\\/)404(?:\\.html)?\\/?$/u.test(Astro.url.pathname);
---

{options.seoEnabled ? <SEOHead options={options} /> : <DefaultHead />}
{!isNotFound && options.googleAnalyticsMeasurementId && (
  <GoogleAnalytics measurementId={options.googleAnalyticsMeasurementId} />
)}
`;
  const modules = new Map([
    ...(componentIds.header ? [[componentIds.header, headerSource]] : []),
    [componentIds.footer, footerSource],
    ...(componentIds.pageTitle ? [[componentIds.pageTitle, pageTitleSource]] : []),
    ...(componentIds.markdownContent ? [[componentIds.markdownContent, markdownContentSource]] : []),
    ...(componentIds.head ? [[componentIds.head, headSource]] : []),
  ]);
  const vitePlugin = {
    name: `@hagicode/hagilight-starlight:${instanceId}`,
    resolveId(id) {
      return modules.has(id) || id === optionsId || id === rssConfigId ? `\0${id}` : null;
    },
    load(id) {
      if (!id.startsWith('\0')) return null;
      const moduleId = id.slice(1);
      if (moduleId === optionsId) {
        return `export default ${JSON.stringify({
          ...serializedOptions,
          rssFeedUrl: getConfiguredRssFeed(),
          rssLocaleFeedUrls,
        })};`;
      }
      if (moduleId === rssConfigId) return `export default ${JSON.stringify(rssConfig)};`;
      return modules.get(moduleId) ?? null;
    },
  };

  return {
    name: `@hagicode/hagilight-starlight:${instanceId}`,
    hooks: {
      'astro:config:setup'({ injectRoute, updateConfig }) {
        if (generateRss) {
          injectRoute({
            pattern: '/rss.xml',
            entrypoint: fileURLToPath(new URL('./rss.xml.ts', import.meta.url)),
            prerender: true,
          });
          injectRoute({
            pattern: '/rss.[language].xml',
            entrypoint: fileURLToPath(new URL('./rss.[language].xml.ts', import.meta.url)),
            prerender: true,
          });
        }
        updateConfig({ vite: { plugins: [vitePlugin] } });
      },
    },
  };
}

export default function hagilight(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Hagilight Starlight options must be an object.');
  }
  if (options.header !== undefined
    && (!options.header || typeof options.header !== 'object' || Array.isArray(options.header))) {
    throw new TypeError('Hagilight header options must be an object.');
  }
  if (options.header?.enabled !== undefined && typeof options.header.enabled !== 'boolean') {
    throw new TypeError('Hagilight header enabled option must be a boolean.');
  }
  if (options.notFoundPage !== undefined
    && (!options.notFoundPage || typeof options.notFoundPage !== 'object' || Array.isArray(options.notFoundPage))) {
    throw new TypeError('Hagilight notFoundPage options must be an object.');
  }
  if (options.notFoundPage?.enabled !== undefined && typeof options.notFoundPage.enabled !== 'boolean') {
    throw new TypeError('Hagilight notFoundPage enabled option must be a boolean.');
  }
  if (options.rss !== undefined
    && (!options.rss || typeof options.rss !== 'object' || Array.isArray(options.rss))) {
    throw new TypeError('Hagilight rss options must be an object.');
  }
  if (options.rss?.enabled !== undefined && typeof options.rss.enabled !== 'boolean') {
    throw new TypeError('Hagilight rss enabled option must be a boolean.');
  }
  const rssOptions = resolveRssOptions(options.rss);
  if (options.analytics !== undefined
    && (!options.analytics || typeof options.analytics !== 'object' || Array.isArray(options.analytics))) {
    throw new TypeError('Hagilight analytics options must be an object.');
  }
  const seo = resolveSeoOptions(options.seo);
  if (options.contentComponents !== undefined
    && (!options.contentComponents || typeof options.contentComponents !== 'object' || Array.isArray(options.contentComponents))) {
    throw new TypeError('Hagilight contentComponents options must be an object.');
  }
  for (const key of ['pageTitle', 'markdownContent']) {
    if (options.contentComponents?.[key] !== undefined && typeof options.contentComponents[key] !== 'boolean') {
      throw new TypeError(`Hagilight contentComponents ${key} option must be a boolean.`);
    }
  }
  const analytics = options.analytics ?? {};
  const aiDisclosures = resolveAIDisclosures(options.aiDisclosures);
  const hagicodePromotionEnabled = resolveHagicodePromotion(options.hagicodePromotion);
  const googleAnalyticsMeasurementId = resolveProvider(analytics.googleAnalytics, {
    name: 'Google Analytics',
    idKey: 'measurementId',
    pattern: GOOGLE_ID_PATTERN,
    defaultId: DEFAULT_GOOGLE_ANALYTICS_ID,
  });
  const fiftyOneLaId = resolveProvider(analytics.fiftyOneLa, {
    name: '51LA',
    idKey: 'siteId',
    pattern: FIFTY_ONE_LA_ID_PATTERN,
    defaultId: DEFAULT_51LA_ID,
  });
  const instanceId = randomUUID();
  const headerEnabled = options.header?.enabled !== false;
  const notFoundPageEnabled = options.notFoundPage?.enabled !== false;
  const pageTitleEnabled = options.contentComponents?.pageTitle !== false;
  const markdownContentEnabled = options.contentComponents?.markdownContent !== false;
  const componentIds = {
    header: headerEnabled
      ? `virtual:hagilight-starlight/${instanceId}/Header.astro`
      : undefined,
    hero: notFoundPageEnabled
      ? fileURLToPath(new URL('./NotFoundHero.astro', import.meta.url))
      : undefined,
    footer: `virtual:hagilight-starlight/${instanceId}/Footer.astro`,
    pageTitle: pageTitleEnabled ? `virtual:hagilight-starlight/${instanceId}/PageTitle.astro` : undefined,
    markdownContent: markdownContentEnabled
      ? `virtual:hagilight-starlight/${instanceId}/MarkdownContent.astro`
      : undefined,
    head: seo.enabled || googleAnalyticsMeasurementId
      ? `virtual:hagilight-starlight/${instanceId}/Head.astro`
      : undefined,
  };
  const serializedOptions = {
    promotoEnabled: options.promoto?.enabled !== false,
    hagicodePromotionEnabled,
    links: options.links ?? {},
    googleAnalyticsMeasurementId,
    fiftyOneLaId,
    aiDisclosures,
    seoEnabled: seo.enabled,
    seo,
  };

  return {
    name: '@hagicode/hagilight-starlight',
    hooks: {
      'config:setup'({ astroConfig, config, updateConfig, addIntegration }) {
        if (headerEnabled && config.components?.Header) {
          throw new Error('Hagilight cannot replace an existing Starlight Header override. Set header: { enabled: false } to keep it, or compose @hagicode/hagilight-starlight/Header directly.');
        }
        if (notFoundPageEnabled && config.components?.Hero) {
          throw new Error('Hagilight cannot replace an existing Starlight Hero override. Set notFoundPage: { enabled: false } to keep it, or compose @hagicode/hagilight-starlight/NotFoundHero directly.');
        }
        if (config.components?.Footer) {
          throw new Error('Hagilight cannot replace an existing Starlight Footer override.');
        }
        if (pageTitleEnabled && config.components?.PageTitle) {
          throw new Error('Hagilight cannot replace an existing Starlight PageTitle override. Set contentComponents: { pageTitle: false } and compose @hagicode/hagilight-starlight/ContentLayoutToggle into your PageTitle component.');
        }
        if (markdownContentEnabled && config.components?.MarkdownContent) {
          throw new Error('Hagilight cannot replace an existing Starlight MarkdownContent override. Set contentComponents: { markdownContent: false } and compose @hagicode/hagilight-starlight/MarkdownContent into your MarkdownContent component.');
        }
        if (componentIds.head && config.components?.Head) {
          if (seo.enabled) {
            throw new Error('Hagilight SEO cannot replace an existing Starlight Head override. Set seo: { enabled: false } and disable Google Analytics to keep your Head, or compose your site metadata explicitly.');
          }
          throw new Error('Hagilight Google Analytics cannot replace an existing Starlight Head override. Disable Google Analytics or compose @hagicode/hagilight/GoogleAnalytics in your Head instead.');
        }

        let seoSite;
        let seoLocales = [];
        let defaultSeoLocale = 'root';
        if (seo.enabled) {
          seoSite = resolveAstroSite(astroConfig.site);
          seoLocales = resolveSeoLocales(config.locales);
          defaultSeoLocale = resolveDefaultSeoLocale(config.defaultLocale, seoLocales);
        }
        const basePath = astroConfig.base ?? '/';
        serializedOptions.seoSite = seoSite;
        serializedOptions.seoBasePath = basePath;
        serializedOptions.seoLocales = seoLocales;
        serializedOptions.seoDefaultLocale = defaultSeoLocale;
        serializedOptions.seoFormat = astroConfig.build?.format ?? 'directory';
        serializedOptions.seoTrailingSlash = astroConfig.trailingSlash ?? 'ignore';
        serializedOptions.seo = seo.enabled
          ? {
            ...seo,
            ...(seo.image === undefined
              ? {}
              : { image: resolveSeoImageUrl(seo.image, { site: seoSite, basePath }) }),
            ...(seo.organization === undefined
              ? {}
              : {
                organization: {
                  ...seo.organization,
                  ...(seo.organization.logo === undefined
                    ? {}
                    : { logo: resolveSeoImageUrl(seo.organization.logo, { site: seoSite, basePath }) }),
                },
              }),
          }
          : seo;
        serializedOptions.consumerHead = config.head ?? [];

        const generateRss = options.rss?.enabled !== false && !getRssFeedUrl(config);
        if (generateRss && !astroConfig.site) {
          throw new Error('Hagilight RSS requires the Astro site option. Set site or disable RSS with rss: { enabled: false }.');
        }
        const rssLocales = generateRss ? resolveRssLocales(config.locales) : [];
        const baseUrl = generateRss
          ? new URL((astroConfig.base ?? '/').replace(/\/?$/u, '/'), astroConfig.site)
          : undefined;
        const rssFeedUrl = baseUrl ? new URL('rss.xml', baseUrl).toString() : undefined;
        const rssLocaleFeedUrls = baseUrl
          ? Object.fromEntries(rssLocales
            .filter(({ filename }) => filename !== 'en')
            .map(({ lang, filename }) => [
              lang,
              new URL(`rss.${filename}.xml`, baseUrl).toString(),
            ]))
          : {};
        addIntegration(createConfiguredIntegration(
          instanceId,
          serializedOptions,
          { options: rssOptions, locales: rssLocales },
          rssLocaleFeedUrls,
          componentIds,
          () => getRssFeedUrl(config) ?? rssFeedUrl,
          generateRss,
        ));
        updateConfig({
          ...(config.logo === undefined ? { logo: { src: defaultLogo, alt: 'HagiCode' } } : {}),
          customCss: [...(config.customCss ?? []), contentWidthCssPath],
          head: [
            ...(config.head ?? []),
            ...(rssFeedUrl ? [{
              tag: 'link',
              attrs: { rel: 'alternate', type: 'application/rss+xml', href: rssFeedUrl },
            }] : []),
            { tag: 'script', content: contentWidthHeadScript },
            ...(() => {
              const entry = resolveFaviconHeadEntry(
                config.head,
                config.favicon === undefined ? {} : { href: config.favicon },
              );
              return entry ? [entry] : [];
            })(),
          ],
          components: {
            ...config.components,
            ...(componentIds.header ? { Header: componentIds.header } : {}),
            ...(componentIds.hero ? { Hero: componentIds.hero } : {}),
            Footer: componentIds.footer,
            ...(componentIds.pageTitle ? { PageTitle: componentIds.pageTitle } : {}),
            ...(componentIds.markdownContent ? { MarkdownContent: componentIds.markdownContent } : {}),
            ...(componentIds.head ? { Head: componentIds.head } : {}),
          },
        });
      },
    },
  };
}