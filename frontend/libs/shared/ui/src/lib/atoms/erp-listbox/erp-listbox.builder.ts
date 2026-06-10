import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpListboxConfig } from './erp-listbox.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpListboxBuilder extends ErpBaseBuilder<ErpListboxConfig> {


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

  public setOptions(options: MaybeSignal<any[] | undefined>): this {
    this._data.options = options;
    return this;
  }

  public setOptionLabel(label: MaybeSignal<string | undefined>): this {
    this._data.optionLabel = label;
    return this;
  }

  public setOptionValue(value: MaybeSignal<string | undefined>): this {
    this._data.optionValue = value;
    return this;
  }

  public setMultiple(multiple: MaybeSignal<boolean | undefined> = true): this {
    this._data.multiple = multiple;
    return this;
  }

  public setCheckbox(checkbox: MaybeSignal<boolean | undefined> = true): this {
    this._data.checkbox = checkbox;
    return this;
  }

  public setFilter(filter: MaybeSignal<boolean | undefined> = true): this {
    this._data.filter = filter;
    return this;
  }

  public setScrollHeight(height: MaybeSignal<string | undefined>): this {
    this._data.scrollHeight = height;
    return this;
  }

  public setItemComponent<T>(component: MaybeSignal<Type<T>>): this {
    this._data.itemComponent = component;
    return this;
  }
}
