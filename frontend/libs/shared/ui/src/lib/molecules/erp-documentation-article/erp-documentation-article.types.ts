import { ErpDocumentationArticle } from '@erp/shared/util';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpDocumentationArticleConfig {
  article: MaybeSignal<ErpDocumentationArticle | null>;
  state: MaybeSignal<'loading' | 'ready' | 'empty' | 'error'>;
  loadingMessage: MaybeSignal<Translatable>;
  errorMessage: MaybeSignal<Translatable>;
  emptyMessage: MaybeSignal<Translatable>;
  previousLabel: MaybeSignal<Translatable>;
  nextLabel: MaybeSignal<Translatable>;
  onArticleSelect: (articleId: string) => void;
  onInternalLink: (url: string) => void;
}
