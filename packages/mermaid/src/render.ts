import type { MermaidConfig } from 'mermaid';
import { describeParts } from './adapters.js';
import { renderTraceChip } from './chip.js';
import { el, icon, iconButton, prefersReducedMotion } from './dom.js';
import { playMermaidEntrance, type MermaidEntranceHandle } from './entrance.js';
import { attachMermaidPartFocus } from './focus.js';
import { buildMermaidGraph, type MermaidGraph } from './graph.js';
import { attachMermaidDiagramInteraction, type MermaidInteractionHandle } from './interaction.js';
import { resolveEngine } from './engine.js';
import { resolveLabels } from './labels.js';
import { resolveMode, watchMode } from './mode.js';
import { isPeleDegraded } from './pele-degraded.js';
import { applyPeleVariables, peleFontFamily, peleVariables } from './pele-theme.js';
import { ensureSvgViewBox, normalizeMermaidSvgViewBox, postProcessMermaidSvg } from './svg.js';
import { getMermaidThemeConfig, resolvePreset } from './theme.js';
import type {
  MermaidEngine,
  MermaidHandle,
  MermaidInteractionConfig,
  MermaidLabels,
  MermaidModule,
  MermaidPreset,
  MermaidRenderOptions,
  MermaidThemeMode,
  MermaidTraceSummary,
  MermaidUpdate,
  PeleErrorShape,
  PeleModule,
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

function defaultPeleLoader(): Promise<PeleModule> {
  return import('pele') as Promise<PeleModule>;
}

/** Pele is loaded once per loader. A failed import is not kept, so the next render tries again. */
const PELE_MODULES = new WeakMap<() => Promise<PeleModule>, Promise<PeleModule>>();

function loadPele(loader: () => Promise<PeleModule>): Promise<PeleModule> {
  let pending = PELE_MODULES.get(loader);
  if (!pending) {
    pending = loader().catch((error: unknown) => {
      PELE_MODULES.delete(loader);
      throw error;
    });
    PELE_MODULES.set(loader, pending);
  }
  return pending;
}

/** Mermaid backend: the shared Mermaid instance, queued so renders never overlap. */
function renderWithMermaid(
  source: string,
  options: MermaidRenderOptions,
  mode: MermaidThemeMode,
  preset: MermaidPreset,
): Promise<string> {
  return enqueue(async () => {
    const { default: mermaid } = await (options.loadMermaid ?? defaultLoader)();
    const config = getMermaidThemeConfig(mode, preset, { tokens: options.tokens });
    await initializeOnce(mermaid, config);
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return (await mermaid.render(id, source)).svg;
  });
}

/** Pele backend: a direct synchronous call, never Pele's own mount. Mermaid is not loaded on this path. */
async function renderWithPele(source: string, options: MermaidRenderOptions): Promise<{ svg: string; type: string }> {
  const pele = await loadPele(options.peleLoader ?? defaultPeleLoader);
  const { svg, type } = pele.render(source);
  return { svg, type };
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

/** Pele's `PeleError` is recognized by its shape, because the class is only reachable once `pele` has loaded. */
function isPeleError(error: unknown): error is PeleErrorShape {
  if (!(error instanceof Error)) return false;
  const candidate = error as Partial<PeleErrorShape>;
  return error.name === 'PeleError' || (typeof candidate.code === 'string' && typeof candidate.line === 'number');
}

/**
 * Keeps the position visible after the Mermaid label replaces "Parse error on line N:": the first line gets
 * "(line N, column M)" unless the message already names a line. Only the first line changes.
 */
function withPosition(message: string, error: PeleErrorShape): string {
  if (!error.line || /\bline \d+/i.test(message)) return message;
  const position = `line ${error.line}${error.column ? `, column ${error.column}` : ''}`;
  const [first = '', ...rest] = message.split('\n');
  const head = first.endsWith(':') ? `${first.slice(0, -1)} (${position}):` : `${first} (${position})`;
  return [head, ...rest].join('\n');
}

function describeError(error: unknown, labels: MermaidLabels): string {
  let message = labels.unableToRender;
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;
  const described = message
    .replace(/^Parse error on line \d+:/, labels.syntaxErrorPrefix)
    .replace(/^Error:/, labels.renderingErrorPrefix)
    .replace(/no diagram type detected/i, labels.noValidDiagram)
    .replace(/unknown diagram type/i, labels.unknownDiagramType);
  return isPeleError(error) ? withPosition(described, error) : described;
}

/** The options a Pele restyle may change without a render. Everything else still needs a render. */
function withoutRestyleKeys(options: MermaidRenderOptions): MermaidRenderOptions {
  const { mode: _mode, preset: _preset, tokens: _tokens, ...rest } = options;
  return rest;
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
  /** What the shown diagram was rendered from, so a Pele restyle is only taken when nothing else changed. */
  private renderedEngine: MermaidEngine | null = null;
  private renderedSource = '';
  private renderedOptions: MermaidRenderOptions = {};
  private renderedPreset: MermaidPreset = 'default';

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
    if (this.restylePele()) return;
    this.teardownDiagram();
    if (!this.source.trim()) {
      this.host.replaceChildren();
      return;
    }

    this.host.replaceChildren(this.loadingPanel());
    const { source, options } = this;
    const mode = resolveMode(options.mode ?? 'auto');
    const preset = resolvePreset(options.preset);
    const engine = resolveEngine(options.engine);
    try {
      const rendered = engine === 'pele' ? await renderWithPele(source, options) : { svg: await renderWithMermaid(source, options, mode, preset), type: '' };
      if (this.isStale(version)) return;
      this.renderedSource = source;
      this.renderedOptions = withoutRestyleKeys(options);
      this.renderedEngine = engine;
      this.showDiagram(postProcessMermaidSvg(rendered.svg, {}, engine), mode, preset, rendered.type);
    } catch (error) {
      if (this.isStale(version)) return;
      console.error('Mermaid rendering error:', error);
      this.host.replaceChildren(this.errorPanel(describeError(error, this.labels)));
    }
  }

  private showDiagram(svg: string, mode: MermaidThemeMode, preset: MermaidPreset, peleType = ''): void {
    this.renderedMode = mode;
    this.renderedPreset = preset;
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
    // Pele's SVG reads its colors from these variables, so they are written once here and restyled in place.
    if (this.renderedEngine === 'pele') this.paintPele(container, mode, preset);
    if (this.renderedEngine === 'pele' && isPeleDegraded(peleType)) {
      const notice = el('p', 'mermaid-engine-notice', this.labels.peleDegradedNotice);
      notice.setAttribute('role', 'note');
      container.insertBefore(notice, diagramHost);
    }

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

  /** Writes the Pele variables for a mode and preset onto the container. No Pele call is made. */
  private paintPele(container: HTMLElement, mode: MermaidThemeMode, preset: MermaidPreset): void {
    applyPeleVariables(container, peleVariables(mode, preset, { tokens: this.options.tokens, font: peleFontFamily(container) }));
  }

  /**
   * A mode, preset or token change on a shown Pele diagram only rewrites its variables and classes. Source,
   * engine and every other option still take the full render path. Returns false when a render is needed.
   */
  private restylePele(): boolean {
    if (this.renderedEngine !== 'pele' || !this.container || this.renderedSource !== this.source) return false;
    if (resolveEngine(this.options.engine) !== 'pele') return false;
    if (!sameOptions(withoutRestyleKeys(this.options), this.renderedOptions)) return false;
    const mode = resolveMode(this.options.mode ?? 'auto');
    const preset = resolvePreset(this.options.preset);
    const container = this.container;
    container.classList.remove(`mermaid-preset-${this.renderedPreset}`);
    container.classList.add(`mermaid-preset-${preset}`);
    container.dataset.mermaidPreset = preset;
    container.dataset.mermaidMode = mode;
    this.renderedMode = mode;
    this.renderedPreset = preset;
    this.paintPele(container, mode, preset);
    return true;
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
