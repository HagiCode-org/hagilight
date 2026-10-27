// Type fixture for @hagicode/hagilight-core/consent. Each `@ts-expect-error` line must stay an error.
import {
  configureConsent,
  getConsent,
  onConsentChange,
  openConsentPreferences,
  setConsent,
  type AnalyticsConsent,
  type ConsentState,
} from '@hagicode/hagilight-core/consent';

const state: ConsentState = getConsent();
const analytics: AnalyticsConsent = state.analytics;
setConsent({ analytics: true });
setConsent({ analytics: false });
const stop: () => void = onConsentChange((next: ConsentState) => {
  const decision: AnalyticsConsent = next.analytics;
  void decision;
});
stop();
openConsentPreferences();
configureConsent({ regionHook: () => false });
void analytics;
// @ts-expect-error analytics must be a boolean, not a string.
setConsent({ analytics: 'yes' });
// @ts-expect-error a choice object is required.
setConsent();

// The popup's options, shared by CookieConsent and the integrations.
import { renderConsentMarkup, type ConsentPopupOptions } from '@hagicode/hagilight-core/consent-markup';

const popup: ConsentPopupOptions = { providers: ['googleAnalytics', 'posthog'], privacyUrl: '/privacy', policyVersion: '2' };
renderConsentMarkup(popup);
// @ts-expect-error an unknown analytics provider is not a consent provider.
const unknownProvider: ConsentPopupOptions = { providers: ['tracker'] };
void unknownProvider;
