import { mountMermaidDiagrams } from '@hagicode/hagilight-mermaid';
import '@hagicode/hagilight-mermaid/styles.css';

const mermaid = mountMermaidDiagrams(document, { mode: 'auto', preset: 'default' });

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
