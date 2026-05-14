import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpSelectConfig } from './erp-select.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpSelectBuilder extends ErpBaseBuilder<ErpSelectConfig> {


  public setPlaceholder(placeholder: MaybeSignal<string | undefined>): this {
    this._data.placeholder = placeholder;
    return this;
  }

  public setHint(hint: MaybeSignal<string | undefined>): this {
    this._data.hint = hint;
    return this;
  }

  public setErrorMessages(messages: MaybeSignal<Record<string, string> | undefined>): this {
    this._data.errorMessages = messages;
    return this;
  }

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
