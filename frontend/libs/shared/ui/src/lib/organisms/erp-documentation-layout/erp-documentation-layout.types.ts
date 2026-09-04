import { ErpDocumentationArticle, ErpDocumentationNavigationItem } from '@erp/shared/util';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpDocumentationSearchConfig } from '../../molecules/erp-documentation-search';

export interface ErpDocumentationLayoutConfig {
  moduleTitle: MaybeSignal<string>;
  article: MaybeSignal<ErpDocumentationArticle | null>;
  state: MaybeSignal<'loading' | 'ready' | 'empty' | 'error'>;
  navigation: MaybeSignal<readonly ErpDocumentationNavigationItem[]>;
  activeArticleId: MaybeSignal<string | null>;
  search: ErpDocumentationSearchConfig;
  skipLinkLabel: MaybeSignal<Translatable>;
  topicsLabel: MaybeSignal<Translatable>;
  onThisPageLabel: MaybeSignal<Translatable>;
  mobileNavigationLabel: MaybeSignal<Translatable>;
  closeMobileNavigationLabel: MaybeSignal<Translatable>;
  loadingMessage: MaybeSignal<Translatable>;
  errorMessage: MaybeSignal<Translatable>;
  emptyMessage: MaybeSignal<Translatable>;
  previousLabel: MaybeSignal<Translatable>;
  nextLabel: MaybeSignal<Translatable>;
  onArticleSelect: (articleId: string) => void;
  onInternalLink: (url: string) => void;
  onHeadingSelect: (headingId: string) => void;
}
