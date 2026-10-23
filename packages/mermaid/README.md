# @hagicode/hagilight-mermaid

Framework-agnostic Mermaid rendering with the HagiCode look: a light and dark theme that follows the page, two appearance presets, a reveal that follows how each diagram type reads, hover and pinned path tracing, part-by-part focus for charts, and an enlarged viewer with zoom and pan. It runs in any site (Astro, Starlight, Docusaurus or plain HTML) with no React, store or i18n library.

## Install

```bash
npm install @hagicode/hagilight-mermaid mermaid
```

`mermaid` is a peer dependency (`^11`). The package never bundles it, and it is imported the first time a non-empty diagram renders.

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
| `className` | | Extra class names on the diagram container. |

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

To use a site's own names, pass `tokens` instead of redefining the package tokens:

```ts
mountMermaidDiagrams(document, {
  tokens: { background: '--background', foreground: '--foreground', primary: '--primary', accent: '--accent', primaryForeground: '--primary-foreground' },
});
```

Colors in `oklch()` or `lab()` are converted to `rgb()` through a canvas before Mermaid reads them, because Mermaid's parser rejects those functions.

## Labels

All visible text comes from `labels`. Unspecified keys keep the English defaults, and `{value}` is replaced by the count in trace labels.

```ts
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
- **Text halo**: the default preset draws a light halo behind diagram text in light mode and a dark halo in dark mode. Against a page background of the other colour, text can look outlined.

## Parity

The theme, SVG post-processing, graph, entrance and interaction modules are ported from the HagiCode web app. The web app is not yet on this package, so the two copies can drift. Parity tests compare the Mermaid configuration and the rendered SVG with the web app's values. Adopting the package in the web app is a separate follow-up.
