import { Type } from '@angular/core';
import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpListbox } from './erp-listbox.component';

export class ErpListboxBuilder extends ErpInputBaseBuilder<ErpListbox> {
  public setOptions(options: any[]): this {
    this._data.options = options;
    return this;
  }

  public setOptionLabel(label: string): this {
    this._data.optionLabel = label;
    return this;
  }

  public setOptionValue(value: string): this {
    this._data.optionValue = value;
    return this;
  }

  public setMultiple(multiple = true): this {
    this._data.multiple = multiple;
    return this;
  }

  public setCheckbox(checkbox = true): this {
    this._data.checkbox = checkbox;
    return this;
  }

  public setFilter(filter = true): this {
    this._data.filter = filter;
    return this;
  }

  public setScrollHeight(height: string): this {
    this._data.scrollHeight = height;
    return this;
  }

  public setItemComponent(component: Type<any>): this {
    this._data.itemComponent = component;
    return this;
  }
}
