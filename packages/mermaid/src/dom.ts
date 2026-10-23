const SVG_NS = 'http://www.w3.org/2000/svg';

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
  expand: [
    ['path', { d: 'M15 3h6v6' }],
    ['path', { d: 'm21 3-7 7' }],
    ['path', { d: 'M9 21H3v-6' }],
    ['path', { d: 'm3 21 7-7' }],
  ],
  plus: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'M12 5v14' }],
  ],
  minus: [['path', { d: 'M5 12h14' }]],
  fit: [
    ['path', { d: 'M3 7V5a2 2 0 0 1 2-2h2' }],
    ['path', { d: 'M17 3h2a2 2 0 0 1 2 2v2' }],
    ['path', { d: 'M21 17v2a2 2 0 0 1-2 2h-2' }],
    ['path', { d: 'M7 21H5a2 2 0 0 1-2-2v-2' }],
    ['rect', { x: '8', y: '9', width: '8', height: '6', rx: '1' }],
  ],
} satisfies Record<string, Array<[string, Record<string, string>]>>;

export type IconName = keyof typeof ICONS;

/** Inline SVG icon, so the package needs no icon library. Decorative unless a label is given. */
export function icon(name: IconName, className?: string, label?: string): SVGSVGElement {
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

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A square icon button whose name is its label, shown as a tooltip too. */
export function iconButton(name: IconName, label: string, className: string, onClick: () => void): HTMLButtonElement {
  const button = el('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.appendChild(icon(name));
  button.addEventListener('click', onClick);
  return button;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
