import type { MermaidConfig } from 'mermaid';
import { describeParts } from './adapters.js';
import { renderTraceChip } from './chip.js';
import { el, icon, iconButton, prefersReducedMotion } from './dom.js';
import { playMermaidEntrance, type MermaidEntranceHandle } from './entrance.js';
import { attachMermaidPartFocus } from './focus.js';
import { buildMermaidGraph, type MermaidGraph } from './graph.js';
import { attachMermaidDiagramInteraction, type MermaidInteractionHandle } from './interaction.js';
import { resolveLabels } from './labels.js';
import { resolveMode, watchMode } from './mode.js';
import { ensureSvgViewBox, normalizeMermaidSvgViewBox, postProcessMermaidSvg } from './svg.js';
import { getMermaidThemeConfig, resolvePreset } from './theme.js';
import type {
  MermaidHandle,
  MermaidInteractionConfig,
  MermaidLabels,
  MermaidModule,
  MermaidRenderOptions,
  MermaidThemeMode,
  MermaidTraceSummary,
  MermaidUpdate,
} from './types.js';
import { openMermaidViewer, type MermaidViewerHandle } from './viewer.js';

const PLAYED_SOURCES_LIMIT = 200;
/** Sources whose reveal already played, so re-rendering or remounting the same diagram does not replay it. */
const PLAYED_SOURCES = new Set<string>();

function markPlayed(source: string): void {
  PLAYED_SOURCES.add(source);
  if (PLAYED_SOURCES.size > PLAYED_SOURCES_LIMIT) {
    const oldest = PLAYED_SOURCES.values().next().value;
    if (oldest !== undefined) PLAYED_SOURCES.delete(oldest);
  }
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
/** Trace for a graph the model can read, part focus for every other type, nothing when interaction is off. */
function attachInteraction(
  host: HTMLElement,
  svg: SVGSVGElement,
  config: MermaidInteractionConfig,
  onTraceChange: (summary: MermaidTraceSummary | null) => void,
  graph: MermaidGraph = buildMermaidGraph(svg),
): MermaidInteractionHandle {
  const wired = { ...config, onTraceChange };
  if (graph.nodes.length > 0) return attachMermaidDiagramInteraction(host, wired, graph);
  return attachMermaidPartFocus(host, wired, describeParts(svg));
}

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
  private markup = '';
  private container: HTMLElement | null = null;
  private viewer: MermaidViewerHandle | null = null;
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
      expand: () => this.expand(),
      collapse: () => this.viewer?.close(),
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
    this.markup = svg;
    const container = el('div', [this.baseClasses(), `mermaid-preset-${preset}`].join(' '));
    container.dataset.mermaidPreset = preset;
    container.dataset.mermaidMode = mode;
    const diagramHost = el('div', 'mermaid-diagram-container');
    diagramHost.innerHTML = svg;
    this.host.replaceChildren(container);
    container.appendChild(diagramHost);
    this.container = container;
    this.diagramHost = diagramHost;

    // Layout-dependent work runs once the SVG is in the document: the viewBox needs getBBox, and the
    // reveal's hidden first frame has to be in place before the browser paints.
    const svgElement = diagramHost.querySelector<SVGSVGElement>('svg');
    if (!svgElement) return;
    this.svgElement = svgElement;
    if (svgElement.classList.contains('flowchart')) normalizeMermaidSvgViewBox(svgElement);
    ensureSvgViewBox(svgElement);
    svgElement.setAttribute('aria-label', this.labels.diagramLabel);

    const graph = buildMermaidGraph(svgElement);
    this.graph = graph;
    const interactionOptions = { enabled: true, ...this.options.interaction };
    const interactive = interactionOptions.enabled !== false && (graph.nodes.length > 0 || describeParts(svgElement).length > 0);
    const viewerOn = this.options.viewer !== false;
    if (interactive || viewerOn) container.insertBefore(this.toolbar(typeof svgElement.animate === 'function', viewerOn), diagramHost);
    if (interactive) {
      this.interaction = attachInteraction(
        diagramHost,
        svgElement,
        interactionOptions,
        (summary) => {
          interactionOptions.onTraceChange?.(summary);
          this.renderTrace(summary);
        },
        graph,
      );
    }
    this.scheduleEntrance(svgElement, graph, diagramHost);
  }

  private scheduleEntrance(svg: SVGSVGElement, graph: MermaidGraph, diagramHost: HTMLElement): void {
    if (this.options.entrance === false) return;
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

  private toolbar(canReplay: boolean, canExpand: boolean): HTMLElement {
    const toolbar = el('div', 'mermaid-toolbar');
    const status = el('div', 'mermaid-trace-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    this.statusRegion = status;
    toolbar.appendChild(status);
    if (canReplay) toolbar.appendChild(iconButton('rotate', this.labels.replay, 'mermaid-replay', () => this.replay()));
    if (canExpand) toolbar.appendChild(iconButton('expand', this.labels.expand, 'mermaid-expand', () => this.expand()));
    return toolbar;
  }

  private renderTrace(summary: MermaidTraceSummary | null): void {
    if (this.statusRegion) renderTraceChip(this.statusRegion, summary, this.labels, () => this.interaction?.clearFocus());
  }

  private expand(): void {
    const container = this.container;
    if (this.destroyed || this.viewer || !container || !this.markup || this.options.viewer === false) return;
    this.interaction?.clearFocus();
    this.viewer = openMermaidViewer({
      container,
      markup: this.markup,
      labels: this.labels,
      source: () => this.svgElement,
      enhance: (canvas, svg, onSummary) => {
        const config = { enabled: true, ...this.options.interaction };
        return attachInteraction(canvas, svg, config, (summary) => {
          config.onTraceChange?.(summary);
          onSummary(summary);
        });
      },
      onClose: () => {
        this.viewer = null;
      },
    });
  }

  private replay(): void {
    if (this.destroyed || !this.svgElement || !this.graph) return;
    this.interaction?.clearFocus();
    this.playEntrance(this.svgElement, this.graph);
  }

  /** Classes every container state carries, so loading, error and diagram share the host's sizing. */
  private baseClasses(): string {
    return ['mermaid-container', this.options.fit === 'contain' ? 'mermaid-fit-contain' : '', this.options.className].filter(Boolean).join(' ');
  }

  private loadingPanel(): HTMLElement {
    const container = el('div', this.baseClasses());
    const loading = el('div', 'mermaid-loading');
    loading.appendChild(el('div', 'mermaid-spinner'));
    loading.appendChild(el('span', undefined, this.labels.rendering));
    container.appendChild(loading);
    return container;
  }

  private errorPanel(message: string): HTMLElement {
    const container = el('div', this.baseClasses());
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
    this.viewer?.destroy();
    this.viewer = null;
    this.container = null;
    this.markup = '';
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
