# @hagicode/hagilight-mermaid

Framework-agnostic Mermaid rendering with the HagiCode look: a light and dark theme that follows the page, two appearance presets, a reveal that follows how each diagram type reads, hover and pinned path tracing, part-by-part focus for charts, and an enlarged viewer with zoom and pan. It runs in any site (Astro, Starlight, Docusaurus or plain HTML) with no React, store or i18n library.

## Install

```bash
npm install @hagicode/hagilight-mermaid mermaid
```

`mermaid` is a peer dependency (`^11`). The package never bundles it, and it is imported the first time a non-empty diagram renders.

`pele` is an optional peer (`^1.13.0`) for the Pele engine described below. Install it only if a site selects Pele: `npm install pele@^1.13.0`. A site that never selects Pele does not need it.

## Quick start

```ts
import { mountMermaidDiagrams } from '@hagicode/hagilight-mermaid';
import '@hagicode/hagilight-mermaid/styles.css';

const mermaid = mountMermaidDiagrams(document, { mode: 'auto', preset: 'default' });
```

`mountMermaidDiagrams` replaces each `pre.mermaid` and `code.language-mermaid` block under the root with a rendered diagram. Call `mermaid.destroy()` when the page goes away. For the archify preset, also import `@hagicode/hagilight-mermaid/styles/archify.css`.

To render one diagram into an element you already have, use `renderMermaid`:

```ts
import { renderMermaid } from '@hagicode/hagilight-mermaid';

const handle = renderMermaid(element, 'flowchart LR; A --> B', { mode: 'dark' });
handle.update({ source: 'flowchart LR; B --> C' }); // new source or options
handle.replay(); // play the reveal again
handle.expand(); // open the enlarged viewer; handle.collapse() closes it
handle.destroy(); // discard pending renders and empty the element
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `mode` | `'auto'` | `'light'`, `'dark'` or `'auto'`. `auto` reads `data-theme` on `<html>`, then a `dark` class, then `prefers-color-scheme`, and follows later changes. |
| `preset` | `'default'` | `'default'` or `'archify'`. An unknown name uses `'default'`. |
| `labels` | English | Overrides for user-visible text. See below. |
| `tokens` | `--hagilight-mermaid-*` | Maps theme roles to your own custom property names. |
| `interaction` | `{ enabled: true }` | `enabled: false` renders a static diagram. `pin: false` leaves clicks to the host page (hover and keyboard focus still work). `reducedMotion` overrides the system setting. `onTraceChange` receives the trace or focus summary. |
| `entrance` | `true` | `false` skips the first-view reveal. |
| `viewer` | `true` | Adds an enlarge button to the toolbar and makes `handle.expand()` open the viewer. `false` removes both. |
| `fit` | `'width'` | `'width'` fills the host's width and lets the height follow. `'contain'` fits the whole diagram in the host's height, for fixed-height tiles: give the host a height. |
| `loadMermaid` | `import('mermaid')` | Supplies the `mermaid` module. Use it to control chunking or to test. |
| `engine` | `'mermaid'` | `'mermaid'` or `'pele'`. Resolved from this option, then the stored choice (see below), then `'mermaid'`. An unrecognized value is ignored. |
| `peleLoader` | `import('pele')` | Supplies the `pele` module when the Pele engine renders. Use it to control chunking or to test. |
| `className` | | Extra class names on the diagram container. |

## Pele engine (optional)

[Pele](https://pele.run) renders the same Mermaid source to SVG without Mermaid's runtime. It is synchronous and small. Mermaid stays the default, so a site that does nothing keeps its current output.

```ts
import { mountMermaidDiagrams, writeStoredEngine } from '@hagicode/hagilight-mermaid';

mountMermaidDiagrams(document, { engine: 'pele' }); // this page, whatever is stored
writeStoredEngine('pele'); // remember the choice in this browser for later renders
```

The engine is resolved in this order, and an unrecognized value is ignored:

1. the `engine` option, when given (so `engine: 'mermaid'` outranks a stored `pele`);
2. the choice stored under the key `hagilight-mermaid:engine` in `localStorage`;
3. `mermaid`.

Rendering never writes the stored choice. Only `writeStoredEngine` does, so `update({ engine })` for one page does not change later pages. `readStoredEngine()` returns the stored value or `undefined`. Storage that throws or is absent is treated as no choice, and no call here throws.

**Version.** `pele` is pinned to `^1.13.0` as a peer. The package's tests render one sample per supported type with the installed Pele and fail if a marker the adapters need (node and edge classes, `data-id`, `aria-roledescription`) is missing. Pele has no release page, so a Pele upgrade is checked by those tests before it is accepted.

**What Pele changes.** The theme maps `--hagilight-mermaid-*` tokens to Pele's `--pele-*` variables on the container, so a mode or preset change restyles the diagram without calling Pele again. Pie series colors are set explicitly. The error panel shows Pele's position and writes every message with `textContent`.

**Flowchart, state, class and ER under Pele.** Tracing, keyboard focus and the dependency-order reveal use the geometry of the rendered SVG: each edge's first and last points are matched to the nearest node box. Edge identifiers are never read for endpoints. For class and ER relations the drawn direction, from the start of the line to its end, is the trace direction. ER relations have no true direction, so this is a convention: in the fixtures the line leaves the entity named first in the relation (`Animal` to `Duck`, `CUSTOMER` to `ORDER`).

**Other Pele types** (pie, sequence and the rest) reveal with the generic reveal and have no part focus in this version. Diagram types listed in the degraded set show a notice above the diagram.

**Degraded types.** Pele draws these types in a clearly simpler way, so the container shows the notice `peleDegradedNotice` (overridable through `labels`) above the diagram:

- `c4`: the scaled-down diagram's text is hard to read at the same width.
- `gitGraph`: branch labels sit on mid-tone fills and are hard to read.
- `treemap`: leaf labels are small and light on their fills.

The list was set from a same-size screenshot comparison of the 36 demo samples, both engines at 440 px. It is a constant in the package and is extended only with that kind of comparison.

**Phase 2 limits.** Part focus and type-specific reveals for pie, sequence and the other types are not included. Pele's own `mount()` is not used, so its zoom and resize behaviour is not available. Layouts differ from Mermaid's, so a Pele diagram is not a pixel match for the Mermaid one.

## What each diagram type does

Every Mermaid diagram type moves and responds, not only the ones with nodes.

| Kind | Types | Reveal | Hover, focus and pin |
| --- | --- | --- | --- |
| Graphs | flowchart, state, class, ER, requirement, mindmap, swimlane, Sankey | Nodes land in dependency order and edges draw in behind them | Path tracing: the nodes that reach a node and the ones it reaches light up, with hop badges and a travelling light |
| Charts and maps | pie, Gantt, XY chart, radar, quadrant, treemap, Venn, packet, timeline, journey, git graph, tree view, Wardley, Ishikawa, Cynefin, kanban, architecture, block, event modeling, C4, railroad | Each type reads its own way: pie slices swing in clockwise, Gantt bars and bar charts grow from their base, a line chart draws, radar rings open from the centre | The part under the pointer keeps its colour with its label and legend row, and the rest steps back |
| Sequence | sequence | Participants drop in, lifelines draw down, messages arrive from top to bottom with their arrowheads held back until the line lands | Hover a message or a participant to follow it |
| Info | info | Rises into place | Static |

A diagram type this version does not know still reveals: its top-level pieces arrive in order, or, past 160 pieces, it sweeps in as one. Keyboard users get one tab stop per diagram, arrow keys walk the parts, Enter pins, and Escape releases.

## Enlarged viewer

The toolbar's enlarge button, or `handle.expand()`, opens the diagram in a modal viewer. The diagram lifts out of its place, and settles back when the viewer closes. The viewer has its own copy of the diagram, so tracing and focus work there too, at any scale.

- **Zoom:** scroll wheel or trackpad pinch (about the pointer), two-finger pinch on touch, the buttons, `+` and `-`.
- **Move:** drag; a released drag coasts. Arrow keys move too.
- **Fit and actual size:** the fit button or `0` fits the whole diagram, `1` shows it at its natural size. Double-click zooms in on a point, and again to return to fit.
- **Close:** the close button, `Esc` (first releases a pinned trace), or `handle.collapse()`. Focus returns to the enlarge button.

With reduced motion the viewer opens and closes with no travel and the camera jumps instead of easing.

## Tokens

The theme reads these colors from the page. Define them on `:root` (or any ancestor) to match your site. Undefined tokens use built-in light and dark values.

| Token | Role | Light fallback | Dark fallback |
| --- | --- | --- | --- |
| `--hagilight-mermaid-background` | Canvas | `#ffffff` | `#111827` |
| `--hagilight-mermaid-foreground` | Text | `#17212b` | `#f8fafc` |
| `--hagilight-mermaid-primary` | Node borders, focus | `#2563eb` | `#60a5fa` |
| `--hagilight-mermaid-primary-foreground` | Core node text | `#ffffff` | `#111827` |
| `--hagilight-mermaid-accent` | Secondary accent, hover | `#0f766e` (theme), `#f1f5f9` (hover) | `#5eead4` (theme), `#334155` (hover) |
| `--hagilight-mermaid-card` | Chip and loading surface | `#ffffff` | `#1f2937` |
| `--hagilight-mermaid-border` | Lines and borders | `#e2e8f0` | `#334155` |
| `--hagilight-mermaid-muted`, `--hagilight-mermaid-muted-foreground` | Group fill and secondary text | `#f1f5f9`, `#64748b` | `#1e293b`, `#94a3b8` |
| `--hagilight-mermaid-destructive` | Error icon | `#dc2626` | `#f87171` |
| `--hagilight-mermaid-status-warning` | Upstream trace color | `#d97706` | `#fbbf24` |
| `--hagilight-mermaid-mm-up`, `--hagilight-mermaid-mm-down` | Trace colors override | primary and warning | primary and warning |
| `--hagilight-mermaid-app-font-mono` | Error source font | system monospace | system monospace |

### Series palette

Charts that tell many parts apart (pie, Gantt, git graph, journey, timeline, mindmap, kanban, radar, XY, Venn, quadrant, event modeling, Cynefin) read a fixed 12-hue categorical palette per preset and mode, not the site tokens. Mermaid's base theme would derive these from the primary color and leave every slice navy. Each hue has three tones, generated in OKLCH:

- **mark** for slices, bars, lines and branches: at least 3:1 against the canvas, with 4.5:1 text on it. In dark mode no mark passes 0.5 relative luminance, so a large mark never glares.
- **fill** for blocks that carry their own text, such as notes, quadrants and event boxes.
- **border** for the edge of a fill block.

Blue and teal lead the order, then amber and violet, so neighbouring series never read alike. `getMermaidSemanticTheme(mode, preset).series` exposes the tones; node, edge and cluster colors still follow the tokens above.

To use a site's own names, pass `tokens` instead of redefining the package tokens:

```ts
import { mountMermaidDiagrams } from '@hagicode/hagilight-mermaid';

mountMermaidDiagrams(document, {
  tokens: { background: '--background', foreground: '--foreground', primary: '--primary', accent: '--accent', primaryForeground: '--primary-foreground' },
});
```

Colors in `oklch()` or `lab()` are converted to `rgb()` through a canvas before Mermaid reads them, because Mermaid's parser rejects those functions.

## Labels

All visible text comes from `labels`. Unspecified keys keep the English defaults, and `{value}` is replaced by the count in trace labels.

```ts
import { mountMermaidDiagrams } from '@hagicode/hagilight-mermaid';

mountMermaidDiagrams(document, {
  labels: {
    rendering: 'Rendering diagram...',
    errorTitle: 'Diagram rendering error',
    trace: { upstream: 'Upstream {value}', downstream: 'Downstream {value}', pinned: 'Pinned', clear: 'Clear selection' },
    expand: 'Enlarge diagram',
    viewer: { title: 'Enlarged diagram', close: 'Close', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit to window', actualSize: 'Actual size', hint: 'Scroll to zoom, drag to move, Esc to close' },
  },
});
```

## Docusaurus

Docusaurus renders in React, so wrap `renderMermaid` in an effect:

```tsx
import { useEffect, useRef } from 'react';
import { renderMermaid } from '@hagicode/hagilight-mermaid';
import '@hagicode/hagilight-mermaid/styles.css';

export default function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = renderMermaid(ref.current!, chart);
    return () => handle.destroy();
  }, [chart]);
  return <div ref={ref} />;
}
```

## Subpaths

`@hagicode/hagilight-mermaid/theme`, `/svg`, `/graph`, `/entrance`, `/interaction` and `/labels` expose the pure helpers. They do not touch the DOM at import time, so server builds can import them.

## Known limits

With Mermaid 11.16.1, every diagram type the demo covers renders an SVG, and none shows an error panel. The browser checks keep an empty known-gaps list, so no type is expected to fail. These limits remain:

- **Railroad** (`railroad-beta`, and the ABNF, EBNF and PEG grammar variants): the first label can be clipped at the left edge of the diagram and is drawn larger than its box, because the diagram's own text sizing does not fit the container. The theme does not cause this.
- **Part focus and the reveal** read Mermaid 11.16.1's SVG structure, which has no shared shape across diagram types. A later Mermaid release can rename a class: the affected type then loses its part focus, and its reveal falls back to the generic one, until the table in `src/adapters.ts` is updated. The browser checks pin the installed version.
- **Thin lines** (a sequence message, a git branch) are hard to hit on their own, so the part includes its label: hover the label or the text beside the line.
- **Block**, **kanban**, **architecture** and **Wardley** have no dependency graph the tracing can read, so they get part focus rather than upstream and downstream paths.
- **Pele engine**: the layout is Pele's own, not Mermaid's. The degraded list above is the only place that says where Pele draws less clearly. Part focus and type-specific reveals wait for a later phase.
- **Text halo**: the default preset draws a halo behind diagram text, white in light mode and `#111827` in dark mode. Set `--hagilight-mermaid-halo` to the page color when it differs. Text printed on a colored mark (pie slices, Gantt bars, timeline and branch labels) has no halo.

## Parity

The theme, SVG post-processing, graph, entrance and interaction modules are ported from the HagiCode web app. The web app is not yet on this package, so the two copies can drift. Parity tests compare the Mermaid configuration and the rendered SVG with the web app's values. Adopting the package in the web app is a separate follow-up.
