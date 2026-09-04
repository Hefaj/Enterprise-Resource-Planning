import { ErpRemoteDocumentationDescriptor } from '@erp/shared/util';
import { ErpDocumentationRegistryService } from './documentation-registry.service';
import { ErpDocumentationSearchService } from './documentation-search.service';

const entry = {
  moduleId: 'catalog',
  articleId: 'catalog.products',
  slug: 'produkty',
  locale: 'pl-PL' as const,
  title: 'Produkty i cennik',
  summary: 'Filtrowanie produktów',
  headings: ['Lista produktów'],
  normalizedText: 'produkty cennik filtrowanie lista produktow',
};

describe('documentation registry and search', () => {
  it('caches indexes independently for each locale', async () => {
    const registry = new ErpDocumentationRegistryService();
    const loader = vi.fn(async () => [entry]);
    const descriptor: ErpRemoteDocumentationDescriptor = {
      moduleId: 'catalog',
      routePrefix: 'catalog',
      overviewArticleId: 'catalog.products',
      loadIndex: loader,
    };
    registry.register(descriptor);

    await registry.loadIndex(descriptor, 'pl-PL');
    await registry.loadIndex(descriptor, 'pl-PL');
    await registry.loadIndex(descriptor, 'en-US');

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('returns useful results without Polish diacritics and isolates a failed module', async () => {
    const registry = new ErpDocumentationRegistryService();
    registry.register({
      moduleId: 'catalog',
      routePrefix: 'catalog',
      overviewArticleId: 'catalog.products',
      loadIndex: async () => [entry],
    });
    registry.register({
      moduleId: 'broken',
      routePrefix: 'broken',
      overviewArticleId: 'broken.overview',
      loadIndex: async () => { throw new Error('remote unavailable'); },
    });

    TestBed.configureTestingModule({ providers: [{ provide: ErpDocumentationRegistryService, useValue: registry }] });
    const response = await TestBed.inject(ErpDocumentationSearchService).search('produktow', 'pl-PL');

    expect(response.results[0]).toMatchObject({ articleId: entry.articleId, route: ['/catalog', 'documentation', 'produkty'] });
    expect(response.moduleErrors).toHaveLength(1);
  });
});
import { TestBed } from '@angular/core/testing';
