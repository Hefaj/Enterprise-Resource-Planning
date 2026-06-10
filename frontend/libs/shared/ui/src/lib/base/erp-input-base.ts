import { ErpBaseBuilder } from './erp-base-builder';

import { MaybeSignal } from './erp-signal-utils';

export interface ErpInputBase {
  placeholder?: MaybeSignal<string | undefined>;
  hint?: MaybeSignal<string | undefined>;
  errorMessages?: MaybeSignal<Record<string, string> | undefined>;
}

export class ErpInputBaseBuilder<T extends ErpInputBase> extends ErpBaseBuilder<T> {
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
