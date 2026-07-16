import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export type ErpCheckboxSize = 's' | 'm';

export interface ErpCheckboxConfig extends ErpInputBase {
  label?: MaybeSignal<Translatable | undefined>;
  disabled?: MaybeSignal<boolean>;
  value?: MaybeSignal<boolean>;
  size?: MaybeSignal<ErpCheckboxSize>;
}
