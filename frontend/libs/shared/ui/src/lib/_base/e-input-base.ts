import { EBaseBuilder } from './e-base-builder';

export interface EInputBase {
  placeholder?: string;
  hint?: string;
  errorMessages?: Record<string, string>;
}

export class EInputBaseBuilder<T extends EInputBase> extends EBaseBuilder<T> {
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
