import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpListFilter } from './erp-list-filter.component';

export class ErpListFilterBuilder extends ErpInputBaseBuilder<ErpListFilter> {
  public setOptions(options: { label: string; value: any }[]): this {
    this._data.options = options;
    return this;
  }

  public setMultiple(multiple: boolean): this {
    this._data.multiple = multiple;
    return this;
  }

  public setVirtualScroll(virtualScroll: boolean, itemSize?: number): this {
    this._data.virtualScroll = virtualScroll;
    this._data.virtualScrollItemSize = itemSize;
    return this;
  }

  public setFilter(filter: boolean): this {
    this._data.filter = filter;
    return this;
  }
}
