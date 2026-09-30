export type HeadAttributeValue = string | boolean | number | undefined;

/** A `<head>` element description compatible with Astro and Starlight head configuration. */
export interface HeadEntry {
  tag: string;
  attrs?: Record<string, HeadAttributeValue>;
  content?: string;
}
