import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpCheckboxConfig, ErpCheckboxSize } from './erp-checkbox.types';

export class ErpCheckboxBuilder extends ErpInputBaseBuilder<ErpCheckboxConfig> {
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }

  public setTooltip(tooltip: MaybeSignal<Translatable | undefined>): this {
    this._data.tooltip = tooltip;
    return this;
  }

  public setValue(value: MaybeSignal<boolean>): this {
    this._data.value = value;
    return this;
  }

  public setSize(size: MaybeSignal<ErpCheckboxSize>): this {
    this._data.size = size;
    return this;
  }
}
