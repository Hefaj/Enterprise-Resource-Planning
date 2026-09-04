import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHeadingAnchors, validateTechnicalMetadata } from './documentation-schema.mjs';
import { readFrontMatter } from './read-front-matter.mjs';

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DOCS_ROOT = path.join(REPOSITORY_ROOT, 'docs');

async function walkMarkdown(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMarkdown(absolutePath)));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolutePath);
  }

  return files;
}

export async function scanTechnicalDocs() {
  const markdownFiles = await walkMarkdown(DOCS_ROOT);
  const documents = [];
  const errors = [];

  for (const absolutePath of markdownFiles) {
    if (path.basename(absolutePath) === 'README.md') continue;

    const repositoryPath = path.relative(REPOSITORY_ROOT, absolutePath).split(path.sep).join('/');
    const source = await fs.readFile(absolutePath, 'utf8');

    try {
      const { metadata, body } = readFrontMatter(source, repositoryPath);
      errors.push(...validateTechnicalMetadata(metadata, repositoryPath));
      documents.push({
        absolutePath,
        repositoryPath,
        metadata,
        body,
        anchors: collectHeadingAnchors(body),
      });
    } catch (error) {
      errors.push(error.message);
    }
  }

  const ids = new Map();
  for (const document of documents) {
    const duplicate = ids.get(document.metadata.id);
    if (duplicate) {
      errors.push(`${document.repositoryPath}: duplicate id "${document.metadata.id}" already used by ${duplicate.repositoryPath}`);
    } else {
      ids.set(document.metadata.id, document);
    }
  }

  return { documents, ids, errors };
}
