export type ContentWidthMode = 'wide' | 'narrow';

export const STORAGE_KEY = 'hagilight-content-width';
const VALID_MODES = new Set<unknown>(['wide', 'narrow']);

function normalizeMode(value: unknown): ContentWidthMode {
  return VALID_MODES.has(value) ? value as ContentWidthMode : 'wide';
}

function synchronizeButtons(root: HTMLElement, mode: ContentWidthMode): void {
  root.querySelectorAll<HTMLElement>('[data-hagilight-content-width-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.hagilightContentWidthChoice === mode));
  });
}

export function restoreContentWidth(root: HTMLElement = document.documentElement): ContentWidthMode {
  let mode: ContentWidthMode = 'wide';
  try {
    mode = normalizeMode(globalThis.localStorage.getItem(STORAGE_KEY));
  } catch {
    mode = 'wide';
  }
  root.dataset.hagilightContentWidth = mode;
  synchronizeButtons(root, mode);
  return mode;
}

export function setContentWidth(mode: ContentWidthMode, root: HTMLElement = document.documentElement): void {
  if (!VALID_MODES.has(mode)) {
    throw new TypeError('Hagilight content width must be "wide" or "narrow".');
  }
  root.dataset.hagilightContentWidth = mode;
  synchronizeButtons(root, mode);
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    return;
  }
}

export function synchronizeContentWidthFromStorage(
  event: Pick<StorageEvent, 'key' | 'newValue'>,
  root: HTMLElement = document.documentElement,
): void {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  const mode = normalizeMode(event.newValue);
  root.dataset.hagilightContentWidth = mode;
  synchronizeButtons(root, mode);
}
