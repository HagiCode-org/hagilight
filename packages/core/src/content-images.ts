export const CONTENT_IMAGE_CLASS = 'hagilight-content-image';

export type ContentImageLoading = 'lazy' | 'eager';
export type ContentImageDecoding = 'async' | 'sync' | 'auto';

export interface ContentImageOptions {
  /** Loading value for body images whose author set none. Defaults to `lazy`. */
  loading?: ContentImageLoading;
  /** Decoding value for body images whose author set none. Defaults to `async`. */
  decoding?: ContentImageDecoding;
  /** Marker class added once to every body image. Defaults to `hagilight-content-image`. */
  className?: string;
}

export interface ResolvedContentImageOptions {
  loading: ContentImageLoading;
  decoding: ContentImageDecoding;
  className: string;
}

export interface ContentImageAuthorValues {
  hasLoading: boolean;
  hasDecoding: boolean;
  classNames: readonly string[];
}

export interface ContentImagePatch {
  loading?: ContentImageLoading;
  decoding?: ContentImageDecoding;
  classNames?: string[];
}

export interface MdxAttributeLike {
  type?: string;
  name?: string;
  value?: unknown;
}

export interface ContentImageNode {
  type: string;
  tagName?: string;
  name?: string | null;
  properties?: Record<string, unknown>;
  attributes?: MdxAttributeLike[];
  children?: ContentImageNode[];
}

export interface SatteriContentImageContext {
  parent(node: unknown): unknown;
  setProperty(node: unknown, key: string, value: unknown): void;
}

export interface SatteriContentImageVisitor {
  filter: string[];
  visit(node: ContentImageNode, ctx: SatteriContentImageContext): void;
}

export interface SatteriContentImagePlugin {
  name: string;
  element: SatteriContentImageVisitor;
  mdxJsxFlowElement: SatteriContentImageVisitor;
  mdxJsxTextElement: SatteriContentImageVisitor;
}

export interface ContentImageRegistrationInput {
  config: { markdown?: { processor?: unknown } };
  logger: { warn(message: string): void };
  enabled: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function resolveContentImageOptions(options: ContentImageOptions = {}): ResolvedContentImageOptions {
  if (!isRecord(options)) throw new TypeError('Hagilight content image options must be an object.');
  const { loading = 'lazy', decoding = 'async', className = CONTENT_IMAGE_CLASS } = options;
  if (loading !== 'lazy' && loading !== 'eager') {
    throw new TypeError('Hagilight content image loading option must be "lazy" or "eager".');
  }
  if (decoding !== 'async' && decoding !== 'sync' && decoding !== 'auto') {
    throw new TypeError('Hagilight content image decoding option must be "async", "sync", or "auto".');
  }
  if (typeof className !== 'string' || className === '' || /\s/u.test(className)) {
    throw new TypeError('Hagilight content image className option must be a non-empty class name without whitespace.');
  }
  return { loading, decoding, className };
}

export function contentImagePatch(
  author: ContentImageAuthorValues,
  options: ResolvedContentImageOptions,
): ContentImagePatch {
  const patch: ContentImagePatch = {};
  if (!author.hasLoading) patch.loading = options.loading;
  if (!author.hasDecoding) patch.decoding = options.decoding;
  if (!author.classNames.includes(options.className)) {
    patch.classNames = [...author.classNames, options.className];
  }
  return patch;
}

function splitClassNames(value: string): string[] {
  return value.split(/\s+/u).filter(Boolean);
}

function classNamesOf(value: unknown): string[] {
  if (typeof value === 'string') return splitClassNames(value);
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').flatMap(splitClassNames);
  }
  return [];
}

function mdxClassNames(attribute: MdxAttributeLike | undefined): string[] | undefined {
  if (attribute === undefined || attribute.value === undefined || attribute.value === null) return [];
  return typeof attribute.value === 'string' ? splitClassNames(attribute.value) : undefined;
}

export function hastImagePatch(
  properties: Record<string, unknown>,
  options: ResolvedContentImageOptions,
): ContentImagePatch {
  return contentImagePatch({
    hasLoading: properties.loading !== undefined,
    hasDecoding: properties.decoding !== undefined,
    classNames: classNamesOf(properties.className),
  }, options);
}

export interface MdxImagePatch {
  loading?: ContentImageLoading;
  decoding?: ContentImageDecoding;
  className?: string;
}

/** A class written as an expression cannot be merged statically, so its marker is left out. */
export function mdxImagePatch(
  attributes: readonly MdxAttributeLike[],
  options: ResolvedContentImageOptions,
): MdxImagePatch {
  const classNames = mdxClassNames(attributes.find((attribute) => attribute.name === 'class'));
  const patch = contentImagePatch({
    hasLoading: attributes.some((attribute) => attribute.name === 'loading'),
    hasDecoding: attributes.some((attribute) => attribute.name === 'decoding'),
    classNames: classNames ?? [options.className],
  }, options);
  return {
    loading: patch.loading,
    decoding: patch.decoding,
    className: patch.classNames?.join(' '),
  };
}

function isMdxJsx(node: ContentImageNode): boolean {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement';
}

function isPicture(node: ContentImageNode): boolean {
  return (node.type === 'element' && node.tagName === 'picture')
    || (isMdxJsx(node) && node.name === 'picture');
}

function upsertMdxAttribute(attributes: MdxAttributeLike[], name: string, value: string): void {
  const existing = attributes.find((attribute) => attribute.name === name);
  if (existing) existing.value = value;
  else attributes.push({ type: 'mdxJsxAttribute', name, value });
}

function applyUnifiedNode(node: ContentImageNode, options: ResolvedContentImageOptions): void {
  if (node.type === 'element' && node.tagName === 'img') {
    const properties = (node.properties ??= {});
    const patch = hastImagePatch(properties, options);
    if (patch.loading !== undefined) properties.loading = patch.loading;
    if (patch.decoding !== undefined) properties.decoding = patch.decoding;
    if (patch.classNames !== undefined) properties.className = patch.classNames;
    return;
  }
  if (isMdxJsx(node) && node.name === 'img') {
    const attributes = (node.attributes ??= []);
    const patch = mdxImagePatch(attributes, options);
    if (patch.loading !== undefined) upsertMdxAttribute(attributes, 'loading', patch.loading);
    if (patch.decoding !== undefined) upsertMdxAttribute(attributes, 'decoding', patch.decoding);
    if (patch.className !== undefined) upsertMdxAttribute(attributes, 'class', patch.className);
  }
}

function applyUnifiedTree(node: ContentImageNode, options: ResolvedContentImageOptions, inPicture: boolean): void {
  if (!inPicture) applyUnifiedNode(node, options);
  const childrenInPicture = inPicture || isPicture(node);
  for (const child of node.children ?? []) applyUnifiedTree(child, options, childrenInPicture);
}

/** Unified rehype plugin: `unified` processors and Astro 6 `markdown.rehypePlugins`. */
export function rehypeContentImages(options: ContentImageOptions = {}): (tree: ContentImageNode) => void {
  const resolved = resolveContentImageOptions(options);
  return (tree) => {
    applyUnifiedTree(tree, resolved, false);
  };
}

function isInsidePicture(node: ContentImageNode, ctx: SatteriContentImageContext): boolean {
  for (
    let parent = ctx.parent(node) as ContentImageNode | undefined;
    parent;
    parent = ctx.parent(parent) as ContentImageNode | undefined
  ) {
    if (isPicture(parent)) return true;
  }
  return false;
}

/** Sätteri hast plugin: Astro's default Markdown processor, through `hastPlugins`. */
export function satteriContentImages(options: ContentImageOptions = {}): SatteriContentImagePlugin {
  const resolved = resolveContentImageOptions(options);
  const mdxVisitor: SatteriContentImageVisitor = {
    filter: ['img'],
    visit(node, ctx) {
      if (isInsidePicture(node, ctx)) return;
      const patch = mdxImagePatch(node.attributes ?? [], resolved);
      if (patch.loading !== undefined) ctx.setProperty(node, 'loading', patch.loading);
      if (patch.decoding !== undefined) ctx.setProperty(node, 'decoding', patch.decoding);
      if (patch.className !== undefined) ctx.setProperty(node, 'class', patch.className);
    },
  };
  return {
    name: 'hagilight:content-images',
    element: {
      filter: ['img'],
      visit(node, ctx) {
        if (isInsidePicture(node, ctx)) return;
        const patch = hastImagePatch(node.properties ?? {}, resolved);
        if (patch.loading !== undefined) ctx.setProperty(node, 'loading', patch.loading);
        if (patch.decoding !== undefined) ctx.setProperty(node, 'decoding', patch.decoding);
        if (patch.classNames !== undefined) ctx.setProperty(node, 'className', patch.classNames);
      },
    },
    mdxJsxFlowElement: mdxVisitor,
    mdxJsxTextElement: mdxVisitor,
  };
}

const RECORD_KEY: unique symbol = Symbol.for('hagilight.content-images');

interface ContentImageRecord {
  optedOut: boolean;
  entry?: unknown;
  list?: unknown[];
  warned: Set<string>;
}

interface ProcessorLike {
  name?: unknown;
  options?: Record<string, unknown>;
}

function recordOf(processor: object): ContentImageRecord {
  const holder = processor as { [RECORD_KEY]?: ContentImageRecord };
  holder[RECORD_KEY] ??= { optedOut: false, warned: new Set<string>() };
  return holder[RECORD_KEY];
}

function pluginListOf(processor: ProcessorLike): unknown[] | undefined {
  const hastPlugins = processor.options?.hastPlugins;
  const rehypePlugins = processor.options?.rehypePlugins;
  if (processor.name === 'satteri' && Array.isArray(hastPlugins)) return hastPlugins;
  if (processor.name === 'unified' && Array.isArray(rehypePlugins)) return rehypePlugins;
  return undefined;
}

function warnOnce(record: ContentImageRecord, key: string, logger: { warn(message: string): void }, message: string): void {
  if (record.warned.has(key)) return;
  record.warned.add(key);
  logger.warn(message);
}

/**
 * Register the content-image plugin on the active Markdown processor. The first enabled
 * call appends one adapter; an `enabled: false` call opts the whole site out and removes
 * only the adapter it did not append, so the result does not depend on hook order.
 */
export function registerContentImages({ config, logger, enabled }: ContentImageRegistrationInput): void {
  const processor = config.markdown?.processor as ProcessorLike | undefined;
  if (!processor) {
    if (enabled) {
      logger.warn('Hagilight content images need a Markdown processor, but the Astro config has none. Body images are left unchanged.');
    }
    return;
  }
  const record = recordOf(processor);
  if (!enabled) {
    record.optedOut = true;
    if (record.list && record.entry !== undefined) {
      const index = record.list.indexOf(record.entry);
      if (index !== -1) record.list.splice(index, 1);
    }
    record.entry = undefined;
    record.list = undefined;
    return;
  }
  if (record.optedOut || record.entry !== undefined) return;
  const list = pluginListOf(processor);
  if (!list) {
    warnOnce(record, 'unsupported', logger, `Hagilight content images cannot run on the "${String(processor.name)}" Markdown processor. Body images are left unchanged.`);
    return;
  }
  const plugin = processor.name === 'satteri' ? satteriContentImages() : rehypeContentImages;
  list.push(plugin);
  record.entry = plugin;
  record.list = list;
}

/** `astro:config:done` re-check: warns once if an enabled site's adapter is missing from the final processor. */
export function checkContentImageRegistration({ config, logger, enabled }: ContentImageRegistrationInput): void {
  if (!enabled) return;
  const processor = config.markdown?.processor as ProcessorLike | undefined;
  if (!processor) return;
  const record = recordOf(processor);
  if (record.optedOut || record.warned.has('unsupported')) return;
  if (record.entry !== undefined && pluginListOf(processor)?.includes(record.entry)) return;
  warnOnce(record, 'lost', logger, `Hagilight content images were not found in the final "${String(processor.name)}" Markdown processor. Body images are left unchanged.`);
}
