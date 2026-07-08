import { Type } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export interface ErpDrawerConfig<TComponent = any> {
  open: MaybeSignal<boolean>;
  title?: MaybeSignal<Translatable>;
  overlay?: MaybeSignal<boolean>;
  direction?: MaybeSignal<'start' | 'end'>;
  component?: Type<TComponent>;
  inputs?: ErpComponentSignalInputs<TComponent>;
  onClose?: () => void;
}
