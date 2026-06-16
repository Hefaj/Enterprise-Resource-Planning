import { ErpBaseBuilder } from './erp-base-builder';

import { MaybeSignal, Translatable } from './erp-signal-utils';

export interface ErpInputBase {
  placeholder?: MaybeSignal<Translatable | undefined>;
  hint?: MaybeSignal<Translatable | undefined>;
  errorMessages?: MaybeSignal<Record<string, Translatable> | undefined>;
}

export class ErpInputBaseBuilder<T extends ErpInputBase> extends ErpBaseBuilder<T> {
  public setPlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.placeholder = placeholder;
    return this;
  }

  public setHint(hint: MaybeSignal<Translatable | undefined>): this {
    this._data.hint = hint;
    return this;
  }

  public setErrorMessages(messages: MaybeSignal<Record<string, Translatable> | undefined>): this {
    this._data.errorMessages = messages;
    return this;
  }
}
