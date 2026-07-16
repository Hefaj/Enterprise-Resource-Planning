import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export type ErpDatePickerStrategy = 'single' | 'multiple' | 'range';
export type ErpDatePickerMode = 'date' | 'datetime';

export interface ErpDatePickerConfig extends ErpInputBase {
  label?: MaybeSignal<Translatable | undefined>;
  size?: MaybeSignal<'s' | 'm' | 'l'>;
  strategy?: MaybeSignal<ErpDatePickerStrategy>;
  mode?: MaybeSignal<ErpDatePickerMode>;
  value?: MaybeSignal<any>;
}
