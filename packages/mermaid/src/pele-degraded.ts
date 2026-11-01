/**
 * Pele diagram types that render in a clearly degraded way, so the container shows a notice above them. The list
 * is filled from the same-size screenshot comparison of the demo samples (see the change's design notes), and
 * each entry is a Pele type name, as `PeleRenderResult.type` reports it. Falling back to Mermaid is not used,
 * because it would load `mermaid` on a Pele-only site.
 */
// Found in the 2026-10-31 same-size comparison of examples/demo-web/src/mermaid-samples.ts (36 samples, both engines
// at 440px): c4 scales to unreadable text, gitGraph branch labels are white on mid-tone fills, and treemap leaf
// labels are white and too small on their fills.
export const PELE_DEGRADED_TYPES: readonly string[] = Object.freeze(['c4', 'gitGraph', 'treemap']);

/** True when a Pele diagram of this type should show the degraded notice. */
export function isPeleDegraded(type: string | undefined): boolean {
  return type !== undefined && PELE_DEGRADED_TYPES.includes(type);
}
