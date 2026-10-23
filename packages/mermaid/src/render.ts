import type { MermaidConfig } from 'mermaid';
import { playMermaidEntrance, type MermaidEntranceHandle } from './entrance.js';
import { buildMermaidGraph, type MermaidGraph } from './graph.js';
import { attachMermaidDiagramInteraction, type MermaidInteractionHandle } from './interaction.js';
import { formatLabel, resolveLabels } from './labels.js';
import { resolveMode, watchMode } from './mode.js';
import { normalizeMermaidSvgViewBox, postProcessMermaidSvg } from './svg.js';
import { getMermaidThemeConfig, resolvePreset } from './theme.js';
import type {
  MermaidHandle,
  MermaidLabels,
  MermaidModule,
  MermaidRenderOptions,
  MermaidThemeMode,
  MermaidTraceSummary,
  MermaidUpdate,
} from './types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLAYED_SOURCES_LIMIT = 200;
/** Sources whose reveal already played, so re-rendering or remounting the same diagram does not replay it. */
const PLAYED_SOURCES = new Set<string>();

const ICONS = {
  pin: [
    ['line', { x1: '12', x2: '12', y1: '17', y2: '22' }],
    ['path', { d: 'M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z' }],
  ],
  x: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }],
  ],
  rotate: [
    ['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }],
    ['path', { d: 'M3 3v5h5' }],
  ],
  alert: [
    ['path', { d: 'M12 8V12M12 16H12.01' }],
    ['path', { d: 'M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z' }],
  ],
} satisfies Record<string, Array<[string, Record<string, string>]>>;

type IconName = keyof typeof ICONS;

/** Inline SVG icon, so the package needs no icon library. Decorative unless a label is given. */
function icon(name: IconName, className?: string, label?: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attributes: Record<string, string> = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  if (className) attributes.class = className;
  if (label) Object.assign(attributes, { role: 'img', 'aria-label': label });
  else attributes['aria-hidden'] = 'true';
  for (const [key, value] of Object.entries(attributes)) svg.setAttribute(key, value);
  for (const [tag, attrs] of ICONS[name]) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, value);
    svg.appendChild(shape);
  }
  return svg;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function markPlayed(source: string): void {
  PLAYED_SOURCES.add(source);
  if (PLAYED_SOURCES.size > PLAYED_SOURCES_LIMIT) {
    const oldest = PLAYED_SOURCES.values().next().value;
    if (oldest !== undefined) PLAYED_SOURCES.delete(oldest);
  }
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** At least 15% of the element's visible height is inside the viewport. */
function isMostlyInView(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  return rect.height > 0 && visible >= Math.min(rect.height, window.innerHeight) * 0.15;
}

/** Mermaid is one global instance, so renders run one at a time and each re-initializes only on a config change. */
let renderQueue: Promise<unknown> = Promise.resolve();
const initializedWith = new WeakMap<object, MermaidConfig>();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = renderQueue.then(task);
  renderQueue = next.catch(() => undefined);
  return next;
}

async function initializeOnce(mermaid: MermaidModule['default'], config: MermaidConfig): Promise<void> {
  if (initializedWith.get(mermaid) === config) return;
  await mermaid.initialize({
    suppressErrorRendering: true,
    startOnLoad: false,
    ...config,
    // Mermaid models "no theme" as undefined, not null.
    theme: config.theme ?? undefined,
  });
  initializedWith.set(mermaid, config);
}

function defaultLoader(): Promise<MermaidModule> {
  return import('mermaid');
}

/** Maps Mermaid's parser messages onto the labels, as the web app does. */
function describeError(error: unknown, labels: MermaidLabels): string {
  let message = labels.unableToRender;
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;
  return message
    .replace(/^Parse error on line \d+:/, labels.syntaxErrorPrefix)
    .replace(/^Error:/, labels.renderingErrorPrefix)
    .replace(/no diagram type detected/i, labels.noValidDiagram)
    .replace(/unknown diagram type/i, labels.unknownDiagramType);
}

/** Objects compare by value and functions by identity, so a new loader or callback counts as a change. */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  return typeof left === 'object' && left !== null && JSON.stringify(left) === JSON.stringify(right);
}

function sameOptions(next: MermaidRenderOptions, current: MermaidRenderOptions): boolean {
  const keys = new Set([...Object.keys(next), ...Object.keys(current)]) as Set<keyof MermaidRenderOptions>;
  return [...keys].every((key) => sameValue(next[key], current[key]));
}

class MermaidDiagram {
  private source: string;
  private options: MermaidRenderOptions;
  private labels: MermaidLabels;
  private version = 0;
  private destroyed = false;
  private renderedMode: MermaidThemeMode | null = null;
  private graph: MermaidGraph | null = null;
  private svgElement: SVGSVGElement | null = null;
  private diagramHost: HTMLElement | null = null;
  private statusRegion: HTMLElement | null = null;
  private interaction: MermaidInteractionHandle | null = null;
  private entrance: MermaidEntranceHandle | null = null;
  private observer: IntersectionObserver | null = null;
  private unwatchMode: (() => void) | null = null;

  constructor(
    private readonly host: HTMLElement,
    source: string,
    options: MermaidRenderOptions,
  ) {
    this.source = source;
    this.options = options;
    this.labels = resolveLabels(options.labels);
    this.syncModeWatch();
    void this.render();
  }

  handle(): MermaidHandle {
    return {
      update: (changes) => this.update(changes),
      replay: () => this.replay(),
      clearFocus: () => this.interaction?.clearFocus(),
      destroy: () => this.destroy(),
    };
  }

  private update(changes: MermaidUpdate = {}): void {
    if (this.destroyed) return;
    const { source, ...rest } = changes;
    const next = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
    const nextOptions: MermaidRenderOptions = { ...this.options, ...next };
    const nextSource = source ?? this.source;
    if (nextSource === this.source && sameOptions(nextOptions, this.options)) return;
    this.options = nextOptions;
    this.source = nextSource;
    this.labels = resolveLabels(nextOptions.labels);
    this.syncModeWatch();
    void this.render();
  }

  private syncModeWatch(): void {
    const auto = (this.options.mode ?? 'auto') === 'auto';
    if (auto && !this.unwatchMode) {
      this.unwatchMode = watchMode(() => this.onModeSignal());
    } else if (!auto && this.unwatchMode) {
      this.unwatchMode();
      this.unwatchMode = null;
    }
  }

  private onModeSignal(): void {
    if (this.destroyed) return;
    if (resolveMode(this.options.mode ?? 'auto') !== this.renderedMode) void this.render();
  }

  private isStale(version: number): boolean {
    return this.destroyed || version !== this.version;
  }

  private async render(): Promise<void> {
    const version = ++this.version;
    this.teardownDiagram();
    if (!this.source.trim()) {
      this.host.replaceChildren();
      return;
    }

    this.host.replaceChildren(this.loadingPanel());
    const { source, options } = this;
    const mode = resolveMode(options.mode ?? 'auto');
    const preset = resolvePreset(options.preset);
    try {
      const svg = await enqueue(async () => {
        const { default: mermaid } = await (options.loadMermaid ?? defaultLoader)();
        const config = getMermaidThemeConfig(mode, preset, { tokens: options.tokens });
        await initializeOnce(mermaid, config);
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        return (await mermaid.render(id, source)).svg;
      });
      if (this.isStale(version)) return;
      this.showDiagram(postProcessMermaidSvg(svg), mode, preset);
    } catch (error) {
      if (this.isStale(version)) return;
      console.error('Mermaid rendering error:', error);
      this.host.replaceChildren(this.errorPanel(describeError(error, this.labels)));
    }
  }

  private showDiagram(svg: string, mode: MermaidThemeMode, preset: 'default' | 'archify'): void {
    this.renderedMode = mode;
    const container = el('div', ['mermaid-container', `mermaid-preset-${preset}`, this.options.className].filter(Boolean).join(' '));
    container.dataset.mermaidPreset = preset;
    container.dataset.mermaidMode = mode;
    const diagramHost = el('div', 'mermaid-diagram-container');
    diagramHost.innerHTML = svg;
    this.host.replaceChildren(container);
    container.appendChild(diagramHost);
    this.diagramHost = diagramHost;

    // Layout-dependent work runs once the SVG is in the document: the viewBox needs getBBox, and the
    // reveal's hidden first frame has to be in place before the browser paints.
    const svgElement = diagramHost.querySelector<SVGSVGElement>('svg');
    if (!svgElement) return;
    this.svgElement = svgElement;
    if (svgElement.classList.contains('flowchart')) normalizeMermaidSvgViewBox(svgElement);
    svgElement.setAttribute('aria-label', this.labels.diagramLabel);

    const graph = buildMermaidGraph(svgElement);
    this.graph = graph;
    const interactionOptions = { enabled: true, ...this.options.interaction };
    const interactive = graph.nodes.length > 0 && interactionOptions.enabled !== false;
    if (interactive) {
      container.insertBefore(this.toolbar(typeof svgElement.animate === 'function'), diagramHost);
      this.interaction = attachMermaidDiagramInteraction(
        diagramHost,
        {
          ...interactionOptions,
          onTraceChange: (summary) => {
            interactionOptions.onTraceChange?.(summary);
            this.renderTrace(summary);
          },
        },
        graph,
      );
    }
    this.scheduleEntrance(svgElement, graph, diagramHost);
  }

  private scheduleEntrance(svg: SVGSVGElement, graph: MermaidGraph, diagramHost: HTMLElement): void {
    if (this.options.entrance === false || graph.nodes.length === 0) return;
    if (PLAYED_SOURCES.has(this.source) || prefersReducedMotion()) return;
    markPlayed(this.source);
    if (typeof IntersectionObserver === 'undefined' || isMostlyInView(diagramHost)) {
      this.playEntrance(svg, graph);
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.observer?.disconnect();
        this.observer = null;
        this.playEntrance(svg, graph);
      },
      { threshold: 0.15 },
    );
    this.observer.observe(diagramHost);
  }

  private playEntrance(svg: SVGSVGElement, graph: MermaidGraph): void {
    this.entrance?.cancel();
    this.entrance = playMermaidEntrance(svg, graph);
  }

  private toolbar(canReplay: boolean): HTMLElement {
    const toolbar = el('div', 'mermaid-toolbar');
    const status = el('div', 'mermaid-trace-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    this.statusRegion = status;
    toolbar.appendChild(status);
    if (canReplay) {
      const replay = el('button', 'mermaid-replay');
      replay.type = 'button';
      replay.setAttribute('aria-label', this.labels.replay);
      replay.title = this.labels.replay;
      replay.appendChild(icon('rotate'));
      replay.addEventListener('click', () => this.replay());
      toolbar.appendChild(replay);
    }
    return toolbar;
  }

  private renderTrace(summary: MermaidTraceSummary | null): void {
    const status = this.statusRegion;
    if (!status) return;
    status.replaceChildren();
    if (!summary) return;
    const { trace } = this.labels;
    const chip = el('div', 'mermaid-trace-chip');
    chip.dataset.pinned = String(summary.pinned);
    if (summary.pinned) chip.appendChild(icon('pin', 'mermaid-trace-chip-pin', trace.pinned));
    chip.appendChild(el('span', 'mermaid-trace-chip-name', summary.label));
    chip.appendChild(
      el('span', 'mermaid-trace-chip-count mermaid-trace-chip-up', formatLabel(trace.upstream, { value: summary.upstream })),
    );
    chip.appendChild(
      el('span', 'mermaid-trace-chip-count mermaid-trace-chip-down', formatLabel(trace.downstream, { value: summary.downstream })),
    );
    if (summary.pinned) {
      const clear = el('button', 'mermaid-trace-chip-clear');
      clear.type = 'button';
      clear.setAttribute('aria-label', trace.clear);
      clear.title = trace.clear;
      clear.appendChild(icon('x'));
      clear.addEventListener('click', () => this.interaction?.clearFocus());
      chip.appendChild(clear);
    }
    status.appendChild(chip);
  }

  private replay(): void {
    if (this.destroyed || !this.svgElement || !this.graph) return;
    this.interaction?.clearFocus();
    this.playEntrance(this.svgElement, this.graph);
  }

  private loadingPanel(): HTMLElement {
    const container = el('div', ['mermaid-container', this.options.className].filter(Boolean).join(' '));
    const loading = el('div', 'mermaid-loading');
    loading.appendChild(el('div', 'mermaid-spinner'));
    loading.appendChild(el('span', undefined, this.labels.rendering));
    container.appendChild(loading);
    return container;
  }

  private errorPanel(message: string): HTMLElement {
    const container = el('div', ['mermaid-container', this.options.className].filter(Boolean).join(' '));
    const panel = el('div', 'mermaid-error-container');
    const iconBox = el('div', 'mermaid-error-icon');
    iconBox.appendChild(icon('alert'));
    const content = el('div', 'mermaid-error-content');
    content.appendChild(el('h4', 'mermaid-error-title', this.labels.errorTitle));
    content.appendChild(el('p', 'mermaid-error-message', message));
    const details = el('details', 'mermaid-error-details');
    details.appendChild(el('summary', undefined, this.labels.viewSource));
    details.appendChild(el('pre', 'mermaid-error-code', this.source));
    content.appendChild(details);
    panel.append(iconBox, content);
    container.appendChild(panel);
    return container;
  }

  private teardownDiagram(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.entrance?.cancel();
    this.entrance = null;
    this.interaction?.destroy();
    this.interaction = null;
    this.graph = null;
    this.svgElement = null;
    this.diagramHost = null;
    this.statusRegion = null;
  }

  private destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.version += 1;
    this.teardownDiagram();
    this.unwatchMode?.();
    this.unwatchMode = null;
    this.host.replaceChildren();
  }
}

/**
 * Renders Mermaid source into `host`. The host shows a loading panel, then the diagram, or an error
 * panel with the source when Mermaid cannot parse it. Empty source leaves the host empty and does
 * not load Mermaid.
 */
export function renderMermaid(host: HTMLElement, source: string, options: MermaidRenderOptions = {}): MermaidHandle {
  return new MermaidDiagram(host, source, options).handle();
}
