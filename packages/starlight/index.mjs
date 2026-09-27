import { fileURLToPath } from 'node:url';

export default function hagilight() {
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
            Footer: fileURLToPath(new URL('./Footer.astro', import.meta.url)),
          },
        });
      },
    },
  };
}
