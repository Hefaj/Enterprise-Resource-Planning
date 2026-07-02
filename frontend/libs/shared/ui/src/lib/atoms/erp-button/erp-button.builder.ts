import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpButtonConfig, ErpButtonAppearance, ErpButtonSize } from './erp-button.types';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

export class ErpButtonBuilder extends ErpBaseBuilder<ErpButtonConfig> {
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  public setAppearance(appearance: MaybeSignal<ErpButtonAppearance | undefined>): this {
    this._data.appearance = appearance;
    return this;
  }

  public setSize(size: MaybeSignal<ErpButtonSize | undefined>): this {
    this._data.size = size;
    return this;
  }

  public setIconStart(iconStart: MaybeSignal<ErpIcon | undefined>): this {
    this._data.iconStart = iconStart;
    return this;
  }

  public setIconEnd(iconEnd: MaybeSignal<ErpIcon | undefined>): this {
    this._data.iconEnd = iconEnd;
    return this;
  }

  public setLoading(loading: MaybeSignal<boolean | undefined>): this {
    this._data.loading = loading;
    return this;
  }

  public setDisabled(disabled: MaybeSignal<boolean | undefined>): this {
    this._data.disabled = disabled;
    return this;
  }

  public setOnClick(onClick: ErpButtonConfig['onClick']): this {
    this._data.onClick = onClick;
    return this;
  }
}
