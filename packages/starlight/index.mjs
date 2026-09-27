import { fileURLToPath } from 'node:url';

export default function hagilight(options = {}) {
  const footer = options.promoto?.enabled === false ? 'Footer.astro' : 'PromotoFooter.astro';
  return {
    name: '@hagicode/hagilight-starlight',
    hooks: {
      'config:setup'({ config, updateConfig }) {
        if (config.components?.Footer) {
          throw new Error('Hagilight cannot replace an existing Starlight Footer override.');
        }

        updateConfig({
          components: {
            ...config.components,
            Footer: fileURLToPath(new URL(`./${footer}`, import.meta.url)),
          },
        });
      },
    },
  };
}
