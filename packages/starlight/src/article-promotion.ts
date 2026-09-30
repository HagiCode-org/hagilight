export interface ArticlePromotionFeature {
  label: string;
  description: string;
}

export interface ArticlePromotionCopy {
  title: string;
  lead: string;
  subheadline: string;
  imageAlt: string;
  features: readonly ArticlePromotionFeature[];
  visitLabel: string;
}

export const COPY: Readonly<Record<string, ArticlePromotionCopy>> = {
  'zh-CN': {
    title: 'HagiCode',
    lead: 'HagiCode 是一套智能体编码工作台：结构化工作流、多 Agent 并行执行与 Hero Dungeon 视图，把想法变成真正交付的软件。',
    subheadline: '让想法更快变成好用的软件，让智能编码更聪明、更高效，也更有趣。',
    imageAlt: 'HagiCode 浅色主题主界面截图',
    features: [
      { label: 'Smart', description: '结构化工作流将意图转化为从想法到交付的可执行路径。' },
      { label: 'Efficient', description: '多 Agent 工作流让调研、实现与审阅并行推进。' },
      { label: 'Fun', description: 'Hero Dungeon 让长时间编码协作更直观、更有参与感。' },
    ],
    visitLabel: '访问 HagiCode',
  },
  'en-US': {
    title: 'HagiCode',
    lead: 'HagiCode is an agentic coding workspace: structured workflows, multi-agent execution, and Hero Dungeon views turn ideas into shipped software.',
    subheadline: 'Turn ideas into polished, usable software with a smarter, faster, and more enjoyable agentic coding workflow.',
    imageAlt: 'HagiCode light theme main interface screenshot',
    features: [
      { label: 'Smart', description: 'Structured workflows turn intent into an executable path from idea to shipped change.' },
      { label: 'Efficient', description: 'Multi-agent workflows keep research, implementation, and review moving in parallel.' },
      { label: 'Fun', description: 'Hero Dungeon interfaces make long coding sessions visual, collaborative, and rewarding.' },
    ],
    visitLabel: 'Visit HagiCode',
  },
  'zh-Hant': {
    title: 'HagiCode',
    lead: 'HagiCode 是智慧代理程式開發工作台，結合結構化工作流程、多代理程式執行與 Hero Dungeon 介面，將想法化為交付成果。',
    subheadline: '以更聰明、更快速且更有趣的智慧代理程式工作流程，打造實用的軟體。',
    imageAlt: 'HagiCode 淺色主題介面畫面',
    features: [
      { label: 'Smart', description: '結構化流程將意圖轉化為從構想到交付的可執行步驟。' },
      { label: 'Efficient', description: '多代理程式工作流程讓研究、實作與審查並行進行。' },
      { label: 'Fun', description: 'Hero Dungeon 讓長時間的程式協作更直覺、更有參與感。' },
    ],
    visitLabel: '造訪 HagiCode',
  },
  'ja-JP': {
    title: 'HagiCode',
    lead: 'HagiCode は構造化ワークフロー、マルチエージェント実行、Hero Dungeon ビューを備えたエージェント型コーディングワークスペースです。',
    subheadline: 'よりスマートで速く、楽しいエージェント型ワークフローで、使いやすいソフトウェアを形にします。',
    imageAlt: 'HagiCode ライトテーマのメイン画面',
    features: [
      { label: 'Smart', description: '構造化ワークフローは意図をアイデアから変更のリリースまで実行可能な道筋にします。' },
      { label: 'Efficient', description: 'マルチエージェントのワークフローで調査、実装、レビューを並行して進めます。' },
      { label: 'Fun', description: 'Hero Dungeon により長時間のコーディングを視覚的で協力的な体験にします。' },
    ],
    visitLabel: 'HagiCode を見る',
  },
  'ko-KR': {
    title: 'HagiCode',
    lead: 'HagiCode는 구조화된 워크플로, 다중 에이전트 실행, Hero Dungeon 뷰를 갖춘 에이전트 코딩 작업 공간입니다.',
    subheadline: '더 스마트하고 빠르며 즐거운 에이전트 워크플로로 유용한 소프트웨어를 만드세요.',
    imageAlt: 'HagiCode 라이트 테마 메인 화면',
    features: [
      { label: 'Smart', description: '구조화된 워크플로는 의도를 아이디어부터 배포까지 실행 가능한 경로로 바꿉니다.' },
      { label: 'Efficient', description: '다중 에이전트 워크플로로 조사, 구현, 검토를 병렬로 진행합니다.' },
      { label: 'Fun', description: 'Hero Dungeon은 긴 코딩 세션을 시각적이고 협업적인 경험으로 만듭니다.' },
    ],
    visitLabel: 'HagiCode 방문',
  },
  'de-DE': {
    title: 'HagiCode',
    lead: 'HagiCode ist ein agentischer Coding-Arbeitsplatz mit strukturierten Workflows, Multi-Agent-Ausführung und Hero-Dungeon-Ansichten.',
    subheadline: 'Mit einem intelligenteren, schnelleren und unterhaltsameren agentischen Workflow wird aus Ideen nutzbare Software.',
    imageAlt: 'HagiCode-Hauptoberfläche im hellen Design',
    features: [
      { label: 'Smart', description: 'Strukturierte Workflows machen aus Absichten einen umsetzbaren Weg von der Idee bis zur Auslieferung.' },
      { label: 'Efficient', description: 'Multi-Agent-Workflows führen Recherche, Umsetzung und Prüfung parallel aus.' },
      { label: 'Fun', description: 'Hero Dungeon macht lange Coding-Sitzungen anschaulich und gemeinschaftlich.' },
    ],
    visitLabel: 'HagiCode besuchen',
  },
  'fr-FR': {
    title: 'HagiCode',
    lead: 'HagiCode est un espace de développement agentique qui associe workflows structurés, exécution multi-agent et vues Hero Dungeon.',
    subheadline: 'Transformez vos idées en logiciels utiles grâce à un workflow agentique plus intelligent, rapide et agréable.',
    imageAlt: 'Interface principale de HagiCode en thème clair',
    features: [
      { label: 'Smart', description: 'Des workflows structurés transforment une intention en parcours exécutable, de l’idée à la livraison.' },
      { label: 'Efficient', description: 'Les workflows multi-agents font avancer recherche, réalisation et revue en parallèle.' },
      { label: 'Fun', description: 'Hero Dungeon rend les longues sessions de code plus visuelles et collaboratives.' },
    ],
    visitLabel: 'Visiter HagiCode',
  },
  'es-ES': {
    title: 'HagiCode',
    lead: 'HagiCode es un espacio de trabajo de programación con agentes, flujos estructurados, ejecución multiagente y vistas de Hero Dungeon.',
    subheadline: 'Convierte ideas en software útil con un flujo de trabajo con agentes más inteligente, rápido y ameno.',
    imageAlt: 'Interfaz principal de HagiCode con tema claro',
    features: [
      { label: 'Smart', description: 'Los flujos estructurados convierten la intención en un itinerario ejecutable desde la idea hasta la entrega.' },
      { label: 'Efficient', description: 'Los flujos multiagente permiten avanzar en paralelo con la investigación, implementación y revisión.' },
      { label: 'Fun', description: 'Hero Dungeon hace que las largas sesiones de programación sean visuales y colaborativas.' },
    ],
    visitLabel: 'Visitar HagiCode',
  },
  'pt-BR': {
    title: 'HagiCode',
    lead: 'HagiCode é um ambiente de programação com agentes, fluxos estruturados, execução multiagente e visualizações Hero Dungeon.',
    subheadline: 'Transforme ideias em software útil com um fluxo de trabalho com agentes mais inteligente, rápido e agradável.',
    imageAlt: 'Interface principal do HagiCode no tema claro',
    features: [
      { label: 'Smart', description: 'Fluxos estruturados transformam intenções em um caminho executável da ideia à entrega.' },
      { label: 'Efficient', description: 'Fluxos multiagente mantêm pesquisa, implementação e revisão em andamento simultaneamente.' },
      { label: 'Fun', description: 'O Hero Dungeon torna longas sessões de programação mais visuais e colaborativas.' },
    ],
    visitLabel: 'Acessar HagiCode',
  },
  'ru-RU': {
    title: 'HagiCode',
    lead: 'HagiCode — агентная среда разработки со структурированными процессами, параллельным выполнением несколькими агентами и интерфейсами Hero Dungeon.',
    subheadline: 'Превращайте идеи в полезное ПО с более умным, быстрым и увлекательным агентным рабочим процессом.',
    imageAlt: 'Главный экран HagiCode в светлой теме',
    features: [
      { label: 'Smart', description: 'Структурированные процессы превращают намерение в исполнимый путь от идеи до готового изменения.' },
      { label: 'Efficient', description: 'Мультиагентные процессы параллельно продвигают исследование, реализацию и проверку.' },
      { label: 'Fun', description: 'Hero Dungeon делает длительную совместную разработку наглядной и увлекательной.' },
    ],
    visitLabel: 'Перейти на HagiCode',
  },
};

export function resolveArticlePromotion(frontmatterValue: unknown, siteDefault: boolean = true): boolean {
  if (typeof siteDefault !== 'boolean') {
    throw new TypeError('Hagilight hagicodePromotion enabled default must be a boolean.');
  }
  if (frontmatterValue !== undefined && typeof frontmatterValue !== 'boolean') {
    throw new TypeError('Hagilight frontmatter hagicodePromotion must be a boolean.');
  }
  return (frontmatterValue as boolean | undefined) ?? siteDefault;
}

export function getArticlePromotionCopy(lang: string | undefined): ArticlePromotionCopy {
  return (lang === undefined ? undefined : COPY[lang]) ?? COPY['en-US']!;
}
