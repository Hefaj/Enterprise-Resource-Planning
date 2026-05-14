import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpTabItem<TComp = any> {
  label: MaybeSignal<string>;
  value: string | number;
  icon?: MaybeSignal<string | undefined>;
  disabled?: MaybeSignal<boolean | undefined>;
  component?: Type<TComp>;
  config?: ErpComponentSignalInputs<TComp> | any;
}

export interface ErpTabsConfig {
  items: ErpTabItem[];
  initialValue?: string | number;
  onTabChange?: (value: string | number) => void;
  headless?: MaybeSignal<boolean | undefined>;
}
