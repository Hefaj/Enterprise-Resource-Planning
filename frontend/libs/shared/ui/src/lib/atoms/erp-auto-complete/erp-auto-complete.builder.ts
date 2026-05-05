import { Type } from '@angular/core';
import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpAutoComplete } from './erp-auto-complete.component';

export class ErpAutoCompleteBuilder extends ErpInputBaseBuilder<ErpAutoComplete> {
  public setSuggestions(suggestions: any[]): this {
    this._data.suggestions = suggestions;
    return this;
  }

  public setOptionLabel(label: string): this {
    this._data.optionLabel = label;
    return this;
  }

  public setDropdown(dropdown = true): this {
    this._data.dropdown = dropdown;
    return this;
  }

  public setMultiple(multiple = true): this {
    this._data.multiple = multiple;
    return this;
  }

  public setFluid(fluid = true): this {
    this._data.fluid = fluid;
    return this;
  }

  public setForceSelection(forceSelection = true): this {
    this._data.forceSelection = forceSelection;
    return this;
  }

  public setItemComponent(component: Type<any>): this {
    this._data.itemComponent = component;
    return this;
  }

  public setHeaderComponent(component: Type<any>): this {
    this._data.headerComponent = component;
    return this;
  }

  public setFooterComponent(component: Type<any>): this {
    this._data.footerComponent = component;
    return this;
  }
}
