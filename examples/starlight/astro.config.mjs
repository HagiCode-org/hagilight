import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base: '/',
  integrations: [
    starlight({
      title: 'Hagilight example',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
        'en-US': { label: 'English', lang: 'en-US' },
        'zh-Hant': { label: '繁體中文', lang: 'zh-Hant' },
        'fr-FR': { label: 'Français', lang: 'fr-FR' },
        'de-DE': { label: 'Deutsch', lang: 'de-DE' },
        'es-ES': { label: 'Español (España)', lang: 'es-ES' },
        'ja-JP': { label: '日本語', lang: 'ja-JP' },
        'ko-KR': { label: '한국어', lang: 'ko-KR' },
        'pt-BR': { label: 'Português (Brasil)', lang: 'pt-BR' },
        'ru-RU': { label: 'Русский', lang: 'ru-RU' },
      },
      plugins: [hagilight({
        promoto: { enabled: true },
        links: {
          siteId: 'hagilight-example',
          siteUrl: 'https://hagilight.hagicode.com/',
        },
      })],
    }),
  ],
});
