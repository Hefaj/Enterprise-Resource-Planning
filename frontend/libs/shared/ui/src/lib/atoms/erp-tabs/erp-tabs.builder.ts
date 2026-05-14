import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTabItem, ErpTabsConfig } from './erp-tabs.types';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpTabsBuilder extends ErpBaseBuilder<ErpTabsConfig> {
  constructor() {
    super();
    this._data.items = [];
  }



  public addTab<T = any>(
    label: MaybeSignal<string>,
    value: string | number,
    options?: {
      icon?: MaybeSignal<string | undefined>;
      disabled?: MaybeSignal<boolean | undefined>;
      component?: Type<T>;
      config?: ErpComponentSignalInputs<T> | any;
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
    this._data.items!.push(tab);
    return this;
  }

  public setInitialValue(value: string | number): this {
    this._data.initialValue = value;
    return this;
  }

  public setOnTabChange(callback: (value: string | number) => void): this {
    this._data.onTabChange = callback;
    return this;
  }

  public setHeadless(headless: MaybeSignal<boolean | undefined> = true): this {
    this._data.headless = headless;
    return this;
  }
}
