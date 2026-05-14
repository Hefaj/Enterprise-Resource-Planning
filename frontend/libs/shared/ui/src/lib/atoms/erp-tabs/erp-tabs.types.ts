import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpTabItem<TComp = any> {
  label: MaybeSignal<string>;
  value: MaybeSignal<string | number>;
  icon?: MaybeSignal<string | undefined>;
  disabled?: MaybeSignal<boolean | undefined>;
  component?: MaybeSignal<Type<TComp>>;
  config?: ErpComponentSignalInputs<TComp> | any;
}

export interface ErpTabsConfig {
  items: MaybeSignal<ErpTabItem[]>;
  initialValue?: MaybeSignal<string | number | undefined>;
  onTabChange?: (value: string | number) => void;
}
