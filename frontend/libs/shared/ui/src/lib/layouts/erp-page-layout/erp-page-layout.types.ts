import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpPageRegion<TComp = any> {
  component: MaybeSignal<Type<TComp>>;
  config?: ErpComponentSignalInputs<TComp> | any;
}

export interface ErpPageLayoutConfig {
  main?: ErpPageRegion;
  leftSidebar?: ErpPageRegion;
}
