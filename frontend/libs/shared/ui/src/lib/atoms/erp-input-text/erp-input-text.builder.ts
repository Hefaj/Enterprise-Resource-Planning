import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpInputTextConfig } from './erp-input-text.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpInputTextBuilder extends ErpBaseBuilder<ErpInputTextConfig> {


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
