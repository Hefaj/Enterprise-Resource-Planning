import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpMultiSelect } from './erp-multi-select.component';

export class ErpMultiSelectBuilder extends ErpInputBaseBuilder<ErpMultiSelect> {
  public setOptions(options: any[]): this {
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

  public setFilter(filter = true): this {
    this._data.filter = filter;
    return this;
  }

  public setDisplay(display: 'comma' | 'chip'): this {
    this._data.display = display;
    return this;
  }

  public setShowHeader(showHeader = true): this {
    this._data.showHeader = showHeader;
    return this;
  }

  public setFluid(fluid = true): this {
    this._data.fluid = fluid;
    return this;
  }
}
