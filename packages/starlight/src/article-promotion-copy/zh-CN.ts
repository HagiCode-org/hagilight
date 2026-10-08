import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'HagiCode 工作台截图，会话看板分为待处理、进行中与已归档三列。';

export default {
  title: 'HagiCode',
  lead: 'HagiCode 是面向项目开发的 AI 编码工作台：用 OpenSpec 工作流规划变更，多 Agent 并行执行，再由 Hero Dungeon 让进度一目了然，把想法变成真正交付的软件。',
  subheadline: '让想法更快变成好用的软件，让智能编码更聪明、更高效，也更有趣。',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: '智能', description: 'OpenSpec 工作流把意图转化为从提案、设计、任务到交付的可执行路径。' },
    { id: 'efficient', label: '高效', description: '多 Agent 并行推进调研、实现与审阅，并支持多仓库变更和你熟悉的 Agent CLI。' },
    { id: 'fun', label: '有趣', description: 'Hero Dungeon 让长时间编码协作变成看得见的冒险：英雄、进度与成就一目了然。' },
  ],
  visitLabel: '访问 HagiCode',
  docsLabel: '阅读文档',
  galleryHeading: '一览 HagiCode',
  gallery: [
    {
      id: 'workbench',
      caption: '工作台：所有会话汇集在同一块看板上。',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: '提案从创建、起草、审阅一路推进到执行与归档。',
      alt: 'HagiCode 提案阶段条截图，从已创建到已归档，当前高亮“执行完成”阶段并带有归档计划按钮。',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon：英雄推进工作，你随时查看进度、等级与剧情。',
      alt: 'HagiCode Hero Dungeon 面板截图，名为 Ember Keep，列出三位运行中的英雄及其等级、进度与剧情文字。',
    },
  ],
  windowsLabel: '下载 Windows 版',
  windowsStoreLabel: '从 Microsoft Store 获取',
  windowsStoreAriaLabel: '在 Microsoft Store 中打开 HagiCode',
  allDownloadsLabel: '全部下载',
  shareLabel: '分享 HagiCode',
  shareText: 'HagiCode 是一套集 OpenSpec 工作流、多 Agent 并行执行与 Hero Dungeon 于一体的编码工作台：https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
