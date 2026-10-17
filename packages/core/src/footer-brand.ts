import type { SiteLink } from './links.js';

export type FooterBrandPillarId = 'smart' | 'efficient' | 'fun';

export interface FooterBrandPillar {
  id: FooterBrandPillarId;
  label: string;
  description: string;
}

export interface FooterBrandCopy {
  name: string;
  /** One display line: what HagiCode turns the reader's work into. */
  headline: string;
  /** What the product is, in the same words the article showcase uses. */
  summary: string;
  pillars: readonly FooterBrandPillar[];
}

export interface FooterBrandLinks {
  primary?: SiteLink;
  secondary?: SiteLink;
}

const NAME = 'HagiCode';

function copy(
  headline: string,
  summary: string,
  pillars: readonly [
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
  ],
): FooterBrandCopy {
  const ids = ['smart', 'efficient', 'fun'] as const;
  return {
    name: NAME,
    headline,
    summary,
    pillars: pillars.map(([label, description], index) => ({
      id: ids[index] as FooterBrandPillarId,
      label,
      description,
    })),
  };
}

// Summaries and pillar labels mirror `repos/web` and the article showcase copy, so a reader
// sees the same description of HagiCode in the footer as in the article above it.
const catalog: Readonly<Record<string, FooterBrandCopy>> = {
  'en-US': copy(
    'Turn ideas into shipped software.',
    'HagiCode is an agentic coding workspace. OpenSpec workflows plan the change, multi-agent execution carries it out, and Hero Dungeon makes the long run visible, so ideas become shipped software.',
    [
      ['Smart', 'OpenSpec workflows turn intent into a path from proposal to shipped change.'],
      ['Efficient', 'Multi-agent execution runs research, build, and review in parallel.'],
      ['Fun', 'Hero Dungeon makes long sessions visible, with heroes, progress, and achievements.'],
    ],
  ),
  'zh-CN': copy(
    '让想法变成真正交付的软件。',
    'HagiCode 是面向项目开发的 AI 编码工作台：用 OpenSpec 工作流规划变更，多 Agent 并行执行，再由 Hero Dungeon 让进度一目了然，把想法变成真正交付的软件。',
    [
      ['智能', 'OpenSpec 工作流把意图变成从提案到交付的可执行路径。'],
      ['高效', '多 Agent 并行推进调研、实现与审阅。'],
      ['有趣', 'Hero Dungeon 让长时间编码看得见：英雄、进度与成就。'],
    ],
  ),
  'zh-Hant': copy(
    '讓想法化為交付成果。',
    'HagiCode 是面向專案開發的 AI 編碼工作台：以 OpenSpec 工作流程規劃變更，多 Agent 並行執行，再由 Hero Dungeon 讓進度一目了然，將想法化為交付成果。',
    [
      ['智慧', 'OpenSpec 工作流程將意圖轉化為從提案到交付的可執行路徑。'],
      ['高效', '多 Agent 並行推進研究、實作與審查。'],
      ['有趣', 'Hero Dungeon 讓長時間編碼看得見：英雄、進度與成就。'],
    ],
  ),
  'ja-JP': copy(
    'アイデアを、出荷できるソフトウェアへ。',
    'HagiCode はエージェント型コーディングワークスペースです。OpenSpec ワークフローで変更を計画し、マルチエージェント実行で進め、Hero Dungeon で長い作業の進み具合を見える化して、アイデアを出荷できるソフトウェアにします。',
    [
      ['スマート', 'OpenSpec ワークフローが、意図を提案からリリースまでの実行可能な道筋にします。'],
      ['効率的', 'マルチエージェント実行で、調査・実装・レビューを並行して進めます。'],
      ['楽しい', 'Hero Dungeon が長い作業を、ヒーロー・進行状況・実績で見える化します。'],
    ],
  ),
  'ko-KR': copy(
    '아이디어를 실제로 배포되는 소프트웨어로.',
    'HagiCode는 에이전트 코딩 작업 공간입니다. OpenSpec 워크플로로 변경을 계획하고, 다중 에이전트 실행으로 진행하며, Hero Dungeon으로 긴 작업의 진행 상황을 한눈에 보여 아이디어를 실제로 배포되는 소프트웨어로 만듭니다.',
    [
      ['스마트', 'OpenSpec 워크플로는 의도를 제안부터 배포까지 이어지는 실행 가능한 경로로 바꿉니다.'],
      ['효율적', '다중 에이전트 실행으로 조사, 구현, 검토를 병렬로 진행합니다.'],
      ['즐거운', 'Hero Dungeon은 긴 세션을 영웅, 진행 상황, 업적으로 한눈에 보여 줍니다.'],
    ],
  ),
  'de-DE': copy(
    'Aus Ideen wird ausgelieferte Software.',
    'HagiCode ist ein agentischer Coding-Arbeitsplatz: OpenSpec-Workflows planen die Änderung, Multi-Agent-Ausführung setzt sie um, und Hero Dungeon macht den langen Weg sichtbar, bis aus der Idee ausgelieferte Software wird.',
    [
      ['Intelligent', 'OpenSpec-Workflows machen aus einer Absicht einen Weg vom Vorschlag bis zur Auslieferung.'],
      ['Effizient', 'Multi-Agent-Ausführung treibt Recherche, Umsetzung und Prüfung parallel voran.'],
      ['Unterhaltsam', 'Hero Dungeon macht lange Sitzungen sichtbar: mit Helden, Fortschritt und Erfolgen.'],
    ],
  ),
  'fr-FR': copy(
    'Transformez vos idées en logiciels livrés.',
    'HagiCode est un espace de développement agentique : les workflows OpenSpec planifient le changement, l’exécution multi-agent le réalise et Hero Dungeon rend le long parcours visible, pour transformer vos idées en logiciels livrés.',
    [
      ['Intelligent', 'Les workflows OpenSpec transforment une intention en parcours, de la proposition à la livraison.'],
      ['Efficace', 'L’exécution multi-agent mène recherche, réalisation et revue en parallèle.'],
      ['Ludique', 'Hero Dungeon rend les longues sessions visibles : héros, progression et succès.'],
    ],
  ),
  'es-ES': copy(
    'Convierte ideas en software entregado.',
    'HagiCode es un espacio de trabajo de programación con agentes: los flujos de trabajo de OpenSpec planifican el cambio, la ejecución multiagente lo lleva a cabo y Hero Dungeon hace visible el largo recorrido, para convertir ideas en software entregado.',
    [
      ['Inteligente', 'Los flujos de OpenSpec convierten la intención en un camino de la propuesta a la entrega.'],
      ['Eficiente', 'La ejecución multiagente avanza en paralelo con investigación, implementación y revisión.'],
      ['Divertido', 'Hero Dungeon hace visibles las sesiones largas: héroes, progreso y logros.'],
    ],
  ),
  'pt-BR': copy(
    'Transforme ideias em software entregue.',
    'O HagiCode é um ambiente de programação com agentes: os fluxos de trabalho do OpenSpec planejam a mudança, a execução multiagente a realiza e o Hero Dungeon torna o longo percurso visível, para transformar ideias em software entregue.',
    [
      ['Inteligente', 'Os fluxos do OpenSpec transformam a intenção em um caminho da proposta à entrega.'],
      ['Eficiente', 'A execução multiagente conduz pesquisa, implementação e revisão em paralelo.'],
      ['Divertido', 'O Hero Dungeon torna as sessões longas visíveis: heróis, progresso e conquistas.'],
    ],
  ),
  'ru-RU': copy(
    'Превращайте идеи в готовое ПО.',
    'HagiCode — агентная среда разработки: рабочие процессы OpenSpec планируют изменение, мультиагентное выполнение его реализует, а Hero Dungeon делает долгий путь наглядным, так что идеи становятся готовым ПО.',
    [
      ['Умный', 'Рабочие процессы OpenSpec превращают намерение в путь от предложения до готового изменения.'],
      ['Эффективный', 'Мультиагентное выполнение ведёт исследование, реализацию и проверку параллельно.'],
      ['Увлекательный', 'Hero Dungeon делает долгие сессии наглядными: герои, прогресс и достижения.'],
    ],
  ),
};

export const FOOTER_BRAND_LOCALES: readonly string[] = Object.freeze(Object.keys(catalog));

/** Resolves the footer's product statement. `locale` is the value `resolveSiteLinks` already normalized. */
export function resolveFooterBrand(locale?: string | null): FooterBrandCopy & { locale: string } {
  const resolved = locale && Object.hasOwn(catalog, locale) ? locale : 'en-US';
  return { locale: resolved, ...(catalog[resolved] as FooterBrandCopy) };
}

/**
 * Picks the two calls to action from the footer's already-resolved quick links, so consumer
 * overrides and `removeLinks` apply and a removed link leaves no dead button behind.
 */
export function pickFooterBrandLinks(quick: readonly SiteLink[]): FooterBrandLinks {
  const primary = quick.find((link) => link.id === 'downloadClient');
  const secondary = quick.find((link) => link.id === 'productDocs');
  return {
    ...(primary ? { primary } : {}),
    ...(secondary ? { secondary } : {}),
  };
}
