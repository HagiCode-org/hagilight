import { mountRandomFans } from '@hagicode/hagilight-core/random-image';

/** Deals the footer avatar's cat fan once per page view, on the first load and after each client-side route change. */
export function onRouteDidUpdate(): void {
  void mountRandomFans(document);
}
