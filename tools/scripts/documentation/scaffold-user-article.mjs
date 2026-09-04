import { promises as fs } from 'node:fs';
import path from 'node:path';
import { REPOSITORY_ROOT } from './scan-technical-docs.mjs';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const moduleId = argument('module');
const articleId = argument('article');
if (!moduleId || !articleId) throw new Error('Usage: pnpm docs:scaffold --module MODULE --article ARTICLE_ID');

const root = path.join(REPOSITORY_ROOT, 'frontend/libs/modules', moduleId, 'feature/src/lib/documentation');
const manifestPath = path.join(root, 'documentation.manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const fullId = articleId.startsWith(`${moduleId}.`) ? articleId : `${moduleId}.${articleId}`;
if (manifest.articles.some((article) => article.id === fullId)) throw new Error(`Article "${fullId}" already exists.`);

const relativeId = fullId.slice(moduleId.length + 1);
const content = `${relativeId.replaceAll('.', '/')}.md`;
const slug = relativeId.replaceAll('.', '-').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
manifest.articles.push({ id: fullId, slug, content, order: Math.max(0, ...manifest.articles.map((article) => article.order)) + 10 });
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const templates = {
  'pl-PL': `# Tytuł\n\nKrótki opis odpowiadający na pytanie „po co tego używać”.\n\n## Kto może wykonać operację\n\n## Gdzie znaleźć funkcję\n\n## Jak wykonać operację\n\n## Rezultat\n\n## Ograniczenia i przypadki szczególne\n\n## Powiązane tematy\n`,
  'en-US': `# Title\n\nA short explanation of why this feature is useful.\n\n## Who can perform the operation\n\n## Where to find the feature\n\n## How to perform the operation\n\n## Result\n\n## Limitations and special cases\n\n## Related topics\n`,
};
for (const [locale, template] of Object.entries(templates)) {
  const target = path.join(root, 'content', locale, content);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, template, { flag: 'wx' });
}
console.log(`Scaffolded ${fullId} in pl-PL and en-US.`);
