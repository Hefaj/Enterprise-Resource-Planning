import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMarkdown } from './generate-user-documentation.mjs';

const manifest = { moduleId: 'sample', routePrefix: 'sample' };
const descriptor = { id: 'sample.overview', slug: 'overview' };
const descriptors = new Map([[descriptor.id, descriptor]]);

function polishArticle(extra = '') {
  return `# Przegląd

Krótki opis.

## Kto może wykonać operację

Każdy.

## Gdzie znaleźć funkcję

W menu.

## Jak wykonać operację

Wybierz akcję.

## Rezultat

Gotowe.

## Ograniczenia i przypadki szczególne

Brak.

## Powiązane tematy

${extra}
`;
}

test('user Markdown adds safe attributes to external links', () => {
  const result = prepareMarkdown(
    manifest,
    descriptor,
    'pl-PL',
    polishArticle('[Strona](https://example.com)'),
    'overview.md',
    descriptors,
  );

  assert.deepEqual(result.errors, []);
  assert.match(result.article.html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(result.article.html, /<h2[^>]+id=/);
  assert.equal(result.article.headings[0].id, 'kto-może-wykonać-operację');
});

test('user Markdown rejects raw HTML and unsafe protocols', () => {
  const result = prepareMarkdown(
    manifest,
    descriptor,
    'pl-PL',
    polishArticle('<script>alert(1)</script>\n\n[Zły link](javascript:alert(1))'),
    'overview.md',
    descriptors,
  );

  assert.ok(result.errors.some((error) => error.includes('raw HTML is not allowed')));
  assert.ok(result.errors.some((error) => error.includes('unsupported protocol')));
  assert.doesNotMatch(result.article.html, /<script>/);
});

test('user Markdown rejects missing local anchors', () => {
  const result = prepareMarkdown(
    manifest,
    descriptor,
    'pl-PL',
    polishArticle('[Sekcja](#nie-istnieje)'),
    'overview.md',
    descriptors,
  );

  assert.ok(result.errors.some((error) => error.includes('missing anchor')));
});
