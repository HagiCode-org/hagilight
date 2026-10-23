import { renderTraceChip } from './chip.js';
import { el, iconButton, prefersReducedMotion } from './dom.js';
import type { MermaidInteractionHandle } from './interaction.js';
import { ensureSvgViewBox, normalizeMermaidSvgViewBox } from './svg.js';
import type { MermaidLabels, MermaidTraceSummary } from './types.js';

export interface MermaidViewerOptions {
  /** Where the dialog is appended. It sits inside the diagram's container, so it inherits the theme tokens. */
  container: HTMLElement;
  /** Post-processed SVG markup of the diagram. The viewer draws its own copy. */
  markup: string;
  labels: MermaidLabels;
  /** The inline diagram the viewer grows out of and settles back into. */
  source: () => SVGSVGElement | null;
  /** Wires trace or part focus on the viewer's copy of the diagram. */
  enhance: (canvas: HTMLElement, svg: SVGSVGElement, onSummary: (summary: MermaidTraceSummary | null) => void) => MermaidInteractionHandle;
  onClose: () => void;
}

export interface MermaidViewerHandle {
  /** Settles the diagram back into its place, then closes. A pinned trace is released first. */
  close: () => void;
  /** Closes at once with no motion. */
  destroy: () => void;
}

interface Pose {
  k: number;
  x: number;
  y: number;
}

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const OPEN_MS = 520;
const CLOSE_MS = 360;
const FADE_MS = 180;
const SETTLE_MS = 70;
const ZOOM_STEP = 1.25;
const MAX_SCALE = 10;
const MAX_FIT_SCALE = 3;
/** Part of the diagram that must stay on screen, so it can never be panned out of reach. */
const KEEP_VISIBLE_PX = 80;
const KEY_PAN_PX = 90;
const DRAG_SLOP_PX = 4;
/** How long a released drag keeps coasting, in ms of its release speed. */
const COAST_MS = 220;
const INSET = { top: 64, bottom: 44, side: 24 };

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

function transformOf(pose: Pose): string {
  return `translate(${pose.x}px, ${pose.y}px) scale(${pose.k})`;
}

function naturalSize(svg: SVGSVGElement): { w: number; h: number } {
  const box = svg.viewBox.baseVal;
  return { w: box.width || 1, h: box.height || 1 };
}

/** The rectangle the diagram's drawing occupies on screen, inside an svg that may letterbox it. */
function drawnRect(svg: SVGSVGElement): DOMRect {
  const frame = svg.getBoundingClientRect();
  const { w, h } = naturalSize(svg);
  const scale = Math.min(frame.width / w, frame.height / h);
  const width = w * scale;
  const height = h * scale;
  return new DOMRect(frame.left + (frame.width - width) / 2, frame.top + (frame.height - height) / 2, width, height);
}

function isOnScreen(box: DOMRect): boolean {
  return box.width > 8 && box.height > 8 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
}

export function openMermaidViewer(options: MermaidViewerOptions): MermaidViewerHandle {
  const { container, labels } = options;
  const text = labels.viewer;
  const reduced = prefersReducedMotion();

  const dialog = el('dialog', 'mermaid-viewer');
  dialog.dataset.state = 'opening';
  dialog.setAttribute('aria-label', text.title);

  const bar = el('div', 'mermaid-viewer-bar');
  const status = el('div', 'mermaid-trace-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const zoom = el('div', 'mermaid-viewer-zoom');
  zoom.setAttribute('role', 'group');
  const percent = el('output', 'mermaid-viewer-percent');
  const actual = el('button', 'mermaid-viewer-button mermaid-viewer-actual', '1:1');
  actual.type = 'button';
  actual.setAttribute('aria-label', text.actualSize);
  actual.title = text.actualSize;
  zoom.append(
    iconButton('minus', text.zoomOut, 'mermaid-viewer-button', () => zoomAtCentre(1 / ZOOM_STEP)),
    percent,
    iconButton('plus', text.zoomIn, 'mermaid-viewer-button', () => zoomAtCentre(ZOOM_STEP)),
    iconButton('fit', text.fit, 'mermaid-viewer-button mermaid-viewer-fit', () => goFit()),
    actual,
  );
  const closeButton = iconButton('x', text.close, 'mermaid-viewer-button mermaid-viewer-close', () => handle.close());
  bar.append(status, zoom, closeButton);

  const stage = el('div', 'mermaid-viewer-stage');
  stage.tabIndex = 0;
  const canvas = el('div', 'mermaid-diagram-container mermaid-viewer-canvas');
  const hint = el('p', 'mermaid-viewer-hint', text.hint);
  hint.id = `mermaid-viewer-hint-${Math.random().toString(36).slice(2, 9)}`;
  dialog.setAttribute('aria-describedby', hint.id);
  stage.appendChild(canvas);
  dialog.append(stage, bar, hint);

  // The copy needs its own ids: the inline diagram's marker and style references would otherwise resolve to it.
  const rootId = /<svg[^>]*?\sid="([^"]+)"/.exec(options.markup)?.[1];
  canvas.innerHTML = rootId ? options.markup.split(rootId).join(`${rootId}-zoom`) : options.markup;
  const svg = canvas.querySelector<SVGSVGElement>('svg');
  if (!svg) return { close: () => options.onClose(), destroy: () => options.onClose() };

  container.appendChild(dialog);
  dialog.showModal();
  if (svg.classList.contains('flowchart')) normalizeMermaidSvgViewBox(svg);
  ensureSvgViewBox(svg);
  const size = naturalSize(svg);
  svg.setAttribute('width', String(size.w));
  svg.setAttribute('height', String(size.h));
  svg.style.cssText = `width:${size.w}px;height:${size.h}px;max-width:none`;

  let pinnedTrace = false;
  const focus = options.enhance(canvas, svg, (summary) => {
    pinnedTrace = summary?.pinned ?? false;
    renderTraceChip(status, summary, labels, () => focus.clearFocus());
  });

  // Camera: the canvas is laid out at the diagram's natural size and moved by transform alone.
  let cur: Pose = { k: 1, x: 0, y: 0 };
  let tgt: Pose = cur;
  let atFit = true;
  let frame = 0;
  let lastTick = 0;
  let busy = true;
  let closing = false;
  let finished = false;

  const stageSize = () => ({ w: stage.clientWidth, h: stage.clientHeight });

  const fitPose = (): Pose => {
    const { w, h } = stageSize();
    const side = w < 520 ? 12 : INSET.side;
    const room = { w: w - side * 2, h: h - INSET.top - INSET.bottom };
    const k = clamp(Math.min(room.w / size.w, room.h / size.h), 0.001, MAX_FIT_SCALE);
    return { k, x: (w - size.w * k) / 2, y: INSET.top + (room.h - size.h * k) / 2 };
  };

  const limit = (pose: Pose): Pose => {
    const { w, h } = stageSize();
    const k = clamp(pose.k, fitPose().k * 0.5, MAX_SCALE);
    return {
      k,
      x: clamp(pose.x, KEEP_VISIBLE_PX - size.w * k, w - KEEP_VISIBLE_PX),
      y: clamp(pose.y, KEEP_VISIBLE_PX - size.h * k, h - KEEP_VISIBLE_PX),
    };
  };

  const write = () => {
    canvas.style.transform = transformOf(cur);
    percent.textContent = `${Math.round(cur.k * 100)}%`;
  };

  const stopCamera = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const tick = (now: number) => {
    const ease = 1 - Math.exp(-(now - lastTick) / SETTLE_MS);
    lastTick = now;
    const next = {
      k: cur.k + (tgt.k - cur.k) * ease,
      x: cur.x + (tgt.x - cur.x) * ease,
      y: cur.y + (tgt.y - cur.y) * ease,
    };
    const settled = Math.abs(tgt.k - next.k) < tgt.k * 0.0005 && Math.abs(tgt.x - next.x) < 0.3 && Math.abs(tgt.y - next.y) < 0.3;
    cur = settled ? tgt : next;
    write();
    frame = settled ? 0 : requestAnimationFrame(tick);
  };

  /** Moves the camera to a pose, easing unless asked not to or the visitor prefers no motion. */
  const go = (pose: Pose, instant = false) => {
    tgt = limit(pose);
    if (instant || reduced) {
      stopCamera();
      cur = tgt;
      write();
      return;
    }
    if (!frame) {
      lastTick = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };

  const goFit = () => {
    atFit = true;
    go(fitPose());
  };

  const zoomAt = (factor: number, cx: number, cy: number, instant = false) => {
    const base = instant ? cur : tgt;
    const k = clamp(base.k * factor, fitPose().k * 0.5, MAX_SCALE);
    const ratio = k / base.k;
    atFit = false;
    go({ k, x: cx - (cx - base.x) * ratio, y: cy - (cy - base.y) * ratio }, instant);
  };

  const zoomAtCentre = (factor: number) => {
    const { w, h } = stageSize();
    zoomAt(factor, w / 2, h / 2);
  };

  const goActual = () => {
    const { w, h } = stageSize();
    zoomAt(1 / tgt.k, w / 2, h / 2);
  };
  actual.addEventListener('click', goActual);

  const local = (event: { clientX: number; clientY: number }) => {
    const box = stage.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  // Pointers: one drags, two pinch. A press that never moves is left to the diagram, so a node still selects.
  const pointers = new Map<number, { x: number; y: number }>();
  let dragging = false;
  let pressed: { x: number; y: number } | null = null;
  let velocity = { x: 0, y: 0 };
  let lastMove = 0;
  let pinch: { distance: number; mid: { x: number; y: number } } | null = null;

  const spread = () => {
    const [a, b] = [...pointers.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDown = (event: PointerEvent) => {
    if (busy || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointers.set(event.pointerId, local(event));
    if (pointers.size === 1) pressed = local(event);
    if (pointers.size === 2) {
      pinch = spread();
      dragging = true;
      stopCamera();
      stage.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous || busy) return;
    const point = local(event);
    pointers.set(event.pointerId, point);
    if (pointers.size === 2 && pinch) {
      const next = spread();
      zoomAt(next.distance / pinch.distance, next.mid.x, next.mid.y, true);
      go({ ...cur, x: cur.x + next.mid.x - pinch.mid.x, y: cur.y + next.mid.y - pinch.mid.y }, true);
      pinch = next;
      return;
    }
    if (!dragging) {
      if (!pressed || Math.hypot(point.x - pressed.x, point.y - pressed.y) <= DRAG_SLOP_PX) return;
      dragging = true;
      stopCamera();
      stage.setPointerCapture(event.pointerId);
      stage.dataset.dragging = '';
    }
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const elapsed = Math.max(event.timeStamp - lastMove, 1);
    velocity = { x: dx / elapsed, y: dy / elapsed };
    lastMove = event.timeStamp;
    atFit = false;
    go({ ...cur, x: cur.x + dx, y: cur.y + dy }, true);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size < 2) pinch = null;
    if (pointers.size > 0) return;
    pressed = null;
    delete stage.dataset.dragging;
    if (!dragging) return;
    dragging = false;
    // A drag that was still moving when released keeps coasting, easing to rest.
    const fresh = event.timeStamp - lastMove < 80;
    if (fresh && !reduced) go({ ...cur, x: cur.x + velocity.x * COAST_MS, y: cur.y + velocity.y * COAST_MS });
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (busy) return;
    const at = local(event);
    if (!event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      atFit = false;
      go({ ...tgt, x: tgt.x - event.deltaX });
      return;
    }
    // A trackpad pinch arrives as ctrl+wheel with small deltas, so it needs more gain than a wheel notch.
    const gain = event.ctrlKey ? 0.01 : 0.0022;
    zoomAt(clamp(Math.exp(-event.deltaY * gain), 0.5, 2), at.x, at.y);
  };

  const onDoubleClick = (event: MouseEvent) => {
    if (busy || (event.target as Element).closest?.('.mermaid-node, .mermaid-entity')) return;
    const at = local(event);
    if (atFit) zoomAt(Math.min(2.5, (MAX_SCALE * 0.5) / tgt.k), at.x, at.y);
    else goFit();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const onStage = event.target === stage;
    const pan = (dx: number, dy: number) => {
      event.preventDefault();
      atFit = false;
      go({ ...tgt, x: tgt.x + dx, y: tgt.y + dy });
    };
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        zoomAtCentre(ZOOM_STEP);
        break;
      case '-':
      case '_':
        event.preventDefault();
        zoomAtCentre(1 / ZOOM_STEP);
        break;
      case '0':
        event.preventDefault();
        goFit();
        break;
      case '1':
        event.preventDefault();
        goActual();
        break;
      case 'ArrowLeft':
        if (onStage) pan(KEY_PAN_PX, 0);
        break;
      case 'ArrowRight':
        if (onStage) pan(-KEY_PAN_PX, 0);
        break;
      case 'ArrowUp':
        if (onStage) pan(0, KEY_PAN_PX);
        break;
      case 'ArrowDown':
        if (onStage) pan(0, -KEY_PAN_PX);
        break;
    }
  };

  // The platform asks to close on Escape. A pinned trace gives way first, so Escape peels one layer at a time.
  const onCancel = (event: Event) => {
    event.preventDefault();
    if (pinnedTrace) focus.clearFocus();
    else handle.close();
  };

  const resize = new ResizeObserver(() => {
    if (busy) return;
    if (atFit) go(fitPose(), true);
    else go(tgt, true);
  });

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('dblclick', onDoubleClick);
  dialog.addEventListener('keydown', onKeyDown);
  dialog.addEventListener('cancel', onCancel);
  resize.observe(stage);

  const source = options.source();
  const sourceBefore = source?.style.visibility ?? '';

  const teardown = () => {
    if (finished) return;
    finished = true;
    stopCamera();
    resize.disconnect();
    focus.destroy();
    if (source) source.style.visibility = sourceBefore;
    dialog.close();
    dialog.remove();
    options.onClose();
  };

  /** Pose that puts the canvas exactly over a drawn rectangle on the page. */
  const poseOver = (box: DOMRect): Pose => {
    const stageBox = stage.getBoundingClientRect();
    return { k: box.width / size.w, x: box.left - stageBox.left, y: box.top - stageBox.top };
  };

  cur = tgt = fitPose();
  write();
  const from = source ? drawnRect(source) : null;
  if (from && isOnScreen(from) && !reduced) {
    // The diagram lifts out of its card: the same drawing, moving from where it was to where it will rest.
    source!.style.visibility = 'hidden';
    canvas
      .animate([{ transform: transformOf(poseOver(from)) }, { transform: transformOf(cur) }], { duration: OPEN_MS, easing: EASE_OUT })
      .finished.then(
        () => undefined,
        () => undefined,
      )
      .then(() => {
        busy = false;
        if (!closing) dialog.dataset.state = 'open';
      });
  } else {
    busy = false;
    dialog.dataset.state = 'open';
  }
  stage.focus({ preventScroll: true });

  const handle: MermaidViewerHandle = {
    close: () => {
      if (closing || finished) return;
      closing = true;
      busy = true;
      stopCamera();
      dialog.dataset.state = 'closing';
      const target = options.source();
      const to = target ? drawnRect(target) : null;
      if (to && isOnScreen(to) && !reduced) {
        canvas
          .animate([{ transform: transformOf(cur) }, { transform: transformOf(poseOver(to)) }], { duration: CLOSE_MS, easing: EASE_OUT, fill: 'forwards' })
          .finished.then(teardown, teardown);
      } else {
        dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 0 : FADE_MS, fill: 'forwards' }).finished.then(teardown, teardown);
      }
    },
    destroy: () => {
      closing = true;
      teardown();
    },
  };
  return handle;
}
