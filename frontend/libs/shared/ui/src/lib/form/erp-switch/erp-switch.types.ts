import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export type ErpSwitchSize = 's' | 'm';

export interface ErpSwitchConfig extends ErpInputBase {
  label?: MaybeSignal<Translatable | undefined>;
  disabled?: MaybeSignal<boolean>;
  tooltip?: MaybeSignal<Translatable | undefined>;
  value?: MaybeSignal<boolean>;
  size?: MaybeSignal<ErpSwitchSize>;
}
