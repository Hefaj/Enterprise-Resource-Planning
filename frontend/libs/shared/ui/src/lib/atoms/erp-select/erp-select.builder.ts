import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpSelectConfig } from './erp-select.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpSelectBuilder extends ErpInputBaseBuilder<ErpSelectConfig> {
  public setOptions(options: MaybeSignal<any[] | undefined>): this {
    this._data.options = options;
    return this;
  }

  public setOptionLabel(label: MaybeSignal<string | undefined>): this {
    this._data.optionLabel = label;
    return this;
  }

  public setOptionValue(value: MaybeSignal<string | undefined>): this {
    this._data.optionValue = value;
    return this;
  }

  public setFilter(filter: MaybeSignal<boolean | undefined> = true): this {
    this._data.filter = filter;
    return this;
  }

  public setShowClear(showClear: MaybeSignal<boolean | undefined> = true): this {
    this._data.showClear = showClear;
    return this;
  }

  public setFluid(fluid: MaybeSignal<boolean | undefined> = true): this {
    this._data.fluid = fluid;
    return this;
  }
}
