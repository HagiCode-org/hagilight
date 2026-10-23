import { entranceBeats, type Beat, type BeatKind } from './adapters.js';

export interface MermaidChoreographyHandle {
  cancel: () => void;
  finished: Promise<void>;
}

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** One beat's stagger never spends more than this, however many elements it holds. */
const STAGGER_BUDGET_MS = 1100;
const DEFAULT_MS: Record<BeatKind, number> = {
  fade: 360,
  rise: 420,
  drop: 420,
  pop: 440,
  growX: 520,
  growY: 580,
  draw: 520,
  swing: 560,
  wipe: 900,
};
const RISE_PX = 8;
const MARKER_ATTRIBUTES = ['marker-start', 'marker-mid', 'marker-end'] as const;

type Anchor = 'center' | 'left' | 'bottom';

function anchorOf(kind: BeatKind): Anchor {
  if (kind === 'growX') return 'left';
  if (kind === 'growY') return 'bottom';
  return 'center';
}

/**
 * The point a scale or rotation pivots about, in the element's parent coordinates. An element's own
 * `transform` attribute is part of the pivot: with `transform-origin` set to the element's centre after
 * that transform, a collapsed element stays where it will land instead of sliding in from the origin.
 */
function pivotOf(el: Element, anchor: Anchor): [number, number] | null {
  const graphic = el as SVGGraphicsElement;
  if (typeof graphic.getBBox !== 'function') return null;
  let box: DOMRect;
  try {
    box = graphic.getBBox();
  } catch {
    return null;
  }
  if (box.width === 0 && box.height === 0) return null;
  const x = anchor === 'left' ? box.x : box.x + box.width / 2;
  const y = anchor === 'bottom' ? box.y + box.height : box.y + box.height / 2;
  const matrix = graphic.transform?.baseVal?.numberOfItems ? graphic.transform.baseVal.consolidate()?.matrix : null;
  return matrix ? [matrix.a * x + matrix.c * y + matrix.e, matrix.b * x + matrix.d * y + matrix.f] : [x, y];
}

function isDashed(el: Element): boolean {
  const dash = getComputedStyle(el).strokeDasharray;
  return dash !== '' && dash !== 'none' && dash !== '0';
}

function framesFor(el: Element, beat: Beat): Keyframe[] | null {
  switch (beat.kind) {
    case 'fade':
      return [{ opacity: 0 }, { opacity: 1 }];
    case 'rise':
      return [
        { opacity: 0, translate: `0 ${RISE_PX}px` },
        { opacity: 1, translate: '0 0' },
      ];
    case 'drop':
      return [
        { opacity: 0, translate: `0 -${RISE_PX + 4}px` },
        { opacity: 1, translate: '0 0' },
      ];
    case 'draw': {
      const geometry = el as SVGGeometryElement;
      const length = typeof geometry.getTotalLength === 'function' ? geometry.getTotalLength() : 0;
      // A dashed stroke is its own pattern; animating the dash would erase it.
      if (!length || isDashed(el)) return [{ opacity: 0 }, { opacity: 1 }];
      return [
        { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
        { strokeDasharray: `${length}`, strokeDashoffset: '0' },
      ];
    }
    case 'pop':
    case 'swing': {
      const origin = beat.origin ?? pivotOf(el, 'center');
      if (!origin) return [{ opacity: 0 }, { opacity: 1 }];
      const pivot = { transformBox: 'view-box', transformOrigin: `${origin[0]}px ${origin[1]}px` };
      if (beat.kind === 'swing') {
        return [
          { ...pivot, opacity: 0, scale: '0.72', rotate: '-28deg' },
          { ...pivot, opacity: 1, scale: '1', rotate: '0deg' },
        ];
      }
      return [
        { ...pivot, opacity: 0, scale: '0.7' },
        { ...pivot, opacity: 1, scale: '1' },
      ];
    }
    case 'growX':
    case 'growY': {
      const origin = pivotOf(el, anchorOf(beat.kind));
      if (!origin) return [{ opacity: 0 }, { opacity: 1 }];
      const pivot = { transformBox: 'view-box', transformOrigin: `${origin[0]}px ${origin[1]}px` };
      const flat = beat.kind === 'growX' ? '0 1' : '1 0';
      const early = beat.kind === 'growX' ? '0.12 1' : '1 0.12';
      return [
        { ...pivot, opacity: 0, scale: flat },
        { ...pivot, opacity: 1, scale: early, offset: 0.18 },
        { ...pivot, opacity: 1, scale: '1 1' },
      ];
    }
    case 'wipe':
      return [
        { clipPath: 'inset(-12px 100% -12px -12px)' },
        { clipPath: 'inset(-12px -12px -12px -12px)' },
      ];
  }
}

/**
 * A marker (an arrowhead, a sequence number) is drawn at full size whatever the dash state of its line,
 * so a line that is still being drawn would already show its end. Holds them back until the line lands.
 */
function holdMarkers(el: Element, animation: Animation, restores: Array<() => void>): void {
  const held: Array<[string, string]> = [];
  for (const name of MARKER_ATTRIBUTES) {
    const value = el.getAttribute(name);
    if (value !== null) held.push([name, value]);
  }
  if (held.length === 0) return;
  held.forEach(([name]) => el.removeAttribute(name));
  const land = () => held.forEach(([name, value]) => el.setAttribute(name, value));
  restores.push(land);
  animation.finished.then(land, land);
}

/** Plays a list of beats on an SVG. Each element follows its beat's kind, delay and the shared easing. */
export function playBeats(svg: SVGSVGElement, beats: Beat[]): MermaidChoreographyHandle | null {
  if (typeof svg.animate !== 'function') return null;
  const animations: Animation[] = [];
  const restores: Array<() => void> = [];
  for (const beat of beats) {
    const gap = Math.min(beat.gap ?? 0, STAGGER_BUDGET_MS / Math.max(beat.els.length - 1, 1));
    const ms = beat.ms ?? DEFAULT_MS[beat.kind];
    beat.els.forEach((el, index) => {
      const frames = framesFor(el, beat);
      if (!frames) return;
      const delay = beat.delays?.[index] ?? beat.at + index * gap;
      const animation = (el as SVGElement).animate(frames, { duration: ms, delay, easing: EASE_OUT, fill: 'backwards' });
      animations.push(animation);
      if (beat.kind === 'draw') holdMarkers(el, animation, restores);
    });
  }
  if (animations.length === 0) return null;
  const restore = () => restores.forEach((land) => land());
  return {
    finished: Promise.allSettled(animations.map((animation) => animation.finished)).then(restore),
    cancel: () => {
      animations.forEach((animation) => animation.cancel());
      restore();
    },
  };
}

/** The reveal for a diagram that has no graph: its parts arrive in the order its type reads. */
export function playTypeEntrance(svg: SVGSVGElement): MermaidChoreographyHandle | null {
  return playBeats(svg, entranceBeats(svg));
}
