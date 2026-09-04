import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpDocumentationSearchResult } from '@erp/shared/util';
import { ErpDocumentationSearchConfig } from './erp-documentation-search.types';

export class ErpDocumentationSearchBuilder extends ErpBaseBuilder<ErpDocumentationSearchConfig> {
  public setQuery(query: MaybeSignal<string>): this { this._data.query = query; return this; }
  public setLabel(label: MaybeSignal<Translatable>): this { this._data.label = label; return this; }
  public setPlaceholder(placeholder: MaybeSignal<Translatable>): this { this._data.placeholder = placeholder; return this; }
  public setResults(results: MaybeSignal<readonly ErpDocumentationSearchResult[]>): this { this._data.results = results; return this; }
  public setState(state: MaybeSignal<'idle' | 'loading' | 'ready' | 'error'>): this { this._data.state = state; return this; }
  public setNoResultsMessage(message: MaybeSignal<Translatable>): this { this._data.noResultsMessage = message; return this; }
  public setErrorMessage(message: MaybeSignal<Translatable>): this { this._data.errorMessage = message; return this; }
  public setOnQueryChange(handler: (query: string) => void): this { this._data.onQueryChange = handler; return this; }
  public setOnResultSelect(handler: (result: ErpDocumentationSearchResult) => void): this { this._data.onResultSelect = handler; return this; }
}
