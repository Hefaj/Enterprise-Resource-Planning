import { loadDocumentationIndex } from './index';

describe('Catalog user documentation', () => {
  it.each(['pl-PL', 'en-US'] as const)('loads only the localized search index for %s', async (locale) => {
    const index = await loadDocumentationIndex(locale);

    expect(index.length).toBeGreaterThan(0);
    expect(index.every((entry) => entry.locale === locale)).toBe(true);
    expect(index.some((entry) => entry.articleId === 'catalog.overview')).toBe(true);
    expect(index.every((entry) => !('html' in entry))).toBe(true);
  });
});
