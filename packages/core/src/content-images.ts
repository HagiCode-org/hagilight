import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  /** Source text of an `mdxjsEsm` node. */
  value?: string;
  /** ESTree data of an `mdxjsEsm` node, read by the unified MDX compiler. */
  data?: unknown;
}

/** Per-document state for MDX picture output on the Sätteri processor. */
export interface MdxPictureScope {
  /** Decoded `src` to the identifier its asset import binds. */
  assets: Map<string, string>;
  /** Whether the `Picture` component import has been queued for this document. */
  component: boolean;
  /** Import nodes not yet placed in the document. */
  pending: ContentImageNode[];
}

export interface LocalImageData {
  astro?: { localImagePaths?: Set<string> | readonly string[] };
  /** Sätteri's per-document MDX picture state, created on first use. */
  hagilightContentPicture?: MdxPictureScope;
}

export interface SatteriContentImageContext {
  readonly sourceFormat: string;
  readonly fileURL?: URL | undefined;
  readonly data: LocalImageData;
  parent(node: unknown): unknown;
  setProperty(node: unknown, key: string, value: unknown): void;
  replaceNode(node: unknown, newNode: ContentImageNode): void;
  prependChild(node: unknown, childNode: ContentImageNode | ContentImageNode[]): void;
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

export interface PictureStep {
  enabled: boolean;
  /** Filesystem path of the project's `publicDir`. Images that resolve into it keep their markup. */
  publicDir?: string;
}

export interface ContentImageRegistrationInput {
  config: {
    markdown?: { processor?: unknown };
    image?: { service?: { entrypoint?: unknown } };
    publicDir?: unknown;
  };
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
    || (isMdxJsx(node) && (node.name === 'picture' || node.name === 'Picture'));
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

export interface UnifiedFileLike {
  path?: unknown;
  data?: LocalImageData;
}

/** Replaces each `img` outside a picture for which `replace` returns a node. */
function replaceUnifiedImages(
  node: ContentImageNode,
  inPicture: boolean,
  replace: (img: ContentImageNode) => ContentImageNode | undefined,
): void {
  const children = node.children;
  if (!children) return;
  children.forEach((child, index) => {
    if (!inPicture && child.type === 'element' && child.tagName === 'img') {
      const replacement = replace(child);
      if (replacement !== undefined) {
        children[index] = replacement;
        return;
      }
    }
    replaceUnifiedImages(child, inPicture || isPicture(child), replace);
  });
}

/** Unified rehype plugin for sites whose `markdown.processor` is `unified()`. */
export function rehypeContentImages(
  options: ContentImageOptions = {},
  picture: PictureStep = { enabled: true },
): (tree: ContentImageNode, file?: UnifiedFileLike) => void {
  const resolved = resolveContentImageOptions(options);
  let pictureCount = 0;
  return (tree, file) => {
    applyUnifiedTree(tree, resolved, false);
    const format = documentFormat(file?.path);
    if (!picture.enabled || format === undefined) return;
    const astro = file?.data?.astro;
    const documentPath = toFilePath(file?.path);
    const eligibleSrc = (img: ContentImageNode): string | undefined =>
      pictureSource(img.properties?.src, astro, picture, documentPath);
    if (format === 'markdown') {
      replaceUnifiedImages(tree, false, (img) => {
        const src = eligibleSrc(img);
        return src === undefined ? undefined : pictureElement(img, src, ++pictureCount);
      });
      return;
    }
    const scope = newMdxPictureScope();
    replaceUnifiedImages(tree, false, (img) => {
      const src = eligibleSrc(img);
      if (src === undefined) return undefined;
      return pictureComponent(pictureProperties(img.properties ?? {}, resolved), assetIdentifier(scope, src, 'estree'), 'estree');
    });
    if (scope.pending.length > 0) tree.children?.unshift(...scope.pending);
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

const PICTURE_FORMATS = ['avif', 'webp'] as const;
const PICTURE_FALLBACK_FORMAT = 'webp';
const PICTURE_COMPONENT = 'HagilightContentPicture';
const PICTURE_COMPONENT_SOURCE = 'astro:assets';
const NOOP_IMAGE_SERVICE = 'astro/assets/services/noop';
/** Extensions the picture step leaves alone: SVG is already vector, and a GIF would lose its animation. */
const VECTOR_OR_ANIMATED = /\.(?:svg|gif)$/iu;

function localImageSrc(value: unknown, astro: LocalImageData['astro']): string | undefined {
  const localPaths = astro?.localImagePaths;
  if (typeof value !== 'string' || localPaths === undefined) return undefined;
  const src = decodeURI(value);
  const isLocal = localPaths instanceof Set ? localPaths.has(src) : localPaths.includes(src);
  return isLocal ? src : undefined;
}

/** A file URL or absolute path as a filesystem path; `undefined` for anything else. */
function toFilePath(value: unknown): string | undefined {
  const text = value instanceof URL ? value.href : value;
  if (typeof text !== 'string') return undefined;
  if (text.startsWith('file:')) return fileURLToPath(text);
  return isAbsolute(text) ? text : undefined;
}

function documentFormat(filePath: unknown): 'markdown' | 'mdx' | undefined {
  const text = String(filePath ?? '');
  if (text.endsWith('.mdx')) return 'mdx';
  if (text.endsWith('.md')) return 'markdown';
  return undefined;
}

function withoutQueryOrFragment(src: string): string {
  return src.replace(/[?#].*$/u, '');
}

/**
 * The file a relative reference names, resolved against the document's directory.
 * Site-root, bare and aliased specifiers, and a missing document location, resolve to `undefined`.
 */
function resolveLocalFile(src: string, documentPath: string | undefined): string | undefined {
  if (documentPath === undefined) return undefined;
  const file = withoutQueryOrFragment(src);
  if (!file.startsWith('./') && !file.startsWith('../')) return undefined;
  return resolve(dirname(documentPath), file);
}

function isInsideDirectory(directory: string, file: string): boolean {
  const offset = relative(directory, file);
  return offset !== '..' && !offset.startsWith(`..${sep}`) && !isAbsolute(offset);
}

/**
 * The decoded `src` when the picture step may wrap this image, otherwise `undefined`. One rule for
 * `.md` and `.mdx`: collected by Astro as local, not SVG or GIF, not inside `publicDir`, step enabled.
 * Without a document location or a `publicDir`, the `public/` check is skipped.
 */
function pictureSource(
  value: unknown,
  astro: LocalImageData['astro'],
  picture: PictureStep,
  documentPath: string | undefined,
): string | undefined {
  if (!picture.enabled) return undefined;
  const src = localImageSrc(value, astro);
  if (src === undefined || VECTOR_OR_ANIMATED.test(withoutQueryOrFragment(src))) return undefined;
  const file = resolveLocalFile(src, documentPath);
  if (picture.publicDir !== undefined && file !== undefined && isInsideDirectory(picture.publicDir, file)) {
    return undefined;
  }
  return src;
}

function pictureElement(img: ContentImageNode, src: string, index: number): ContentImageNode {
  const sources = PICTURE_FORMATS.map((format): ContentImageNode => ({
    type: 'element',
    tagName: 'source',
    properties: {
      __ASTRO_IMAGE_: JSON.stringify({
        src,
        format,
        type: `image/${format}`,
        densities: [1],
        index: `picture-${format}-${index}`,
      }),
    },
    children: [],
  }));
  return { type: 'element', tagName: 'picture', properties: {}, children: [...sources, img] };
}

/** A JSX attribute as Sätteri parses it (`value` text), or with ESTree data for the unified compiler. */
type PictureAttribute =
  | { name: string; text: string }
  | { name: string; identifier: string }
  | { name: string; list: string[] };

type ImportFlavor = 'source' | 'estree';

function estreeProgram(body: Record<string, unknown>[]): Record<string, unknown> {
  return { type: 'Program', sourceType: 'module', comments: [], body };
}

function jsxAttributeNode(attribute: PictureAttribute, flavor: ImportFlavor): MdxAttributeLike {
  if ('text' in attribute) return { type: 'mdxJsxAttribute', name: attribute.name, value: attribute.text };
  const expression = 'identifier' in attribute ? attribute.identifier : JSON.stringify(attribute.list);
  const value: Record<string, unknown> = { type: 'mdxJsxAttributeValueExpression', value: expression };
  if (flavor === 'estree') {
    const node = 'identifier' in attribute
      ? { type: 'Identifier', name: attribute.identifier }
      : {
        type: 'ArrayExpression',
        elements: attribute.list.map((item) => ({ type: 'Literal', value: item, raw: JSON.stringify(item) })),
      };
    value.data = { estree: estreeProgram([{ type: 'ExpressionStatement', expression: node }]) };
  }
  return { type: 'mdxJsxAttribute', name: attribute.name, value };
}

function importNode(flavor: ImportFlavor, text: string, declaration: Record<string, unknown>): ContentImageNode {
  if (flavor === 'source') return { type: 'mdxjsEsm', value: text };
  return { type: 'mdxjsEsm', value: '', data: { estree: estreeProgram([declaration]) } };
}

function newMdxPictureScope(): MdxPictureScope {
  return { assets: new Map(), component: false, pending: [] };
}

/** The identifier an asset import binds for `src`, queuing the imports the first time each is needed. */
function assetIdentifier(scope: MdxPictureScope, src: string, flavor: ImportFlavor): string {
  const existing = scope.assets.get(src);
  if (existing !== undefined) return existing;
  const name = `HagilightContentImage${scope.assets.size}`;
  if (!scope.component) {
    scope.component = true;
    scope.pending.push(importNode(
      flavor,
      `import { Picture as ${PICTURE_COMPONENT} } from "${PICTURE_COMPONENT_SOURCE}";`,
      {
        type: 'ImportDeclaration',
        attributes: [],
        source: { type: 'Literal', value: PICTURE_COMPONENT_SOURCE, raw: JSON.stringify(PICTURE_COMPONENT_SOURCE) },
        specifiers: [{
          type: 'ImportSpecifier',
          imported: { type: 'Identifier', name: 'Picture' },
          local: { type: 'Identifier', name: PICTURE_COMPONENT },
        }],
      },
    ));
  }
  scope.pending.push(importNode(flavor, `import ${name} from ${JSON.stringify(src)};`, {
    type: 'ImportDeclaration',
    attributes: [],
    source: { type: 'Literal', value: src, raw: JSON.stringify(src) },
    specifiers: [{ type: 'ImportDefaultSpecifier', local: { type: 'Identifier', name } }],
  }));
  scope.assets.set(src, name);
  return name;
}

/** The image's properties after the baseline patch, with `alt` present, as `Picture` receives them. */
function pictureProperties(properties: Record<string, unknown>, options: ResolvedContentImageOptions): Record<string, unknown> {
  const patch = hastImagePatch(properties, options);
  const next: Record<string, unknown> = { ...properties };
  if (patch.loading !== undefined) next.loading = patch.loading;
  if (patch.decoding !== undefined) next.decoding = patch.decoding;
  if (patch.classNames !== undefined) next.className = patch.classNames;
  if (next.alt === undefined || next.alt === null) next.alt = '';
  return next;
}

/** The `Picture` element an author would write by hand (D2), with the image's own attributes. */
function pictureComponent(
  properties: Record<string, unknown>,
  identifier: string,
  flavor: ImportFlavor,
): ContentImageNode {
  const attributes: PictureAttribute[] = [
    { name: 'src', identifier },
    { name: 'formats', list: [...PICTURE_FORMATS] },
    { name: 'fallbackFormat', text: PICTURE_FALLBACK_FORMAT },
  ];
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'src' || value === undefined || value === null || value === false) continue;
    const name = key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key;
    attributes.push({ name, text: Array.isArray(value) ? value.map(String).join(' ') : String(value) });
  }
  return {
    type: 'mdxJsxFlowElement',
    name: PICTURE_COMPONENT,
    attributes: attributes.map((attribute) => jsxAttributeNode(attribute, flavor)),
    children: [],
  };
}

/** The root of the document, which holds the ESM imports a `Picture` needs. */
function documentRoot(node: unknown, ctx: SatteriContentImageContext): unknown {
  let current = node;
  for (let parent = ctx.parent(current); parent; parent = ctx.parent(current)) current = parent;
  return current;
}

function mdxScope(data: LocalImageData): MdxPictureScope {
  data.hagilightContentPicture ??= newMdxPictureScope();
  return data.hagilightContentPicture;
}

/** Sätteri hast plugin: Astro's default Markdown processor, through `hastPlugins`. */
export function satteriContentImages(
  options: ContentImageOptions = {},
  picture: PictureStep = { enabled: true },
): SatteriContentImagePlugin {
  const resolved = resolveContentImageOptions(options);
  let pictureCount = 0;
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
        const isDocument = ctx.sourceFormat === 'markdown' || ctx.sourceFormat === 'mdx';
        const src = isDocument
          ? pictureSource(node.properties?.src, ctx.data.astro, picture, toFilePath(ctx.fileURL))
          : undefined;
        if (src !== undefined && ctx.sourceFormat === 'mdx') {
          const root = documentRoot(node, ctx);
          const scope = mdxScope(ctx.data);
          const identifier = assetIdentifier(scope, src, 'source');
          ctx.replaceNode(node, pictureComponent(pictureProperties(node.properties ?? {}, resolved), identifier, 'source'));
          if (scope.pending.length > 0) ctx.prependChild(root, scope.pending.splice(0));
          return;
        }
        const patch = hastImagePatch(node.properties ?? {}, resolved);
        if (patch.loading !== undefined) ctx.setProperty(node, 'loading', patch.loading);
        if (patch.decoding !== undefined) ctx.setProperty(node, 'decoding', patch.decoding);
        if (patch.classNames !== undefined) ctx.setProperty(node, 'className', patch.classNames);
        if (src !== undefined && ctx.sourceFormat === 'markdown') {
          ctx.replaceNode(node, pictureElement(node, src, ++pictureCount));
        }
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
  picture?: PictureStep;
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
    record.picture = undefined;
    return;
  }
  if (record.optedOut || record.entry !== undefined) return;
  const list = pluginListOf(processor);
  if (!list) {
    warnOnce(record, 'unsupported', logger, `Hagilight content images cannot run on the "${String(processor.name)}" Markdown processor. Body images are left unchanged.`);
    return;
  }
  const picture: PictureStep = { enabled: true };
  const publicDir = toFilePath(config.publicDir);
  if (publicDir !== undefined) picture.publicDir = publicDir;
  const plugin = processor.name === 'satteri'
    ? satteriContentImages({}, picture)
    : (options?: ContentImageOptions) => rehypeContentImages(options, picture);
  list.push(plugin);
  record.entry = plugin;
  record.list = list;
  record.picture = picture;
}

/** `astro:config:done` re-check: warns once if an enabled site's adapter is missing from the final processor. */
export function checkContentImageRegistration({ config, logger, enabled }: ContentImageRegistrationInput): void {
  if (!enabled) return;
  const processor = config.markdown?.processor as ProcessorLike | undefined;
  if (!processor) return;
  const record = recordOf(processor);
  if (record.optedOut || record.warned.has('unsupported')) return;
  if (record.entry === undefined || !pluginListOf(processor)?.includes(record.entry)) {
    warnOnce(record, 'lost', logger, `Hagilight content images were not found in the final "${String(processor.name)}" Markdown processor. Body images are left unchanged.`);
    return;
  }
  if (record.picture?.enabled && config.image?.service?.entrypoint === NOOP_IMAGE_SERVICE) {
    record.picture.enabled = false;
    warnOnce(record, 'picture', logger, 'Hagilight content images skip the <picture> wrapper because the Astro image service is the passthrough no-op, which cannot encode AVIF. Body images keep the baseline output. Use the default sharp service to get AVIF and WebP sources.');
  }
}
