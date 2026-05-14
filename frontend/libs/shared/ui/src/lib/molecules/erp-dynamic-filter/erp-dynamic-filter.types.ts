import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

import { MaybeSignal } from '../../base/erp-signal-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ErpDynamicFilterItem<T = any> {
  label: MaybeSignal<string | undefined>;
  component: Type<T>;
  inputs: ErpComponentSignalInputs<T>;
}

export interface ErpDynamicFilterConfig {
  items: MaybeSignal<ErpDynamicFilterItem[]>;
  submitButtonLabel?: MaybeSignal<string | undefined>;
  showSubmitButton?: MaybeSignal<boolean | undefined>;
  onSubmit?: () => void | Promise<void>;
}
