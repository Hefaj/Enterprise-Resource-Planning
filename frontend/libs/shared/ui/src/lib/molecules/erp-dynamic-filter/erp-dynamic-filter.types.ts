import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ErpDynamicFilterItem<T = any> {
  label: string | undefined;
  component: Type<T>;
  inputs: ErpComponentSignalInputs<T>;
}

export interface ErpDynamicFilterConfig {
  items: ErpDynamicFilterItem[];
  submitButtonLabel?: string;
  showSubmitButton?: boolean;
}
