import { promises as fs } from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { buildTechnicalOutputs } from './generate-technical-index.mjs';
import { collectHeadingAnchors } from './documentation-schema.mjs';
import { DOCS_ROOT, REPOSITORY_ROOT, scanTechnicalDocs } from './scan-technical-docs.mjs';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

async function walk(directory, predicate) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(absolutePath, predicate)));
    if (entry.isFile() && predicate(absolutePath)) result.push(absolutePath);
  }
  return result;
}

function markdownLinks(source) {
  const links = [];
  for (const token of markdown.parse(source, {})) {
    if (token.type !== 'inline' || !token.children) continue;
    for (const child of token.children) {
      if (child.type === 'link_open' || child.type === 'image') {
        const href = child.attrGet(child.type === 'image' ? 'src' : 'href');
        if (href) links.push(href);
      }
    }
  }
  return links;
}

async function validateLinks(markdownFiles) {
  const errors = [];
  const anchorCache = new Map();

  for (const absolutePath of markdownFiles) {
    const source = await fs.readFile(absolutePath, 'utf8');
    const repositoryPath = path.relative(REPOSITORY_ROOT, absolutePath).split(path.sep).join('/');

    for (const href of markdownLinks(source)) {
      if (/^(?:https?:|mailto:)/i.test(href)) continue;
      if (/^[a-z][a-z\d+.-]*:/i.test(href)) {
        errors.push(`${repositoryPath}: unsupported link protocol in "${href}"`);
        continue;
      }

      const [rawTarget, rawAnchor] = href.split('#', 2);
      const targetPath = rawTarget
        ? path.resolve(path.dirname(absolutePath), decodeURIComponent(rawTarget))
        : absolutePath;

      let stat;
      try {
        stat = await fs.stat(targetPath);
      } catch {
        errors.push(`${repositoryPath}: broken relative link "${href}"`);
        continue;
      }

      if (!stat.isFile() || !rawAnchor) continue;
      let anchors = anchorCache.get(targetPath);
      if (!anchors) {
        anchors = collectHeadingAnchors(await fs.readFile(targetPath, 'utf8'));
        anchorCache.set(targetPath, anchors);
      }
      const anchor = decodeURIComponent(rawAnchor);
      if (!anchors.has(anchor)) errors.push(`${repositoryPath}: missing anchor "#${anchor}" in ${path.relative(REPOSITORY_ROOT, targetPath)}`);
    }
  }

  return errors;
}

async function validateNoPlanReferencesFromCode() {
  const errors = [];
  for (const root of ['frontend', 'backend']) {
    const files = await walk(path.join(REPOSITORY_ROOT, root), (file) => /\.(?:ts|tsx|js|mjs|cs|csproj)$/.test(file) && !/[\\/](?:bin|obj|node_modules)[\\/]/.test(file));
    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      if (/(?:PLAN(?:-task-management)?\.md|plans\/(?:active|backlog)\/[^\s)`'"<>]+\.md)/.test(source)) {
        errors.push(`${path.relative(REPOSITORY_ROOT, file)}: production code must not use an implementation plan as a durable source`);
      }
    }
  }
  return errors;
}

async function validateNoLegacyDocumentationPaths() {
  const errors = [];
  const roots = ['frontend', 'backend'];
  for (const root of roots) {
    const files = await walk(
      path.join(REPOSITORY_ROOT, root),
      (file) => !/[\/](?:bin|obj|node_modules)[\/]/.test(file),
    );
    for (const file of files) {
      let source;
      try { source = await fs.readFile(file, 'utf8'); }
      catch { continue; }
      if (/docs\/(?:frontend|backend)\//.test(source)) {
        errors.push(`${path.relative(REPOSITORY_ROOT, file)}: use the current docs taxonomy instead of docs/frontend or docs/backend`);
      }
    }
  }
  return errors;
}

async function validateGeneratedOutputs() {
  const errors = [];
  const outputs = await buildTechnicalOutputs();
  for (const [repositoryPath, expected] of outputs) {
    let current = '';
    try {
      current = await fs.readFile(path.join(REPOSITORY_ROOT, repositoryPath), 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (current !== expected) errors.push(`${repositoryPath}: generated documentation index is stale`);
  }
  return errors;
}

export async function validateTechnicalDocs() {
  const { documents, ids, errors } = await scanTechnicalDocs();

  for (const document of documents) {
    for (const relatedId of document.metadata.related ?? []) {
      if (!ids.has(relatedId)) errors.push(`${document.repositoryPath}: related id "${relatedId}" does not exist`);
    }
    if (/^#{1,6}\s+.*(?:dziennik sesji|session log|kolejność wdrożenia|stan wdrożenia|plan realizacji|faza(?:\s+\d+)?\b)/imu.test(document.body)) {
      errors.push(`${document.repositoryPath}: implementation phases and session journals belong in plans/ or Git history`);
    }
  }

  const markdownFiles = await walk(DOCS_ROOT, (file) => file.endsWith('.md'));
  errors.push(...(await validateLinks(markdownFiles)));
  errors.push(...(await validateNoPlanReferencesFromCode()));
  errors.push(...(await validateNoLegacyDocumentationPaths()));

  try {
    errors.push(...(await validateGeneratedOutputs()));
  } catch (error) {
    errors.push(error.message);
  }

  const uniqueErrors = [...new Set(errors)].sort();
  if (uniqueErrors.length > 0) throw new Error(uniqueErrors.join('\n'));
  console.log(`Validated ${documents.length} technical documents.`);
}

validateTechnicalDocs().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
