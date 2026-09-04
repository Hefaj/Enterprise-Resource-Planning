import { ErpDocumentationArticle } from '@erp/shared/util';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpDocumentationArticleConfig } from './erp-documentation-article.types';

export class ErpDocumentationArticleBuilder extends ErpBaseBuilder<ErpDocumentationArticleConfig> {
  public setArticle(article: MaybeSignal<ErpDocumentationArticle | null>): this { this._data.article = article; return this; }
  public setState(state: MaybeSignal<'loading' | 'ready' | 'empty' | 'error'>): this { this._data.state = state; return this; }
  public setLoadingMessage(message: MaybeSignal<Translatable>): this { this._data.loadingMessage = message; return this; }
  public setErrorMessage(message: MaybeSignal<Translatable>): this { this._data.errorMessage = message; return this; }
  public setEmptyMessage(message: MaybeSignal<Translatable>): this { this._data.emptyMessage = message; return this; }
  public setPreviousLabel(label: MaybeSignal<Translatable>): this { this._data.previousLabel = label; return this; }
  public setNextLabel(label: MaybeSignal<Translatable>): this { this._data.nextLabel = label; return this; }
  public setOnArticleSelect(handler: (articleId: string) => void): this { this._data.onArticleSelect = handler; return this; }
  public setOnInternalLink(handler: (url: string) => void): this { this._data.onInternalLink = handler; return this; }
}
