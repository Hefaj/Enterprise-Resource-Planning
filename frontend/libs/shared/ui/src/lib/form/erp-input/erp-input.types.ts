import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

export type ErpInputSize = 's' | 'm' | 'l';
export type ErpInputType = 'text' | 'password';

export interface ErpInputConfig extends ErpInputBase {
  disabled?: MaybeSignal<boolean>;
  iconStart?: MaybeSignal<ErpIcon | undefined>;
  iconEnd?: MaybeSignal<ErpIcon | undefined>;
  size?: MaybeSignal<ErpInputSize>;
  type?: MaybeSignal<ErpInputType>;
  value?: MaybeSignal<string>;
  label?: MaybeSignal<Translatable | undefined>;
  mask?: MaybeSignal<any>;
}
