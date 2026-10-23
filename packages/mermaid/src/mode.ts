import type { MermaidMode, MermaidThemeMode } from './types.js';

type ModeListener = () => void;

const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<ModeListener>();
let observer: MutationObserver | null = null;
let query: MediaQueryList | null = null;

function documentRoot(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

/** Reads the mode a document declares: `data-theme` first, then a `dark` class. Null when neither says. */
function declaredMode(root: HTMLElement | null): MermaidThemeMode | null {
  const theme = root?.getAttribute('data-theme') ?? '';
  if (/dark/i.test(theme)) return 'dark';
  if (/light/i.test(theme)) return 'light';
  if (root?.classList.contains('dark')) return 'dark';
  return null;
}

/**
 * Explicit `light` and `dark` win. `auto` checks the document's `data-theme`, then its
 * `dark` class, then `prefers-color-scheme`.
 */
export function resolveMode(
  mode: MermaidMode = 'auto',
  root: HTMLElement | null = documentRoot(),
  prefersDark: boolean = systemPrefersDark(),
): MermaidThemeMode {
  if (mode === 'light' || mode === 'dark') return mode;
  return declaredMode(root) ?? (prefersDark ? 'dark' : 'light');
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function startWatching(): void {
  const root = documentRoot();
  if (root && typeof MutationObserver === 'function') {
    observer = new MutationObserver(notify);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  }
  if (typeof matchMedia === 'function') {
    query = matchMedia(DARK_QUERY);
    query.addEventListener('change', notify);
  }
}

function stopWatching(): void {
  observer?.disconnect();
  observer = null;
  query?.removeEventListener('change', notify);
  query = null;
}

/**
 * Calls `listener` when the document's theme or the system preference may have changed.
 * One observer serves every `auto` diagram on the page, and it is removed with the last
 * listener. Returns the function that removes this listener.
 */
export function watchMode(listener: ModeListener): () => void {
  if (listeners.size === 0) startWatching();
  listeners.add(listener);
  return () => {
    if (!listeners.delete(listener) || listeners.size > 0) return;
    stopWatching();
  };
}

/** Number of listeners currently registered. Exposed for tests and diagnostics. */
export function watcherCount(): number {
  return listeners.size;
}
