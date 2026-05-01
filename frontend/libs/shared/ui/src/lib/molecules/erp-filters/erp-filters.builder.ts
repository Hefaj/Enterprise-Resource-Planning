import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpFiltersConfig, ErpFilterItem, ErpFilterType } from './erp-filters.types';

export class ErpFiltersBuilder extends ErpBaseBuilder<ErpFiltersConfig> {
  constructor() {
    super();
    this._data.items = [];
  }

  public addItem(item: ErpFilterItem): this {
    this._data.items?.push(item);
    return this;
  }

  public addFilter(id: string, label: string, type: ErpFilterType, config: any, initialValue?: any): this {
    this._data.items?.push({ id, label, type, config, initialValue });
    return this;
  }

  public setSubmitButtonLabel(label: string): this {
    this._data.submitButtonLabel = label;
    return this;
  }

  public setShowSubmitButton(show: boolean): this {
    this._data.showSubmitButton = show;
    return this;
  }
}
