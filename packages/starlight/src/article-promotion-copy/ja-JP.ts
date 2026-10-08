import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'HagiCode のワークベンチ。保留中・進行中・アーカイブ済みの 3 列を持つセッションのカンバンボード。';

export default {
  title: 'HagiCode',
  lead: 'HagiCode はエージェント型コーディングワークスペースです。OpenSpec ワークフローで変更を計画し、マルチエージェント実行で進め、Hero Dungeon で長い作業の進み具合を見える化して、アイデアを出荷できるソフトウェアにします。',
  subheadline: 'よりスマートで速く、楽しいエージェント型ワークフローで、使いやすいソフトウェアを形にします。',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'スマート', description: 'OpenSpec ワークフローが意図を、提案・設計・タスクから変更のリリースまで実行可能な道筋にします。' },
    { id: 'efficient', label: '効率的', description: 'マルチエージェント実行で調査・実装・レビューを並行して進め、複数リポジトリや使い慣れた Agent CLI にも対応します。' },
    { id: 'fun', label: '楽しい', description: 'Hero Dungeon が長時間のコーディングを、ヒーロー・進行状況・実績が見える冒険に変えます。' },
  ],
  visitLabel: 'HagiCode を見る',
  docsLabel: 'ドキュメントを読む',
  galleryHeading: 'HagiCode の概要',
  gallery: [
    {
      id: 'workbench',
      caption: 'ワークベンチ：すべてのセッションを 1 つのカンバンボードに集約。',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: '提案は作成、起草、レビューを経て、実行とアーカイブへ進みます。',
      alt: 'HagiCode の提案ステージバー。作成済みからアーカイブ済みまで並び、実行完了のステージが強調され、プランをアーカイブするボタンがある。',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon：ヒーローが作業を進め、進行状況・レベル・物語を見守れます。',
      alt: 'HagiCode の Hero Dungeon パネル「Ember Keep」。実行中の 3 人のヒーローのレベル、進行状況、物語のテキストが並ぶ。',
    },
  ],
  windowsLabel: 'Windows 版をダウンロード',
  windowsStoreLabel: 'Microsoft Store で入手',
  windowsStoreAriaLabel: 'Microsoft Store で HagiCode を開く',
  allDownloadsLabel: 'すべてのダウンロード',
  shareLabel: 'HagiCode を共有',
  shareText: 'HagiCode は OpenSpec ワークフロー、マルチエージェント実行、Hero Dungeon を備えたコーディングワークスペースです：https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
