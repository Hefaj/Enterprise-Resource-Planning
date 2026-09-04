import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';
import { slugifyHeading } from './documentation-schema.mjs';
import { REPOSITORY_ROOT } from './scan-technical-docs.mjs';

const LOCALES = ['pl-PL', 'en-US'];
const REQUIRED_HEADINGS = {
  'pl-PL': ['Kto może wykonać operację', 'Gdzie znaleźć funkcję', 'Jak wykonać operację', 'Rezultat', 'Ograniczenia i przypadki szczególne', 'Powiązane tematy'],
  'en-US': ['Who can perform the operation', 'Where to find the feature', 'How to perform the operation', 'Result', 'Limitations and special cases', 'Related topics'],
};
const SEARCH_INDEX_WARNING_BYTES = 32 * 1024;

function normalizeText(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll('ł', 'l').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function typescriptValue(value) {
  return JSON.stringify(value, null, 2);
}

async function discoverManifestPaths() {
  const modulesRoot = path.join(REPOSITORY_ROOT, 'frontend/libs/modules');
  const modules = await fs.readdir(modulesRoot, { withFileTypes: true });
  const result = [];
  for (const module of modules.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!module.isDirectory()) continue;
    const manifest = path.join(modulesRoot, module.name, 'feature/src/lib/documentation/documentation.manifest.json');
    try {
      await fs.access(manifest);
      result.push(manifest);
    } catch {
      // Documentation is opt-in until a module has a verified capability inventory.
    }
  }
  return result;
}

function validateManifest(manifest, repositoryPath) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return [`${repositoryPath}: manifest must be an object`];
  for (const field of ['moduleId', 'routePrefix', 'overviewArticleId']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) errors.push(`${repositoryPath}: "${field}" must be a non-empty string`);
  }
  if (!Array.isArray(manifest.articles) || manifest.articles.length === 0) errors.push(`${repositoryPath}: "articles" must be a non-empty array`);
  return errors;
}

export function prepareMarkdown(manifest, descriptor, locale, source, filePath, descriptorsById) {
  const errors = [];
  if (/<\/?[a-z][^>]*>/i.test(source)) errors.push(`${filePath}: raw HTML is not allowed`);
  for (const match of source.matchAll(/!?\[[^\]]*\]\(\s*<?([^\s)>]+)/g)) {
    const href = match[1];
    if (/^[a-z][a-z\d+.-]*:/i.test(href) && !/^(?:https?:|mailto:|doc:)/i.test(href)) {
      errors.push(`${filePath}: link uses unsupported protocol "${href}"`);
    }
  }

  const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const tokens = markdown.parse(source, {});
  const headings = [];
  const headingCounts = new Map();
  let title = '';
  let summary = '';
  let h1Seen = false;
  let h1Start = -1;
  let summaryStart = -1;
  const documentLinks = [];
  const localFiles = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'heading_open') {
      const level = Number(token.tag.slice(1));
      const text = tokens[index + 1]?.content?.trim() ?? '';
      const base = slugifyHeading(text);
      const count = headingCounts.get(base) ?? 0;
      headingCounts.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      if (level === 1) {
        if (h1Seen) errors.push(`${filePath}: article must contain exactly one H1`);
        h1Seen = true;
        h1Start = index;
        title = text;
      } else if (level === 2 || level === 3) {
        headings.push({ id, text, level });
      }
    }
    if (h1Seen && !summary && token.type === 'paragraph_open') {
      summaryStart = index;
      summary = tokens[index + 1]?.content?.trim() ?? '';
    }
  }

  if (!title) errors.push(`${filePath}: article must start with an H1 title`);
  if (!summary) errors.push(`${filePath}: article must contain a summary paragraph after H1`);
  const levelTwoHeadings = headings.filter((heading) => heading.level === 2).map((heading) => heading.text);
  for (const required of REQUIRED_HEADINGS[locale]) {
    if (!levelTwoHeadings.includes(required)) errors.push(`${filePath}: missing required H2 "${required}"`);
  }

  for (const token of tokens) {
    if (token.type !== 'inline' || !token.children) continue;
    for (const child of token.children) {
      if (child.type === 'image') {
        if (!child.content.trim()) errors.push(`${filePath}: image is missing alternative text`);
        const sourcePath = child.attrGet('src') ?? '';
        if (/^https?:\/\//i.test(sourcePath)) {
          // External images are allowed when their alt text carries the same information.
        } else if (/^[a-z][a-z\d+.-]*:/i.test(sourcePath)) {
          errors.push(`${filePath}: image uses unsupported protocol "${sourcePath}"`);
        } else if (sourcePath && !sourcePath.startsWith('#')) {
          localFiles.push(sourcePath.split('#', 1)[0]);
        }
      }
      if (child.type !== 'link_open') continue;
      const href = child.attrGet('href') ?? '';
      if (href.startsWith('doc:')) {
        const [articleId, fragment] = href.slice(4).split('#', 2);
        const target = descriptorsById.get(articleId);
        if (!target) errors.push(`${filePath}: documentation link points to unknown article "${articleId}"`);
        else {
          documentLinks.push({ articleId, fragment });
          child.attrSet('href', `/${manifest.routePrefix}/documentation/${target.slug}${fragment ? `#${fragment}` : ''}`);
        }
      } else if (/^https?:\/\//i.test(href)) {
        child.attrSet('rel', 'noopener noreferrer');
      } else if (/^mailto:/i.test(href)) {
        // Allowed mail link.
      } else if (href.startsWith('#')) {
        const fragment = href.slice(1);
        const availableAnchors = new Set([slugifyHeading(title), ...headings.map((heading) => heading.id)]);
        if (!availableAnchors.has(fragment)) errors.push(`${filePath}: local link points to missing anchor "#${fragment}"`);
      } else if (/^[a-z][a-z\d+.-]*:/i.test(href)) {
        errors.push(`${filePath}: link uses unsupported protocol "${href}"`);
      } else if (href) {
        localFiles.push(href.split('#', 1)[0]);
      }
    }
  }

  const plainText = tokens.filter((token) => token.type === 'inline').map((token) => token.content).join(' ');
  return {
    errors,
    article: {
      id: descriptor.id,
      slug: descriptor.slug,
      locale,
      title,
      summary,
      html: markdown.renderer.render(tokens.filter((_, index) =>
        !(index >= h1Start && index <= h1Start + 2)
        && !(index >= summaryStart && index <= summaryStart + 2)), markdown.options, {}),
      headings,
      relatedArticleIds: descriptor.relatedArticleIds ?? [],
    },
    normalizedText: normalizeText(`${title} ${title} ${summary} ${headings.map((heading) => `${heading.text} ${heading.text}`).join(' ')} ${plainText}`),
    headingShape: headings.map((heading) => heading.level),
    documentLinks,
    localFiles,
  };
}

function buildNavigation(descriptors, articlesById) {
  const children = new Map();
  for (const descriptor of descriptors) {
    const key = descriptor.parentId ?? null;
    children.set(key, [...(children.get(key) ?? []), descriptor]);
  }
  const visit = (parentId = null) => (children.get(parentId) ?? [])
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((descriptor) => ({
      articleId: descriptor.id,
      slug: descriptor.slug,
      title: articlesById[descriptor.id].title,
      order: descriptor.order,
      ...(descriptor.icon ? { icon: descriptor.icon } : {}),
      children: visit(descriptor.id),
    }));
  return visit();
}

function collectNavigationArticleIds(items, result = new Set()) {
  for (const item of items) {
    result.add(item.articleId);
    collectNavigationArticleIds(item.children, result);
  }
  return result;
}

function identifier(segment) {
  const value = segment.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase()).replace(/[^a-zA-Z0-9_$]/g, '');
  return /^[a-zA-Z_$]/.test(value) ? value : `_${value}`;
}

function renderIdTree(moduleId, descriptors) {
  const root = {};
  for (const descriptor of descriptors) {
    const segments = descriptor.id.startsWith(`${moduleId}.`) ? descriptor.id.slice(moduleId.length + 1).split('.') : descriptor.id.split('.');
    let cursor = root;
    segments.forEach((segment, index) => {
      const key = identifier(segment);
      if (index === segments.length - 1) cursor[key] = descriptor.id;
      else cursor = cursor[key] ??= {};
    });
  }
  const render = (node, indent = 0) => Object.entries(node).map(([key, value]) => {
    const padding = ' '.repeat(indent);
    return typeof value === 'string' ? `${padding}${key}: '${value}',` : `${padding}${key}: {\n${render(value, indent + 2)}\n${padding}},`;
  }).join('\n');
  return `{\n${render(root, 2)}\n} as const`;
}

export async function buildUserDocumentationOutputs() {
  const outputs = new Map();
  const errors = [];
  for (const manifestPath of await discoverManifestPaths()) {
    const repositoryManifestPath = path.relative(REPOSITORY_ROOT, manifestPath).split(path.sep).join('/');
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (error) {
      errors.push(`${repositoryManifestPath}: invalid JSON: ${error.message}`);
      continue;
    }
    errors.push(...validateManifest(manifest, repositoryManifestPath));
    if (!Array.isArray(manifest.articles)) continue;

    const descriptorsById = new Map();
    const slugs = new Set();
    const contentPaths = new Set();
    const contextRoutes = new Set();
    for (const descriptor of manifest.articles) {
      if (!descriptor || typeof descriptor !== 'object') { errors.push(`${repositoryManifestPath}: article descriptor must be an object`); continue; }
      for (const field of ['id', 'slug', 'content']) if (typeof descriptor[field] !== 'string' || !descriptor[field].trim()) errors.push(`${repositoryManifestPath}: article requires non-empty "${field}"`);
      if (!Number.isInteger(descriptor.order)) errors.push(`${repositoryManifestPath}: article "${descriptor.id}" requires integer order`);
      if (descriptorsById.has(descriptor.id)) errors.push(`${repositoryManifestPath}: duplicate article id "${descriptor.id}"`);
      if (slugs.has(descriptor.slug)) errors.push(`${repositoryManifestPath}: duplicate article slug "${descriptor.slug}"`);
      if (contentPaths.has(descriptor.content)) errors.push(`${repositoryManifestPath}: duplicate content path "${descriptor.content}"`);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(descriptor.slug ?? '')) errors.push(`${repositoryManifestPath}: invalid slug "${descriptor.slug}"`);
      descriptorsById.set(descriptor.id, descriptor);
      slugs.add(descriptor.slug);
      contentPaths.add(descriptor.content);
      for (const contextRoute of descriptor.contextRoutes ?? []) {
        if (contextRoutes.has(contextRoute)) errors.push(`${repositoryManifestPath}: duplicate context route "${contextRoute}"`);
        contextRoutes.add(contextRoute);
      }
    }
    if (!descriptorsById.has(manifest.overviewArticleId)) errors.push(`${repositoryManifestPath}: overviewArticleId does not exist`);

    for (const descriptor of manifest.articles) {
      if (descriptor.parentId && !descriptorsById.has(descriptor.parentId)) errors.push(`${repositoryManifestPath}: parent article "${descriptor.parentId}" does not exist`);
      for (const relatedId of descriptor.relatedArticleIds ?? []) if (!descriptorsById.has(relatedId)) errors.push(`${repositoryManifestPath}: related article "${relatedId}" does not exist`);
    }

    const documentationRoot = path.dirname(manifestPath);
    const localeResults = new Map();
    for (const locale of LOCALES) {
      const articles = {};
      const search = [];
      const shapes = new Map();
      const links = [];
      for (const descriptor of manifest.articles) {
        const contentPath = path.join(documentationRoot, 'content', locale, descriptor.content);
        let source;
        try { source = await fs.readFile(contentPath, 'utf8'); }
        catch { errors.push(`${path.relative(REPOSITORY_ROOT, contentPath)}: article content does not exist`); continue; }
        const result = prepareMarkdown(manifest, descriptor, locale, source, path.relative(REPOSITORY_ROOT, contentPath), descriptorsById);
        errors.push(...result.errors);
        for (const relativePath of result.localFiles) {
          const targetPath = path.resolve(path.dirname(contentPath), decodeURIComponent(relativePath));
          try { await fs.access(targetPath); }
          catch { errors.push(`${path.relative(REPOSITORY_ROOT, contentPath)}: local link or image does not exist "${relativePath}"`); }
        }
        articles[descriptor.id] = result.article;
        shapes.set(descriptor.id, result.headingShape);
        links.push(...result.documentLinks.map((link) => ({ ...link, source: path.relative(REPOSITORY_ROOT, contentPath) })));
        search.push({ moduleId: manifest.moduleId, articleId: descriptor.id, slug: descriptor.slug, locale, title: result.article.title, summary: result.article.summary, headings: result.article.headings.map((heading) => heading.text), normalizedText: result.normalizedText });
      }

      const ordered = manifest.articles.slice().sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
      ordered.forEach((descriptor, index) => {
        if (!articles[descriptor.id]) return;
        articles[descriptor.id] = {
          ...articles[descriptor.id],
          ...(index > 0 ? { previousArticleId: ordered[index - 1].id } : {}),
          ...(index < ordered.length - 1 ? { nextArticleId: ordered[index + 1].id } : {}),
        };
      });
      const navigation = buildNavigation(manifest.articles, articles);
      const reachable = collectNavigationArticleIds(navigation);
      for (const descriptor of manifest.articles) {
        if (!reachable.has(descriptor.id)) errors.push(`${repositoryManifestPath}: article "${descriptor.id}" is not reachable from navigation (check parent cycles)`);
      }
      localeResults.set(locale, { articles, search, shapes, links, navigation });
    }

    for (const descriptor of manifest.articles) {
      const left = localeResults.get('pl-PL').shapes.get(descriptor.id);
      const right = localeResults.get('en-US').shapes.get(descriptor.id);
      if (left && right && JSON.stringify(left) !== JSON.stringify(right)) errors.push(`${repositoryManifestPath}: heading structure differs between locales for "${descriptor.id}"`);
    }

    for (const locale of LOCALES) {
      const result = localeResults.get(locale);
      for (const link of result.links) {
        if (!link.fragment) continue;
        const target = result.articles[link.articleId];
        const anchors = new Set([slugifyHeading(target?.title ?? ''), ...(target?.headings ?? []).map((heading) => heading.id)]);
        if (!anchors.has(link.fragment)) errors.push(`${link.source}: documentation link points to missing anchor "${link.articleId}#${link.fragment}"`);
      }
    }

    for (const locale of LOCALES) {
      const result = localeResults.get(locale);
      const suffix = locale.replace('-', '_').toUpperCase();
      const exportName = `DOCUMENTATION_${suffix}`;
      const searchName = `DOCUMENTATION_SEARCH_${suffix}`;
      const moduleDescriptor = { moduleId: manifest.moduleId, routePrefix: manifest.routePrefix, overviewArticleId: manifest.overviewArticleId, ...(manifest.requiredPermission ? { requiredPermission: manifest.requiredPermission } : {}) };
      const generatedModule = {
        module: moduleDescriptor,
        locale,
        articles: result.articles,
        articleIdBySlug: Object.fromEntries(manifest.articles.map((descriptor) => [descriptor.slug, descriptor.id])),
        navigation: result.navigation,
        contextArticleIds: Object.fromEntries(manifest.articles.flatMap((descriptor) => (descriptor.contextRoutes ?? []).map((route) => [route, descriptor.id]))),
      };
      const generatedPath = path.join(documentationRoot, 'generated', `documentation.${locale}.generated.ts`);
      outputs.set(generatedPath, `/* This file is generated by pnpm docs:generate. Do not edit. */\nimport type { ErpDocumentationGeneratedModule } from '@erp/shared/util';\n\nexport const ${exportName} = ${typescriptValue(generatedModule)} as const satisfies ErpDocumentationGeneratedModule;\n`);
      const searchPath = path.join(documentationRoot, 'generated', `documentation-search.${locale}.generated.ts`);
      outputs.set(searchPath, `/* This file is generated by pnpm docs:generate. Do not edit. */\nimport type { ErpDocumentationSearchEntry } from '@erp/shared/util';\n\nexport const ${searchName} = ${typescriptValue(result.search)} as const satisfies readonly ErpDocumentationSearchEntry[];\n`);
    }

    const moduleRoot = path.resolve(documentationRoot, '../../../..');
    const idsPath = path.join(moduleRoot, 'util/src/lib/documentation/documentation-article-ids.generated.ts');
    const constantName = `${manifest.moduleId.replaceAll('-', '_').toUpperCase()}_DOCUMENTATION_ARTICLE_IDS`;
    outputs.set(idsPath, `/* This file is generated by pnpm docs:generate. Do not edit. */\nexport const ${constantName} = ${renderIdTree(manifest.moduleId, manifest.articles)};\n`);
  }
  return { outputs, errors };
}

export async function generateUserDocumentation({ check = false } = {}) {
  const { outputs, errors } = await buildUserDocumentationOutputs();
  if (errors.length > 0) throw new Error([...new Set(errors)].sort().join('\n'));
  const stale = [];
  for (const [absolutePath, expected] of outputs) {
    if (absolutePath.includes(`${path.sep}generated${path.sep}documentation-search.`)) {
      const size = Buffer.byteLength(expected, 'utf8');
      if (size > SEARCH_INDEX_WARNING_BYTES) {
        console.warn(`${path.relative(REPOSITORY_ROOT, absolutePath)}: search index is ${size} B (warning budget: ${SEARCH_INDEX_WARNING_BYTES} B)`);
      }
    }
    let current = '';
    try { current = await fs.readFile(absolutePath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (current === expected) continue;
    stale.push(path.relative(REPOSITORY_ROOT, absolutePath));
    if (!check) { await fs.mkdir(path.dirname(absolutePath), { recursive: true }); await fs.writeFile(absolutePath, expected); }
  }
  if (check && stale.length > 0) throw new Error(`Generated user documentation is stale:\n- ${stale.join('\n- ')}`);
  return stale;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) generateUserDocumentation({ check: process.argv.includes('--check') }).then((changed) => console.log(changed.length ? `Updated ${changed.length} user documentation file(s).` : 'User documentation is current.')).catch((error) => { console.error(error.message); process.exitCode = 1; });
