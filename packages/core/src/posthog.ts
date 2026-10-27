import { POSTHOG_FRAMEWORKS, POSTHOG_PAGE_TYPES, type PostHogFramework, type PostHogPageType } from './posthog-events.js';

export const DEFAULT_POSTHOG_API_KEY = 'phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5';
export const POSTHOG_API_HOST = 'https://t.hagicode.com';
export const POSTHOG_UI_HOST = 'https://us.posthog.com';
export const POSTHOG_DEFAULTS = '2026-05-30';
export const POSTHOG_PERSON_PROFILES = 'identified_only';
export const POSTHOG_API_KEY_PATTERN = /^phc_[A-Za-z0-9]+$/u;

/** Site facts registered as PostHog super properties right after initialization. */
export interface PostHogSiteContext {
  /** Omitted to use the document hostname at run time. */
  siteId?: string;
  framework: PostHogFramework;
  /** The integration's package version, sent as `hagilight_version`. */
  version: string;
  /** A build-time page type. Out-of-vocabulary values are treated as absent. */
  pageType?: PostHogPageType;
}

function serializeLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}

function resolveSiteContext(context: PostHogSiteContext): PostHogSiteContext {
  if (typeof context !== 'object' || context === null) {
    throw new TypeError('PostHog site context must be an object.');
  }
  if (!(POSTHOG_FRAMEWORKS as readonly unknown[]).includes(context.framework)) {
    throw new TypeError(`PostHog site context framework must be one of: ${POSTHOG_FRAMEWORKS.join(', ')}.`);
  }
  if (context.siteId !== undefined && typeof context.siteId !== 'string') {
    throw new TypeError('PostHog site context siteId must be a string.');
  }
  if (typeof context.version !== 'string') {
    throw new TypeError('PostHog site context version must be a string.');
  }
  const siteId = context.siteId?.trim() || undefined;
  const version = context.version.trim() || undefined;
  const pageType = (POSTHOG_PAGE_TYPES as readonly unknown[]).includes(context.pageType) ? context.pageType : undefined;
  return { siteId, framework: context.framework, version, pageType } as PostHogSiteContext;
}

/**
 * Browser-safe, once-per-document initialization using the supplied PostHog loader. With a site context,
 * the page also registers its super properties once, right after initialization.
 */
export function posthogInitScript(apiKey: string = DEFAULT_POSTHOG_API_KEY, context?: PostHogSiteContext): string {
  if (typeof apiKey !== 'string' || !POSTHOG_API_KEY_PATTERN.test(apiKey)) {
    throw new TypeError('PostHog apiKey must be phc_ followed by ASCII letters or digits.');
  }
  const key = serializeLiteral(apiKey);
  const siteContext = serializeLiteral(context === undefined ? {} : resolveSiteContext(context));
  return `(() => {
  if (window.__hagilightPosthogInitialized) return;
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init(${key}, ${JSON.stringify({
    api_host: POSTHOG_API_HOST,
    ui_host: POSTHOG_UI_HOST,
    defaults: POSTHOG_DEFAULTS,
    person_profiles: POSTHOG_PERSON_PROFILES,
    capture_exceptions: true,
  })});
  (() => {
    const context = ${siteContext};
    const pageTypes = ${serializeLiteral(POSTHOG_PAGE_TYPES)};
    const metaPageType = document.querySelector('meta[name="hagilight:page-type"]')?.getAttribute('content');
    const superProperties = {
      site_id: context.siteId || window.location.hostname,
      site_framework: context.framework,
      hagilight_version: context.version,
      locale: document.documentElement.lang,
      page_type: [context.pageType, metaPageType].find((value) => pageTypes.includes(value)) ?? 'other',
    };
    posthog.register(Object.fromEntries(Object.entries(superProperties).filter(([, value]) => typeof value === 'string' && value !== '')));
  })();
  window.__hagilightPosthogInitialized = true;
})();`;
}
