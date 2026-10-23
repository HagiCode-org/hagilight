import { describeParts, type PartFamily } from './adapters.js';
import type { MermaidInteractionHandle } from './interaction.js';
import type { MermaidInteractionConfig } from './types.js';

const FOCUS_CLASSES = ['mermaid-focus-on', 'mermaid-focus-dim'] as const;
const CLICK_SLOP_PX = 4;

const NOOP_HANDLE: MermaidInteractionHandle = { destroy: () => undefined, clearFocus: () => undefined };

/**
 * Part focus for charts and diagrams the graph model cannot read (pie, Gantt, sequence, ...). The part
 * under the pointer or keyboard focus keeps its colour and everything else steps back, so a slice and
 * its legend row, or a message and its label, read as one thing. It shares the trace's classes, chip and
 * `onTraceChange` callback, so a host wires one interaction whatever the diagram type.
 */
export function attachMermaidPartFocus(
  root: HTMLElement,
  config: MermaidInteractionConfig = {},
  prebuilt?: PartFamily[],
): MermaidInteractionHandle {
  if (!config.enabled) return NOOP_HANDLE;
  const svg = root.querySelector<SVGSVGElement>('svg');
  if (!svg) return NOOP_HANDLE;
  const families = prebuilt ?? describeParts(svg);
  if (families.length === 0) return NOOP_HANDLE;

  const canPin = config.pin !== false;
  const owner = new Map<Element, number>();
  const placeInGroup: Array<{ index: number; total: number }> = [];
  const groupSize = new Map<string, number>();
  families.forEach((family, index) => {
    const seen = (groupSize.get(family.group) ?? 0) + 1;
    groupSize.set(family.group, seen);
    placeInGroup[index] = { index: seen, total: 0 };
    family.parts.forEach((part) => {
      part.classList.add('mermaid-part');
      owner.set(part, index);
    });
  });
  placeInGroup.forEach((place, index) => {
    place.total = groupSize.get(families[index].group) ?? 1;
  });

  let pinned: number | null = null;
  let hovered: number | null = null;
  let focused: number | null = null;
  let applied: number | null = null;
  let pointerStart: { x: number; y: number } | null = null;

  // One tab stop for the whole chart; arrow keys walk the parts of one kind.
  families.forEach((family, index) => {
    family.primary.classList.add('mermaid-entity');
    family.primary.setAttribute('tabindex', index === 0 ? '0' : '-1');
    family.primary.setAttribute('role', canPin ? 'button' : 'group');
    if (canPin) family.primary.setAttribute('aria-pressed', 'false');
    if (family.label) family.primary.setAttribute('aria-label', family.label);
  });

  const familyOf = (target: EventTarget | null): number => {
    for (let node = target as Element | null; node && node !== root; node = node.parentElement) {
      const index = owner.get(node);
      if (index !== undefined) return index;
    }
    return -1;
  };

  const clearMarks = () => {
    root.classList.remove('mermaid-interaction-active', 'mermaid-focusing');
    svg.querySelectorAll(FOCUS_CLASSES.map((name) => `.${name}`).join(',')).forEach((el) => el.classList.remove(...FOCUS_CLASSES));
  };

  const report = (index: number | null) => {
    if (!config.onTraceChange) return;
    config.onTraceChange(
      index === null
        ? null
        : { label: families[index].label, upstream: 0, downstream: 0, pinned: pinned === index, position: placeInGroup[index] },
    );
  };

  const apply = () => {
    const next = hovered ?? focused ?? pinned;
    families.forEach((family, index) => family.primary.setAttribute('aria-pressed', String(pinned === index)));
    if (next === applied) {
      if (next !== null) report(next);
      return;
    }
    applied = next;
    clearMarks();
    if (next === null) {
      report(null);
      return;
    }
    const on = new Set(families[next].parts);
    root.classList.add('mermaid-interaction-active', 'mermaid-focusing');
    on.forEach((part) => part.classList.add('mermaid-focus-on'));
    families.forEach((family, index) => {
      if (index === next) return;
      family.parts.forEach((part) => {
        if (on.has(part)) return;
        // Dimming an ancestor of the focused part, or a descendant of it, would dim the focus itself.
        const nested = [...on].some((kept) => part.contains(kept) || kept.contains(part));
        if (!nested) part.classList.add('mermaid-focus-dim');
      });
    });
    report(next);
  };

  const togglePin = (index: number) => {
    if (!canPin) return;
    pinned = pinned === index ? null : index;
    apply();
  };

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const index = familyOf(event.target);
    const next = index === -1 ? null : index;
    if (next === hovered) return;
    hovered = next;
    apply();
  };
  const onPointerLeave = () => {
    if (hovered === null) return;
    hovered = null;
    apply();
  };
  const onPointerDown = (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  };
  const onPointerCancel = () => {
    pointerStart = null;
  };
  const select = (target: EventTarget | null) => {
    if (!canPin) return;
    const index = familyOf(target);
    if (index === -1) {
      if (pinned === null) return;
      pinned = null;
      apply();
      return;
    }
    togglePin(index);
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = pointerStart;
    pointerStart = null;
    if (event.button !== 0 || !start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    select(event.target);
  };
  const onClick = (event: MouseEvent) => {
    if (event.detail !== 0) return;
    select(event.target);
  };
  const onFocusIn = (event: FocusEvent) => {
    const index = familyOf(event.target);
    if (index === -1 || families[index].primary !== event.target) return;
    families.forEach((family, at) => family.primary.setAttribute('tabindex', at === index ? '0' : '-1'));
    focused = index;
    apply();
  };
  const onFocusOut = (event: FocusEvent) => {
    if (focused === null || families[focused].primary !== event.target) return;
    focused = null;
    apply();
  };

  /** The next part of the same kind, in reading order. Stays put at either end. */
  const neighbour = (from: number, step: 1 | -1 | 'first' | 'last'): number => {
    const sameGroup = families.map((family, index) => ({ family, index })).filter(({ family }) => family.group === families[from].group);
    const at = sameGroup.findIndex(({ index }) => index === from);
    const target = step === 'first' ? 0 : step === 'last' ? sameGroup.length - 1 : Math.min(Math.max(at + step, 0), sameGroup.length - 1);
    return sameGroup[target].index;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof Element === false) return;
    const index = familyOf(event.target);
    if (index === -1 || families[index].primary !== event.target) return;
    if (event.key === 'Enter' || event.key === ' ') {
      if (!canPin) return;
      event.preventDefault();
      togglePin(index);
      return;
    }
    if (event.key === 'Escape') {
      if (pinned === null) return;
      event.stopPropagation();
      pinned = null;
      apply();
      return;
    }
    const steps: Record<string, 1 | -1 | 'first' | 'last'> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      Home: 'first',
      End: 'last',
    };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    (families[neighbour(index, step)].primary as SVGElement).focus();
  };

  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointerleave', onPointerLeave);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerCancel);
  root.addEventListener('click', onClick);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('keydown', onKeyDown);

  return {
    clearFocus: () => {
      pinned = null;
      hovered = null;
      focused = null;
      apply();
    },
    destroy: () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerleave', onPointerLeave);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerCancel);
      root.removeEventListener('click', onClick);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('keydown', onKeyDown);
      clearMarks();
      applied = null;
      families.forEach((family) => {
        family.parts.forEach((part) => part.classList.remove('mermaid-part'));
        family.primary.classList.remove('mermaid-entity');
        ['tabindex', 'role', 'aria-pressed', 'aria-label'].forEach((name) => family.primary.removeAttribute(name));
      });
      config.onTraceChange?.(null);
    },
  };
}
