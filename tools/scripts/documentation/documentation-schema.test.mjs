import assert from 'node:assert/strict';
import test from 'node:test';
import { collectHeadingAnchors, slugifyHeading, validateTechnicalMetadata } from './documentation-schema.mjs';
import { readFrontMatter } from './read-front-matter.mjs';

test('front matter parser separates YAML metadata from Markdown', () => {
  const result = readFrontMatter(`---\nid: frontend.pages\ntitle: Pages\nrelated: []\n---\n# Body\n`);

  assert.equal(result.metadata.id, 'frontend.pages');
  assert.deepEqual(result.metadata.related, []);
  assert.equal(result.body, '# Body\n');
});

test('front matter parser rejects a document without metadata', () => {
  assert.throws(() => readFrontMatter('# Body'), /missing YAML front matter/);
});

test('heading anchors are stable and duplicate-compatible', () => {
  assert.equal(slugifyHeading('Zażółć gęślą — API_v2!'), 'zażółć-gęślą--api_v2');
  assert.deepEqual(
    [...collectHeadingAnchors('# Tytuł\n## Powtórka\n## Powtórka\n')],
    ['tytuł', 'powtórka', 'powtórka-1'],
  );
});

test('technical metadata validation rejects plans in docs', () => {
  const errors = validateTechnicalMetadata({
    id: 'sample',
    title: 'Sample',
    summary: 'Sample document.',
    kind: 'plan',
    scope: 'sample',
    audience: [],
    triggers: [],
    related: [],
  }, 'docs/sample.md');

  assert.ok(errors.some((error) => error.includes('implementation plans belong in plans/')));
});
