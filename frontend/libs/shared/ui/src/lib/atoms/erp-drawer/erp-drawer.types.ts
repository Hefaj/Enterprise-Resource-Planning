import { Type } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpDrawerConfig {
  open: MaybeSignal<boolean>;
  title?: MaybeSignal<Translatable>;
  overlay?: MaybeSignal<boolean>;
  direction?: MaybeSignal<'start' | 'end'>;
  component?: Type<any>;
  onClose?: () => void;
}
