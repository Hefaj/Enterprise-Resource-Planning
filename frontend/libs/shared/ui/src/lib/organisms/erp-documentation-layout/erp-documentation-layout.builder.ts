import { ErpDocumentationArticle, ErpDocumentationNavigationItem } from '@erp/shared/util';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpDocumentationSearchConfig } from '../../molecules/erp-documentation-search';
import { ErpDocumentationLayoutConfig } from './erp-documentation-layout.types';

export class ErpDocumentationLayoutBuilder extends ErpBaseBuilder<ErpDocumentationLayoutConfig> {
  public setModuleTitle(value: MaybeSignal<string>): this { this._data.moduleTitle = value; return this; }
  public setArticle(value: MaybeSignal<ErpDocumentationArticle | null>): this { this._data.article = value; return this; }
  public setState(value: MaybeSignal<'loading' | 'ready' | 'empty' | 'error'>): this { this._data.state = value; return this; }
  public setNavigation(value: MaybeSignal<readonly ErpDocumentationNavigationItem[]>): this { this._data.navigation = value; return this; }
  public setActiveArticleId(value: MaybeSignal<string | null>): this { this._data.activeArticleId = value; return this; }
  public setSearch(value: ErpDocumentationSearchConfig): this { this._data.search = value; return this; }
  public setSkipLinkLabel(value: MaybeSignal<Translatable>): this { this._data.skipLinkLabel = value; return this; }
  public setTopicsLabel(value: MaybeSignal<Translatable>): this { this._data.topicsLabel = value; return this; }
  public setOnThisPageLabel(value: MaybeSignal<Translatable>): this { this._data.onThisPageLabel = value; return this; }
  public setMobileNavigationLabel(value: MaybeSignal<Translatable>): this { this._data.mobileNavigationLabel = value; return this; }
  public setCloseMobileNavigationLabel(value: MaybeSignal<Translatable>): this { this._data.closeMobileNavigationLabel = value; return this; }
  public setLoadingMessage(value: MaybeSignal<Translatable>): this { this._data.loadingMessage = value; return this; }
  public setErrorMessage(value: MaybeSignal<Translatable>): this { this._data.errorMessage = value; return this; }
  public setEmptyMessage(value: MaybeSignal<Translatable>): this { this._data.emptyMessage = value; return this; }
  public setPreviousLabel(value: MaybeSignal<Translatable>): this { this._data.previousLabel = value; return this; }
  public setNextLabel(value: MaybeSignal<Translatable>): this { this._data.nextLabel = value; return this; }
  public setOnArticleSelect(value: (articleId: string) => void): this { this._data.onArticleSelect = value; return this; }
  public setOnInternalLink(value: (url: string) => void): this { this._data.onInternalLink = value; return this; }
  public setOnHeadingSelect(value: (headingId: string) => void): this { this._data.onHeadingSelect = value; return this; }
}
