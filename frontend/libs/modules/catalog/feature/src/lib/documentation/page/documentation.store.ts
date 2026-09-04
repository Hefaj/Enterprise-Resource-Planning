import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { ErpLanguageService } from '@erp/shared/data-access';
import { ErpDocumentationGeneratedModule, ErpDocumentationSearchResult, erpNormalizeDocumentationText } from '@erp/shared/util';

interface CatalogDocumentationBundle {
  readonly documentation: ErpDocumentationGeneratedModule;
  readonly search: readonly Omit<ErpDocumentationSearchResult, 'score' | 'route'>[];
}

async function loadBundle(locale: 'pl-PL' | 'en-US'): Promise<CatalogDocumentationBundle> {
  if (locale === 'en-US') {
    const [documentation, search] = await Promise.all([
      import('../generated/documentation.en-US.generated').then((module) => module.DOCUMENTATION_EN_US),
      import('../generated/documentation-search.en-US.generated').then((module) => module.DOCUMENTATION_SEARCH_EN_US),
    ]);
    return { documentation, search };
  }
  const [documentation, search] = await Promise.all([
    import('../generated/documentation.pl-PL.generated').then((module) => module.DOCUMENTATION_PL_PL),
    import('../generated/documentation-search.pl-PL.generated').then((module) => module.DOCUMENTATION_SEARCH_PL_PL),
  ]);
  return { documentation, search };
}

@Injectable()
export class CatalogDocumentationStore {
  private readonly _language = inject(ErpLanguageService);
  private readonly _bundleResource = resource({
    params: () => ({ locale: this._language.language() }),
    loader: ({ params }) => loadBundle(params.locale),
  });

  public readonly query = signal('');
  public readonly documentation = computed(() => this._bundleResource.value()?.documentation ?? null);
  public readonly loading = this._bundleResource.isLoading;
  public readonly error = this._bundleResource.error;
  public readonly searchResults = computed<readonly ErpDocumentationSearchResult[]>(() => {
    const query = erpNormalizeDocumentationText(this.query());
    if (query.length < 2) return [];
    return (this._bundleResource.value()?.search ?? [])
      .filter((entry) => entry.normalizedText.includes(query))
      .slice(0, 8)
      .map((entry) => ({ ...entry, score: 1, route: ['/catalog', 'documentation', entry.slug] }));
  });
}
