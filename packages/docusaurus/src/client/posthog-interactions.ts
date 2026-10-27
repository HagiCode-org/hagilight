import { installPostHogInteractions } from '@hagicode/hagilight-core/posthog-interactions';

/*
 * Installs the shared PostHog interaction observers (search, result clicks, code copy, locale links).
 * Runs only when the head script initialized PostHog. Observers are delegated on the document, so
 * Docusaurus client navigation needs no rebinding and this module adds no route listener.
 */
export function installPostHogInteractionObservers(): boolean {
  if ((globalThis as { __hagilightPosthogInitialized?: boolean }).__hagilightPosthogInitialized !== true) return false;
  return installPostHogInteractions(document as unknown as Parameters<typeof installPostHogInteractions>[0]);
}

if (typeof document !== 'undefined') installPostHogInteractionObservers();
