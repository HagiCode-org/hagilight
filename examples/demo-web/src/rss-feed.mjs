export default async ({ lang }) => {
  if (lang === 'en-US') {
    return {
      title: 'Hagilight core package showcase',
      description: 'English updates from the standalone Hagilight Astro demo.',
      items: [
        {
          title: 'Explore Hagilight core, without Starlight.',
          description: 'A standalone Astro tour of the shared components and integrations.',
          link: '/',
        },
        {
          title: 'Review generated Footer feed links.',
          description: 'The English site pages use the integration-generated default feed.',
          link: '/#live-footer-example',
        },
      ],
    };
  }
  if (lang === 'zh-CN') {
    return {
      title: 'Hagilight 独立 Astro 示例',
      description: '来自 Hagilight 独立 Astro 示例的简体中文更新。',
      items: [
        {
          title: '探索 Hagilight core，无需 Starlight。',
          description: '通过独立的 Astro 示例了解共享组件和集成。',
          link: '/zh-CN/',
        },
        {
          title: '查看自动生成的页脚订阅链接。',
          description: '中文页面同时提供默认订阅源和当前语言订阅源。',
          link: '/zh-CN/#live-footer-example',
        },
      ],
    };
  }

  throw new Error(`The Hagilight demo has no RSS content configured for "${lang}".`);
};
