import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TuiIcon, TuiLoader } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpDocumentationSearchResult } from '@erp/shared/util';
import { ErpDocumentationSearchConfig } from './erp-documentation-search.types';

@Component({
  selector: 'erp-documentation-search',
  standalone: true,
  imports: [ErpTranslatePipe, TuiIcon, TuiLoader],
  template: `
    <div class="search">
      <label [for]="searchId">{{ (_label() | erpTranslate) || '' }}</label>
      <div class="search__field">
        <tui-icon icon="@tui.search" />
        <input
          [id]="searchId"
          type="search"
          [value]="_query()"
          [placeholder]="(_placeholder() | erpTranslate) || ''"
          (input)="queryChanged($event)"
        />
        @if (_state() === 'loading') { <tui-loader size="s" /> }
      </div>
      @if (_state() === 'error') {
        <p class="search__message" role="alert">{{ (_errorMessage() | erpTranslate) || '' }}</p>
      } @else if (_state() === 'ready' && _query().length >= 2 && _results().length === 0) {
        <p class="search__message">{{ (_noResultsMessage() | erpTranslate) || '' }}</p>
      }
      @if (_results().length > 0) {
        <ul class="search__results">
          @for (group of _resultGroups(); track group.moduleId) {
            <li class="search__group">
              @if (_resultGroups().length > 1) {
                <span class="search__group-title">{{ group.moduleId }}</span>
              }
              <ul>
                @for (result of group.results; track result.articleId) {
                  <li>
                    <button type="button" (click)="select(result)">
                      <strong>{{ result.title }}</strong>
                      <span>{{ result.summary }}</span>
                    </button>
                  </li>
                }
              </ul>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .search { position: relative; }
    label { display: block; margin-bottom: .375rem; font: var(--tui-font-text-s); color: var(--tui-text-secondary); }
    .search__field { display: flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: 0 .75rem; border: 1px solid var(--tui-border-normal); border-radius: .75rem; background: var(--tui-background-base); }
    .search__field:focus-within { border-color: var(--tui-border-focus); outline: .125rem solid var(--tui-background-accent-1); outline-offset: .125rem; }
    input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--tui-text-primary); font: var(--tui-font-text-m); }
    .search__message { margin: .5rem 0 0; color: var(--tui-text-secondary); font: var(--tui-font-text-s); }
    .search__results { position: absolute; z-index: 20; top: 100%; right: 0; left: 0; max-height: 24rem; margin: .375rem 0 0; padding: .25rem; overflow: auto; list-style: none; border: 1px solid var(--tui-border-normal); border-radius: .75rem; background: var(--tui-background-elevation-1); box-shadow: var(--tui-shadow-small); }
    .search__group > ul { margin: 0; padding: 0; list-style: none; }
    .search__group-title { display: block; padding: .625rem .75rem .25rem; color: var(--tui-text-secondary); font: var(--tui-font-text-s); font-weight: 600; }
    .search__results button { width: 100%; padding: .625rem .75rem; border: 0; border-radius: .5rem; background: transparent; color: inherit; text-align: left; cursor: pointer; }
    .search__results button:hover, .search__results button:focus-visible { background: var(--tui-background-neutral-1-hover); outline: none; }
    .search__results strong, .search__results span { display: block; }
    .search__results span { margin-top: .125rem; color: var(--tui-text-secondary); font: var(--tui-font-text-s); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDocumentationSearchComponent {
  public readonly config = input.required<ErpDocumentationSearchConfig>();
  public readonly searchId = `erp-documentation-search-${Math.random().toString(36).slice(2)}`;
  protected readonly _query = computed(() => unwrapSignal(this.config().query) ?? '');
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _results = computed(() => unwrapSignal(this.config().results) ?? []);
  protected readonly _state = computed(() => unwrapSignal(this.config().state));
  protected readonly _noResultsMessage = computed(() => unwrapSignal(this.config().noResultsMessage));
  protected readonly _errorMessage = computed(() => unwrapSignal(this.config().errorMessage));
  protected readonly _resultGroups = computed(() => {
    const groups = new Map<string, ErpDocumentationSearchResult[]>();
    for (const result of this._results()) {
      groups.set(result.moduleId, [...(groups.get(result.moduleId) ?? []), result]);
    }
    return [...groups].map(([moduleId, results]) => ({ moduleId, results }));
  });

  protected queryChanged(event: Event): void { this.config().onQueryChange((event.target as HTMLInputElement).value); }
  protected select(result: ErpDocumentationSearchResult): void { this.config().onResultSelect(result); }
}
