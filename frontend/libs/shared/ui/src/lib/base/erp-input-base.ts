import { ErpBaseBuilder } from './erp-base-builder';

export interface ErpInputBase {
  placeholder?: string;
  hint?: string;
  errorMessages?: Record<string, string>;
}

export class ErpInputBaseBuilder<T extends ErpInputBase> extends ErpBaseBuilder<T> {
  public setPlaceholser(placeholder: string): this {
    this._data.placeholder = placeholder;
    return this;
  }

  public setHint(hint: string): this {
    this._data.hint = hint;
    return this;
  }

  public setErrorMessages(messages: Record<string, string>): this {
    this._data.errorMessages = messages;
    return this;
  }
}
