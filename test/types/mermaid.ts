// Type fixture for @hagicode/hagilight-mermaid. Each `@ts-expect-error` line must stay an error.
import {
  mountMermaidDiagrams,
  renderMermaid,
  type MermaidHandle,
  type MermaidRenderOptions,
} from '@hagicode/hagilight-mermaid';

const host = document.createElement('div');
const options: MermaidRenderOptions = {
  mode: 'dark',
  preset: 'archify',
  labels: { errorTitle: 'Diagram failed', expand: 'Enlarge', trace: { clear: 'Reset' }, viewer: { close: 'Done' } },
  tokens: { background: '--site-bg', primaryForeground: '--site-on-primary' },
  interaction: { enabled: false, pin: false },
  entrance: false,
  viewer: false,
  fit: 'contain',
};
const handle: MermaidHandle = renderMermaid(host, 'flowchart LR; A-->B', options);
handle.update({ mode: 'light', source: 'flowchart LR; B-->C' });
handle.replay();
handle.clearFocus();
handle.expand();
handle.collapse();
handle.destroy();

const mount = mountMermaidDiagrams(document, { mode: 'auto', preset: 'default' });
const count: number = mount.handles.length;
mount.destroy();
void count;

// @ts-expect-error A mode is light, dark or auto.
renderMermaid(host, 'flowchart LR; A-->B', { mode: 'sepia' });
// @ts-expect-error A preset is default or archify.
renderMermaid(host, 'flowchart LR; A-->B', { preset: 'neon' });
// @ts-expect-error A label key must exist in the label set.
renderMermaid(host, 'flowchart LR; A-->B', { labels: { errorTitel: 'typo' } });
// @ts-expect-error A token maps to a custom property name, not a bare word.
renderMermaid(host, 'flowchart LR; A-->B', { tokens: { background: 'background' } });
// @ts-expect-error A fit is width or contain.
renderMermaid(host, 'flowchart LR; A-->B', { fit: 'cover' });
// @ts-expect-error A viewer label key must exist.
renderMermaid(host, 'flowchart LR; A-->B', { labels: { viewer: { zoomInn: 'typo' } } });
// @ts-expect-error A mode update cannot be a number.
handle.update({ mode: 1 });
