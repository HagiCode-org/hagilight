import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const GOOGLE_ID_PATTERN = /^G-[A-Z0-9]+$/u;
const FIFTY_ONE_LA_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;

function resolveProvider(config, { name, idKey, pattern }) {
  if (config === undefined) return undefined;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError(`Hagilight ${name} analytics options must be an object.`);
  }

  const enabled = config.enabled ?? Boolean(config[idKey]);
  if (!enabled) return undefined;

  const id = config[idKey];
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error(`Hagilight ${name} analytics is enabled but its ${idKey} is missing.`);
  }
  if (!pattern.test(id)) {
    throw new Error(`Hagilight ${name} analytics ${idKey} has an invalid format.`);
  }
  return id;
}

function createConfiguredIntegration(instanceId, serializedOptions, componentIds) {
  const optionsId = `virtual:hagilight-starlight/${instanceId}/options`;
  const footerPath = fileURLToPath(new URL('./Footer.astro', import.meta.url));
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

<Footer locale={Astro.locals?.starlightRoute?.locale} links={options.links} />
${promotionRender}
${analyticsRender}
`;
  const headSource = `---
import DefaultHead from '@astrojs/starlight/components/Head.astro';
import GoogleAnalytics from '@hagicode/hagilight/GoogleAnalytics';
import options from '${optionsId}';
const isNotFound = /(?:^|\\/)404(?:\\.html)?\\/?$/u.test(Astro.url.pathname);
---

<DefaultHead />
{!isNotFound && options.googleAnalyticsMeasurementId && (
  <GoogleAnalytics measurementId={options.googleAnalyticsMeasurementId} />
)}
`;
  const modules = new Map([
    [componentIds.footer, footerSource],
    ...(componentIds.head ? [[componentIds.head, headSource]] : []),
    [optionsId, `export default ${JSON.stringify(serializedOptions)};`],
  ]);
  const vitePlugin = {
    name: `@hagicode/hagilight-starlight:${instanceId}`,
    resolveId(id) {
      return modules.has(id) ? `\0${id}` : null;
    },
    load(id) {
      return id.startsWith('\0') ? modules.get(id.slice(1)) ?? null : null;
    },
  };

  return {
    name: `@hagicode/hagilight-starlight:${instanceId}`,
    hooks: {
      'astro:config:setup'({ updateConfig }) {
        updateConfig({ vite: { plugins: [vitePlugin] } });
      },
    },
  };
}

export default function hagilight(options = {}) {
  const googleAnalyticsMeasurementId = resolveProvider(options.analytics?.googleAnalytics, {
    name: 'Google Analytics',
    idKey: 'measurementId',
    pattern: GOOGLE_ID_PATTERN,
  });
  const fiftyOneLaId = resolveProvider(options.analytics?.fiftyOneLa, {
    name: '51LA',
    idKey: 'siteId',
    pattern: FIFTY_ONE_LA_ID_PATTERN,
  });
  const instanceId = randomUUID();
  const componentIds = {
    footer: `virtual:hagilight-starlight/${instanceId}/Footer.astro`,
    head: googleAnalyticsMeasurementId
      ? `virtual:hagilight-starlight/${instanceId}/Head.astro`
      : undefined,
  };
  const serializedOptions = {
    promotoEnabled: options.promoto?.enabled !== false,
    links: options.links ?? {},
    googleAnalyticsMeasurementId,
    fiftyOneLaId,
  };

  return {
    name: '@hagicode/hagilight-starlight',
    hooks: {
      'config:setup'({ config, updateConfig, addIntegration }) {
        if (config.components?.Footer) {
          throw new Error('Hagilight cannot replace an existing Starlight Footer override.');
        }
        if (googleAnalyticsMeasurementId && config.components?.Head) {
          throw new Error('Hagilight Google Analytics cannot replace an existing Starlight Head override. Compose @hagicode/hagilight/GoogleAnalytics in your Head instead.');
        }

        addIntegration(createConfiguredIntegration(instanceId, serializedOptions, componentIds));
        updateConfig({
          components: {
            ...config.components,
            Footer: componentIds.footer,
            ...(componentIds.head ? { Head: componentIds.head } : {}),
          },
        });
      },
    },
  };
}
