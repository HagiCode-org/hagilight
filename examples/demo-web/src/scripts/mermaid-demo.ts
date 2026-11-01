import { mountMermaidDiagrams, resolveEngine, writeStoredEngine, type MermaidEngine } from '@hagicode/hagilight-mermaid';
import '@hagicode/hagilight-mermaid/styles.css';

// Tiles are fixed-height: each diagram fits whole inside its tile. A click is left to the tile, which
// opens the enlarged viewer, so tiles do not pin; the viewer has the full path tracing.
const mermaid = mountMermaidDiagrams(document, { mode: 'auto', preset: 'default', fit: 'contain', interaction: { pin: false } });

// Handles come back in document order, which is the tile order.
const tiles = Array.from(document.querySelectorAll<HTMLElement>('section[data-mermaid-type]'));
tiles.forEach((tile, index) => {
  tile.addEventListener('click', (event) => {
    // The toolbar buttons and the error details keep their own clicks.
    if ((event.target as Element).closest('button, a, summary, details')) return;
    mermaid.handles[index]?.expand();
  });
});

// The engine is not passed on mount, so the stored choice (if any) decides, as it would for any site. The radio
// shows what the diagrams actually use. Choosing an engine remembers it and updates every mounted diagram.
const engine = resolveEngine();
document.querySelectorAll<HTMLInputElement>('input[name="mermaid-engine"]').forEach((input) => {
  input.checked = input.value === engine;
});

// The mode and preset controls update every mounted diagram.
document.querySelectorAll<HTMLInputElement>('input[name="mermaid-mode"]').forEach((input) => {
  input.addEventListener('change', () => {
    const mode = input.value as 'auto' | 'light' | 'dark';
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = mode;
    mermaid.handles.forEach((handle) => handle.update({ mode }));
  });
});
document.querySelectorAll<HTMLInputElement>('input[name="mermaid-preset"]').forEach((input) => {
  input.addEventListener('change', () => mermaid.handles.forEach((handle) => handle.update({ preset: input.value as 'default' | 'archify' })));
});
document.querySelectorAll<HTMLInputElement>('input[name="mermaid-engine"]').forEach((input) => {
  input.addEventListener('change', () => {
    const chosen = input.value as MermaidEngine;
    // Storage can be blocked; the switch still applies to this page and the choice is just not remembered.
    writeStoredEngine(chosen);
    mermaid.handles.forEach((handle) => handle.update({ engine: chosen }));
  });
});
