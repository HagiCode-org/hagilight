import { el, icon } from './dom.js';
import { formatLabel } from './labels.js';
import type { MermaidLabels, MermaidTraceSummary } from './types.js';

const renderedKeys = new WeakMap<HTMLElement, string>();

/** Identifies what a chip shows, so an unchanged summary can keep the chip it already has. */
export function traceChipKey(summary: MermaidTraceSummary | null, labels: MermaidLabels): string {
  return JSON.stringify([summary, labels.trace]);
}

/**
 * Fills a live region with the trace or focus summary: the name, then either the upstream and
 * downstream counts of a traced node or the place of a focused chart part. A pinned summary carries a
 * clear button.
 */
export function renderTraceChip(
  status: HTMLElement,
  summary: MermaidTraceSummary | null,
  labels: MermaidLabels,
  onClear: () => void,
): void {
  // Focus leaving a pinned node re-reports the same summary. Rebuilding the chip then detaches the
  // clear button under a mouse press, and the click never reaches it, so an unchanged chip stays.
  const key = traceChipKey(summary, labels);
  if (renderedKeys.get(status) === key) return;
  renderedKeys.set(status, key);
  status.replaceChildren();
  if (!summary) return;
  const { trace } = labels;
  const chip = el('div', 'mermaid-trace-chip');
  chip.dataset.pinned = String(summary.pinned);
  if (summary.pinned) chip.appendChild(icon('pin', 'mermaid-trace-chip-pin', trace.pinned));
  chip.appendChild(el('span', 'mermaid-trace-chip-name', summary.label));
  if (summary.position) {
    chip.appendChild(el('span', 'mermaid-trace-chip-count mermaid-trace-chip-place', `${summary.position.index} / ${summary.position.total}`));
  } else {
    chip.appendChild(
      el('span', 'mermaid-trace-chip-count mermaid-trace-chip-up', formatLabel(trace.upstream, { value: summary.upstream })),
    );
    chip.appendChild(
      el('span', 'mermaid-trace-chip-count mermaid-trace-chip-down', formatLabel(trace.downstream, { value: summary.downstream })),
    );
  }
  if (summary.pinned) {
    const clear = el('button', 'mermaid-trace-chip-clear');
    clear.type = 'button';
    clear.setAttribute('aria-label', trace.clear);
    clear.title = trace.clear;
    clear.appendChild(icon('x'));
    clear.addEventListener('click', onClear);
    chip.appendChild(clear);
  }
  status.appendChild(chip);
}
