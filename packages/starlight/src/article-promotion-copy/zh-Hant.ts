import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'HagiCode 工作台畫面，工作階段看板分為待處理、進行中與已封存三欄。';

export default {
  title: 'HagiCode',
  lead: 'HagiCode 是面向專案開發的 AI 編碼工作台：以 OpenSpec 工作流程規劃變更，多 Agent 並行執行，再由 Hero Dungeon 讓進度一目了然，將想法化為交付成果。',
  subheadline: '以更聰明、更快速且更有趣的 Agent 工作流程，打造實用的軟體。',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: '智慧', description: 'OpenSpec 工作流程將意圖轉化為從提案、設計、任務到交付的可執行路徑。' },
    { id: 'efficient', label: '高效', description: '多 Agent 並行推進研究、實作與審查，並支援多儲存庫變更與你熟悉的 Agent CLI。' },
    { id: 'fun', label: '有趣', description: 'Hero Dungeon 讓長時間的程式協作化為看得見的冒險：英雄、進度與成就一目了然。' },
  ],
  visitLabel: '造訪 HagiCode',
  docsLabel: '閱讀文件',
  galleryHeading: '一覽 HagiCode',
  gallery: [
    {
      id: 'workbench',
      caption: '工作台：所有工作階段集中在同一塊看板上。',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: '提案從建立、起草、審查一路推進到執行與封存。',
      alt: 'HagiCode 提案階段列畫面，從已建立到已封存，目前標示「執行完成」階段並附有封存計畫按鈕。',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon：英雄推進工作，你隨時查看進度、等級與劇情。',
      alt: 'HagiCode Hero Dungeon 面板畫面，名為 Ember Keep，列出三位執行中的英雄及其等級、進度與劇情文字。',
    },
  ],
  windowsLabel: '下載 Windows 版',
  windowsStoreLabel: '從 Microsoft Store 取得',
  windowsStoreAriaLabel: '在 Microsoft Store 開啟 HagiCode',
  allDownloadsLabel: '所有下載',
  shareLabel: '分享 HagiCode',
  shareText: 'HagiCode 是結合 OpenSpec 工作流程、多 Agent 並行執行與 Hero Dungeon 的編碼工作台：https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
