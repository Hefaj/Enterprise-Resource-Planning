import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpSelect } from './erp-select.component';

export class ErpSelectBuilder extends ErpInputBaseBuilder<ErpSelect> {
  public setOptions(options: { label: string; value: any }[]): this {
    this._data.options = options;
    return this;
  }

  public setOptionLabel(label: string): this {
    this._data.optionLabel = label;
    return this;
  }

  public setOptionValue(value: string): this {
    this._data.optionValue = value;
    return this;
  }

  public setFilter(filter: boolean): this {
    this._data.filter = filter;
    return this;
  }
}
