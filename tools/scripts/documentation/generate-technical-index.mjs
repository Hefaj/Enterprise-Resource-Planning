import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DOCS_ROOT, REPOSITORY_ROOT, scanTechnicalDocs } from './scan-technical-docs.mjs';

export const GENERATED_START = '<!-- generated:documentation-index:start -->';
export const GENERATED_END = '<!-- generated:documentation-index:end -->';

const INDEXES = [
  { file: 'docs/README.md', title: 'Dokumentacja techniczna ERP', prefix: 'docs/' },
  { file: 'docs/architecture/README.md', title: 'Architektura', prefix: 'docs/architecture/' },
  { file: 'docs/guides/README.md', title: 'Przewodniki implementacyjne', prefix: 'docs/guides/' },
  { file: 'docs/guides/frontend/README.md', title: 'Przewodniki frontendowe', prefix: 'docs/guides/frontend/' },
  { file: 'docs/guides/backend/README.md', title: 'Przewodniki backendowe', prefix: 'docs/guides/backend/' },
  { file: 'docs/modules/README.md', title: 'Specyfikacje modułów', prefix: 'docs/modules/' },
  { file: 'docs/modules/catalog/README.md', title: 'Catalog', prefix: 'docs/modules/catalog/' },
  { file: 'docs/modules/task-management/README.md', title: 'Task Management', prefix: 'docs/modules/task-management/' },
  { file: 'docs/modules/dms/README.md', title: 'DMS', prefix: 'docs/modules/dms/' },
  { file: 'docs/modules/notification/README.md', title: 'Notification', prefix: 'docs/modules/notification/' },
  { file: 'docs/operations/README.md', title: 'Operacje produkcyjne', prefix: 'docs/operations/' },
  { file: 'docs/reference/README.md', title: 'Dane referencyjne', prefix: 'docs/reference/' },
];

function escapeTable(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function relativeLink(indexPath, documentPath) {
  return path.relative(path.dirname(indexPath), documentPath).split(path.sep).join('/');
}

function renderDocumentTable(documents, indexPath) {
  if (documents.length === 0) return '_Brak dokumentów w tej kategorii._';

  const rows = documents
    .sort((left, right) => left.metadata.title.localeCompare(right.metadata.title, 'pl'))
    .map((document) => `| [${escapeTable(document.metadata.title)}](${relativeLink(indexPath, document.repositoryPath)}) | ${escapeTable(document.metadata.summary)} | \`${document.metadata.kind}\` |`);

  return ['| Dokument | Zakres | Rodzaj |', '|---|---|---|', ...rows].join('\n');
}

function renderRootIndex(documents) {
  const categories = [
    ['Architektura', 'architecture/README.md', 'architecture'],
    ['Przewodniki', 'guides/README.md', 'guides'],
    ['Moduły', 'modules/README.md', 'modules'],
    ['Operacje', 'operations/README.md', 'operations'],
    ['Referencje', 'reference/README.md', 'reference'],
    ['Decyzje', 'decisions/README.md', 'decisions'],
    ['Współtworzenie', 'contributing/README.md', 'contributing'],
  ];

  const rows = categories.map(([label, href, segment]) => {
    const count = documents.filter((document) => document.repositoryPath.startsWith(`docs/${segment}/`)).length;
    return `| [${label}](${href}) | ${count} |`;
  });

  return [
    'Dokumentacja techniczna opisuje aktualne reguły, architekturę i powtarzalne procedury. Jednorazowe plany realizacji znajdują się w [`plans/`](../plans/README.md).',
    '',
    '| Obszar | Dokumenty |',
    '|---|---:|',
    ...rows,
  ].join('\n');
}

function renderAgentIndex(documents) {
  const rows = documents
    .filter((document) => document.metadata.triggers.length > 0)
    .sort((left, right) => left.metadata.triggers[0].localeCompare(right.metadata.triggers[0], 'pl'))
    .map((document) => `| ${escapeTable(document.metadata.triggers.join('; '))} | [\`${document.repositoryPath}\`](${document.repositoryPath}) |`);

  return [
    '| Zadanie / sygnał | Obowiązkowy dokument |',
    '|---|---|',
    ...rows,
  ].join('\n');
}

export function replaceGeneratedBlock(source, generated, filePath) {
  const start = source.indexOf(GENERATED_START);
  const end = source.indexOf(GENERATED_END);
  if (start < 0 || end < start) {
    throw new Error(`${filePath}: missing documentation index markers`);
  }

  return `${source.slice(0, start + GENERATED_START.length)}\n${generated.trim()}\n${source.slice(end)}`;
}

async function readOrCreateIndex(index) {
  const absolutePath = path.join(REPOSITORY_ROOT, index.file);
  try {
    return await fs.readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return `# ${index.title}\n\n${GENERATED_START}\n${GENERATED_END}\n`;
  }
}

export async function buildTechnicalOutputs() {
  const { documents, errors } = await scanTechnicalDocs();
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const outputs = new Map();
  for (const index of INDEXES) {
    const source = await readOrCreateIndex(index);
    const included = index.file === 'docs/README.md'
      ? documents
      : documents.filter((document) => document.repositoryPath.startsWith(index.prefix));
    const generated = index.file === 'docs/README.md'
      ? renderRootIndex(documents)
      : renderDocumentTable(included, index.file);
    outputs.set(index.file, replaceGeneratedBlock(source, generated, index.file));
  }

  const agentIndex = renderAgentIndex(documents);
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const source = await fs.readFile(path.join(REPOSITORY_ROOT, file), 'utf8');
    outputs.set(file, replaceGeneratedBlock(source, agentIndex, file));
  }

  return outputs;
}

export async function generateTechnicalIndexes({ check = false } = {}) {
  const outputs = await buildTechnicalOutputs();
  const stale = [];

  for (const [repositoryPath, expected] of outputs) {
    const absolutePath = path.join(REPOSITORY_ROOT, repositoryPath);
    let current = '';
    try {
      current = await fs.readFile(absolutePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (current === expected) continue;
    stale.push(repositoryPath);
    if (!check) {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, expected);
    }
  }

  if (check && stale.length > 0) {
    throw new Error(`Generated documentation indexes are stale:\n- ${stale.join('\n- ')}`);
  }

  return stale;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  generateTechnicalIndexes({ check: process.argv.includes('--check') })
    .then((changed) => console.log(changed.length === 0 ? 'Technical documentation indexes are current.' : `Updated ${changed.length} documentation index file(s).`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
