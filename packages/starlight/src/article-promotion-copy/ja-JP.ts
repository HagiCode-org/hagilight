import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'HagiCode のワークベンチ。保留中・進行中・アーカイブ済みの 3 列を持つセッションのカンバンボード。';

export default {
  title: 'HagiCode',
  lead: 'HagiCode はエージェント型コーディングワークスペースです。豊富で便利な UI インタラクションにより、計画・エージェント実行・プロジェクト作業を始めやすく、進めやすくし、開発をより魅力的な体験にします。',
  subheadline: '豊富で便利な UI インタラクションで、計画からプロジェクト作業までを分かりやすく進められます。',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'スマート', description: 'OpenSpec ワークフローが意図を、提案・設計・タスクから変更のリリースまで実行可能な道筋にします。' },
    { id: 'efficient', label: '効率的', description: 'マルチエージェント実行で調査・実装・レビューを並行して進め、複数リポジトリや使い慣れた Agent CLI にも対応します。' },
    { id: 'fun', label: '興味深い', description: '豊富で便利な UI インタラクションにより、計画・エージェント実行・プロジェクト作業を始めやすく、進めやすくします。' },
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
      caption: 'Hero Scenario：ヒーローが作業を進め、進行状況・レベル・物語を見守れます。',
      alt: 'HagiCode の Hero Scenario パネル「Ember Keep」。実行中の 3 人のヒーローのレベル、進行状況、物語のテキストが並ぶ。',
    },
    {
      id: 'hero-avatar',
      caption: 'イラスト：同じセットに含まれる HagiCode ヒーローアバターの一つで、訪問するたびに入れ替わります。',
      alt: 'HagiCode ヒーローアバターのイラスト。様式化されたキャラクターの肖像です。',
    },
  ],
  windowsLabel: 'Windows 版をダウンロード',
  windowsStoreLabel: 'Microsoft Store で入手',
  windowsStoreAriaLabel: 'Microsoft Store で HagiCode を開く',
  allDownloadsLabel: 'すべてのダウンロード',
  shareLabel: 'HagiCode を共有',
  shareText: 'HagiCode は豊富で便利な UI インタラクションにより、計画・エージェント実行・プロジェクト作業を進めやすくします：https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
