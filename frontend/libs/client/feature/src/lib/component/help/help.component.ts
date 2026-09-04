import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ErpDocumentationSearchBuilder, ErpDocumentationSearchComponent, ErpTranslatePipe, SHARED_KEYS } from '@erp/shared/ui';
import { ErpDocumentationSearchResult } from '@erp/shared/util';
import { HelpStore } from './help.store';

@Component({
  selector: 'erp-help',
  standalone: true,
  imports: [ErpDocumentationSearchComponent, ErpTranslatePipe],
  providers: [HelpStore],
  template: `
    <main class="help">
      <header>
        <h1>{{ (SHARED_KEYS.documentation.centerTitle | erpTranslate) || '' }}</h1>
        <erp-documentation-search [config]="searchConfig" />
      </header>
      @if (store.hasPartialError()) {
        <p class="warning" role="status">{{ (SHARED_KEYS.documentation.partialError | erpTranslate) || '' }}</p>
      }
      <section [attr.aria-labelledby]="modulesHeadingId">
        <h2 [id]="modulesHeadingId">{{ (SHARED_KEYS.documentation.availableModules | erpTranslate) || '' }}</h2>
        <div class="modules">
          @for (card of store.moduleCards(); track card.module.moduleId) {
            @if (card.overview) {
              <button type="button" (click)="openOverview(card.module.routePrefix, card.overview.slug)">
                <strong>{{ card.overview.title }}</strong>
                <span>{{ card.overview.summary }}</span>
              </button>
            }
          }
        </div>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: auto; background: var(--tui-background-base); }
    .help { width: min(72rem, 100%); margin: 0 auto; padding: 2rem; }
    header { display: grid; grid-template-columns: minmax(12rem, 1fr) minmax(18rem, 34rem); gap: 2rem; align-items: end; }
    h1 { margin: 0; font: var(--tui-font-heading-2); }
    h2 { margin: 3rem 0 1rem; font: var(--tui-font-heading-4); }
    .warning { padding: .75rem 1rem; border-radius: .75rem; background: var(--tui-background-warning); color: var(--tui-text-primary); }
    .modules { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; }
    .modules button { padding: 1.25rem; border: 1px solid var(--tui-border-normal); border-radius: 1rem; background: var(--tui-background-elevation-1); color: inherit; text-align: left; cursor: pointer; }
    .modules button:hover, .modules button:focus-visible { border-color: var(--tui-border-focus); box-shadow: var(--tui-shadow-small); }
    .modules strong, .modules span { display: block; }
    .modules span { margin-top: .5rem; color: var(--tui-text-secondary); line-height: 1.5; }
    @media (max-width: 44rem) { .help { padding: 1rem; } header { grid-template-columns: 1fr; gap: 1rem; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {
  protected readonly store = inject(HelpStore);
  protected readonly SHARED_KEYS = SHARED_KEYS;
  protected readonly modulesHeadingId = 'erp-help-modules';
  private readonly _router = inject(Router);
  protected readonly searchConfig = ErpDocumentationSearchBuilder.create((builder) => builder
    .setQuery(this.store.query)
    .setLabel(SHARED_KEYS.documentation.searchLabel)
    .setPlaceholder(SHARED_KEYS.documentation.searchPlaceholder)
    .setResults(this.store.results)
    .setState(this.store.searchState)
    .setNoResultsMessage(SHARED_KEYS.documentation.noResults)
    .setErrorMessage(SHARED_KEYS.documentation.loadError)
    .setOnQueryChange((query) => this.store.setQuery(query))
    .setOnResultSelect((result) => this._openResult(result)));

  protected openOverview(routePrefix: string, slug: string): void {
    void this._router.navigate(['/', routePrefix, 'documentation', slug]);
  }

  private _openResult(result: ErpDocumentationSearchResult): void {
    void this._router.navigate(result.route);
  }
}
