import { mountConsent } from '@hagicode/hagilight-core/consent-mount';

// The head's descriptors and the shared wiring do the work; this module only runs them in the browser.
if (typeof document !== 'undefined') mountConsent(document, window);
