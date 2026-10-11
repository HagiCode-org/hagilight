import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

type Feature = { title: string; body: string };

type Copy = {
  title: string;
  description: string;
  tagline: string;
  start: string;
  blog: string;
  features: ReadonlyArray<Feature>;
};

const copy: Record<string, Copy> = {
  'en-US': {
    title: 'Hagilight for Docusaurus',
    description:
      'One Docusaurus plugin for the footer, analytics, promote card, SEO, sitemap, robots.txt, and RSS of HagiCode sites.',
    tagline: 'One plugin. Every HagiCode site feature.',
    start: 'Get started',
    blog: 'Read the blog',
    features: [
      { title: 'Footer', body: 'A shared footer with related sites, quick links, and attribution.' },
      { title: 'Analytics', body: 'Google Analytics and 51LA load only in production builds.' },
      { title: 'Promote card', body: 'A dismissible card that rotates between promotions above the footer.' },
      { title: 'Language selector', body: 'Checks the navbar dropdown and the locale catalog.' },
      { title: 'SEO', body: 'Organization and WebSite JSON-LD, plus a default sharing image.' },
      { title: 'Sitemap and RSS', body: 'A sitemap and feed per locale, listed in robots.txt.' },
    ],
  },
  'zh-CN': {
    title: 'Hagilight for Docusaurus',
    description:
      'Docusaurus 站点的一体化插件：页脚、统计、推广卡片、SEO、站点地图、robots.txt 与 RSS。',
    tagline: '一个插件，覆盖 HagiCode 站点的全部功能。',
    start: '开始使用',
    blog: '阅读博客',
    features: [
      { title: '页脚', body: '共享页脚，包含相关站点、快速链接和署名。' },
      { title: '统计', body: 'Google Analytics 与 51LA 仅在生产构建中加载。' },
      { title: '推广卡片', body: '可关闭的推广卡片，位于页脚上方轮换展示。' },
      { title: '语言切换', body: '检查导航栏语言下拉菜单与语言目录。' },
      { title: 'SEO', body: 'Organization 与 WebSite 结构化数据，以及默认分享图片。' },
      { title: '站点地图与 RSS', body: '每个语言生成站点地图和订阅源，并列入 robots.txt。' },
    ],
  },
};

export default function Home(): ReactNode {
  const { i18n } = useDocusaurusContext();
  const text = copy[i18n.currentLocale] ?? copy['en-US'];
  const prefix = i18n.currentLocale === 'zh-CN' ? '/zh-CN' : '';

  return (
    <Layout title={text.title} description={text.description}>
      <main className="container">
        <section className="demo-hero">
          <h1>{text.title}</h1>
          <p>{text.tagline}</p>
          <code className="demo-hero__code">plugins: [hagilightDocusaurus()],</code>
        </section>
        <div className="demo-actions">
          <Link className="button button--primary button--lg" to={`${prefix}/docs/intro`}>
            {text.start}
          </Link>
          <Link className="button button--secondary button--lg" to={`${prefix}/blog`}>
            {text.blog}
          </Link>
        </div>
        <section className="demo-features">
          {text.features.map((feature) => (
            <article key={feature.title} className="demo-feature">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </section>
      </main>
    </Layout>
  );
}
