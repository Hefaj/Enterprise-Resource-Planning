import { ErpDocumentationSearchResult } from '@erp/shared/util';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpDocumentationSearchConfig {
  query: MaybeSignal<string>;
  label: MaybeSignal<Translatable>;
  placeholder: MaybeSignal<Translatable>;
  results: MaybeSignal<readonly ErpDocumentationSearchResult[]>;
  state: MaybeSignal<'idle' | 'loading' | 'ready' | 'error'>;
  noResultsMessage: MaybeSignal<Translatable>;
  errorMessage: MaybeSignal<Translatable>;
  onQueryChange: (query: string) => void;
  onResultSelect: (result: ErpDocumentationSearchResult) => void;
}
