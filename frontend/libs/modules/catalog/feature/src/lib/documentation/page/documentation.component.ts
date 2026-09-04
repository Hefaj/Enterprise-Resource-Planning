import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  ErpDocumentationLayoutBuilder,
  ErpDocumentationLayoutComponent,
  ErpDocumentationSearchBuilder,
  SHARED_KEYS,
} from '@erp/shared/ui';
import { ErpDocumentationSearchResult } from '@erp/shared/util';
import { CatalogDocumentationStore } from './documentation.store';

@Component({
  selector: 'erp-catalog-documentation',
  standalone: true,
  imports: [ErpDocumentationLayoutComponent],
  providers: [CatalogDocumentationStore],
  template: `<erp-documentation-layout [config]="layoutConfig" />`,
  host: { style: 'display: block; height: 100%; min-height: 0;' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDocumentationComponent {
  private readonly _store = inject(CatalogDocumentationStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _title = inject(Title);
  private readonly _paramMap = toSignal(this._route.paramMap, { initialValue: this._route.snapshot.paramMap });
  private readonly _fragment = toSignal(this._route.fragment, { initialValue: this._route.snapshot.fragment });

  protected readonly article = computed(() => {
    const documentation = this._store.documentation();
    if (!documentation) return null;
    const slug = this._paramMap().get('articleSlug') ?? 'overview';
    const articleId = documentation.articleIdBySlug[slug] ?? documentation.module.overviewArticleId;
    return documentation.articles[articleId] ?? null;
  });
  protected readonly activeArticleId = computed(() => this.article()?.id ?? null);
  protected readonly moduleTitle = computed(() => {
    const documentation = this._store.documentation();
    return documentation?.articles[documentation.module.overviewArticleId]?.title ?? '';
  });

  protected readonly searchConfig = ErpDocumentationSearchBuilder.create((builder) => builder
    .setQuery(this._store.query)
    .setLabel(SHARED_KEYS.documentation.searchLabel)
    .setPlaceholder(SHARED_KEYS.documentation.searchPlaceholder)
    .setResults(this._store.searchResults)
    .setState(computed(() => this._store.loading() ? 'loading' : this._store.error() ? 'error' : 'ready'))
    .setNoResultsMessage(SHARED_KEYS.documentation.noResults)
    .setErrorMessage(SHARED_KEYS.documentation.loadError)
    .setOnQueryChange((query) => this._store.query.set(query))
    .setOnResultSelect((result) => this._selectSearchResult(result)));

  protected readonly layoutConfig = ErpDocumentationLayoutBuilder.create((builder) => builder
    .setModuleTitle(this.moduleTitle)
    .setArticle(this.article)
    .setState(computed(() => this._store.loading() ? 'loading' : this._store.error() ? 'error' : this._store.documentation() ? 'ready' : 'empty'))
    .setNavigation(computed(() => this._store.documentation()?.navigation ?? []))
    .setActiveArticleId(this.activeArticleId)
    .setSearch(this.searchConfig)
    .setSkipLinkLabel(SHARED_KEYS.documentation.skipToContent)
    .setTopicsLabel(SHARED_KEYS.documentation.topics)
    .setOnThisPageLabel(SHARED_KEYS.documentation.onThisPage)
    .setMobileNavigationLabel(SHARED_KEYS.documentation.mobileNavigation)
    .setCloseMobileNavigationLabel(SHARED_KEYS.documentation.closeMobileNavigation)
    .setLoadingMessage(SHARED_KEYS.documentation.loading)
    .setErrorMessage(SHARED_KEYS.documentation.loadError)
    .setEmptyMessage(SHARED_KEYS.documentation.empty)
    .setPreviousLabel(SHARED_KEYS.documentation.previous)
    .setNextLabel(SHARED_KEYS.documentation.next)
    .setOnArticleSelect((articleId) => this._selectArticle(articleId))
    .setOnInternalLink((url) => this._openInternalLink(url))
    .setOnHeadingSelect((headingId) => this._selectHeading(headingId)));

  public constructor() {
    effect(() => {
      const article = this.article();
      if (article) this._title.setTitle(article.title);
    });
    effect(() => {
      const fragment = this._fragment();
      if (fragment) queueMicrotask(() => this._focusHeading(fragment));
    });
  }

  private _selectSearchResult(result: ErpDocumentationSearchResult): void {
    this._store.query.set('');
    void this._router.navigate(result.route);
  }

  private _selectArticle(articleId: string): void {
    const documentation = this._store.documentation();
    const article = documentation?.articles[articleId];
    if (article) void this._router.navigate(['/catalog', 'documentation', article.slug]);
  }

  private _selectHeading(headingId: string): void {
    void this._router.navigate([], { relativeTo: this._route, fragment: headingId }).then(() => this._focusHeading(headingId));
  }

  private _openInternalLink(url: string): void {
    if (url.startsWith('#')) {
      this._selectHeading(url.slice(1));
      return;
    }
    void this._router.navigateByUrl(url);
  }

  private _focusHeading(headingId: string): void {
    const heading = document.getElementById(headingId);
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
}
