import { Type } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpPopoverConfig {
  component?: MaybeSignal<Type<any>>;
  componentInputs?: MaybeSignal<Record<string, any>>;
  appendTo?: MaybeSignal<any | string>;
  styleClass?: MaybeSignal<string>;
  motionOptions?: MaybeSignal<any>;
  dismissable?: MaybeSignal<boolean>;
}
