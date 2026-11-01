import type { MermaidEngine } from './types.js';

/** Storage key for the engine a visitor chose. The package never writes it on its own. */
export const ENGINE_STORAGE_KEY = 'hagilight-mermaid:engine';

const ENGINES: readonly string[] = ['mermaid', 'pele'];

/** True for `mermaid` and `pele`. Anything else counts as no choice. */
export function isMermaidEngine(value: unknown): value is MermaidEngine {
  return typeof value === 'string' && ENGINES.includes(value);
}

/**
 * The engine a render uses: the option when it is recognized, then the stored choice, then `mermaid`.
 * An unrecognized option is ignored, so the next source in the order decides.
 */
export function resolveEngine(option?: unknown): MermaidEngine {
  if (isMermaidEngine(option)) return option;
  return readStoredEngine() ?? 'mermaid';
}

/** The stored engine choice, or `undefined` when none is stored, the value is unrecognized, or storage is unavailable. */
export function readStoredEngine(): MermaidEngine | undefined {
  try {
    const value = globalThis.localStorage?.getItem(ENGINE_STORAGE_KEY);
    return isMermaidEngine(value) ? value : undefined;
  } catch {
    // Blocked or throwing storage: rendering falls back to the default engine.
    return undefined;
  }
}

/** Stores the engine choice for later renders with no explicit option. Unrecognized values and storage failures do nothing. */
export function writeStoredEngine(engine: MermaidEngine): void {
  if (!isMermaidEngine(engine)) return;
  try {
    globalThis.localStorage?.setItem(ENGINE_STORAGE_KEY, engine);
  } catch {
    // The control still switches the engine for this page; the choice is just not remembered.
  }
}
