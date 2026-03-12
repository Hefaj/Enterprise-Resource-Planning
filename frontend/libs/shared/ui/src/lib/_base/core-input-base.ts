import { CoreBaseBuilder } from './core-base-builder';

export interface CoreInputBase {
  placeholder?: string;
  hint?: string;
  errorMessages?: Record<string, string>;
}

export class CoreInputBaseBuilder<T extends CoreInputBase> extends CoreBaseBuilder<T> {
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
