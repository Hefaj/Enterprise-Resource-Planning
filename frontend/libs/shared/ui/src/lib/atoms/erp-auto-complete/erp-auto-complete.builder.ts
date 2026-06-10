import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpAutoCompleteConfig } from './erp-auto-complete.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpAutoCompleteBuilder extends ErpBaseBuilder<ErpAutoCompleteConfig> {


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

  public setSuggestions(suggestions: MaybeSignal<any[] | undefined>): this {
    this._data.suggestions = suggestions;
    return this;
  }

  public setOptionLabel(label: MaybeSignal<string | undefined>): this {
    this._data.optionLabel = label;
    return this;
  }

  public setDropdown(dropdown: MaybeSignal<boolean | undefined> = true): this {
    this._data.dropdown = dropdown;
    return this;
  }

  public setMultiple(multiple: MaybeSignal<boolean | undefined> = true): this {
    this._data.multiple = multiple;
    return this;
  }

  public setFluid(fluid: MaybeSignal<boolean | undefined> = true): this {
    this._data.fluid = fluid;
    return this;
  }

  public setForceSelection(forceSelection: MaybeSignal<boolean | undefined> = true): this {
    this._data.forceSelection = forceSelection;
    return this;
  }

  public setItemComponent<T>(component: MaybeSignal<Type<T>>): this {
    this._data.itemComponent = component;
    return this;
  }

  public setHeaderComponent<T>(component: MaybeSignal<Type<T>>): this {
    this._data.headerComponent = component;
    return this;
  }

  public setFooterComponent<T>(component: MaybeSignal<Type<T>>): this {
    this._data.footerComponent = component;
    return this;
  }
}
