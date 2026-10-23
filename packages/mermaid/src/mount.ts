import { renderMermaid } from './render.js';
import type { MermaidHandle, MermaidMountHandle, MermaidMountOptions } from './types.js';

const SELECTOR = 'pre.mermaid, code.language-mermaid';
const MOUNTED = 'data-mermaid-mounted';

/** The element to replace for a block: a `code.language-mermaid` inside a `pre` is replaced with its `pre`. */
function blockOf(element: Element): Element {
  return element.matches('code') ? (element.closest('pre') ?? element) : element;
}

/**
 * Renders every Mermaid code block under `root` in place. Each block's text becomes a diagram, and
 * a block that is already mounted is skipped, so mounting the same root twice creates no duplicates.
 * A block that fails to mount is logged and left as written, and the other blocks still render.
 */
export function mountMermaidDiagrams(root: ParentNode, options: MermaidMountOptions = {}): MermaidMountHandle {
  const handles: MermaidHandle[] = [];
  const blocks = new Set<Element>();
  root.querySelectorAll(SELECTOR).forEach((element) => {
    const block = blockOf(element);
    if (block.closest(`[${MOUNTED}]`)) return;
    blocks.add(block);
  });

  for (const block of blocks) {
    try {
      const host = document.createElement('div');
      host.setAttribute(MOUNTED, '');
      const source = block.textContent ?? '';
      block.replaceWith(host);
      handles.push(renderMermaid(host, source, options));
    } catch (error) {
      console.error('Mermaid block failed to mount:', error);
    }
  }

  return {
    handles,
    destroy: () => handles.forEach((handle) => handle.destroy()),
  };
}
