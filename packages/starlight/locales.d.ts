export interface LocaleDefinition {
  label: string;
  lang: string;
}

export const locales: Record<string, LocaleDefinition>;

export { locales as default };
