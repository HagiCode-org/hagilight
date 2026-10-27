/**
 * The one citable sentence that defines HagiCode. Every surface that summarizes the product
 * (homepage, desktop page, comparison pages, llms.txt summary, SoftwareApplication description)
 * reads it from here, so the wording cannot drift between them.
 *
 * Each sentence states only facts that the product copy already documents: a proposal-first
 * workflow, execution through agent CLIs (Claude Code, Codex, GitHub Copilot), and team knowledge.
 */
export const ENTITY_DEFINITIONS = {
  'en-US': 'HagiCode is a proposal-driven AI coding workbench that turns a request into a reviewable proposal, runs it through agent CLIs such as Claude Code, Codex and GitHub Copilot, and keeps the outcome as team knowledge.',
  'zh-CN': 'HagiCode 是一款提案驱动的 AI 编码工作台，可将需求转化为可审阅的提案，通过 Claude Code、Codex、GitHub Copilot 等 Agent CLI 执行，并把结果沉淀为团队知识。',
} as const;

export type EntityDefinitionLocale = keyof typeof ENTITY_DEFINITIONS;

export const DEFAULT_ENTITY_DEFINITION_LOCALE: EntityDefinitionLocale = 'en-US';

/**
 * Return the entity definition for a locale. A locale without its own sentence, including an
 * unknown or missing one, receives the `en-US` sentence.
 */
export function getEntityDefinition(locale?: string): string {
  if (typeof locale === 'string' && Object.prototype.hasOwnProperty.call(ENTITY_DEFINITIONS, locale)) {
    return ENTITY_DEFINITIONS[locale as EntityDefinitionLocale];
  }
  return ENTITY_DEFINITIONS[DEFAULT_ENTITY_DEFINITION_LOCALE];
}
