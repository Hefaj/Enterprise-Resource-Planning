import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpInputTextConfig } from './erp-input-text.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpInputTextBuilder extends ErpInputBaseBuilder<ErpInputTextConfig> {
  public setIcon(icon: MaybeSignal<string | undefined>): this {
    this._data.icon = icon;
    return this;
  }

  public setFluid(fluid: MaybeSignal<boolean | undefined> = true): this {
    this._data.fluid = fluid;
    return this;
  }

  public setSize(size: MaybeSignal<'small' | 'large' | undefined>): this {
    this._data.size = size;
    return this;
  }

  public setVariant(variant: MaybeSignal<'filled' | 'outlined' | undefined>): this {
    this._data.variant = variant;
    return this;
  }
}
