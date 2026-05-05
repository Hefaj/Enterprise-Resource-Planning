import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTabsConfig, ErpTabItem } from './erp-tabs.component';
import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export class ErpTabsBuilder extends ErpBaseBuilder<ErpTabsConfig> {
  constructor() {
    super();
    this._data.items = [];
  }

  public addItem<TComp>(
    label: string, 
    value: string | number, 
    component?: Type<TComp>, 
    config?: ErpComponentSignalInputs<TComp> | any,
    options: { icon?: string, disabled?: boolean } = {}
  ): this {
    this._data.items?.push({ 
      label, 
      value, 
      icon: options.icon, 
      disabled: options.disabled,
      component,
      config: this._extract(config)
    });
    return this;
  }

  public setInitialValue(value: string | number): this {
    this._data.initialValue = value;
    return this;
  }

  public onTabChange(callback: (value: string | number) => void): this {
    this._data.onTabChange = callback;
    return this;
  }

  public setHeadless(headless = true): this {
    this._data.headless = headless;
    return this;
  }

  public setItems(items: ErpTabItem[]): this {
    this._data.items = items;
    return this;
  }
}
