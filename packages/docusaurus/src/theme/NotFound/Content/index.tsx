import Content from '@theme-init/NotFound/Content';
import { useEffect, type ComponentProps, type ReactElement } from 'react';
import { capturePostHogEvent, referrerDomain } from '@hagicode/hagilight-core/posthog-events';

/**
 * The Docusaurus 404 content, with one `not_found_viewed` event per view. The wrapper remounts on each
 * client navigation to the 404 route, so each view reports once. Without PostHog the capture is silent.
 */
export default function NotFoundContent(props: ComponentProps<typeof Content>): ReactElement {
  useEffect(() => {
    try {
      capturePostHogEvent('not_found_viewed', {
        path: window.location.pathname,
        referrer_domain: referrerDomain(document.referrer),
      });
    } catch {
      // Analytics must never break the 404 page.
    }
  }, []);
  return <Content {...props} />;
}
