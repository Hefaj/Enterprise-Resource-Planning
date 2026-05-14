import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export interface ErpPageRegion<TComp = any> {
  component: Type<TComp>;
  config?: ErpComponentSignalInputs<TComp> | any;
}

export interface ErpPageLayoutConfig {
  main?: ErpPageRegion;
  leftSidebar?: ErpPageRegion;
}
