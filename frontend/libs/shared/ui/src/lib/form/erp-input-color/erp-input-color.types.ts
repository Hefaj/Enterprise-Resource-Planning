import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export type ErpInputColorSize = 's' | 'm' | 'l';

export interface ErpInputColorConfig extends ErpInputBase {
  label?: MaybeSignal<Translatable | undefined>;
  disabled?: MaybeSignal<boolean>;
  tooltip?: MaybeSignal<Translatable | undefined>;
  value?: MaybeSignal<string>;
  size?: MaybeSignal<ErpInputColorSize>;
}
