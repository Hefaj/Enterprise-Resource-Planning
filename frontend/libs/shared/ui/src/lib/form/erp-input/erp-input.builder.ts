import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpInputConfig, ErpInputSize, ErpInputType } from './erp-input.types';

export class ErpInputBuilder extends ErpInputBaseBuilder<ErpInputConfig> {
  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }

  public setTooltip(tooltip: MaybeSignal<Translatable | undefined>): this {
    this._data.tooltip = tooltip;
    return this;
  }

  public setIconStart(icon: MaybeSignal<ErpIcon | undefined>): this {
    this._data.iconStart = icon;
    return this;
  }

  public setIconEnd(icon: MaybeSignal<ErpIcon | undefined>): this {
    this._data.iconEnd = icon;
    return this;
  }

  public setSize(size: MaybeSignal<ErpInputSize>): this {
    this._data.size = size;
    return this;
  }

  public setError(error: MaybeSignal<Translatable | undefined>): this {
    this._data.error = error;
    return this;
  }

  public setClearable(clearable: MaybeSignal<boolean>): this {
    this._data.clearable = clearable;
    return this;
  }

  public setType(type: MaybeSignal<ErpInputType>): this {
    this._data.type = type;
    return this;
  }

  public setValue(value: MaybeSignal<string>): this {
    this._data.value = value;
    return this;
  }
}
