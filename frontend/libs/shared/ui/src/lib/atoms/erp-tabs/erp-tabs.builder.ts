import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTabItem, ErpTabsConfig } from './erp-tabs.types';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpTabsBuilder extends ErpBaseBuilder<ErpTabsConfig> {
  constructor() {
    super();
  }

  public setItems(items: MaybeSignal<ErpTabItem[]>): this {
    this._data.items = items;
    return this;
  }



  public addTab<T = any>(
    label: MaybeSignal<string>,
    value: MaybeSignal<string | number>,
    options: {
      icon?: MaybeSignal<string | undefined>;
      disabled?: MaybeSignal<boolean | undefined>;
      component?: MaybeSignal<Type<T>>;
      config?: MaybeSignal<ErpComponentSignalInputs<T> | any>;
    }
  ): this {
    const tab: ErpTabItem = {
      label,
      value,
      icon: options?.icon,
      disabled: options?.disabled,
      component: options?.component,
      config: options?.config,
    };
    if (!Array.isArray(this._data.items)) {
      this._data.items = [];
    }
    this._data.items.push(tab);
    return this;
  }

  public setInitialValue(value: MaybeSignal<string | number | undefined>): this {
    this._data.initialValue = value;
    return this;
  }

  public setOnTabChange(callback: (value: string | number) => void): this {
    this._data.onTabChange = callback;
    return this;
  }
}
