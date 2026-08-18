import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpSelectionScope } from '../erp-table/erp-selection.utils';
import { ErpSelectionScopeBannerConfig } from './erp-selection-scope-banner.types';

export class ErpSelectionScopeBannerBuilder extends ErpBaseBuilder<ErpSelectionScopeBannerConfig> {
  public setScope(scope: MaybeSignal<ErpSelectionScope<any, any>>): this {
    this._data.scope = scope;
    return this;
  }

  public setShownCount(count: MaybeSignal<number>): this {
    this._data.shownCount = count;
    return this;
  }

  public setPreviewTitle(title: MaybeSignal<Translatable>): this {
    this._data.previewTitle = title;
    return this;
  }

  public setPreviewDescription(description: MaybeSignal<Translatable>): this {
    this._data.previewDescription = description;
    return this;
  }

  public setAllTitle(title: MaybeSignal<Translatable>): this {
    this._data.allTitle = title;
    return this;
  }

  public setShowMaterialized(show: MaybeSignal<boolean>): this {
    this._data.showMaterialized = show;
    return this;
  }
}
