import { Type } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export interface ErpStepItem<TComp = any> {
  label: MaybeSignal<string>;
  value: MaybeSignal<number>;
  disabled?: MaybeSignal<boolean | undefined>;
  component?: MaybeSignal<Type<TComp>>;
  config?: MaybeSignal<ErpComponentSignalInputs<TComp> | any>;
}

export interface ErpStepperConfig {
  items: MaybeSignal<ErpStepItem[]>;
  linear?: MaybeSignal<boolean | undefined>;
  initialValue?: MaybeSignal<number | undefined>;
  onStepChange?: (value: number) => void;
}
