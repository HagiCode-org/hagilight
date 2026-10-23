# @hagicode/hagilight-mermaid

Framework-agnostic Mermaid rendering with the HagiCode look: a light and dark theme that follows the page, two appearance presets, a dependency-order reveal, and hover and pinned path tracing. It runs in any site (Astro, Starlight, Docusaurus or plain HTML) with no React, store or i18n library.

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
handle.destroy(); // discard pending renders and empty the element
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `mode` | `'auto'` | `'light'`, `'dark'` or `'auto'`. `auto` reads `data-theme` on `<html>`, then a `dark` class, then `prefers-color-scheme`, and follows later changes. |
| `preset` | `'default'` | `'default'` or `'archify'`. An unknown name uses `'default'`. |
| `labels` | English | Overrides for user-visible text. See below. |
| `tokens` | `--hagilight-mermaid-*` | Maps theme roles to your own custom property names. |
| `interaction` | `{ enabled: true }` | `enabled: false` renders a static diagram. `reducedMotion` overrides the system setting. `onTraceChange` receives the trace summary. |
| `entrance` | `true` | `false` skips the first-view reveal. |
| `loadMermaid` | `import('mermaid')` | Supplies the `mermaid` module. Use it to control chunking or to test. |
| `className` | | Extra class names on the diagram container. |

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
- **Block** and **kanban**: the trace toolbar, the replay control and the entrance reveal are not shown. They have no traceable node graph: the path tracing reads `g.nodes > g.node`, which these diagrams do not use.
- **Text halo**: the default preset draws a light halo behind diagram text in light mode and a dark halo in dark mode. Against a page background of the other colour, text can look outlined.

## Parity

The theme, SVG post-processing, graph, entrance and interaction modules are ported from the HagiCode web app. The web app is not yet on this package, so the two copies can drift. Parity tests compare the Mermaid configuration and the rendered SVG with the web app's values. Adopting the package in the web app is a separate follow-up.
