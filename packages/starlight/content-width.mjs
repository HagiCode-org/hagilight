const STORAGE_KEY = 'hagilight-content-width';
const VALID_MODES = new Set(['wide', 'narrow']);

function normalizeMode(value) {
  return VALID_MODES.has(value) ? value : 'wide';
}

export function restoreContentWidth(root = document.documentElement) {
  let mode = 'wide';
  try {
    mode = normalizeMode(globalThis.localStorage.getItem(STORAGE_KEY));
  } catch {
    mode = 'wide';
  }
  root.dataset.hagilightContentWidth = mode;
  synchronizeButtons(root, mode);
  return mode;
}

export function setContentWidth(mode, root = document.documentElement) {
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

export function synchronizeContentWidthFromStorage(event, root = document.documentElement) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  const mode = normalizeMode(event.newValue);
  root.dataset.hagilightContentWidth = mode;
  synchronizeButtons(root, mode);
}

function synchronizeButtons(root, mode) {
  root.querySelectorAll('[data-hagilight-content-width-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.hagilightContentWidthChoice === mode));
  });
}

export { STORAGE_KEY };
