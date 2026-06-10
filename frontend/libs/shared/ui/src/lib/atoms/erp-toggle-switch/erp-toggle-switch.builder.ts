import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpToggleSwitchConfig } from './erp-toggle-switch.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpToggleSwitchBuilder extends ErpBaseBuilder<ErpToggleSwitchConfig> {


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
}
