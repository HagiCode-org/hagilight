// Type fixture for @hagicode/hagilight-core/posthog-events. Each `@ts-expect-error` line must stay an error.
import {
  POSTHOG_EVENTS,
  capturePostHogEvent,
  classifyPagePath,
  destinationOf,
  installPostHogClickTracking,
  resolvePageType,
  sanitizePostHogProperties,
  type PagePathType,
  type PostHogDestination,
  type PostHogEventName,
  type PostHogPageType,
} from '@hagicode/hagilight-core/posthog-events';

const destination: PostHogDestination = destinationOf('https://example.test/download', 'https://hagilight.example/');
const host: string | undefined = destination.host;
const eventName: PostHogEventName = 'cta_click';
const page: PostHogPageType = resolvePageType('home');
const pagePath: PagePathType = classifyPagePath('/blog/', { base: '/', locales: ['zh-CN'] });
const cta = sanitizePostHogProperties('cta_click', { category: 'download', label: 'downloadClient', location: 'footer' });
const category: string | number | boolean | undefined = cta.category;
capturePostHogEvent('cta_click', { category: 'download', label: 'downloadClient', location: 'footer', is_external: true });
installPostHogClickTracking(document);
// @ts-expect-error Unknown event names are rejected at compile time.
capturePostHogEvent('not_an_event', { label: 'x' });
// @ts-expect-error Only declared properties are accepted for cta_click.
capturePostHogEvent('cta_click', { unknown_prop: 'x' });
// @ts-expect-error The page-type vocabulary is closed.
const outsidePageType: PostHogPageType = 'landing';
export { host, eventName, page, pagePath, category, outsidePageType, POSTHOG_EVENTS };
