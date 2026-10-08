import type { ArticlePromotionCopy } from '../article-promotion.js';
import deDE from './de-DE.js';
import enUS from './en-US.js';
import esES from './es-ES.js';
import frFR from './fr-FR.js';
import jaJP from './ja-JP.js';
import koKR from './ko-KR.js';
import ptBR from './pt-BR.js';
import ruRU from './ru-RU.js';
import zhCN from './zh-CN.js';
import zhHant from './zh-Hant.js';

export interface ShowcaseGlossaryEntry {
  /** Approved word for "agent". */
  agent: string;
  /** Approved word for "multi-agent (execution)". */
  multiAgent: string;
  /** Approved word for "workflow". */
  workflow: string;
  /** Approved word for "documentation". */
  documentation: string;
  /** Approved labels for the Smart, Efficient, and Fun pillars. */
  pillars: { smart: string; efficient: string; fun: string };
  /** Variants the locale's copy must not use because the product wording differs. */
  avoid: readonly string[];
}

/**
 * Approved terminology per locale, checked by `test/article-promotion.test.mjs`. Terms are matched as
 * substrings so inflected forms count. Seeded from the product locale files in `repos/web/src/locales/<locale>/`
 * (agent, workflow, and "Efficient"/"Smart" strings) and the existing Docs wording. Where the product keeps the
 * English word (zh-CN and zh-Hant "Agent"), the English word is the approved term. `HagiCode`, `OpenSpec`,
 * `Hero Dungeon`, `Microsoft Store`, and `Windows` are pinned untranslated in every locale and are not listed here.
 * Internal to the catalog: it is not part of the package's public entry points.
 */
export const GLOSSARY: Readonly<Record<string, ShowcaseGlossaryEntry>> = {
  'zh-CN': { agent: 'Agent', multiAgent: '多 Agent', workflow: '工作流', documentation: '文档', pillars: { smart: '智能', efficient: '高效', fun: '有趣' }, avoid: ['智能体', '代理'] },
  'en-US': { agent: 'agent', multiAgent: 'multi-agent', workflow: 'workflow', documentation: 'documentation', pillars: { smart: 'Smart', efficient: 'Efficient', fun: 'Fun' }, avoid: ['multiagent'] },
  'zh-Hant': { agent: 'Agent', multiAgent: '多 Agent', workflow: '工作流程', documentation: '文件', pillars: { smart: '智慧', efficient: '高效', fun: '有趣' }, avoid: ['代理程式', '代理商', '智慧代理'] },
  'ja-JP': { agent: 'エージェント', multiAgent: 'マルチエージェント', workflow: 'ワークフロー', documentation: 'ドキュメント', pillars: { smart: 'スマート', efficient: '効率的', fun: '楽しい' }, avoid: ['エージェンシー', 'ドキュメンテーション'] },
  'ko-KR': { agent: '에이전트', multiAgent: '다중 에이전트', workflow: '워크플로', documentation: '문서', pillars: { smart: '스마트', efficient: '효율적', fun: '즐거운' }, avoid: ['대리인', '멀티 에이전트'] },
  'de-DE': { agent: 'Agent', multiAgent: 'Multi-Agent', workflow: 'Workflow', documentation: 'Dokumentation', pillars: { smart: 'Intelligent', efficient: 'Effizient', fun: 'Unterhaltsam' }, avoid: ['Multiagent', 'Arbeitsablauf'] },
  'fr-FR': { agent: 'agent', multiAgent: 'multi-agent', workflow: 'workflow', documentation: 'documentation', pillars: { smart: 'Intelligent', efficient: 'Efficace', fun: 'Ludique' }, avoid: ['multiagent', 'flux de travail'] },
  'es-ES': { agent: 'agente', multiAgent: 'multiagente', workflow: 'flujos de trabajo', documentation: 'documentación', pillars: { smart: 'Inteligente', efficient: 'Eficiente', fun: 'Divertido' }, avoid: ['multi-agente', 'workflow'] },
  'pt-BR': { agent: 'agente', multiAgent: 'multiagente', workflow: 'fluxos de trabalho', documentation: 'documentação', pillars: { smart: 'Inteligente', efficient: 'Eficiente', fun: 'Divertido' }, avoid: ['multi-agente', 'workflow'] },
  'ru-RU': { agent: 'агент', multiAgent: 'мультиагент', workflow: 'рабочие процессы', documentation: 'документаци', pillars: { smart: 'Умный', efficient: 'Эффективный', fun: 'Увлекательный' }, avoid: ['мульти-агент'] },
};

function deepFreeze<T extends object>(value: T): Readonly<T> {
  for (const child of Object.values(value)) {
    if (typeof child === 'object' && child !== null) deepFreeze(child);
  }
  return Object.freeze(value);
}

/** Per-locale showcase copy in the pinned key order, deeply frozen so consumers cannot mutate it. */
export const COPY: Readonly<Record<string, ArticlePromotionCopy>> = deepFreeze({
  'zh-CN': zhCN,
  'en-US': enUS,
  'zh-Hant': zhHant,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'de-DE': deDE,
  'fr-FR': frFR,
  'es-ES': esES,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
});
