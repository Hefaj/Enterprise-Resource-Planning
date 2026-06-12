import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpStepItem, ErpStepperConfig } from './erp-stepper.types';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpStepperBuilder extends ErpBaseBuilder<ErpStepperConfig> {
  constructor() {
    super();
  }

  public setItems(items: MaybeSignal<ErpStepItem[]>): this {
    this._data.items = items;
    return this;
  }

  public addStep<T = any>(
    label: MaybeSignal<string>,
    value: MaybeSignal<number>,
    options?: {
      disabled?: MaybeSignal<boolean | undefined>;
      component?: MaybeSignal<Type<T>>;
      config?: MaybeSignal<ErpComponentSignalInputs<T> | any>;
    }
  ): this {
    const step: ErpStepItem = {
      label,
      value,
      disabled: options?.disabled,
      component: options?.component,
      config: options?.config,
    };
    if (!Array.isArray(this._data.items)) {
      this._data.items = [];
    }
    this._data.items.push(step);
    return this;
  }

  public setLinear(linear: MaybeSignal<boolean | undefined>): this {
    this._data.linear = linear;
    return this;
  }

  public setInitialValue(value: MaybeSignal<number | undefined>): this {
    this._data.initialValue = value;
    return this;
  }

  public setOnStepChange(callback: (value: number) => void): this {
    this._data.onStepChange = callback;
    return this;
  }
}
