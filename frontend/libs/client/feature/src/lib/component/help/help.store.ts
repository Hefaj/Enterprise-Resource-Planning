import { computed, DestroyRef, effect, inject, Injectable, resource, signal, untracked } from '@angular/core';
import {
  ErpDocumentationRegistryService,
  ErpDocumentationSearchService,
  ErpLanguageService,
} from '@erp/shared/data-access';
import { ErpDocumentationSearchResult } from '@erp/shared/util';

@Injectable()
export class HelpStore {
  private _requestVersion = 0;
  private _debounceHandle: ReturnType<typeof setTimeout> | undefined;
  private readonly _registry = inject(ErpDocumentationRegistryService);
  private readonly _searchService = inject(ErpDocumentationSearchService);
  private readonly _language = inject(ErpLanguageService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _indexesResource = resource({
    params: () => ({ locale: this._language.language() }),
    loader: ({ params }) => Promise.all(this._registry.modules().map((module) => this._registry.loadIndex(module, params.locale))),
  });

  public readonly query = signal('');
  public readonly searchState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  public readonly results = signal<readonly ErpDocumentationSearchResult[]>([]);
  public readonly moduleCards = computed(() => (this._indexesResource.value() ?? []).map((loaded) => ({
    module: loaded.module,
    overview: loaded.entries.find((entry) => entry.articleId === loaded.module.overviewArticleId),
    error: loaded.error,
  })));
  public readonly hasPartialError = computed(() => this.moduleCards().some((card) => card.error !== undefined));

  public constructor() {
    this._destroyRef.onDestroy(() => clearTimeout(this._debounceHandle));
    effect(() => {
      const locale = this._language.language();
      const query = untracked(this.query);
      if (query.trim().length >= 2) this._scheduleSearch(query, locale);
    });
  }

  public setQuery(query: string): void {
    this.query.set(query);
    this._scheduleSearch(query, this._language.language());
  }

  private _scheduleSearch(query: string, locale: 'pl-PL' | 'en-US'): void {
    clearTimeout(this._debounceHandle);
    if (query.trim().length < 2) {
      this.results.set([]);
      this.searchState.set('idle');
      return;
    }
    const version = ++this._requestVersion;
    this.searchState.set('loading');
    this._debounceHandle = setTimeout(() => {
      void this._searchService.search(query, locale).then((response) => {
        if (version !== this._requestVersion) return;
        this.results.set(response.results);
        const moduleCount = this._registry.modules().length;
        this.searchState.set(moduleCount > 0 && response.moduleErrors.length === moduleCount ? 'error' : 'ready');
      }).catch(() => {
        if (version === this._requestVersion) this.searchState.set('error');
      });
    }, 250);
  }
}
