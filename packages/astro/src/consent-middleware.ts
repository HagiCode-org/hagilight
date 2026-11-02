import type { MiddlewareHandler } from 'astro';
import consentFooter from 'virtual:hagilight/consent-footer';

export const onRequest: MiddlewareHandler = (context, next) => {
  (context.locals as { hagilightConsent?: unknown }).hagilightConsent = consentFooter;
  return next();
};
