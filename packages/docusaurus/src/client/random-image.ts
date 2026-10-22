import { mountRandomImages } from '@hagicode/hagilight-core/random-image';

/** Picks the footer avatar once per page view, on the first load and after each client-side route change. */
export function onRouteDidUpdate(): void {
  void mountRandomImages(document);
}
