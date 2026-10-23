/**
 * What each Mermaid diagram type is made of. Mermaid's SVG has no shared structure across types, so
 * this file is the one place that knows which elements are a pie slice, a Gantt bar or a sequence
 * message. It answers two questions from the rendered SVG alone, without re-parsing the source:
 *
 * - `entranceBeats`: in what order, and how, do the parts of the diagram arrive?
 * - `describeParts`: which elements belong together when one of them is hovered or focused?
 *
 * Diagrams that `buildMermaidGraph` can read (flowchart, state, class, ER, ...) arrive and trace
 * through the graph model instead. Every selector here was read from Mermaid 11.16.1 output; a type
 * the table does not know falls back to its top-level pieces, so a new Mermaid diagram still moves.
 */

export type BeatKind = 'fade' | 'rise' | 'drop' | 'pop' | 'growX' | 'growY' | 'draw' | 'swing' | 'wipe';

export interface Beat {
  els: Element[];
  kind: BeatKind;
  /** Start of the first element, in ms from the start of the reveal. */
  at: number;
  /** Gap between consecutive elements. Capped so one beat never outlasts the stagger budget. */
  gap?: number;
  /** Explicit start per element, in ms. Overrides `at` and `gap`. */
  delays?: number[];
  ms?: number;
  /** Pivot for `pop` and `swing`, in the elements' parent coordinates. Defaults to each element's centre. */
  origin?: [number, number];
}

/** One focusable thing in a chart: the element that takes focus, and every element that belongs to it. */
export interface PartFamily {
  primary: Element;
  parts: Element[];
  label: string;
  /** Families of the same group are numbered and walked together, for example every slice of a pie. */
  group: string;
}

const SKIPPED_TOP_LEVEL = new Set(['defs', 'style', 'title', 'desc', 'marker']);
const GENERIC_PIECE_LIMIT = 160;

export function diagramType(svg: Element): string {
  return svg.getAttribute('aria-roledescription') ?? '';
}

function all(root: ParentNode, selector: string): Element[] {
  return Array.from(root.querySelectorAll(selector));
}

function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function rect(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

function byX(els: Element[]): Element[] {
  return [...els].sort((a, b) => rect(a).left - rect(b).left || rect(a).top - rect(b).top);
}

/** Start times that follow each element's position along an axis, mapped onto [at, at + span]. */
function along(els: Element[], axis: 'x' | 'y', at: number, span: number, reference: Element[] = els): number[] {
  const centre = (el: Element) => {
    const box = rect(el);
    return axis === 'x' ? box.left + box.width / 2 : box.top + box.height / 2;
  };
  const marks = reference.map(centre);
  const low = Math.min(...marks);
  const range = Math.max(...marks) - low || 1;
  return els.map((el) => at + ((centre(el) - low) / range) * span);
}

function beat(kind: BeatKind, els: Element[], at: number, gap?: number, ms?: number, extra: Partial<Beat> = {}): Beat {
  return { kind, els, at, gap, ms, ...extra };
}

/** One beat per element, so a mixed list can keep its own order and give each element its own kind. */
function sequence(els: Element[], pick: (el: Element) => BeatKind, at: number, gap: number, ms?: number): Beat[] {
  return els.map((el, index) => beat(pick(el), [el], at + index * gap, undefined, ms));
}

/** The parents of elements, each once, in order. */
function lift(els: Element[]): Element[] {
  return [...new Set(els.map((el) => el.parentElement).filter((el): el is HTMLElement => el !== null))];
}

/** Centre of an element, in its parent's coordinates. */
function centreOf(el: Element | undefined): [number, number] | undefined {
  const graphic = el as SVGGraphicsElement | undefined;
  if (!graphic || typeof graphic.getBBox !== 'function') return undefined;
  try {
    const box = graphic.getBBox();
    return [box.x + box.width / 2, box.y + box.height / 2];
  } catch {
    return undefined;
  }
}

/** The top-level pieces of a diagram, looking through a lone wrapper group. */
function pieces(svg: Element): Element[] {
  const visible = (parent: Element) =>
    Array.from(parent.children).filter(
      (child) => !SKIPPED_TOP_LEVEL.has(child.tagName.toLowerCase()) && (child.children.length > 0 || textOf(child) !== '' || child.tagName.toLowerCase() !== 'g'),
    );
  let found = visible(svg);
  while (found.length === 1 && found[0].tagName.toLowerCase() === 'g' && found[0].children.length > 1) {
    found = visible(found[0]);
  }
  return found;
}

function genericKind(el: Element): BeatKind {
  const tag = el.tagName.toLowerCase();
  if (tag === 'path' || tag === 'line' || tag === 'polyline') return 'draw';
  if (tag === 'text') return 'fade';
  return 'pop';
}

function genericBeats(svg: Element): Beat[] {
  const found = pieces(svg);
  if (found.length === 0 || found.length > GENERIC_PIECE_LIMIT) return [beat('wipe', [svg], 0)];
  return sequence(found, genericKind, 0, Math.min(90, 900 / found.length));
}

type EntranceBuilder = (svg: Element) => Beat[];

const ENTRANCES: Record<string, EntranceBuilder> = {
  architecture: (svg) => [
    beat('fade', all(svg, 'g.architecture-groups > g'), 0, 120, 420),
    beat('pop', all(svg, 'g.architecture-service'), 160, 90),
    beat('draw', all(svg, 'g.architecture-edges path.edge'), 380, 80, 360),
    beat('fade', all(svg, 'g.architecture-edges polygon.arrow'), 620, 80, 240),
  ],

  block: (svg) => [
    beat('pop', all(svg, 'g.block > g.node'), 0, 70),
    beat('draw', all(svg, 'path[class*="edge-thickness"]'), 280, 60, 360),
  ],

  cynefin: (svg) => [
    beat('pop', all(svg, 'rect.cynefinDomain'), 0, 110, 520),
    beat('draw', all(svg, 'g.cynefin-boundaries path'), 260, 120, 520),
    beat('fade', all(svg, 'path.cynefinConfusion'), 520, 0, 420),
    beat('fade', all(svg, 'text.cynefinDomainLabel, text.cynefinSubtitle'), 300, 30, 360),
    beat('pop', all(svg, 'rect.cynefinItem, text.cynefinItemText'), 560, 50),
  ],

  eventmodeling: (svg) => {
    const boxes = byX(all(svg, 'g.em-box'));
    return [
      beat('growX', all(svg, 'g.em-swimlane'), 0, 90, 480),
      beat('rise', boxes, 200, 80),
      beat('draw', all(svg, 'path.em-relation'), 520, 70, 360),
    ];
  },

  gantt: (svg) => [
    beat('fade', all(svg, 'g.grid, text.titleText, text.sectionTitle'), 0, 0, 380),
    beat('fade', all(svg, 'rect.section'), 40, 60, 360),
    beat('growX', all(svg, 'rect.task'), 220, 90, 520),
    beat('fade', all(svg, 'text[class*="taskText"]'), 420, 90, 320),
    beat('draw', all(svg, 'g.today line'), 760, 0, 420),
  ],

  gitGraph: (svg) => {
    const commits = byX(all(svg, 'circle.commit'));
    return [
      beat('draw', all(svg, 'line.branch'), 0, 140, 640),
      beat('fade', all(svg, 'rect.branchLabelBkg, g.branchLabel'), 0, 0, 380),
      beat('pop', commits, 220, 100),
      beat('fade', byX(all(svg, 'rect.commit-label-bkg, text.commit-label, polygon.tag-label-bkg, circle.tag-hole')), 360, 70, 300),
      beat('draw', all(svg, 'g.commit-arrows path'), 420, 70, 360),
    ];
  },

  info: (svg) => [beat('rise', pieces(svg), 0, 80)],

  ishikawa: (svg) => [
    beat('draw', all(svg, 'line.ishikawa-spine'), 0, 0, 640),
    beat('pop', all(svg, 'g.ishikawa-head-group'), 420, 0, 460),
    beat('draw', all(svg, 'line.ishikawa-branch'), 260, 140, 420),
    beat('rise', all(svg, 'g.ishikawa-label-group'), 440, 140),
    beat('draw', all(svg, 'line.ishikawa-sub-branch'), 560, 90, 320),
    beat('rise', all(svg, 'g.ishikawa-sub-group'), 620, 90),
  ],

  journey: (svg) => [
    beat('fade', lift(all(svg, 'rect.journey-section')), 0, 80, 380),
    beat('draw', all(svg, 'line.task-line'), 140, 80, 380),
    beat('pop', all(svg, 'rect.task'), 220, 90),
    beat('pop', all(svg, 'circle.face'), 360, 90),
    beat('fade', all(svg, 'circle[class^="actor-"], text.legend'), 300, 20, 320),
  ],

  kanban: (svg) => [
    beat('rise', all(svg, 'g.sections > g.cluster'), 0, 120, 460),
    beat('rise', all(svg, 'g.items > g.node'), 240, 70),
  ],

  packet: (svg) => [
    beat('fade', all(svg, 'text.packetTitle'), 0, 0, 320),
    beat('rise', all(svg, 'rect.packetBlock'), 60, 45, 360),
    beat('fade', all(svg, 'text.packetLabel'), 200, 45, 300),
    beat('fade', all(svg, 'text.packetByte'), 260, 12, 260),
  ],

  pie: (svg) => [
    beat('fade', all(svg, 'circle.pieOuterCircle, text.pieTitleText'), 0, 0, 420),
    beat('swing', all(svg, 'path.pieCircle'), 60, 130, 600, { origin: [0, 0] }),
    beat('fade', all(svg, 'text.slice'), 420, 130, 320),
    beat('rise', all(svg, 'g.legend'), 300, 80),
  ],

  quadrantChart: (svg) => [
    beat('fade', all(svg, 'g.quadrants g.quadrant'), 0, 100, 420),
    beat('draw', all(svg, 'g.border line'), 140, 40, 420),
    beat('fade', all(svg, 'g.labels text, g.title text'), 260, 30, 340),
    beat('pop', all(svg, 'g.data-point'), 460, 90),
  ],

  radar: (svg) => {
    const centre = centreOf(svg.querySelector('circle.radarGraticule:last-of-type') ?? svg.querySelector('circle.radarGraticule') ?? undefined);
    return [
      beat('pop', all(svg, 'circle.radarGraticule'), 0, 70, 460, { origin: centre }),
      beat('draw', all(svg, 'line.radarAxisLine'), 160, 40, 360),
      beat('fade', all(svg, 'text.radarAxisLabel, text.radarTitle'), 320, 40, 320),
      beat('pop', all(svg, 'path[class^="radarCurve"]'), 460, 220, 760, { origin: centre }),
      beat('rise', all(svg, 'rect[class^="radarLegendBox"], text.radarLegendText'), 700, 60),
    ];
  },

  railroad: (svg) => [
    beat('pop', all(svg, 'g.railroad-start, g.railroad-end'), 0, 0, 360),
    beat('draw', all(svg, 'path.railroad-line'), 60, 60, 420),
    beat('pop', all(svg, 'g.railroad-terminal, g.railroad-nonterminal'), 160, 70),
    beat('fade', all(svg, 'text.railroad-rule-name'), 0, 0, 360),
  ],

  sequence: (svg) => {
    const messages = all(svg, 'line.messageLine0, line.messageLine1, path.messageLine0, path.messageLine1');
    const texts = all(svg, 'text.messageText');
    // With autonumber, each number is a zero-length line whose marker draws the dot, plus a text for the digits.
    const numbers = all(svg, 'text.sequenceNumber, line[marker-start*="sequencenumber"]');
    const frames = all(svg, 'line.loopLine, polygon.labelBox, text.labelText, text.loopText, rect.note, text.noteText');
    const timeline = [...messages, ...texts, ...frames];
    const start = 520;
    const span = 1000;
    return [
      beat('drop', lift(all(svg, 'rect.actor-top')), 0, 80, 420),
      beat('draw', all(svg, 'line.actor-line'), 120, 60, 780),
      beat('draw', messages, 0, 0, 300, { delays: along(messages, 'y', start, span, timeline) }),
      beat('fade', texts, 0, 0, 300, { delays: along(texts, 'y', start + 80, span, timeline) }),
      beat('fade', numbers, 0, 0, 300, { delays: along(numbers, 'y', start + 40, span, timeline) }),
      beat('fade', frames, 0, 0, 300, { delays: along(frames, 'y', start, span, timeline) }),
      beat('rise', lift(all(svg, 'rect.actor-bottom')), start + span, 70, 360),
    ];
  },

  timeline: (svg) => {
    const parts = all(svg, 'g.taskWrapper, g.lineWrapper, g.eventWrapper');
    const kind = (el: Element): BeatKind => (el.matches('.lineWrapper') ? 'draw' : el.matches('.taskWrapper') ? 'pop' : 'rise');
    return [
      beat('fade', all(svg, 'g > g.timeline-node, text.titleText').filter((el) => !el.closest('.taskWrapper, .eventWrapper')), 0, 40, 360),
      ...sequence(parts, kind, 120, Math.min(120, 1400 / Math.max(parts.length, 1)), 420),
    ];
  },

  treeView: (svg) => {
    const rows = Array.from(svg.querySelector('g.tree-view')?.children ?? []);
    return sequence(rows, (el) => (el.tagName.toLowerCase() === 'line' ? 'draw' : 'rise'), 0, Math.min(60, 1200 / Math.max(rows.length, 1)), 380);
  },

  treemap: (svg) => [
    beat('pop', all(svg, 'g.treemapSection'), 0, 110, 520),
    beat('pop', all(svg, 'g.treemapLeafGroup'), 240, 60),
  ],

  venn: (svg) => [
    beat('pop', all(svg, 'g.venn-circle'), 0, 140, 620),
    beat('fade', all(svg, 'g.venn-intersection'), 480, 100, 420),
    beat('fade', all(svg, 'text.venn-title'), 0, 0, 360),
  ],

  wardley: (svg) => [
    beat('fade', all(svg, 'rect.wardley-background, text.wardley-title, text.wardley-axis-label, text.wardley-stage-label'), 0, 0, 380),
    beat('draw', all(svg, 'g.wardley-axes line'), 0, 80, 420),
    beat('fade', all(svg, 'g.wardley-stages line'), 120, 80, 360),
    beat('pop', all(svg, 'g.wardley-node'), 260, 120),
    beat('draw', all(svg, 'g.wardley-links line'), 400, 120, 360),
  ],

  xychart: (svg) => [
    beat('fade', all(svg, 'g.chart-title, g.bottom-axis, g.left-axis'), 0, 80, 420),
    beat('growY', all(svg, 'g[class^="bar-plot"] rect'), 220, 90, 600),
    beat('draw', all(svg, 'g[class^="line-plot"] path'), 640, 0, 760),
  ],
};

ENTRANCES.railroadAbnf = ENTRANCES.railroad;
ENTRANCES.railroadEbnf = ENTRANCES.railroad;
ENTRANCES.railroadPeg = ENTRANCES.railroad;

/** The reveal for a diagram the graph model cannot read. Always returns beats, so every type moves. */
export function entranceBeats(svg: Element): Beat[] {
  const build = ENTRANCES[diagramType(svg)];
  const beats = build ? build(svg).filter((item) => item.els.length > 0) : [];
  return beats.length > 0 ? beats : genericBeats(svg);
}

/**
 * Pairs the i-th element of each extra selector with the i-th primary, and drops an extra whose count
 * does not match, so a part is never attached to the wrong family.
 */
function zip(
  svg: Element,
  group: string,
  primarySelector: string,
  extras: string[] = [],
  options: { lift?: boolean; labelFrom?: string; labelPart?: number; trim?: boolean; leftToRight?: boolean; within?: string } = {},
): PartFamily[] {
  const pick = (selector: string) => {
    const found = all(svg, selector);
    return options.lift ? lift(found) : found;
  };
  const primaries = pick(primarySelector);
  // A column with extras past the last primary (a centre label, say) can be trimmed to fit.
  const columns = extras
    .map(pick)
    .map((column) => (options.trim && column.length > primaries.length ? column.slice(0, primaries.length) : column))
    .filter((column) => column.length === primaries.length);
  const rows = primaries.map((primary, index) => ({ primary, parts: [primary, ...columns.map((column) => column[index])] }));
  // Mermaid may emit parts in drawing order, which is not always reading order (sequence lists actors last to first).
  if (options.leftToRight) rows.sort((a, b) => rect(a.primary).left - rect(b.primary).left);
  const inside = options.within ? all(svg, options.within) : [];
  return rows.map(({ primary, parts }) => {
    if (inside.length > 0) {
      // Parts that sit over the primary (a domain's labels and items) belong to it, found by position.
      const bounds = rect(primary);
      parts = [...parts, ...inside.filter((part) => {
        const box = rect(part);
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
      })];
    }
    const labelled = options.labelFrom ? primary.querySelector(options.labelFrom) : null;
    const named = options.labelPart === undefined ? undefined : textOf(parts[options.labelPart]);
    const label = named || textOf(labelled) || parts.map(textOf).find((text) => text !== '') || '';
    return { primary, parts, label, group };
  });
}

function solo(svg: Element, group: string, selector: string, options: { lift?: boolean; labelFrom?: string } = {}): PartFamily[] {
  return zip(svg, group, selector, [], options);
}

/** A kanban column and the cards that sit inside it, matched by position. */
function kanbanColumns(svg: Element): PartFamily[] {
  const cards = all(svg, 'g.items > g.node');
  return all(svg, 'g.sections > g.cluster').map((column) => {
    const bounds = rect(column);
    const inside = cards.filter((card) => {
      const box = rect(card);
      const middle = box.left + box.width / 2;
      return middle >= bounds.left && middle <= bounds.right;
    });
    return { primary: column, parts: [column, ...inside], label: textOf(column.querySelector('.cluster-label')), group: 'column' };
  });
}

type PartsBuilder = (svg: Element) => PartFamily[];

const PARTS: Record<string, PartsBuilder> = {
  architecture: (svg) => solo(svg, 'service', 'g.architecture-service'),
  block: (svg) => solo(svg, 'block', 'g.block > g.node'),
  c4: (svg) => solo(svg, 'element', 'g.person-man'),
  cynefin: (svg) =>
    zip(svg, 'domain', 'rect.cynefinDomain', ['text.cynefinDomainLabel'], {
      trim: true,
      within: 'text.cynefinSubtitle, rect.cynefinItem, text.cynefinItemText',
    }),
  eventmodeling: (svg) => solo(svg, 'event', 'g.em-box'),
  gantt: (svg) => zip(svg, 'task', 'rect.task', ['text[class*="taskText"]']),
  gitGraph: (svg) => zip(svg, 'branch', 'rect.branchLabelBkg', ['g.branchLabel', 'line.branch'], { labelPart: 1 }),
  ishikawa: (svg) => solo(svg, 'cause', 'g.ishikawa-pair', { labelFrom: '.ishikawa-label-group' }),
  journey: (svg) => solo(svg, 'task', 'rect.task', { lift: true, labelFrom: 'div.task, text.task' }),
  kanban: kanbanColumns,
  packet: (svg) => zip(svg, 'field', 'rect.packetBlock', ['text.packetLabel', 'text.packetByte.start', 'text.packetByte.end'], { labelPart: 1 }),
  pie: (svg) => zip(svg, 'slice', 'path.pieCircle', ['text.slice', 'g.legend'], { labelPart: 2 }),
  quadrantChart: (svg) => [
    ...solo(svg, 'point', 'g.data-point'),
    ...solo(svg, 'quadrant', 'g.quadrants g.quadrant'),
  ],
  radar: (svg) => zip(svg, 'series', 'path[class^="radarCurve"]', ['rect[class^="radarLegendBox"]', 'text.radarLegendText']),
  railroad: (svg) => solo(svg, 'token', 'g.railroad-terminal, g.railroad-nonterminal'),
  sequence: (svg) => [
    ...zip(svg, 'message', 'line.messageLine0, line.messageLine1, path.messageLine0, path.messageLine1', ['text.messageText', 'text.sequenceNumber']),
    ...zip(svg, 'participant', 'line.actor-line', ['rect.actor-bottom'], { lift: true, leftToRight: true }),
  ],
  timeline: (svg) => solo(svg, 'period', 'g.taskWrapper, g.eventWrapper'),
  treeView: (svg) => solo(svg, 'entry', 'text.treeView-node-label', { lift: true }),
  treemap: (svg) =>
    solo(svg, 'tile', 'g.treemapLeafGroup, g.treemapSection').map((family) => {
      const name = textOf(family.primary.querySelector('text.treemapSectionLabel, text.treemapLabel'));
      const value = textOf(family.primary.querySelector('text.treemapSectionValue, text.treemapValue'));
      return { ...family, label: [name, value].filter(Boolean).join(' ') };
    }),
  venn: (svg) => solo(svg, 'area', 'g.venn-area'),
  wardley: (svg) => solo(svg, 'component', 'g.wardley-node'),
  xychart: (svg) => zip(svg, 'bar', 'g[class^="bar-plot"] rect', ['g.bottom-axis g.label text']),
};

PARTS.railroadAbnf = PARTS.railroad;
PARTS.railroadEbnf = PARTS.railroad;
PARTS.railroadPeg = PARTS.railroad;

/**
 * The focusable families of a chart. Message families label themselves from the message text, which
 * is the second part, so they name it explicitly.
 */
export function describeParts(svg: Element): PartFamily[] {
  const build = PARTS[diagramType(svg)];
  if (!build) return [];
  return build(svg)
    // Mermaid sometimes draws a hidden root (the treemap's first section); nothing can hover it.
    .filter((family) => {
      const box = rect(family.primary);
      return box.width > 0 || box.height > 0;
    })
    .map((family) => {
      if (family.group === 'message' && family.parts[1]) return { ...family, label: textOf(family.parts[1]) };
      return family;
    });
}
